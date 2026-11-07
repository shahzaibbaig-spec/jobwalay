-- Database-backed quotas apply to direct RPC writes as well as web handlers.
create table private.action_limits(actor_id uuid not null references public.accounts(id),scope text not null,bucket timestamptz not null,hits integer not null,primary key(actor_id,scope,bucket));
alter table private.action_limits enable row level security;
revoke all on private.action_limits from public,anon,authenticated;
create function private.consume_limit(p_scope text,p_max integer) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_actor();used integer;
begin
 if actor is null then raise exception 'Not permitted' using errcode='42501';end if;
 insert into private.action_limits values(actor,p_scope,date_trunc('minute',clock_timestamp()),1) on conflict(actor_id,scope,bucket) do update set hits=private.action_limits.hits+1 returning hits into used;
 if used>p_max then raise exception 'Too many requests. Try again later.' using errcode='P0001';end if;
end; $$;
create function public.consume_request_quota(p_mutation boolean default true) returns void language plpgsql security definer set search_path='' as $$
begin perform private.consume_limit(case when p_mutation then 'http.write' else 'http.read' end,case when p_mutation then 600 else 240 end);end; $$;
create function private.guard_business_writes() returns trigger language plpgsql security definer set search_path='' as $$
begin if private.active_actor() is not null then perform private.consume_limit('business.write',120);end if;return new;end; $$;
create trigger quota_jobs before insert or update on public.jobs for each row execute function private.guard_business_writes();
create trigger quota_applications before insert or update on public.applications for each row execute function private.guard_business_writes();
create trigger quota_bank before insert on public.bank_questions for each row execute function private.guard_business_writes();
create trigger quota_documents before insert on public.candidate_documents for each row execute function private.guard_business_writes();
create function private.guard_response_writes() returns trigger language plpgsql security definer set search_path='' as $$
begin perform private.consume_limit('answer.write',240);return new;end; $$;
create trigger quota_answers before insert or update on public.assessment_responses for each row execute function private.guard_response_writes();

-- Revocation tombstones avoid modifying managed Auth tables. Reactivating an
-- account never restores sessions that were live when it was suspended.
create table private.revoked_account_sessions(session_id uuid primary key,user_id uuid not null references public.accounts(id),revoked_at timestamptz not null default clock_timestamp());
alter table private.revoked_account_sessions enable row level security;
revoke all on private.revoked_account_sessions from public,anon,authenticated;
create or replace function private.active_actor() returns uuid language sql stable security definer set search_path='' as $$
 select a.id from public.accounts a join auth.users u on u.id=a.id where a.id=auth.uid() and a.status='active' and u.email_confirmed_at is not null
 and exists(select 1 from auth.sessions s where s.user_id=a.id and s.id::text=auth.jwt()->>'session_id' and (s.not_after is null or s.not_after>now()) and not exists(select 1 from private.revoked_account_sessions r where r.session_id=s.id))
$$;
create table private.administration_decisions (
 id uuid primary key default gen_random_uuid(),organization_id uuid references public.organizations(id),actor_id uuid not null references public.accounts(id),target_id uuid not null,
 action text not null,reason text not null check(length(trim(reason)) between 5 and 2000),created_at timestamptz not null default clock_timestamp()
);
alter table private.administration_decisions enable row level security;
revoke all on private.administration_decisions from public,anon,authenticated;
create trigger immutable_admin_decisions before update or delete on private.administration_decisions for each row execute function private.deny_content_mutation();
create trigger immutable_audit_events before update or delete on public.audit_events for each row execute function private.deny_content_mutation();
create function private.record_admin_decision(p_org uuid,p_target uuid,p_action text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_platform_admin() then raise exception 'Not permitted' using errcode='42501';end if;
 if p_reason is null or length(trim(p_reason)) not between 5 and 2000 then raise exception 'Give a reason in 5 to 2000 characters';end if;
 insert into private.administration_decisions(organization_id,actor_id,target_id,action,reason) values(p_org,private.active_actor(),p_target,p_action,trim(p_reason));
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(case when p_action like 'abuse.%' then null else p_org end,private.active_actor(),p_action,p_target);
end; $$;

alter table public.jobs add column moderation_status text not null default 'visible' check(moderation_status in ('visible','hidden'));
drop policy job_public on public.jobs;
create policy job_public on public.jobs for select to anon,authenticated using(moderation_status='visible' and status='published' and (application_deadline is null or application_deadline>clock_timestamp()) and private.company_is_public(organization_id));
create function private.enforce_job_moderation() returns trigger language plpgsql security definer set search_path='' as $$
begin if not exists(select 1 from public.jobs where id=new.job_id and organization_id=new.organization_id and moderation_status='visible') then raise exception 'This job is not accepting applications';end if;return new;end; $$;
create trigger enforce_job_moderation before insert on public.applications for each row execute function private.enforce_job_moderation();

create table public.abuse_reports (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,job_id uuid not null,reporter_id uuid not null references public.accounts(id),
 category text not null check(category in ('fraud','discrimination','misleading','unsafe','spam','other')),details text not null check(length(trim(details)) between 10 and 2000),
 state text not null default 'open' check(state in ('open','resolved','dismissed')),resolution text check(length(trim(resolution)) between 5 and 2000),version integer not null default 1,
 created_at timestamptz not null default clock_timestamp(),resolved_at timestamptz,
 foreign key(organization_id,job_id) references public.jobs(organization_id,id)
);
create unique index one_open_abuse_report on public.abuse_reports(reporter_id,job_id) where state='open';
create index abuse_queue on public.abuse_reports(state,created_at,id);
create index verification_queue on public.verification_requests(state,created_at,id);
create index audit_recent on public.audit_events(occurred_at desc,id desc);
create index account_status_directory on public.accounts(status,created_at desc,id);
create index results_review_queue on public.assessment_results(organization_id,outcome,updated_at desc,attempt_id);
create index monitoring_review_latest on public.assessment_monitor_reviews(attempt_id,reviewed_at desc,id);
create index assessment_result_application on public.assessment_results(application_id,attempt_id);
create index applications_cohort on public.applications(organization_id,submitted_at desc,id);
create index review_attempt_application on public.assessment_attempts(organization_id,application_id,started_at desc);
alter table public.abuse_reports enable row level security;
revoke all on public.abuse_reports from public,anon,authenticated;
grant select on public.abuse_reports to authenticated;
create policy abuse_report_authorized on public.abuse_reports for select to authenticated using(reporter_id=private.active_actor() or (private.is_platform_admin() and not exists(select 1 from public.memberships m where m.organization_id=abuse_reports.organization_id and m.user_id=private.active_actor() and m.status='active')));

create function public.report_job_abuse(p_job uuid,p_category text,p_details text) returns uuid language plpgsql security definer set search_path='' as $$
declare job public.jobs;result uuid;
begin
 perform private.consume_limit('abuse.report',5);
 select * into job from public.jobs where id=p_job and status='published' and moderation_status='visible' and (application_deadline is null or application_deadline>clock_timestamp()) and private.company_is_public(organization_id);
 if job.id is null then raise exception 'Job unavailable';end if;
 if p_category is null or p_category not in ('fraud','discrimination','misleading','unsafe','spam','other') or p_details is null or length(trim(p_details)) not between 10 and 2000 then raise exception 'Invalid abuse report';end if;
 insert into public.abuse_reports(organization_id,job_id,reporter_id,category,details) values(job.organization_id,job.id,private.active_actor(),p_category,trim(p_details)) returning id into result;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(null,private.active_actor(),'job.abuse.reported',result);
 return result;
end; $$;
create function public.moderate_job(p_job uuid,p_hidden boolean,p_expected_version integer,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare job public.jobs;
begin
 if not private.is_platform_admin() then raise exception 'Not permitted' using errcode='42501';end if;perform private.consume_limit('admin.write',30);
 select * into job from public.jobs where id=p_job;if job.id is null then raise exception 'Job unavailable';end if;
 perform 1 from public.organizations where id=job.organization_id for update;select * into job from public.jobs where id=p_job for update;
 if not private.is_platform_admin() or exists(select 1 from public.memberships where organization_id=job.organization_id and user_id=private.active_actor() and status='active') then raise exception 'Independent reviewer required' using errcode='42501';end if;
 if p_hidden is null or p_expected_version is null or job.version<>p_expected_version then raise exception 'Record changed. Reload and try again.' using errcode='40001';end if;
 perform private.record_admin_decision(job.organization_id,job.id,case when p_hidden then 'job.moderation.hidden' else 'job.moderation.restored' end,p_reason);
 update public.jobs set moderation_status=case when p_hidden then 'hidden' else 'visible' end,version=version+1 where id=job.id;
end; $$;
create function public.resolve_abuse_report(p_report uuid,p_expected_version integer,p_state text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare r public.abuse_reports;
begin
 if not private.is_platform_admin() then raise exception 'Not permitted' using errcode='42501';end if;perform private.consume_limit('admin.write',30);
 select * into r from public.abuse_reports where id=p_report;if r.id is null then raise exception 'Report unavailable';end if;
 perform 1 from public.organizations where id=r.organization_id for update;select * into r from public.abuse_reports where id=p_report for update;
 if not private.is_platform_admin() or exists(select 1 from public.memberships where organization_id=r.organization_id and user_id=private.active_actor() and status='active') then raise exception 'Independent reviewer required' using errcode='42501';end if;
 if p_expected_version is null or r.version<>p_expected_version or r.state<>'open' then raise exception 'Record changed. Reload and try again.' using errcode='40001';end if;
 if p_state is null or p_state not in ('resolved','dismissed') then raise exception 'Invalid report decision';end if;
 perform private.record_admin_decision(r.organization_id,r.id,'abuse.'||p_state,p_reason);
 update public.abuse_reports set state=p_state,resolution=trim(p_reason),resolved_at=clock_timestamp(),version=version+1 where id=r.id;
end; $$;
create function public.manage_account(p_user uuid,p_status text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_platform_admin() then raise exception 'Not permitted' using errcode='42501';end if;perform private.consume_limit('admin.write',30);
 if p_user=private.active_actor() or exists(select 1 from private.platform_administrators where user_id=p_user) then raise exception 'Administrator accounts require the trusted provisioning process';end if;
 if p_status is null or p_status not in ('active','suspended') then raise exception 'Invalid account status';end if;
 perform 1 from public.accounts where id=p_user for update;if not found then raise exception 'Account unavailable';end if;
 perform private.record_admin_decision(null,p_user,'account.'||p_status,p_reason);
 if p_status='suspended' then insert into private.revoked_account_sessions(session_id,user_id) select id,user_id from auth.sessions where user_id=p_user on conflict do nothing;end if;
 update public.accounts set status=p_status where id=p_user;
end; $$;
create function public.manage_organization(p_org uuid,p_status text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_platform_admin() then raise exception 'Not permitted' using errcode='42501';end if;perform private.consume_limit('admin.write',30);
 perform 1 from public.organizations where id=p_org for update;if not found then raise exception 'Organization unavailable';end if;
 if exists(select 1 from public.memberships where organization_id=p_org and user_id=private.active_actor() and status='active') then raise exception 'Independent reviewer required' using errcode='42501';end if;
 if p_status is null or p_status not in ('active','suspended') then raise exception 'Invalid organization status';end if;
 perform private.record_admin_decision(p_org,p_org,'organization.'||p_status,p_reason);
 update public.organizations set status=p_status where id=p_org;
end; $$;

-- Narrow projections avoid granting global access to accounts, drafts, PII,
-- applications, assessment answers or private integrity evidence.
create function public.admin_directory(p_kind text,p_page integer default 1,p_query text default '') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.is_platform_admin() then raise exception 'Not permitted' using errcode='42501';end if;
 if p_page is null or p_page not between 1 and 10000 or p_query is null or length(p_query)>100 then raise exception 'Invalid directory filter';end if;
 if p_kind='users' then select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from(select id,display_name,status,created_at from public.accounts where display_name ilike '%'||replace(replace(replace(p_query,'\','\\'),'%','\%'),'_','\_')||'%' order by created_at desc,id limit 26 offset (p_page-1)*25) x;
 elsif p_kind='jobs' then select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from(select id,organization_id,title,status,moderation_status,version from public.jobs where status<>'draft' and (id::text=p_query or title ilike '%'||replace(replace(replace(p_query,'\','\\'),'%','\%'),'_','\_')||'%') order by created_at desc,id limit 26 offset (p_page-1)*25) x;
 else raise exception 'Invalid directory filter';end if;
 return result;
end; $$;
create function public.platform_overview() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_platform_admin() then raise exception 'Not permitted' using errcode='42501';end if;
 return jsonb_build_object('accounts',(select count(*) from public.accounts),'active_organizations',(select count(*) from public.organizations where status='active'),'verification_pending',(select count(*) from public.verification_requests where state='pending'),'open_reports',(select count(*) from public.abuse_reports where state='open'),'hidden_jobs',(select count(*) from public.jobs where moderation_status='hidden'));
end; $$;
create function public.recruitment_analytics(p_org uuid,p_days integer default 30) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if private.org_role(p_org) is null then raise exception 'Not permitted' using errcode='42501';end if;
 if p_days is null or p_days not between 1 and 365 then raise exception 'Invalid analytics period';end if;
 return jsonb_build_object('days',p_days,'jobs',(select count(*) from public.jobs j where j.organization_id=p_org and private.can_manage_job(p_org,j.id)),
 'stages',(select coalesce(jsonb_object_agg(status,n),'{}') from(select a.status,count(*) n from public.applications a where a.organization_id=p_org and a.submitted_at>=clock_timestamp()-make_interval(days=>p_days) and private.can_review_application(p_org,a.id) group by a.status) x),
 'outcomes',(select coalesce(jsonb_object_agg(outcome,n),'{}') from(select r.outcome,count(*) n from public.assessment_results r join public.applications a on a.id=r.application_id where r.organization_id=p_org and a.submitted_at>=clock_timestamp()-make_interval(days=>p_days) and private.can_review_application(p_org,a.id) group by r.outcome) x));
end; $$;
create function public.integrity_review_queue(p_org uuid default null,p_page integer default 1) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if p_page is null or p_page not between 1 and 10000 then raise exception 'Invalid queue page';end if;
 if p_org is null then
  if not private.is_platform_admin() then raise exception 'Not permitted' using errcode='42501';end if;
  return (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select o.id as organization_id,o.name,count(*) as pending from public.assessment_results r join public.organizations o on o.id=r.organization_id where r.outcome in ('manual_review','integrity_review','appeal_review') group by o.id,o.name order by o.name,o.id limit 26 offset (p_page-1)*25) x);
 end if;
 if private.org_role(p_org) is null then raise exception 'Not permitted' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select t.id,t.application_id,t.attempt_number,t.state,coalesce(r.outcome,'in_progress') as outcome,
 exists(select 1 from public.assessment_integrity_events e where e.attempt_id=t.id and e.kind='simultaneous_session') as overlap_observed
 from public.assessment_attempts t left join public.assessment_results r on r.attempt_id=t.id left join lateral(select outcome from public.assessment_monitor_reviews m where m.attempt_id=t.id order by reviewed_at desc,id desc limit 1) m on true
 where t.organization_id=p_org and private.can_review_application(p_org,t.application_id) and (r.outcome in ('manual_review','integrity_review','appeal_review') or m.outcome='follow_up' or (m.outcome is null and exists(select 1 from public.assessment_integrity_events e where e.attempt_id=t.id and e.kind='simultaneous_session')))
 order by t.started_at,t.id limit 26 offset (p_page-1)*25) x);
end; $$;

revoke all on function private.consume_limit(text,integer),private.guard_business_writes(),private.guard_response_writes(),private.record_admin_decision(uuid,uuid,text,text),private.enforce_job_moderation() from public,anon,authenticated;
revoke all on function public.consume_request_quota(boolean),public.report_job_abuse(uuid,text,text),public.moderate_job(uuid,boolean,integer,text),public.resolve_abuse_report(uuid,integer,text,text),public.manage_account(uuid,text,text),public.manage_organization(uuid,text,text),public.admin_directory(text,integer,text),public.platform_overview(),public.recruitment_analytics(uuid,integer),public.integrity_review_queue(uuid,integer) from public,anon,authenticated;
grant execute on function public.consume_request_quota(boolean),public.report_job_abuse(uuid,text,text),public.moderate_job(uuid,boolean,integer,text),public.resolve_abuse_report(uuid,integer,text,text),public.manage_account(uuid,text,text),public.manage_organization(uuid,text,text),public.admin_directory(text,integer,text),public.platform_overview(),public.recruitment_analytics(uuid,integer),public.integrity_review_queue(uuid,integer) to authenticated;
