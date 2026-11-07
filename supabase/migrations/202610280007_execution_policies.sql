create or replace function public.save_assessment_settings(p_org uuid,p_version uuid,p_revision integer,p_input jsonb) returns void language plpgsql security definer set search_path='' as $$
declare v public.assessment_versions;
begin
 perform 1 from public.organizations where id=p_org for update;
 if not private.can_edit_assessment_version(p_org,p_version) then raise exception 'Not permitted' using errcode='42501';end if;
 select * into v from public.assessment_versions where id=p_version and organization_id=p_org for update;
 if v.status<>'draft' then raise exception 'Create a new version before editing a published assessment';end if;
 if p_revision is null or p_revision<>v.revision then raise exception 'Record changed. Reload and try again.' using errcode='40001';end if;
 if p_input is null or jsonb_typeof(p_input)<>'object' or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('duration_minutes','passing_percentage','max_attempts','deadline','summary','retake_policy','retake_delay_minutes','appeals_enabled','appeal_window_hours','invitation_window_hours')) then raise exception 'Invalid assessment settings';end if;
 update public.assessment_versions set duration_minutes=(p_input->>'duration_minutes')::integer,passing_percentage=(p_input->>'passing_percentage')::numeric,max_attempts=(p_input->>'max_attempts')::integer,deadline=nullif(p_input->>'deadline','')::timestamptz,summary=coalesce(p_input->>'summary',''),
 retake_policy=coalesce(p_input->>'retake_policy',v.retake_policy),retake_delay_minutes=coalesce((p_input->>'retake_delay_minutes')::integer,v.retake_delay_minutes),appeals_enabled=coalesce((p_input->>'appeals_enabled')::boolean,v.appeals_enabled),appeal_window_hours=coalesce((p_input->>'appeal_window_hours')::integer,v.appeal_window_hours),invitation_window_hours=coalesce((p_input->>'invitation_window_hours')::integer,v.invitation_window_hours),revision=revision+1 where id=v.id;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(p_org,private.active_actor(),'assessment.settings.saved',v.id);
end; $$;
create or replace function public.revise_assessment(p_org uuid,p_version uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare base public.assessment_versions;result uuid;number integer;
begin
 perform 1 from public.organizations where id=p_org for update;
 if not private.can_edit_assessment_version(p_org,p_version) then raise exception 'Not permitted' using errcode='42501';end if;
 select * into base from public.assessment_versions where id=p_version and organization_id=p_org;
 if base.status<>'published' then raise exception 'Only published assessments can be revised';end if;
 if exists(select 1 from public.assessment_versions where assessment_id=base.assessment_id and status='draft') then raise exception 'A draft version already exists';end if;
 select max(version_number)+1 into number from public.assessment_versions where assessment_id=base.assessment_id;
 insert into public.assessment_versions(organization_id,assessment_id,version_number,status,summary,duration_minutes,passing_percentage,max_attempts,deadline,retake_policy,retake_delay_minutes,appeals_enabled,appeal_window_hours,invitation_window_hours)
 values(p_org,base.assessment_id,number,'draft',base.summary,base.duration_minutes,base.passing_percentage,base.max_attempts,base.deadline,base.retake_policy,base.retake_delay_minutes,base.appeals_enabled,base.appeal_window_hours,base.invitation_window_hours) returning id into result;
 insert into public.assessment_version_questions(organization_id,version_id,question_id,max_points,position) select p_org,result,question_id,max_points,position from public.assessment_version_questions where version_id=base.id;
 insert into public.assessment_pool_rules(organization_id,version_id,pool_id,draw_count,max_points) select p_org,result,pool_id,draw_count,max_points from public.assessment_pool_rules where version_id=base.id;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(p_org,private.active_actor(),'assessment.version.created',result);
 return result;
end; $$;
create or replace function public.transition_application(p_org uuid,p_application uuid,p_expected_version integer,p_status text,p_message text default '') returns void language plpgsql security definer set search_path='' as $$
declare app public.applications;
begin
 perform 1 from public.organizations where id=p_org for update;
 if not private.can_review_application(p_org,p_application) then raise exception 'Not permitted' using errcode='42501';end if;
 select * into app from public.applications where organization_id=p_org and id=p_application for update;
 if p_expected_version is null or app.version<>p_expected_version then raise exception 'Record changed. Reload and try again.' using errcode='40001';end if;
 if p_status is null or not (
 (app.status='submitted' and p_status in ('screening','assessment','interview','rejected')) or
 (app.status='screening' and p_status in ('assessment','interview','offer','rejected')) or
 (app.status='assessment' and p_status in ('screening','interview','rejected')) or
 (app.status='shortlisted' and p_status in ('interview','offer','rejected')) or
 (app.status='interview' and p_status in ('offer','rejected')) or
 (app.status='offer' and p_status in ('hired','rejected'))) then raise exception 'Invalid application transition';end if;
 if p_message is null or length(p_message)>2000 then raise exception 'Invalid status message';end if;
 perform set_config('app.status_message',p_message,true);
 update public.applications set status=p_status,shortlist_source_attempt_id=null,version=version+1 where id=app.id;
end; $$;
-- Existing closed preview attempts did not collect answers. Hold them for review
-- rather than treating missing historical responses as an automatic failure.
create function private.hold_legacy_attempt() returns trigger language plpgsql security definer set search_path='' as $$
declare t public.assessment_attempts;
begin
 select * into t from public.assessment_attempts where id=new.attempt_id;
 if t.closed_at is null then insert into private.assessment_integrity_flags(organization_id,attempt_id,application_id,kind,reason) values(t.organization_id,t.id,t.application_id,'grading_error','Attempt predates the assessment execution release and requires review');end if;
 return new;
end; $$;
create trigger hold_legacy_attempt before insert on private.objective_grade_runs for each row execute function private.hold_legacy_attempt();
revoke all on function private.hold_legacy_attempt() from public,anon,authenticated;

create or replace function private.cancel_withdrawn_attempts() returns trigger language plpgsql security definer set search_path='' as $$
begin if new.status in ('withdrawn','rejected','hired') then update public.assessment_attempts set state='cancelled' where application_id=new.id and state='in_progress';end if;return new;end; $$;
drop policy attempt_questions_candidate on public.assessment_attempt_questions;
create policy attempt_questions_candidate on public.assessment_attempt_questions for select to authenticated using(exists(select 1 from public.assessment_attempts t join public.applications a on a.id=t.application_id where t.id=attempt_id and t.organization_id=assessment_attempt_questions.organization_id and t.candidate_id=private.active_actor() and t.state='in_progress' and t.deadline_at>clock_timestamp() and a.status not in ('withdrawn','rejected','hired')));
