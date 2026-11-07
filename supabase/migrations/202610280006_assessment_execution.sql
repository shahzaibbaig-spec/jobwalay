-- Policy settings are immutable once published and copied into each attempt.
alter table public.assessment_versions add column retake_policy text not null default 'automatic' check(retake_policy in ('none','automatic','approval'));
alter table public.assessment_versions add column retake_delay_minutes integer not null default 0 check(retake_delay_minutes between 0 and 10080);
alter table public.assessment_versions add column appeals_enabled boolean not null default true;
alter table public.assessment_versions add column appeal_window_hours integer not null default 72 check(appeal_window_hours between 1 and 168);
alter table public.assessment_versions add column invitation_window_hours integer not null default 168 check(invitation_window_hours between 1 and 720);
alter table public.assessment_attempts add column closed_at timestamptz;
alter table public.assessment_attempts add column closure_reason text check(closure_reason in ('submission','expiry','withdrawal','application_closed'));
alter table public.assessment_attempts add unique(organization_id,id,application_id);
alter table public.assessment_attempt_questions add unique(organization_id,attempt_id,id);
alter table public.applications drop constraint applications_status_check;
alter table public.applications add check(status in ('submitted','screening','assessment','shortlisted','interview','offer','hired','rejected','withdrawn'));
alter table public.applications add column shortlist_source_attempt_id uuid;
alter table public.applications add foreign key(organization_id,shortlist_source_attempt_id) references public.assessment_attempts(organization_id,id);

create table public.assessment_invitations (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,application_id uuid not null,candidate_id uuid not null,version_id uuid not null,
 state text not null default 'issued' check(state in ('issued','revoked')),issued_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,
 approved_through integer not null default 1 check(approved_through between 1 and 10),unique(application_id,version_id),unique(organization_id,id),
 foreign key(organization_id,application_id,candidate_id) references public.applications(organization_id,id,candidate_id),foreign key(organization_id,version_id) references public.assessment_versions(organization_id,id)
);
create table public.assessment_responses (
 organization_id uuid not null,attempt_id uuid not null,question_id uuid not null,answer jsonb not null,
 revision integer not null check(revision>0),saved_at timestamptz not null default clock_timestamp(),primary key(attempt_id,question_id),
 foreign key(organization_id,attempt_id,question_id) references public.assessment_attempt_questions(organization_id,attempt_id,id)
);
create table private.objective_grade_runs (
 attempt_id uuid primary key,organization_id uuid not null,grader_version text not null,response_fingerprint text not null,
 objective_points numeric(12,2) not null,max_points numeric(12,2) not null,created_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,attempt_id) references public.assessment_attempts(organization_id,id)
);
create table private.objective_question_scores (
 attempt_id uuid not null,question_id uuid primary key,organization_id uuid not null,awarded_points numeric(8,2),review_required boolean not null default false,
 grading_error boolean not null default false,foreign key(organization_id,attempt_id,question_id) references public.assessment_attempt_questions(organization_id,attempt_id,id)
);
create table private.manual_question_reviews (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,attempt_id uuid not null,question_id uuid not null,revision integer not null,
 points numeric(8,2) not null check(points>=0),rationale text not null check(length(trim(rationale)) between 5 and 2000),reviewed_by uuid not null references public.accounts(id),
 created_at timestamptz not null default clock_timestamp(),unique(question_id,revision),
 foreign key(organization_id,attempt_id,question_id) references public.assessment_attempt_questions(organization_id,attempt_id,id)
);
create table private.assessment_integrity_flags (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,attempt_id uuid not null,application_id uuid not null,
 kind text not null check(kind in ('candidate_report','employer_report','author_conflict','grading_error')),
 reason text not null check(length(trim(reason)) between 5 and 2000),resolution text not null default 'pending' check(resolution in ('pending','cleared','confirmed')),
 created_at timestamptz not null default clock_timestamp(),unique(organization_id,id),foreign key(organization_id,attempt_id,application_id) references public.assessment_attempts(organization_id,id,application_id)
);
create index integrity_application on private.assessment_integrity_flags(application_id,resolution);
create table private.integrity_reviews (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,flag_id uuid not null,reviewed_by uuid not null references public.accounts(id),
 resolution text not null check(resolution in ('cleared','confirmed')),reason text not null check(length(trim(reason)) between 5 and 2000),created_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,flag_id) references private.assessment_integrity_flags(organization_id,id)
);
create table public.assessment_appeals (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,attempt_id uuid not null unique,application_id uuid not null,candidate_id uuid not null,
 reason text not null check(length(trim(reason)) between 5 and 2000),decision text not null default 'pending' check(decision in ('pending','upheld','reviewed','retake_approved')),
 resolution_message text check(length(trim(resolution_message)) between 5 and 2000),created_at timestamptz not null default clock_timestamp(),resolved_at timestamptz,
 foreign key(organization_id,attempt_id,application_id) references public.assessment_attempts(organization_id,id,application_id),
 foreign key(organization_id,application_id,candidate_id) references public.applications(organization_id,id,candidate_id)
);
create table public.assessment_results (
 attempt_id uuid primary key,organization_id uuid not null,application_id uuid not null,candidate_id uuid not null,
 objective_points numeric(12,2) not null,earned_points numeric(12,2) not null,max_points numeric(12,2) not null,
 total_score numeric(12,2),percentage numeric(7,2),passing_percentage numeric(5,2) not null,
 outcome text not null check(outcome in ('passed','failed','manual_review','integrity_review','appeal_review')),
 pending_written integer not null,integrity_holds integer not null,open_appeals integer not null,result_revision integer not null,fingerprint text not null,
 updated_at timestamptz not null default clock_timestamp(),foreign key(organization_id,attempt_id,application_id) references public.assessment_attempts(organization_id,id,application_id),
 foreign key(organization_id,application_id,candidate_id) references public.applications(organization_id,id,candidate_id)
);
create table public.assessment_result_history (
 attempt_id uuid not null,organization_id uuid not null,application_id uuid not null,result_revision integer not null,
 total_score numeric(12,2),percentage numeric(7,2),outcome text not null,occurred_at timestamptz not null default clock_timestamp(),primary key(attempt_id,result_revision),
 foreign key(organization_id,attempt_id,application_id) references public.assessment_attempts(organization_id,id,application_id)
);
create table public.user_notifications (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.accounts(id),organization_id uuid,application_id uuid,
 audience text not null check(audience in ('candidate','employer')),kind text not null,event_key text not null,
 created_at timestamptz not null default clock_timestamp(),read_at timestamptz,unique(user_id,event_key),
 foreign key(organization_id,application_id) references public.applications(organization_id,id)
);
create index notification_owner on public.user_notifications(user_id,created_at desc);
create table private.assessment_engine_errors (
 attempt_id uuid primary key,organization_id uuid not null,code text not null,last_seen_at timestamptz not null default clock_timestamp(),failures integer not null default 1,
 foreign key(organization_id,attempt_id) references public.assessment_attempts(organization_id,id)
);
create function private.notify_assessment(p_application uuid,p_kind text,p_event text,p_employer boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare app public.applications;
begin
 select * into app from public.applications where id=p_application;
 if app.id is null then return;end if;
 if not p_employer then
  insert into public.user_notifications(user_id,organization_id,application_id,audience,kind,event_key) values(app.candidate_id,app.organization_id,app.id,'candidate',p_kind,p_event) on conflict do nothing;
 else
  insert into public.user_notifications(user_id,organization_id,application_id,audience,kind,event_key)
  select m.user_id,app.organization_id,app.id,'employer',p_kind,p_event from public.memberships m join public.accounts a on a.id=m.user_id
  where m.organization_id=app.organization_id and m.status='active' and a.status='active' and m.user_id<>app.candidate_id and
  (m.role in ('owner','admin') or exists(select 1 from public.job_members jm where jm.membership_id=m.id and jm.job_id=app.job_id)) on conflict do nothing;
 end if;
end; $$;
-- RLS and execution grants are declared after the engine functions below.
create function private.issue_assessment_invitation(p_application uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare app public.applications;v public.assessment_versions;inv uuid;
begin
 select * into app from public.applications where id=p_application;
 select * into v from public.assessment_versions where id=app.assessment_version_id and organization_id=app.organization_id and status='published' and builder_ready;
 if v.id is null or app.status in ('withdrawn','rejected','hired') or (v.deadline is not null and v.deadline<=clock_timestamp()) then return null;end if;
 insert into public.assessment_invitations(organization_id,application_id,candidate_id,version_id,expires_at)
 values(app.organization_id,app.id,app.candidate_id,v.id,least(clock_timestamp()+make_interval(hours=>v.invitation_window_hours),coalesce(v.deadline,'infinity'::timestamptz))) on conflict(application_id,version_id) do nothing returning id into inv;
 if inv is null then select id into inv from public.assessment_invitations where application_id=app.id and version_id=v.id;
 else perform private.notify_assessment(app.id,'assessment_invitation','invitation:'||inv::text);end if;
 return inv;
end; $$;
create function private.invite_after_application() returns trigger language plpgsql security definer set search_path='' as $$
begin perform private.issue_assessment_invitation(new.id);return new;end; $$;
create trigger invite_eligible_application after insert on public.applications for each row execute function private.invite_after_application();
-- Backfill eligible existing applications without fabricating an attempt.
do $$ declare app record;begin for app in select id from public.applications where assessment_version_id is not null loop perform private.issue_assessment_invitation(app.id);end loop;end $$;

alter function public.start_assessment_attempt(uuid) set schema private;
alter function private.start_assessment_attempt(uuid) rename to snapshot_assessment_attempt;
revoke all on function private.snapshot_assessment_attempt(uuid) from public,anon,authenticated;
create function private.freeze_execution_policy() returns trigger language plpgsql security definer set search_path='' as $$
declare v public.assessment_versions;
begin
 select * into v from public.assessment_versions where id=new.version_id;
 new.settings_snapshot:=new.settings_snapshot||jsonb_build_object('retake_policy',v.retake_policy,'retake_delay_minutes',v.retake_delay_minutes,'appeals_enabled',v.appeals_enabled,'appeal_window_hours',v.appeal_window_hours);
 return new;
end; $$;
create trigger freeze_execution_policy before insert on public.assessment_attempts for each row execute function private.freeze_execution_policy();
create or replace function private.protect_attempt_settings() returns trigger language plpgsql set search_path='' as $$
begin
 if (to_jsonb(new)-array['state','closed_at','closure_reason'])<>(to_jsonb(old)-array['state','closed_at','closure_reason']) then raise exception 'Attempt settings are immutable';end if;
 if old.state<>'in_progress' and (new.state<>old.state or new.closed_at is distinct from old.closed_at or new.closure_reason is distinct from old.closure_reason) then raise exception 'Closed attempts are immutable';end if;
 if old.state='in_progress' and new.state<>old.state then
  new.closed_at:=clock_timestamp();new.closure_reason:=case when new.state='expired' then 'expiry' when new.state='cancelled' then case when exists(select 1 from public.applications where id=new.application_id and status='withdrawn') then 'withdrawal' else 'application_closed' end else 'submission' end;
 elsif new.closed_at is distinct from old.closed_at or new.closure_reason is distinct from old.closure_reason then raise exception 'Attempt closure is server controlled';end if;
 return new;
end; $$;

create function private.lock_engine_attempt(p_attempt uuid) returns public.assessment_attempts language plpgsql security definer set search_path='' as $$
declare t public.assessment_attempts;
begin
 select * into t from public.assessment_attempts where id=p_attempt;
 if t.id is null then raise exception 'Attempt unavailable' using errcode='42501';end if;
 perform 1 from public.organizations where id=t.organization_id for update;
 perform 1 from public.applications where id=t.application_id for update;
 select * into t from public.assessment_attempts where id=p_attempt for update;
 return t;
end; $$;
create function private.refresh_assessment_result(p_attempt uuid) returns void language plpgsql security definer set search_path='' as $$
declare t public.assessment_attempts;app public.applications;run private.objective_grade_runs;previous public.assessment_results;
 earned numeric:=0;pending integer:=0;holds integer:=0;appeals integer:=0;total numeric;percent numeric;threshold numeric;outcome text;signature text;revision integer;manual_revision integer;latest uuid;
begin
 select * into t from public.assessment_attempts where id=p_attempt;
 select * into run from private.objective_grade_runs where attempt_id=t.id;
 if run.attempt_id is null then return;end if;
 select * into app from public.applications where id=t.application_id;
 select coalesce(sum(coalesce(m.points,s.awarded_points,0)),0),count(*) filter(where s.review_required and m.id is null)
 into earned,pending from private.objective_question_scores s left join lateral(select r.id,r.points from private.manual_question_reviews r where r.question_id=s.question_id order by r.revision desc limit 1) m on true where s.attempt_id=t.id;
 select count(*) into holds from private.assessment_integrity_flags where application_id=app.id and resolution<>'cleared';
 select count(*) into appeals from public.assessment_appeals where application_id=app.id and decision='pending';
 select count(*) into manual_revision from private.manual_question_reviews where attempt_id=t.id;
 threshold:=(t.settings_snapshot->>'passing_percentage')::numeric;
 if pending=0 and not exists(select 1 from private.objective_question_scores where attempt_id=t.id and grading_error) then total:=earned;if run.max_points>0 then percent:=round(total*100/run.max_points,2);end if;end if;
 outcome:=case when appeals>0 then 'appeal_review' when holds>0 or run.max_points<=0 or exists(select 1 from private.objective_question_scores where attempt_id=t.id and grading_error) then 'integrity_review' when pending>0 then 'manual_review' when total*100>=run.max_points*threshold then 'passed' else 'failed' end;
 signature:=md5(jsonb_build_object('points',earned,'total',total,'outcome',outcome,'manual',manual_revision,'pending',pending,'flags',holds,'appeals',appeals)::text);
 select * into previous from public.assessment_results where attempt_id=t.id;
 if previous.attempt_id is not null and previous.fingerprint=signature then return;end if;
 revision:=coalesce(previous.result_revision,0)+1;
 insert into public.assessment_results(attempt_id,organization_id,application_id,candidate_id,objective_points,earned_points,max_points,total_score,percentage,passing_percentage,outcome,pending_written,integrity_holds,open_appeals,result_revision,fingerprint)
 values(t.id,t.organization_id,app.id,t.candidate_id,run.objective_points,earned,run.max_points,total,percent,threshold,outcome,pending,holds,appeals,revision,signature)
 on conflict(attempt_id) do update set earned_points=excluded.earned_points,total_score=excluded.total_score,percentage=excluded.percentage,outcome=excluded.outcome,pending_written=excluded.pending_written,integrity_holds=excluded.integrity_holds,open_appeals=excluded.open_appeals,result_revision=excluded.result_revision,fingerprint=excluded.fingerprint,updated_at=clock_timestamp();
 insert into public.assessment_result_history values(t.id,t.organization_id,app.id,revision,total,percent,outcome,clock_timestamp());
 select id into latest from public.assessment_attempts where application_id=app.id order by attempt_number desc limit 1;
 if latest=t.id then
  if outcome='passed' and app.status in ('submitted','screening','assessment') and exists(select 1 from public.organizations where id=app.organization_id and status='active') and exists(select 1 from public.accounts where id=app.candidate_id and status='active') then
   perform set_config('app.status_message','Assessment passed; automatically shortlisted',true);
   update public.applications set status='shortlisted',shortlist_source_attempt_id=t.id,version=version+1 where id=app.id;
  elsif outcome<>'passed' and app.status='shortlisted' and app.shortlist_source_attempt_id=t.id then
   perform set_config('app.status_message','Assessment requires review; automatic shortlist paused',true);
   update public.applications set status='assessment',shortlist_source_attempt_id=null,version=version+1 where id=app.id;
  end if;
 end if;
 perform private.notify_assessment(app.id,'assessment_result','result:'||t.id::text||':'||revision::text);
 if outcome in ('manual_review','integrity_review','appeal_review') then perform private.notify_assessment(app.id,'assessment_review','review:'||t.id::text||':'||revision::text,true);end if;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(t.organization_id,null,'assessment.result.updated',t.id);
end; $$;

create function private.grade_closed_attempt(p_attempt uuid) returns void language plpgsql security definer set search_path='' as $$
declare t public.assessment_attempts;q record;answer jsonb;points numeric;needs_review boolean;bad boolean;total numeric:=0;maximum numeric:=0;fingerprint text;selected text[];correct text[];
begin
 select * into t from public.assessment_attempts where id=p_attempt;
 if t.state not in ('submitted','expired') then return;end if;
 if exists(select 1 from private.objective_grade_runs where attempt_id=t.id) then perform private.refresh_assessment_result(t.id);return;end if;
 for q in select a.*,k.key from public.assessment_attempt_questions a left join private.attempt_answer_keys k on k.attempt_question_id=a.id where a.attempt_id=t.id order by a.position loop
  select r.answer into answer from public.assessment_responses r where r.attempt_id=t.id and r.question_id=q.id;
  points:=0;needs_review:=false;bad:=false;maximum:=maximum+q.max_points;
  if q.key is null then bad:=true;points:=null;
  elsif q.kind in ('single_choice','multiple_select') and q.key->>'grader_version'='exact-set-v1' then
   select array_agg(x order by x) into selected from jsonb_array_elements_text(coalesce(answer->'selected_ids','[]'::jsonb)) x;
   select array_agg(x order by x) into correct from jsonb_array_elements_text(q.key->'correct_ids') x;
   if selected=correct then points:=q.max_points;end if;
  elsif q.kind='numerical' and q.key->>'grader_version'='absolute-tolerance-v1' then
   if answer->>'value' is not null and abs((answer->>'value')::numeric-(q.key->>'value')::numeric)<=(q.key->>'tolerance')::numeric then points:=q.max_points;end if;
  elsif q.kind='written' and q.key->>'grader_version'='manual-review-v1' then
   if length(trim(coalesce(answer->>'text','')))>0 then points:=null;needs_review:=true;end if;
  else bad:=true;points:=null;end if;
  if bad then insert into private.assessment_integrity_flags(organization_id,attempt_id,application_id,kind,reason) values(t.organization_id,t.id,t.application_id,'grading_error','A frozen grading contract requires operator review');end if;
  insert into private.objective_question_scores values(t.id,q.id,t.organization_id,points,needs_review,bad);
  total:=total+coalesce(points,0);
 end loop;
 if maximum<=0 then insert into private.assessment_integrity_flags(organization_id,attempt_id,application_id,kind,reason) values(t.organization_id,t.id,t.application_id,'grading_error','No gradable frozen questions were found');end if;
 select md5(coalesce(jsonb_agg(jsonb_build_object('question',r.question_id,'answer',r.answer) order by r.question_id)::text,'[]')) into fingerprint from public.assessment_responses r where r.attempt_id=t.id;
 insert into private.objective_grade_runs values(t.id,t.organization_id,'objective-v1',fingerprint,total,maximum,clock_timestamp());
 perform private.refresh_assessment_result(t.id);
end; $$;
create function private.grade_after_closure() returns trigger language plpgsql security definer set search_path='' as $$
begin if old.state='in_progress' and new.state in ('submitted','expired') then perform private.grade_closed_attempt(new.id);end if;return new;end; $$;
create trigger grade_after_closure after update of state on public.assessment_attempts for each row execute function private.grade_after_closure();

create function public.start_assessment_attempt(p_application uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_actor();app public.applications;v public.assessment_versions;inv public.assessment_invitations;previous public.assessment_attempts;counted integer;result uuid;outcome text;
begin
 if actor is null then raise exception 'Not permitted' using errcode='42501';end if;
 select * into app from public.applications where id=p_application and candidate_id=actor;
 if app.id is null then raise exception 'Not permitted' using errcode='42501';end if;
 perform 1 from public.organizations where id=app.organization_id and status='active' for update;
 if not found then raise exception 'Organization unavailable';end if;
 select * into app from public.applications where id=p_application for update;
 if private.active_actor() is distinct from actor then raise exception 'Not permitted' using errcode='42501';end if;
 if app.status in ('withdrawn','rejected','hired') then raise exception 'Application is already final';end if;
 select * into v from public.assessment_versions where id=app.assessment_version_id;
 select * into inv from public.assessment_invitations where application_id=app.id and version_id=v.id for update;
 if inv.id is null or inv.state<>'issued' or inv.expires_at<=clock_timestamp() then raise exception 'Assessment invitation is unavailable or expired';end if;
 select * into previous from public.assessment_attempts where version_id=v.id and candidate_id=actor order by attempt_number desc limit 1;
 if previous.state='in_progress' and previous.deadline_at>clock_timestamp() then
  if previous.application_id=app.id then return previous.id;else raise exception 'An assessment attempt is already active';end if;
 end if;
 select count(*) into counted from public.assessment_attempts where version_id=v.id and candidate_id=actor;
 if counted>=v.max_attempts then raise exception 'Maximum attempts reached';end if;
 if counted>0 then
  if previous.state='in_progress' then update public.assessment_attempts set state='expired' where id=previous.id;end if;
  select r.outcome into outcome from public.assessment_results r where attempt_id=previous.id;
  if coalesce(previous.settings_snapshot->>'retake_policy',v.retake_policy)='none' then raise exception 'Retakes are disabled';end if;
  if outcome='passed' then raise exception 'A passing attempt already exists';end if;
  if (v.retake_policy='approval' or coalesce(outcome,'integrity_review')<>'failed') and inv.approved_through<counted+1 then raise exception 'Retake approval is required';end if;
  if coalesce(previous.closed_at,previous.deadline_at)+make_interval(mins=>v.retake_delay_minutes)>clock_timestamp() then raise exception 'Retake cooldown has not elapsed';end if;
 end if;
 result:=private.snapshot_assessment_attempt(app.id);
 if private.can_manage_assessment(app.organization_id,v.assessment_id) or exists(select 1 from public.assessment_attempt_questions q join public.bank_questions b on b.id=q.source_question_id where q.attempt_id=result and b.created_by=actor) then
  insert into private.assessment_integrity_flags(organization_id,attempt_id,application_id,kind,reason) values(app.organization_id,result,app.id,'author_conflict','Candidate has assessment authoring authority or authored a selected question');
 end if;
 return result;
end; $$;
create function public.save_assessment_response(p_attempt uuid,p_question uuid,p_answer jsonb,p_revision integer) returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_actor();t public.assessment_attempts;q public.assessment_attempt_questions;current public.assessment_responses;answer jsonb;option_id text;ids text[];
begin
 if actor is null or not exists(select 1 from public.assessment_attempts where id=p_attempt and candidate_id=actor) then raise exception 'Not permitted' using errcode='42501';end if;
 t:=private.lock_engine_attempt(p_attempt);
 if private.active_actor() is distinct from actor then raise exception 'Not permitted' using errcode='42501';end if;
 if t.state<>'in_progress' or t.deadline_at<=clock_timestamp() or not exists(select 1 from public.applications where id=t.application_id and status not in ('withdrawn','rejected','hired')) or not exists(select 1 from public.organizations where id=t.organization_id and status='active') then raise exception 'Attempt is closed or expired';end if;
 select * into q from public.assessment_attempt_questions where id=p_question and attempt_id=t.id and organization_id=t.organization_id;
 if q.id is null or p_answer is null or jsonb_typeof(p_answer)<>'object' or p_revision is null or p_revision<0 then raise exception 'Invalid assessment response';end if;
 if q.kind in ('single_choice','multiple_select') then
  if exists(select 1 from jsonb_object_keys(p_answer) k where k<>'selected_ids') or jsonb_typeof(p_answer->'selected_ids') is distinct from 'array' or jsonb_array_length(p_answer->'selected_ids')>10 or (q.kind='single_choice' and jsonb_array_length(p_answer->'selected_ids')>1) then raise exception 'Invalid selected options';end if;
  if exists(select 1 from jsonb_array_elements(p_answer->'selected_ids') x where jsonb_typeof(x)<>'string') then raise exception 'Invalid selected options';end if;
  select coalesce(array_agg(x order by x),'{}') into ids from jsonb_array_elements_text(p_answer->'selected_ids') x;
  if cardinality(ids)<>(select count(distinct x) from unnest(ids) x) then raise exception 'Invalid selected options';end if;
  foreach option_id in array ids loop if not exists(select 1 from jsonb_array_elements(q.options) o where o->>'id'=option_id) then raise exception 'Invalid selected options';end if;end loop;
  answer:=jsonb_build_object('selected_ids',to_jsonb(ids));
 elsif q.kind='numerical' then
  if exists(select 1 from jsonb_object_keys(p_answer) k where k<>'value') or not p_answer?'value' then raise exception 'Invalid numerical response';end if;
  if p_answer->>'value' is not null and (length(p_answer->>'value')>64 or (p_answer->>'value') !~ '^[+-]?([0-9]+(\.[0-9]+)?|\.[0-9]+)([eE][+-]?[0-9]{1,2})?$') then raise exception 'Invalid numerical response';end if;
  if p_answer->>'value' is not null and (p_answer->>'value')::numeric not between -1e12 and 1e12 then raise exception 'Invalid numerical response';end if;
  answer:=jsonb_build_object('value',p_answer->>'value');
 elsif q.kind='written' then
  if exists(select 1 from jsonb_object_keys(p_answer) k where k<>'text') or jsonb_typeof(p_answer->'text') is distinct from 'string' or length(p_answer->>'text')>10000 then raise exception 'Invalid written response';end if;
  answer:=jsonb_build_object('text',p_answer->>'text');
 else raise exception 'Unsupported assessment response';end if;
 select * into current from public.assessment_responses where attempt_id=t.id and question_id=q.id;
 if current.attempt_id is not null and current.revision=p_revision+1 and current.answer=answer then return current.revision;end if;
 if coalesce(current.revision,0)<>p_revision then raise exception 'Answer changed. Reload before saving.' using errcode='40001';end if;
 insert into public.assessment_responses values(t.organization_id,t.id,q.id,answer,p_revision+1,clock_timestamp()) on conflict(attempt_id,question_id) do update set answer=excluded.answer,revision=excluded.revision,saved_at=excluded.saved_at;
 return p_revision+1;
end; $$;
create function public.submit_assessment_attempt(p_attempt uuid) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_actor();t public.assessment_attempts;
begin
 if actor is null or not exists(select 1 from public.assessment_attempts where id=p_attempt and candidate_id=actor) then raise exception 'Not permitted' using errcode='42501';end if;
 t:=private.lock_engine_attempt(p_attempt);
 if private.active_actor() is distinct from actor then raise exception 'Not permitted' using errcode='42501';end if;
 if t.state='in_progress' then update public.assessment_attempts set state=case when deadline_at<=clock_timestamp() then 'expired' else 'submitted' end where id=t.id;
 elsif t.state in ('submitted','expired') then perform private.grade_closed_attempt(t.id);
 else raise exception 'Attempt is cancelled';end if;
end; $$;

create function private.refresh_application_assessments(p_application uuid) returns void language plpgsql security definer set search_path='' as $$
declare t record;
begin for t in select id from public.assessment_attempts where application_id=p_application and state in ('submitted','expired') order by attempt_number loop perform private.refresh_assessment_result(t.id);end loop;end; $$;
create function public.review_written_answer(p_attempt uuid,p_question uuid,p_points numeric,p_rationale text,p_expected_revision integer) returns void language plpgsql security definer set search_path='' as $$
declare t public.assessment_attempts;q public.assessment_attempt_questions;revision integer;
begin
 select * into t from public.assessment_attempts where id=p_attempt;
 if not private.can_review_application(t.organization_id,t.application_id) then raise exception 'Not permitted' using errcode='42501';end if;
 t:=private.lock_engine_attempt(t.id);
 if not private.can_review_application(t.organization_id,t.application_id) or t.state not in ('submitted','expired') then raise exception 'Attempt must be closed before review';end if;
 perform private.grade_closed_attempt(t.id);
 select * into q from public.assessment_attempt_questions where id=p_question and attempt_id=t.id;
 if q.id is null or q.kind<>'written' or not exists(select 1 from private.objective_question_scores where question_id=q.id and review_required) or p_points is null or p_points<0 or p_points>q.max_points or p_rationale is null or length(trim(p_rationale)) not between 5 and 2000 then raise exception 'Invalid written review';end if;
 select coalesce(max(r.revision),0) into revision from private.manual_question_reviews r where question_id=q.id;
 if p_expected_revision is null or revision<>p_expected_revision then raise exception 'Record changed. Reload and try again.' using errcode='40001';end if;
 insert into private.manual_question_reviews(organization_id,attempt_id,question_id,revision,points,rationale,reviewed_by) values(t.organization_id,t.id,q.id,revision+1,p_points,trim(p_rationale),private.active_actor());
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(t.organization_id,private.active_actor(),'assessment.written.reviewed',q.id);
 perform private.refresh_assessment_result(t.id);
end; $$;
create function public.report_assessment_integrity(p_attempt uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare t public.assessment_attempts;actor uuid:=private.active_actor();flag_kind text;flag uuid;
begin
 select * into t from public.assessment_attempts where id=p_attempt;
 if actor is null or t.id is null or (t.candidate_id<>actor and not private.can_review_application(t.organization_id,t.application_id)) then raise exception 'Not permitted' using errcode='42501';end if;
 t:=private.lock_engine_attempt(t.id);
 if private.active_actor() is distinct from actor or (t.candidate_id<>actor and not private.can_review_application(t.organization_id,t.application_id)) then raise exception 'Not permitted' using errcode='42501';end if;
 if p_reason is null or length(trim(p_reason)) not between 5 and 2000 then raise exception 'Explain the issue in 5 to 2000 characters';end if;
 flag_kind:=case when actor=t.candidate_id then 'candidate_report' else 'employer_report' end;
 if (select count(*) from private.assessment_integrity_flags f where f.attempt_id=t.id and f.kind=flag_kind)>=5 then raise exception 'Integrity report limit reached';end if;
 insert into private.assessment_integrity_flags(organization_id,attempt_id,application_id,kind,reason) values(t.organization_id,t.id,t.application_id,flag_kind,trim(p_reason)) returning id into flag;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(t.organization_id,actor,'assessment.integrity.reported',flag);
 perform private.refresh_application_assessments(t.application_id);
 perform private.notify_assessment(t.application_id,'assessment_review','flag:'||flag::text,true);
end; $$;
create function public.resolve_assessment_integrity(p_flag uuid,p_resolution text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare flag private.assessment_integrity_flags;t public.assessment_attempts;
begin
 select * into flag from private.assessment_integrity_flags where id=p_flag;
 if flag.id is null or not private.can_review_application(flag.organization_id,flag.application_id) then raise exception 'Not permitted' using errcode='42501';end if;
 t:=private.lock_engine_attempt(flag.attempt_id);
 if not private.can_review_application(t.organization_id,t.application_id) then raise exception 'Not permitted' using errcode='42501';end if;
 if p_resolution is null or p_resolution not in ('cleared','confirmed') or p_reason is null or length(trim(p_reason)) not between 5 and 2000 then raise exception 'Invalid integrity review';end if;
 select * into flag from private.assessment_integrity_flags where id=p_flag for update;
 if flag.resolution=p_resolution then return;end if;
 update private.assessment_integrity_flags set resolution=p_resolution where id=p_flag;
 insert into private.integrity_reviews(organization_id,flag_id,reviewed_by,resolution,reason) values(t.organization_id,p_flag,private.active_actor(),p_resolution,trim(p_reason));
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(t.organization_id,private.active_actor(),'assessment.integrity.reviewed',p_flag);
 perform private.refresh_application_assessments(t.application_id);
end; $$;
create function public.approve_assessment_retake(p_application uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare app public.applications;v public.assessment_versions;inv public.assessment_invitations;counted integer;
begin
 select * into app from public.applications where id=p_application;
 if app.id is null or not private.can_review_application(app.organization_id,app.id) then raise exception 'Not permitted' using errcode='42501';end if;
 perform 1 from public.organizations where id=app.organization_id for update;
 select * into app from public.applications where id=p_application for update;
 if not private.can_review_application(app.organization_id,app.id) then raise exception 'Not permitted' using errcode='42501';end if;
 select * into v from public.assessment_versions where id=app.assessment_version_id;
 select * into inv from public.assessment_invitations where application_id=app.id and version_id=v.id for update;
 select count(*) into counted from public.assessment_attempts where version_id=v.id and candidate_id=app.candidate_id;
 if inv.id is null or inv.state<>'issued' or inv.expires_at<=clock_timestamp() or v.retake_policy='none' or counted>=v.max_attempts or counted<1 or app.status in ('withdrawn','rejected','hired') or p_reason is null or length(trim(p_reason)) not between 5 and 2000 then raise exception 'Retake is not permitted by the configured policy';end if;
 update public.assessment_invitations set approved_through=greatest(approved_through,counted+1) where id=inv.id;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(app.organization_id,private.active_actor(),'assessment.retake.approved',inv.id);
 perform private.notify_assessment(app.id,'assessment_retake','retake:'||inv.id::text||':'||(counted+1)::text);
end; $$;
create function public.appeal_assessment(p_attempt uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare t public.assessment_attempts;actor uuid:=private.active_actor();result public.assessment_results;appeal uuid;
begin
 if actor is null or not exists(select 1 from public.assessment_attempts where id=p_attempt and candidate_id=actor) then raise exception 'Not permitted' using errcode='42501';end if;
 t:=private.lock_engine_attempt(p_attempt);
 if private.active_actor() is distinct from actor then raise exception 'Not permitted' using errcode='42501';end if;
 select * into result from public.assessment_results where attempt_id=t.id;
 if t.state not in ('submitted','expired') or result.outcome not in ('failed','integrity_review','manual_review') or not coalesce((t.settings_snapshot->>'appeals_enabled')::boolean,true) or coalesce(t.closed_at,t.deadline_at)+make_interval(hours=>coalesce((t.settings_snapshot->>'appeal_window_hours')::integer,72))<=clock_timestamp() or p_reason is null or length(trim(p_reason)) not between 5 and 2000 or exists(select 1 from public.assessment_appeals where attempt_id=t.id) then raise exception 'Appeal is not permitted by the configured policy';end if;
 insert into public.assessment_appeals(organization_id,attempt_id,application_id,candidate_id,reason) values(t.organization_id,t.id,t.application_id,actor,trim(p_reason)) returning id into appeal;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(t.organization_id,actor,'assessment.appeal.requested',appeal);
 perform private.refresh_application_assessments(t.application_id);
 perform private.notify_assessment(t.application_id,'assessment_review','appeal:'||appeal::text,true);
end; $$;
create function public.resolve_assessment_appeal(p_appeal uuid,p_decision text,p_message text) returns void language plpgsql security definer set search_path='' as $$
declare a public.assessment_appeals;t public.assessment_attempts;
begin
 select * into a from public.assessment_appeals where id=p_appeal;
 if a.id is null or not private.can_review_application(a.organization_id,a.application_id) then raise exception 'Not permitted' using errcode='42501';end if;
 t:=private.lock_engine_attempt(a.attempt_id);
 if not private.can_review_application(t.organization_id,t.application_id) then raise exception 'Not permitted' using errcode='42501';end if;
 select * into a from public.assessment_appeals where id=p_appeal for update;
 if a.decision<>'pending' or p_decision is null or p_decision not in ('upheld','reviewed','retake_approved') or p_message is null or length(trim(p_message)) not between 5 and 2000 then raise exception 'Invalid appeal decision';end if;
 if p_decision='retake_approved' then perform public.approve_assessment_retake(a.application_id,p_message);end if;
 update public.assessment_appeals set decision=p_decision,resolution_message=trim(p_message),resolved_at=clock_timestamp() where id=a.id;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(t.organization_id,private.active_actor(),'assessment.appeal.resolved',a.id);
 perform private.refresh_application_assessments(a.application_id);
 perform private.notify_assessment(a.application_id,'assessment_appeal','appeal-resolved:'||a.id::text);
end; $$;
create function public.process_assessment_expiry(p_limit integer default 50) returns integer language plpgsql security definer set search_path='' as $$
declare org record;item record;t public.assessment_attempts;processed integer:=0;visited integer:=0;
begin
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid processing limit';end if;
 -- Do not lock attempts before organizations: every engine writer uses the
 -- organization -> application -> attempt order, including concurrent workers.
 for org in select o.id from public.organizations o where exists(select 1 from public.assessment_attempts a where a.organization_id=o.id and ((a.state='in_progress' and a.deadline_at<=clock_timestamp()) or (a.state in ('submitted','expired') and not exists(select 1 from private.objective_grade_runs g where g.attempt_id=a.id)))) order by o.id for update of o skip locked loop
  for item in select id from public.assessment_attempts a where a.organization_id=org.id and ((a.state='in_progress' and a.deadline_at<=clock_timestamp()) or (a.state in ('submitted','expired') and not exists(select 1 from private.objective_grade_runs g where g.attempt_id=a.id))) order by deadline_at,id limit p_limit-visited loop
   visited:=visited+1;
   begin
    t:=private.lock_engine_attempt(item.id);
    if t.state='in_progress' and t.deadline_at<=clock_timestamp() then update public.assessment_attempts set state='expired' where id=t.id;
    elsif t.state in ('submitted','expired') then perform private.grade_closed_attempt(t.id);end if;
    delete from private.assessment_engine_errors where attempt_id=item.id;processed:=processed+1;
   exception when others then
    insert into private.assessment_engine_errors(attempt_id,organization_id,code) values(item.id,org.id,sqlstate) on conflict(attempt_id) do update set code=excluded.code,last_seen_at=clock_timestamp(),failures=private.assessment_engine_errors.failures+1;
   end;
   if visited>=p_limit then return processed;end if;
  end loop;
 end loop;
 return processed;
end; $$;
create function public.get_employer_assessment_result(p_attempt uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare t public.assessment_attempts;
begin
 select * into t from public.assessment_attempts where id=p_attempt;
 if t.id is null or not private.can_review_application(t.organization_id,t.application_id) then raise exception 'Not permitted' using errcode='42501';end if;
 if t.state='in_progress' then raise exception 'Attempt must be closed before review';end if;
 return jsonb_build_object('attempt',to_jsonb(t),'result',(select to_jsonb(r) from public.assessment_results r where attempt_id=t.id),
 'questions',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'prompt',q.prompt,'kind',q.kind,'options',q.options,'max_points',q.max_points,'answer',r.answer,'key',k.key,'points',coalesce(m.points,s.awarded_points),'manual_revision',coalesce(m.revision,0),'manual_rationale',m.rationale,'review_required',s.review_required,'grading_error',s.grading_error) order by q.position)
 from public.assessment_attempt_questions q left join public.assessment_responses r on r.question_id=q.id left join private.attempt_answer_keys k on k.attempt_question_id=q.id left join private.objective_question_scores s on s.question_id=q.id left join lateral(select * from private.manual_question_reviews m where m.question_id=q.id order by m.revision desc limit 1) m on true where q.attempt_id=t.id),'[]'::jsonb),
 'flags',coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at) from private.assessment_integrity_flags f where f.application_id=t.application_id),'[]'::jsonb),
 'appeals',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.assessment_appeals a where a.application_id=t.application_id),'[]'::jsonb));
end; $$;
create function public.mark_notification_read(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin update public.user_notifications set read_at=coalesce(read_at,clock_timestamp()) where id=p_id and user_id=private.active_actor();end; $$;
create function private.notify_application_status() returns trigger language plpgsql security definer set search_path='' as $$
begin perform private.notify_assessment(new.application_id,'application_status','application-event:'||new.id::text);return new;end; $$;
create trigger notify_application_status after insert on public.application_events for each row execute function private.notify_application_status();

alter table public.assessment_invitations enable row level security;
alter table public.assessment_responses enable row level security;
alter table public.assessment_appeals enable row level security;
alter table public.assessment_results enable row level security;
alter table public.assessment_result_history enable row level security;
alter table public.user_notifications enable row level security;
revoke all on public.assessment_invitations,public.assessment_responses,public.assessment_appeals,public.assessment_results,public.assessment_result_history,public.user_notifications from public,anon,authenticated;
grant select on public.assessment_invitations,public.assessment_responses,public.assessment_appeals,public.assessment_results,public.assessment_result_history,public.user_notifications to authenticated;
create policy invitation_authorized on public.assessment_invitations for select to authenticated using(candidate_id=private.active_actor() or private.can_review_application(organization_id,application_id));
create policy response_owner on public.assessment_responses for select to authenticated using(exists(select 1 from public.assessment_attempts t where t.id=attempt_id and t.candidate_id=private.active_actor()));
create policy appeal_authorized on public.assessment_appeals for select to authenticated using(candidate_id=private.active_actor() or private.can_review_application(organization_id,application_id));
create policy result_authorized on public.assessment_results for select to authenticated using(candidate_id=private.active_actor() or private.can_review_application(organization_id,application_id));
create policy result_history_authorized on public.assessment_result_history for select to authenticated using(exists(select 1 from public.assessment_attempts t where t.id=attempt_id and t.candidate_id=private.active_actor()) or private.can_review_application(organization_id,application_id));
create policy notification_owner on public.user_notifications for select to authenticated using(user_id=private.active_actor() and (audience='candidate' or private.can_review_application(organization_id,application_id)));
-- Employer metadata only; question/key access remains through the closed-only RPC.
create policy employer_attempt_metadata on public.assessment_attempts for select to authenticated using(private.can_review_application(organization_id,application_id));
revoke all on private.objective_grade_runs,private.objective_question_scores,private.manual_question_reviews,private.assessment_integrity_flags,private.integrity_reviews,private.assessment_engine_errors from public,anon,authenticated;
alter table private.objective_grade_runs enable row level security;
alter table private.objective_question_scores enable row level security;
alter table private.manual_question_reviews enable row level security;
alter table private.assessment_integrity_flags enable row level security;
alter table private.integrity_reviews enable row level security;
alter table private.assessment_engine_errors enable row level security;
create trigger immutable_objective_run before update or delete on private.objective_grade_runs for each row execute function private.deny_content_mutation();
create trigger immutable_objective_score before update or delete on private.objective_question_scores for each row execute function private.deny_content_mutation();
create trigger immutable_manual_review before update or delete on private.manual_question_reviews for each row execute function private.deny_content_mutation();
create trigger immutable_integrity_review before update or delete on private.integrity_reviews for each row execute function private.deny_content_mutation();
create trigger immutable_result_history before update or delete on public.assessment_result_history for each row execute function private.deny_content_mutation();

revoke all on function private.notify_assessment(uuid,text,text,boolean),private.issue_assessment_invitation(uuid),private.invite_after_application(),private.freeze_execution_policy(),private.lock_engine_attempt(uuid),private.refresh_assessment_result(uuid),private.grade_closed_attempt(uuid),private.grade_after_closure(),private.refresh_application_assessments(uuid),private.notify_application_status() from public,anon,authenticated;
revoke all on function public.start_assessment_attempt(uuid),public.save_assessment_response(uuid,uuid,jsonb,integer),public.submit_assessment_attempt(uuid),public.review_written_answer(uuid,uuid,numeric,text,integer),public.report_assessment_integrity(uuid,text),public.resolve_assessment_integrity(uuid,text,text),public.approve_assessment_retake(uuid,text),public.appeal_assessment(uuid,text),public.resolve_assessment_appeal(uuid,text,text),public.process_assessment_expiry(integer),public.get_employer_assessment_result(uuid),public.mark_notification_read(uuid) from public,anon,authenticated;
grant execute on function public.start_assessment_attempt(uuid),public.save_assessment_response(uuid,uuid,jsonb,integer),public.submit_assessment_attempt(uuid),public.review_written_answer(uuid,uuid,numeric,text,integer),public.report_assessment_integrity(uuid,text),public.resolve_assessment_integrity(uuid,text,text),public.approve_assessment_retake(uuid,text),public.appeal_assessment(uuid,text),public.resolve_assessment_appeal(uuid,text,text),public.get_employer_assessment_result(uuid),public.mark_notification_read(uuid) to authenticated;
grant execute on function public.process_assessment_expiry(integer) to service_role;

create function public.get_candidate_assessment_invitation(p_application uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.applications where id=p_application and candidate_id=private.active_actor()) then raise exception 'Not permitted' using errcode='42501';end if;
 return (select jsonb_build_object('id',i.id,'state',i.state,'expires_at',i.expires_at,'title',a.title,'summary',v.summary,'duration_minutes',v.duration_minutes,'passing_percentage',v.passing_percentage,'max_attempts',v.max_attempts,'retake_policy',v.retake_policy,'retake_delay_minutes',v.retake_delay_minutes,'approved_through',i.approved_through,'question_count',(select count(*) from public.assessment_version_questions where version_id=v.id)+coalesce((select sum(draw_count) from public.assessment_pool_rules where version_id=v.id),0)) from public.assessment_invitations i join public.assessment_versions v on v.id=i.version_id join public.assessments a on a.id=v.assessment_id where i.application_id=p_application);
end; $$;
create function public.assessment_server_time() returns timestamptz language sql volatile set search_path='' as $$select clock_timestamp()$$;
revoke all on function public.get_candidate_assessment_invitation(uuid),public.assessment_server_time() from public,anon,authenticated;
grant execute on function public.get_candidate_assessment_invitation(uuid),public.assessment_server_time() to authenticated;
