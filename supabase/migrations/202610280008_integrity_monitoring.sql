-- Browser observations are untrusted context. They never change grades,
-- integrity flags or hiring stages automatically.
create table public.assessment_integrity_acknowledgements (
 attempt_id uuid primary key,organization_id uuid not null,candidate_id uuid not null references public.accounts(id),
 disclosure_version text not null check(disclosure_version='browser-integrity-v1'),acknowledged_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,attempt_id) references public.assessment_attempts(organization_id,id)
);
create table public.assessment_monitor_sessions (
 id uuid not null,organization_id uuid not null,attempt_id uuid not null,
 opened_at timestamptz not null default clock_timestamp(),last_seen_at timestamptz not null default clock_timestamp(),released_at timestamptz,
 last_overlap_at timestamptz,primary key(attempt_id,id),unique(organization_id,attempt_id,id),
 foreign key(organization_id,attempt_id) references public.assessment_attempts(organization_id,id)
);
create table public.assessment_integrity_events (
 id uuid primary key default gen_random_uuid(),sequence bigint generated always as identity unique,
 organization_id uuid not null,attempt_id uuid not null,session_id uuid not null,client_event_id uuid,
 kind text not null check(kind in ('visibility_hidden','visibility_visible','fullscreen_enter','fullscreen_exit','fullscreen_unavailable','window_blur','window_focus','network_offline','network_online','request_failed','request_recovered','navigation_away','navigation_back','monitoring_started','queue_overflow','simultaneous_session')),
 source text not null check(source in ('browser','server')),client_observed_at timestamptz,
 received_at timestamptz not null default clock_timestamp(),unique(attempt_id,client_event_id),
 check((source='server' and kind='simultaneous_session' and client_event_id is null and client_observed_at is null) or (source='browser' and kind<>'simultaneous_session' and client_event_id is not null and client_observed_at is not null)),
 foreign key(organization_id,attempt_id,session_id) references public.assessment_monitor_sessions(organization_id,attempt_id,id)
);
create index assessment_integrity_timeline on public.assessment_integrity_events(attempt_id,sequence desc);
create index assessment_integrity_rate on public.assessment_integrity_events(attempt_id,received_at);
create table public.assessment_monitor_reviews (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,attempt_id uuid not null,
 reviewer_id uuid not null references public.accounts(id),outcome text not null check(outcome in ('no_conclusion','context_explained','follow_up')),
 rationale text not null check(length(trim(rationale)) between 5 and 2000),reviewed_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,attempt_id) references public.assessment_attempts(organization_id,id)
);
create trigger immutable_integrity_event before update or delete on public.assessment_integrity_events for each row execute function private.deny_content_mutation();
create trigger immutable_monitor_review before update or delete on public.assessment_monitor_reviews for each row execute function private.deny_content_mutation();
create trigger immutable_integrity_ack before update or delete on public.assessment_integrity_acknowledgements for each row execute function private.deny_content_mutation();

-- Preserve the engine, expose only a disclosure-aware entry point.
alter function public.start_assessment_attempt(uuid) set schema private;
alter function private.start_assessment_attempt(uuid) rename to start_disclosed_execution;
revoke all on function private.start_disclosed_execution(uuid) from public,anon,authenticated;
create function public.start_assessment_attempt(p_application uuid,p_disclosure text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;t public.assessment_attempts;
begin
 if not exists(select 1 from public.applications where id=p_application and candidate_id=private.active_actor()) then raise exception 'Not permitted' using errcode='42501';end if;
 if p_disclosure is distinct from 'browser-integrity-v1' then raise exception 'Acknowledge the assessment monitoring rules before starting';end if;
 result:=private.start_disclosed_execution(p_application);
 select * into t from public.assessment_attempts where id=result;
 insert into public.assessment_integrity_acknowledgements(attempt_id,organization_id,candidate_id,disclosure_version) values(t.id,t.organization_id,t.candidate_id,p_disclosure) on conflict do nothing;
 return result;
end; $$;

create function public.record_assessment_integrity(p_attempt uuid,p_session uuid,p_disclosure text,p_events jsonb default '[]',p_release boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_actor();t public.assessment_attempts;s public.assessment_monitor_sessions;event jsonb;event_id uuid;observed timestamptz;prior public.assessment_integrity_events;
 accepted jsonb:='[]';overlap boolean:=false;
begin
 if actor is null or not exists(select 1 from public.assessment_attempts where id=p_attempt and candidate_id=actor) then raise exception 'Not permitted' using errcode='42501';end if;
 t:=private.lock_engine_attempt(p_attempt);
 if private.active_actor() is distinct from actor then raise exception 'Not permitted' using errcode='42501';end if;
 if p_session is null or p_disclosure is distinct from 'browser-integrity-v1' or p_release is null then raise exception 'Invalid monitoring session';end if;
 if t.state='cancelled' or coalesce(t.closed_at,t.deadline_at)+interval '24 hours'<=clock_timestamp() then raise exception 'Monitoring collection has closed';end if;
 if jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events)>20 then raise exception 'Invalid integrity event batch';end if;
 insert into public.assessment_integrity_acknowledgements(attempt_id,organization_id,candidate_id,disclosure_version) values(t.id,t.organization_id,actor,p_disclosure) on conflict do nothing;
 select * into s from public.assessment_monitor_sessions where attempt_id=t.id and id=p_session;
 if s.id is null then
  if (select count(*) from public.assessment_monitor_sessions where attempt_id=t.id)>=64 then raise exception 'Monitoring session limit reached';end if;
  insert into public.assessment_monitor_sessions(id,organization_id,attempt_id) values(p_session,t.organization_id,t.id) returning * into s;
 end if;
 -- A 45-second recent heartbeat window is an overlap signal, not proof that
 -- two people were active. Reloads, BFCache and delayed unloads can overlap.
 overlap:=t.state='in_progress' and s.released_at is null and exists(select 1 from public.assessment_monitor_sessions x where x.attempt_id=t.id and x.id<>p_session and x.released_at is null and x.last_seen_at>clock_timestamp()-interval '45 seconds');
 if overlap and (s.last_overlap_at is null or s.last_overlap_at<=clock_timestamp()-interval '60 seconds') and (select count(*) from public.assessment_integrity_events where attempt_id=t.id)<4000 then
  insert into public.assessment_integrity_events(organization_id,attempt_id,session_id,kind,source) values(t.organization_id,t.id,p_session,'simultaneous_session','server');
  update public.assessment_monitor_sessions set last_overlap_at=clock_timestamp() where attempt_id=t.id and id=p_session;
 end if;
 for event in select value from jsonb_array_elements(p_events) loop
  if jsonb_typeof(event)<>'object' or (select count(*) from jsonb_object_keys(event))<>3 or exists(select 1 from jsonb_object_keys(event) k where k not in ('id','kind','observedAt')) or jsonb_typeof(event->'id') is distinct from 'string' or jsonb_typeof(event->'kind') is distinct from 'string' or jsonb_typeof(event->'observedAt') is distinct from 'string' then raise exception 'Invalid integrity event';end if;
  event_id:=(event->>'id')::uuid;
  if event->>'kind' not in ('visibility_hidden','visibility_visible','fullscreen_enter','fullscreen_exit','fullscreen_unavailable','window_blur','window_focus','network_offline','network_online','request_failed','request_recovered','navigation_away','navigation_back','monitoring_started','queue_overflow') then raise exception 'Invalid integrity event';end if;
  observed:=(event->>'observedAt')::timestamptz;
  if observed is null or observed not between '2000-01-01'::timestamptz and '2100-01-01'::timestamptz then raise exception 'Invalid integrity event';end if;
  select * into prior from public.assessment_integrity_events where attempt_id=t.id and client_event_id=event_id;
  if prior.id is not null then
   if prior.session_id<>p_session or prior.kind<>event->>'kind' or prior.client_observed_at<>observed then raise exception 'Integrity event ID was reused';end if;
  else
   if (select count(*) from public.assessment_integrity_events where attempt_id=t.id)>=4000 or (select count(*) from public.assessment_integrity_events where attempt_id=t.id and source='browser' and received_at>clock_timestamp()-interval '60 seconds')>=120 then raise exception 'Integrity event limit reached';end if;
   insert into public.assessment_integrity_events(organization_id,attempt_id,session_id,client_event_id,kind,source,client_observed_at) values(t.organization_id,t.id,p_session,event_id,event->>'kind','browser',observed);
  end if;
  accepted:=accepted||jsonb_build_array(event_id);
 end loop;
 -- A released document cannot revive its heartbeat with a delayed request.
 update public.assessment_monitor_sessions set last_seen_at=clock_timestamp(),released_at=case when p_release then coalesce(released_at,clock_timestamp()) else released_at end where attempt_id=t.id and id=p_session;
 return jsonb_build_object('accepted',accepted,'simultaneous',overlap,'closed',t.state<>'in_progress','serverTime',clock_timestamp());
end; $$;

create function public.review_assessment_monitoring(p_attempt uuid,p_outcome text,p_rationale text) returns void language plpgsql security definer set search_path='' as $$
declare t public.assessment_attempts;
begin
 select * into t from public.assessment_attempts where id=p_attempt;
 if not private.can_review_application(t.organization_id,t.application_id) then raise exception 'Not permitted' using errcode='42501';end if;
 t:=private.lock_engine_attempt(p_attempt);
 if not private.can_review_application(t.organization_id,t.application_id) then raise exception 'Not permitted' using errcode='42501';end if;
 if p_outcome is null or p_outcome not in ('no_conclusion','context_explained','follow_up') or p_rationale is null or length(trim(p_rationale)) not between 5 and 2000 then raise exception 'Invalid monitoring review';end if;
 insert into public.assessment_monitor_reviews(organization_id,attempt_id,reviewer_id,outcome,rationale) values(t.organization_id,t.id,private.active_actor(),p_outcome,trim(p_rationale));
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(t.organization_id,private.active_actor(),'assessment.monitoring.reviewed',t.id);
end; $$;

alter table public.assessment_integrity_acknowledgements enable row level security;
alter table public.assessment_monitor_sessions enable row level security;
alter table public.assessment_integrity_events enable row level security;
alter table public.assessment_monitor_reviews enable row level security;
revoke all on public.assessment_integrity_acknowledgements,public.assessment_monitor_sessions,public.assessment_integrity_events,public.assessment_monitor_reviews from public,anon,authenticated;
grant select on public.assessment_integrity_acknowledgements,public.assessment_monitor_sessions,public.assessment_integrity_events,public.assessment_monitor_reviews to authenticated;
create policy integrity_ack_read on public.assessment_integrity_acknowledgements for select to authenticated using(candidate_id=private.active_actor() or exists(select 1 from public.assessment_attempts t where t.id=attempt_id and private.can_review_application(t.organization_id,t.application_id)));
create policy monitor_sessions_read on public.assessment_monitor_sessions for select to authenticated using(exists(select 1 from public.assessment_attempts t where t.id=attempt_id and (t.candidate_id=private.active_actor() or private.can_review_application(t.organization_id,t.application_id))));
create policy integrity_events_read on public.assessment_integrity_events for select to authenticated using(exists(select 1 from public.assessment_attempts t where t.id=attempt_id and (t.candidate_id=private.active_actor() or private.can_review_application(t.organization_id,t.application_id))));
create policy monitoring_reviews_read on public.assessment_monitor_reviews for select to authenticated using(exists(select 1 from public.assessment_attempts t where t.id=attempt_id and private.can_review_application(t.organization_id,t.application_id)));
revoke all on function public.start_assessment_attempt(uuid,text),public.record_assessment_integrity(uuid,uuid,text,jsonb,boolean),public.review_assessment_monitoring(uuid,text,text) from public,anon,authenticated;
grant execute on function public.start_assessment_attempt(uuid,text),public.record_assessment_integrity(uuid,uuid,text,jsonb,boolean),public.review_assessment_monitoring(uuid,text,text) to authenticated;
