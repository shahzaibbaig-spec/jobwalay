-- Company presentation is separate from restricted organization/team records.
create table public.company_profiles (
 organization_id uuid primary key references public.organizations(id),
 company_name text not null check (length(trim(company_name)) between 2 and 120),
 slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 80),
 industry text not null check (length(trim(industry)) between 2 and 100),
 location text not null check (length(trim(location)) between 2 and 160),
 website text not null default '' check (website='' or (website ~ '^https://[^[:space:]]+$' and length(website)<=500)),
 description text not null check (length(trim(description)) between 20 and 10000),
 logo_path text, cover_path text,
 is_public boolean not null default false,
 version integer not null default 1 check (version>0),
 updated_at timestamptz not null default now()
);
create table public.verification_requests (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 legal_name text not null check (length(trim(legal_name)) between 2 and 200),
 registration_number text not null check (length(trim(registration_number)) between 2 and 120),
 notes text not null default '' check (length(notes)<=3000),
 state text not null default 'pending' check (state in ('pending','approved','rejected')),
 submitted_by uuid not null references public.accounts(id),
 reviewed_by uuid references public.accounts(id),
 review_reason text check (length(review_reason) between 5 and 2000),
 created_at timestamptz not null default now(), reviewed_at timestamptz,
 unique(organization_id,id)
);
create unique index verification_one_pending on public.verification_requests(organization_id) where state='pending';

-- Version catalog only: authoring, delivery and grading are separate modules.
create table public.assessments (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 title text not null check (length(title) between 3 and 160), unique(organization_id,id)
);
create table public.assessment_versions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 assessment_id uuid not null, version_number integer not null check(version_number>0),
 status text not null check(status in ('draft','published')),
 summary text not null default '' check(length(summary)<=2000),
 unique(organization_id,id), unique(assessment_id,version_number),
 foreign key(organization_id,assessment_id) references public.assessments(organization_id,id)
);
create function private.valid_skills(skills text[]) returns boolean language sql immutable set search_path='' as $$
 select cardinality(skills)<=30 and not exists(select 1 from unnest(skills) s where s is null or length(trim(s)) not between 1 and 60)
$$;
create function private.job_search(title text,description text,department text,location text,skills text[]) returns tsvector language sql immutable set search_path='' as $$
 select to_tsvector('english'::regconfig,title||' '||description||' '||department||' '||location||' '||coalesce(array_to_string(skills,' '),''))
$$;
create table public.jobs (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 title text not null check(length(trim(title)) between 3 and 160),
 description text not null check(length(trim(description)) between 40 and 20000),
 department text not null default '' check(length(department)<=120),
 location text not null check(length(trim(location)) between 2 and 160),
 work_mode text not null check(work_mode in ('remote','hybrid','onsite')),
 job_type text not null check(job_type in ('full_time','part_time','contract','internship','temporary')),
 experience_min integer not null default 0 check(experience_min between 0 and 60),
 experience_max integer check(experience_max between experience_min and 60),
 education text not null default '' check(length(education)<=500),
 required_skills text[] not null default '{}' check(private.valid_skills(required_skills)),
 salary_min numeric(12,2), salary_max numeric(12,2), salary_currency text,
 salary_period text not null default 'monthly' check(salary_period in ('hourly','monthly','yearly')),
 application_deadline timestamptz,
 positions integer not null default 1 check(positions between 1 and 1000),
 assessment_version_id uuid,
 status text not null default 'draft' check(status in ('draft','published','closed','archived')),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz,
 search_document tsvector generated always as (
  private.job_search(title,description,department,location,required_skills)
 ) stored,
 unique(organization_id,id),
 check(status<>'published' or published_at is not null),
 foreign key(organization_id,assessment_version_id) references public.assessment_versions(organization_id,id),
 check((salary_min is null and salary_max is null and salary_currency is null) or
 (salary_min is not null and salary_max is not null and salary_min>=0 and salary_max>=salary_min and salary_currency is not null and salary_currency ~ '^[A-Z]{3}$'))
);
create index jobs_tenant_status on public.jobs(organization_id,status,created_at desc,id);
create index jobs_search on public.jobs using gin(search_document);
create index jobs_public on public.jobs(published_at desc,id) where status='published';
create index jobs_assessment on public.jobs(organization_id,assessment_version_id);
create table public.job_members (
 organization_id uuid not null, job_id uuid not null, membership_id uuid not null,
 primary key(job_id,membership_id),
 foreign key(organization_id,job_id) references public.jobs(organization_id,id),
 foreign key(organization_id,membership_id) references public.memberships(organization_id,id)
);
create index job_members_actor on public.job_members(membership_id,job_id);

-- Minimal profile-based submission; a future migration adds CVs and ATS stages.
create table public.applications (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null,
 job_id uuid not null, candidate_id uuid not null references public.candidate_profiles(user_id),
 candidate_name text not null, candidate_headline text not null,
 job_title text not null, company_name text not null,
 status text not null default 'submitted' check(status='submitted'),
 submitted_at timestamptz not null default now(), unique(job_id,candidate_id), unique(organization_id,id),
 foreign key(organization_id,job_id) references public.jobs(organization_id,id)
);
create index applications_candidate on public.applications(candidate_id,submitted_at desc);
create index applications_job on public.applications(organization_id,job_id);

create function private.company_is_public(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organizations o join public.company_profiles p on p.organization_id=o.id
 where o.id=org and o.status='active' and o.verification_status='approved' and p.is_public)
$$;
create function private.can_manage_job(org uuid, job uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(private.org_role(org) in ('owner','admin') or
 (private.org_role(org)='recruiter' and exists(select 1 from public.job_members jm join public.memberships m on m.id=jm.membership_id and m.organization_id=jm.organization_id
 where jm.organization_id=org and jm.job_id=job and m.user_id=private.active_actor() and m.status='active')),false)
$$;
alter table public.company_profiles enable row level security;
alter table public.verification_requests enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_versions enable row level security;
alter table public.jobs enable row level security;
alter table public.job_members enable row level security;
alter table public.applications enable row level security;
revoke all on public.company_profiles,public.verification_requests,public.assessments,public.assessment_versions,public.jobs,public.job_members,public.applications from anon,authenticated;
grant select on public.company_profiles,public.jobs to anon,authenticated;
grant select on public.verification_requests,public.assessments,public.assessment_versions,public.job_members,public.applications to authenticated;
create policy company_public on public.company_profiles for select to anon,authenticated using(private.company_is_public(organization_id));
create policy company_team on public.company_profiles for select to authenticated using(private.org_role(organization_id) is not null or private.is_platform_admin());
create policy verification_authorized on public.verification_requests for select to authenticated using(private.org_role(organization_id) in ('owner','admin') or private.is_platform_admin());
create policy assessments_team on public.assessments for select to authenticated using(private.org_role(organization_id) is not null);
create policy versions_team on public.assessment_versions for select to authenticated using(private.org_role(organization_id) is not null);
create policy job_public on public.jobs for select to anon,authenticated using(status='published' and (application_deadline is null or application_deadline>now()) and private.company_is_public(organization_id));
create policy job_managers on public.jobs for select to authenticated using(private.can_manage_job(organization_id,id));
create policy job_assignments on public.job_members for select to authenticated using(private.can_manage_job(organization_id,job_id));
create policy application_access on public.applications for select to authenticated using(candidate_id=private.active_actor() or private.can_manage_job(organization_id,job_id));

create function public.save_company_profile(p_org uuid,p_expected_version integer,p_input jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare current_profile public.company_profiles; identity_changed boolean;
begin
 perform 1 from public.organizations where id=p_org for update;
 if coalesce(private.org_role(p_org),'') not in ('owner','admin') then raise exception 'Not permitted' using errcode='42501'; end if;
 if p_input is null or jsonb_typeof(p_input)<>'object' or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('company_name','slug','industry','location','website','description','is_public')) then raise exception 'Invalid profile'; end if;
 select * into current_profile from public.company_profiles where organization_id=p_org;
 if p_expected_version is null or coalesce(current_profile.version,0)<>p_expected_version then raise exception 'Record changed. Reload and try again.' using errcode='40001'; end if;
 identity_changed := current_profile.organization_id is not null and
 (current_profile.company_name is distinct from p_input->>'company_name' or current_profile.website is distinct from coalesce(p_input->>'website',''));
 if identity_changed and exists(select 1 from public.verification_requests where organization_id=p_org and state='pending') then raise exception 'Resolve the pending verification request before changing company name or website'; end if;
 insert into public.company_profiles(organization_id,company_name,slug,industry,location,website,description,is_public)
 values(p_org,p_input->>'company_name',p_input->>'slug',p_input->>'industry',p_input->>'location',coalesce(p_input->>'website',''),p_input->>'description',coalesce((p_input->>'is_public')::boolean,false))
 on conflict(organization_id) do update set company_name=excluded.company_name,slug=excluded.slug,industry=excluded.industry,location=excluded.location,website=excluded.website,description=excluded.description,is_public=excluded.is_public,version=public.company_profiles.version+1,updated_at=now();
 update public.organizations set name=p_input->>'company_name',verification_status=case when identity_changed then 'pending' else verification_status end where id=p_org;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(p_org,private.active_actor(),'company.profile.saved',p_org);
end; $$;
create function public.request_verification(p_org uuid,p_legal_name text,p_registration_number text,p_notes text) returns uuid
language plpgsql security definer set search_path='' as $$
declare request_id uuid;
begin
 perform 1 from public.organizations where id=p_org for update;
 if coalesce(private.org_role(p_org),'') not in ('owner','admin') then raise exception 'Not permitted' using errcode='42501'; end if;
 if not exists(select 1 from public.company_profiles where organization_id=p_org) then raise exception 'Save a company profile first'; end if;
 if exists(select 1 from public.organizations where id=p_org and verification_status='approved') then raise exception 'Organization is already verified'; end if;
 insert into public.verification_requests(organization_id,legal_name,registration_number,notes,submitted_by)
 values(p_org,trim(p_legal_name),trim(p_registration_number),p_notes,private.active_actor()) returning id into request_id;
 update public.organizations set verification_status='pending' where id=p_org;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(p_org,private.active_actor(),'verification.requested',request_id);
 return request_id;
end; $$;
create function public.review_verification(p_request uuid,p_decision text,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare request public.verification_requests;
begin
 if not private.is_platform_admin() then raise exception 'Not permitted' using errcode='42501'; end if;
 select * into request from public.verification_requests where id=p_request;
 if request.id is null then raise exception 'Request unavailable'; end if;
 perform 1 from public.organizations where id=request.organization_id and status='active' for update;
 if not found then raise exception 'Organization unavailable'; end if;
 select * into request from public.verification_requests where id=p_request for update;
 if request.state<>'pending' or p_decision not in ('approved','rejected') or length(trim(p_reason)) not between 5 and 2000 or p_reason is null then raise exception 'Invalid review'; end if;
 if exists(select 1 from public.memberships where organization_id=request.organization_id and user_id=private.active_actor() and status='active') then raise exception 'Independent reviewer required' using errcode='42501'; end if;
 update public.verification_requests set state=p_decision,review_reason=trim(p_reason),reviewed_by=private.active_actor(),reviewed_at=now() where id=p_request;
 update public.organizations set verification_status=p_decision where id=request.organization_id;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(request.organization_id,private.active_actor(),'verification.'||p_decision,p_request);
end; $$;

create function public.save_job(p_org uuid,p_expected_version integer,p_input jsonb,p_job_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare existing public.jobs; result_id uuid; skills text[]; assessment uuid;
begin
 perform 1 from public.organizations where id=p_org for update;
 if private.org_role(p_org) is null then raise exception 'Not permitted' using errcode='42501'; end if;
 if p_job_id is not null then
  select * into existing from public.jobs where organization_id=p_org and id=p_job_id for update;
  if existing.id is null or not private.can_manage_job(p_org,p_job_id) then raise exception 'Not permitted' using errcode='42501'; end if;
  if p_expected_version is null or existing.version<>p_expected_version then raise exception 'Record changed. Reload and try again.' using errcode='40001'; end if;
  if existing.status='archived' then raise exception 'Archived jobs cannot be edited'; end if;
 elsif p_expected_version is null or p_expected_version<>0 then raise exception 'Invalid version';
 end if;
 if p_input is null or jsonb_typeof(p_input)<>'object' or exists(select 1 from jsonb_object_keys(p_input) k where k not in
 ('title','description','department','location','work_mode','job_type','experience_min','experience_max','education','required_skills','salary_min','salary_max','salary_currency','salary_period','application_deadline','positions','assessment_version_id')) then raise exception 'Invalid job'; end if;
 if jsonb_typeof(p_input->'required_skills')<>'array' or exists(select 1 from jsonb_array_elements(p_input->'required_skills') s where jsonb_typeof(s)<>'string') then raise exception 'Invalid skills'; end if;
 select coalesce(array_agg(trim(value)),'{}') into skills from jsonb_array_elements_text(p_input->'required_skills');
 assessment := nullif(p_input->>'assessment_version_id','')::uuid;
 if assessment is not null and not exists(select 1 from public.assessment_versions where id=assessment and organization_id=p_org and status='published') then raise exception 'Assessment must be a published version in this organization' using errcode='42501'; end if;
 if existing.status='published' and nullif(p_input->>'application_deadline','')::timestamptz<=clock_timestamp() then raise exception 'Published jobs require a future deadline'; end if;
 if p_job_id is null then
  insert into public.jobs(organization_id,title,description,location,work_mode,job_type) values(p_org,p_input->>'title',p_input->>'description',p_input->>'location',p_input->>'work_mode',p_input->>'job_type') returning id into result_id;
  insert into public.job_members(organization_id,job_id,membership_id) select p_org,result_id,id from public.memberships where organization_id=p_org and user_id=private.active_actor() and status='active';
 else result_id := p_job_id;
 end if;
 update public.jobs set title=p_input->>'title',description=p_input->>'description',department=coalesce(p_input->>'department',''),location=p_input->>'location',work_mode=p_input->>'work_mode',job_type=p_input->>'job_type',
 experience_min=coalesce((p_input->>'experience_min')::integer,0),experience_max=(p_input->>'experience_max')::integer,education=coalesce(p_input->>'education',''),required_skills=skills,
 salary_min=(p_input->>'salary_min')::numeric,salary_max=(p_input->>'salary_max')::numeric,salary_currency=nullif(p_input->>'salary_currency',''),salary_period=coalesce(p_input->>'salary_period','monthly'),
 application_deadline=nullif(p_input->>'application_deadline','')::timestamptz,positions=coalesce((p_input->>'positions')::integer,1),assessment_version_id=assessment,
 version=case when p_job_id is null then 1 else version+1 end,updated_at=now() where id=result_id and organization_id=p_org;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(p_org,private.active_actor(),case when p_job_id is null then 'job.created' else 'job.updated' end,result_id);
 return result_id;
end; $$;
create function public.transition_job(p_org uuid,p_job_id uuid,p_expected_version integer,p_status text) returns void
language plpgsql security definer set search_path='' as $$
declare job public.jobs;
begin
 perform 1 from public.organizations where id=p_org for update;
 if not private.can_manage_job(p_org,p_job_id) then raise exception 'Not permitted' using errcode='42501'; end if;
 select * into job from public.jobs where organization_id=p_org and id=p_job_id for update;
 if job.id is null then raise exception 'Job unavailable'; end if;
 if p_expected_version is null or job.version<>p_expected_version then raise exception 'Record changed. Reload and try again.' using errcode='40001'; end if;
 if not ((job.status in ('draft','closed') and p_status='published') or (job.status='published' and p_status='closed') or (job.status in ('draft','closed') and p_status='archived')) or p_status is null then raise exception 'Invalid job transition'; end if;
 if p_status='published' then
  if not private.company_is_public(p_org) then raise exception 'Publishing requires a verified, public company profile'; end if;
  if job.application_deadline is not null and job.application_deadline<=clock_timestamp() then raise exception 'Job deadline has passed'; end if;
  if job.assessment_version_id is not null and not exists(select 1 from public.assessment_versions where organization_id=p_org and id=job.assessment_version_id and status='published') then raise exception 'Assessment unavailable'; end if;
 end if;
 update public.jobs set status=p_status,version=version+1,updated_at=now(),published_at=case when p_status='published' then coalesce(published_at,now()) else published_at end where id=job.id;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(p_org,private.active_actor(),'job.'||p_status,job.id);
end; $$;
create function public.assign_job_recruiter(p_org uuid,p_job_id uuid,p_membership uuid,p_assign boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.organizations where id=p_org for update;
 if coalesce(private.org_role(p_org),'') not in ('owner','admin') then raise exception 'Not permitted' using errcode='42501'; end if;
 if p_assign is null then raise exception 'Invalid assignment'; end if;
 if not exists(select 1 from public.jobs where organization_id=p_org and id=p_job_id) or not exists(select 1 from public.memberships where organization_id=p_org and id=p_membership and role='recruiter' and status='active') then raise exception 'Invalid assignment' using errcode='42501'; end if;
 if p_assign then insert into public.job_members values(p_org,p_job_id,p_membership) on conflict do nothing;
 else delete from public.job_members where organization_id=p_org and job_id=p_job_id and membership_id=p_membership; end if;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(p_org,private.active_actor(),case when p_assign then 'job.recruiter.assigned' else 'job.recruiter.removed' end,p_job_id);
end; $$;
create function public.apply_to_job(p_job uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare job public.jobs; actor uuid:=private.active_actor(); application uuid; org uuid;
begin
 if actor is null then raise exception 'Not permitted' using errcode='42501'; end if;
 select organization_id into org from public.jobs where id=p_job;
 -- Same lock order as close/edit/publish. Recheck eligibility after acquiring locks.
 perform 1 from public.organizations where id=org for update;
 select * into job from public.jobs where id=p_job for update;
 if job.id is null or job.status<>'published' or not private.company_is_public(job.organization_id) or (job.application_deadline is not null and job.application_deadline<=clock_timestamp()) then raise exception 'This job is not accepting applications'; end if;
 if not exists(select 1 from public.candidate_profiles where user_id=actor) then raise exception 'Create a candidate profile before applying'; end if;
 insert into public.applications(organization_id,job_id,candidate_id,candidate_name,candidate_headline,job_title,company_name)
 select job.organization_id,job.id,actor,a.display_name,p.headline,job.title,c.company_name from public.accounts a join public.candidate_profiles p on p.user_id=a.id join public.company_profiles c on c.organization_id=job.organization_id where a.id=actor
 on conflict(job_id,candidate_id) do nothing returning id into application;
 if application is null then select id into application from public.applications where job_id=job.id and candidate_id=actor;
 else insert into public.audit_events(organization_id,actor_id,action,target_id) values(job.organization_id,actor,'application.submitted',application); end if;
 return application;
end; $$;

revoke all on all functions in schema private from public,anon;
grant execute on function private.company_is_public(uuid) to anon,authenticated;
grant execute on function private.can_manage_job(uuid,uuid) to authenticated;
grant usage on schema private to anon;
revoke all on function public.save_company_profile(uuid,integer,jsonb),public.request_verification(uuid,text,text,text),public.review_verification(uuid,text,text),public.save_job(uuid,integer,jsonb,uuid),public.transition_job(uuid,uuid,integer,text),public.assign_job_recruiter(uuid,uuid,uuid,boolean),public.apply_to_job(uuid) from public,anon,authenticated;
grant execute on function public.save_company_profile(uuid,integer,jsonb),public.request_verification(uuid,text,text,text),public.review_verification(uuid,text,text),public.save_job(uuid,integer,jsonb,uuid),public.transition_job(uuid,uuid,integer,text),public.assign_job_recruiter(uuid,uuid,uuid,boolean),public.apply_to_job(uuid) to authenticated;
