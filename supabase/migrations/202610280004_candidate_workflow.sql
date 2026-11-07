-- User-owned professional data remains private; public access is a safe projection.
alter table public.candidate_profiles add column skills text[] not null default '{}' check(private.valid_skills(skills));
alter table public.candidate_profiles add column slug text unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 80);
alter table public.candidate_profiles add column visibility text not null default 'private' check(visibility in ('private','public'));
alter table public.candidate_profiles add column version integer not null default 1 check(version>0);
alter table public.candidate_profiles add check(visibility<>'public' or slug is not null);
create table public.candidate_experiences (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.candidate_profiles(user_id),
 company text not null check(length(trim(company)) between 1 and 160), title text not null check(length(trim(title)) between 1 and 160),
 location text not null default '' check(length(location)<=160), started_on date not null, ended_on date,
 description text not null default '' check(length(description)<=2000), check(ended_on is null or ended_on>=started_on)
);
create table public.candidate_education (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.candidate_profiles(user_id),
 school text not null check(length(trim(school)) between 1 and 160), qualification text not null check(length(trim(qualification)) between 1 and 160),
 field_of_study text not null default '' check(length(field_of_study)<=160), started_on date not null, ended_on date,
 description text not null default '' check(length(description)<=1000),check(ended_on is null or ended_on>=started_on)
);
create table public.candidate_certifications (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.candidate_profiles(user_id),
 name text not null check(length(trim(name)) between 1 and 160),issuer text not null check(length(trim(issuer)) between 1 and 160),
 issued_on date not null,expires_on date,credential_url text not null default '' check(credential_url='' or (credential_url ~ '^https://[^[:space:]]+$' and length(credential_url)<=500)),
 check(expires_on is null or expires_on>=issued_on)
);
create index experience_owner on public.candidate_experiences(user_id,started_on desc);
create index education_owner on public.candidate_education(user_id,started_on desc);
create index certification_owner on public.candidate_certifications(user_id,issued_on desc);
alter table public.candidate_experiences enable row level security;
alter table public.candidate_education enable row level security;
alter table public.candidate_certifications enable row level security;
revoke all on public.candidate_experiences,public.candidate_education,public.candidate_certifications from anon,authenticated;
grant select on public.candidate_experiences,public.candidate_education,public.candidate_certifications to authenticated;
create policy experience_self on public.candidate_experiences for select to authenticated using(user_id=private.active_actor());
create policy education_self on public.candidate_education for select to authenticated using(user_id=private.active_actor());
create policy certifications_self on public.candidate_certifications for select to authenticated using(user_id=private.active_actor());

create function public.save_professional_profile(p_headline text,p_bio text,p_skills text[],p_slug text,p_visibility text,p_expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_actor(); existing_version integer;
begin
 if actor is null then raise exception 'Not permitted' using errcode='42501'; end if;
 perform 1 from public.accounts where id=actor for update;
 select version into existing_version from public.candidate_profiles where user_id=actor;
 if p_expected_version is null or coalesce(existing_version,0)<>p_expected_version then raise exception 'Record changed. Reload and try again.' using errcode='40001'; end if;
 insert into public.candidate_profiles(user_id,headline,bio,skills,slug,visibility)
 values(actor,trim(p_headline),p_bio,p_skills,nullif(p_slug,''),p_visibility)
 on conflict(user_id) do update set headline=excluded.headline,bio=excluded.bio,skills=excluded.skills,slug=excluded.slug,visibility=excluded.visibility,version=public.candidate_profiles.version+1,updated_at=now();
 insert into public.audit_events(actor_id,action,target_id) values(actor,'candidate.profile.saved',actor);
end; $$;
create or replace function public.save_candidate_profile(p_headline text,p_bio text) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_actor();
begin
 if actor is null then raise exception 'Not permitted' using errcode='42501'; end if;
 perform 1 from public.accounts where id=actor for update;
 insert into public.candidate_profiles(user_id,headline,bio) values(actor,trim(p_headline),p_bio)
 on conflict(user_id) do update set headline=excluded.headline,bio=excluded.bio,version=public.candidate_profiles.version+1,updated_at=now();
 insert into public.audit_events(actor_id,action,target_id) values(actor,'candidate.saved',actor);
end; $$;
create function public.save_candidate_entry(p_kind text,p_input jsonb,p_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_actor(); entry_id uuid;
begin
 if actor is null then raise exception 'Not permitted' using errcode='42501'; end if;
 perform 1 from public.accounts where id=actor for update;
 if p_input is null or jsonb_typeof(p_input)<>'object' then raise exception 'Invalid entry'; end if;
 if p_kind='experience' then
  if exists(select 1 from jsonb_object_keys(p_input) k where k not in ('company','title','location','started_on','ended_on','description')) then raise exception 'Invalid entry'; end if;
  if p_id is null then
   if (select count(*) from public.candidate_experiences where user_id=actor)>=50 then raise exception 'Profile entry limit reached'; end if;
   insert into public.candidate_experiences(user_id,company,title,location,started_on,ended_on,description) values(actor,p_input->>'company',p_input->>'title',coalesce(p_input->>'location',''),(p_input->>'started_on')::date,nullif(p_input->>'ended_on','')::date,coalesce(p_input->>'description','')) returning id into entry_id;
  else
   update public.candidate_experiences set company=p_input->>'company',title=p_input->>'title',location=coalesce(p_input->>'location',''),started_on=(p_input->>'started_on')::date,ended_on=nullif(p_input->>'ended_on','')::date,description=coalesce(p_input->>'description','') where id=p_id and user_id=actor returning id into entry_id;
  end if;
 elsif p_kind='education' then
  if exists(select 1 from jsonb_object_keys(p_input) k where k not in ('school','qualification','field_of_study','started_on','ended_on','description')) then raise exception 'Invalid entry'; end if;
  if p_id is null then
   if (select count(*) from public.candidate_education where user_id=actor)>=50 then raise exception 'Profile entry limit reached'; end if;
   insert into public.candidate_education(user_id,school,qualification,field_of_study,started_on,ended_on,description) values(actor,p_input->>'school',p_input->>'qualification',coalesce(p_input->>'field_of_study',''),(p_input->>'started_on')::date,nullif(p_input->>'ended_on','')::date,coalesce(p_input->>'description','')) returning id into entry_id;
  else
   update public.candidate_education set school=p_input->>'school',qualification=p_input->>'qualification',field_of_study=coalesce(p_input->>'field_of_study',''),started_on=(p_input->>'started_on')::date,ended_on=nullif(p_input->>'ended_on','')::date,description=coalesce(p_input->>'description','') where id=p_id and user_id=actor returning id into entry_id;
  end if;
 elsif p_kind='certification' then
  if exists(select 1 from jsonb_object_keys(p_input) k where k not in ('name','issuer','issued_on','expires_on','credential_url')) then raise exception 'Invalid entry'; end if;
  if p_id is null then
   if (select count(*) from public.candidate_certifications where user_id=actor)>=50 then raise exception 'Profile entry limit reached'; end if;
   insert into public.candidate_certifications(user_id,name,issuer,issued_on,expires_on,credential_url) values(actor,p_input->>'name',p_input->>'issuer',(p_input->>'issued_on')::date,nullif(p_input->>'expires_on','')::date,coalesce(p_input->>'credential_url','')) returning id into entry_id;
  else
   update public.candidate_certifications set name=p_input->>'name',issuer=p_input->>'issuer',issued_on=(p_input->>'issued_on')::date,expires_on=nullif(p_input->>'expires_on','')::date,credential_url=coalesce(p_input->>'credential_url','') where id=p_id and user_id=actor returning id into entry_id;
  end if;
 else raise exception 'Invalid entry type';
 end if;
 if entry_id is null then raise exception 'Entry unavailable' using errcode='42501'; end if;
 insert into public.audit_events(actor_id,action,target_id) values(actor,'candidate.entry.saved',entry_id);
 return entry_id;
end; $$;
create function public.delete_candidate_entry(p_kind text,p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_actor(); deleted uuid;
begin
 if actor is null then raise exception 'Not permitted' using errcode='42501'; end if;
 perform 1 from public.accounts where id=actor for update;
 if p_kind='experience' then delete from public.candidate_experiences where id=p_id and user_id=actor returning id into deleted;
 elsif p_kind='education' then delete from public.candidate_education where id=p_id and user_id=actor returning id into deleted;
 elsif p_kind='certification' then delete from public.candidate_certifications where id=p_id and user_id=actor returning id into deleted;
 else raise exception 'Invalid entry type'; end if;
 if deleted is null then raise exception 'Entry unavailable' using errcode='42501'; end if;
 insert into public.audit_events(actor_id,action,target_id) values(actor,'candidate.entry.deleted',deleted);
end; $$;
create function private.candidate_snapshot(candidate uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('name',a.display_name,'headline',p.headline,'bio',p.bio,'skills',p.skills,
 'experiences',coalesce((select jsonb_agg(jsonb_build_object('company',e.company,'title',e.title,'location',e.location,'started_on',e.started_on,'ended_on',e.ended_on,'description',e.description) order by e.started_on desc,e.id) from public.candidate_experiences e where e.user_id=candidate),'[]'::jsonb),
 'education',coalesce((select jsonb_agg(jsonb_build_object('school',e.school,'qualification',e.qualification,'field_of_study',e.field_of_study,'started_on',e.started_on,'ended_on',e.ended_on,'description',e.description) order by e.started_on desc,e.id) from public.candidate_education e where e.user_id=candidate),'[]'::jsonb),
 'certifications',coalesce((select jsonb_agg(jsonb_build_object('name',c.name,'issuer',c.issuer,'issued_on',c.issued_on,'expires_on',c.expires_on,'credential_url',c.credential_url) order by c.issued_on desc,c.id) from public.candidate_certifications c where c.user_id=candidate),'[]'::jsonb))
 from public.accounts a join public.candidate_profiles p on p.user_id=a.id where a.id=candidate
$$;
create function public.get_public_candidate(p_slug text) returns jsonb language sql stable security definer set search_path='' as $$
 select private.candidate_snapshot(p.user_id) from public.candidate_profiles p join public.accounts a on a.id=p.user_id join auth.users u on u.id=a.id
 where p.slug=p_slug and p.visibility='public' and a.status='active' and u.email_confirmed_at is not null
$$;

create table public.candidate_documents (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.candidate_profiles(user_id),
 object_key text not null unique,filename text not null check(length(filename) between 1 and 160 and filename !~ '[\r\n]'),
 size_bytes integer not null check(size_bytes between 1 and 10485760),sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 scan_status text not null default 'pending' check(scan_status in ('pending','clean','rejected','error')),
 created_at timestamptz not null default clock_timestamp(),scanned_at timestamptz,unique(user_id,id),
 check(object_key=user_id::text||'/'||id::text||'.pdf')
);
create index cv_owner on public.candidate_documents(user_id,created_at desc);
alter table public.candidate_profiles add column current_cv_id uuid;
alter table public.candidate_profiles add foreign key(user_id,current_cv_id) references public.candidate_documents(user_id,id);
alter table public.candidate_documents enable row level security;
revoke all on public.candidate_documents from anon,authenticated;
grant select on public.candidate_documents to authenticated;
create policy cv_metadata_owner on public.candidate_documents for select to authenticated using(user_id=private.active_actor());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('candidate-cvs','candidate-cvs',false,10485760,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf'];
create function public.begin_cv_upload(p_filename text,p_size integer,p_sha256 text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_actor(); document uuid:=gen_random_uuid();
begin
 if actor is null then raise exception 'Not permitted' using errcode='42501'; end if;
 perform 1 from public.accounts where id=actor for update;
 if (select count(*) from public.candidate_documents where user_id=actor and created_at>now()-interval '1 hour')>=10 then raise exception 'CV upload limit reached. Try again later.'; end if;
 insert into public.candidate_documents(id,user_id,object_key,filename,size_bytes,sha256) values(document,actor,actor::text||'/'||document::text||'.pdf',p_filename,p_size,p_sha256);
 insert into public.audit_events(actor_id,action,target_id) values(actor,'cv.upload.started',document);
 return document;
end; $$;
create function public.finish_cv_scan(p_document uuid,p_sha256 text,p_result text) returns void language plpgsql security definer set search_path='' as $$
declare doc public.candidate_documents; current_created timestamptz; owner_id uuid;
begin
 -- EXECUTE is granted only to service_role. No user RPC can assert scan success.
 select user_id into owner_id from public.candidate_documents where id=p_document;
 perform 1 from public.accounts where id=owner_id for update;
 select * into doc from public.candidate_documents where id=p_document for update;
 if doc.id is null or doc.scan_status<>'pending' or doc.sha256 is distinct from p_sha256 or p_result is null or p_result not in ('clean','rejected','error') then raise exception 'Invalid scan completion'; end if;
 if p_result='clean' and not exists(select 1 from storage.objects where bucket_id='candidate-cvs' and name=doc.object_key and metadata->>'mimetype'='application/pdf' and (metadata->>'size')::bigint=doc.size_bytes) then raise exception 'Uploaded CV unavailable'; end if;
 update public.candidate_documents set scan_status=p_result,scanned_at=clock_timestamp() where id=doc.id;
 select d.created_at into current_created from public.candidate_profiles p join public.candidate_documents d on d.id=p.current_cv_id where p.user_id=doc.user_id;
 if p_result='clean' and (current_created is null or doc.created_at>current_created) then update public.candidate_profiles set current_cv_id=doc.id,version=version+1,updated_at=now() where user_id=doc.user_id; end if;
 insert into public.audit_events(actor_id,action,target_id) values(null,'cv.scan.'||p_result,doc.id);
end; $$;
create function public.set_current_cv(p_document uuid) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_actor();
begin
 if actor is null then raise exception 'Not permitted' using errcode='42501'; end if;
 perform 1 from public.accounts where id=actor for update;
 if not exists(select 1 from public.candidate_documents where id=p_document and user_id=actor and scan_status='clean') then raise exception 'CV unavailable' using errcode='42501'; end if;
 update public.candidate_profiles set current_cv_id=p_document,version=version+1,updated_at=now() where user_id=actor;
 insert into public.audit_events(actor_id,action,target_id) values(actor,'cv.current.changed',p_document);
end; $$;

-- Application identity and status remain available for history. Sensitive shared
-- material lives separately so withdrawal can revoke employer access to it.
alter table public.applications drop constraint applications_status_check;
alter table public.applications add check(status in ('submitted','screening','assessment','interview','offer','hired','rejected','withdrawn'));
alter table public.applications add column version integer not null default 1 check(version>0);
alter table public.applications drop constraint applications_job_id_candidate_id_key;
create unique index one_active_application on public.applications(job_id,candidate_id) where status not in ('rejected','withdrawn');
alter table public.applications add unique(organization_id,id,candidate_id);
create index applications_pipeline on public.applications(organization_id,status,submitted_at desc,id);
create table public.application_details (
 application_id uuid primary key,organization_id uuid not null,candidate_id uuid not null,document_id uuid,
 contact_email text not null check(length(contact_email)<=254),phone text not null default '' check(length(phone)<=50),
 cover_letter text not null default '' check(length(cover_letter)<=5000),profile_snapshot jsonb not null,consented_at timestamptz,
 foreign key(organization_id,application_id,candidate_id) references public.applications(organization_id,id,candidate_id),
 foreign key(candidate_id,document_id) references public.candidate_documents(user_id,id)
);
insert into public.application_details(application_id,organization_id,candidate_id,contact_email,profile_snapshot)
select id,organization_id,candidate_id,'',jsonb_build_object('name',candidate_name,'headline',candidate_headline,'bio','','skills','[]'::jsonb,'experiences','[]'::jsonb,'education','[]'::jsonb,'certifications','[]'::jsonb) from public.applications;
create index application_document on public.application_details(document_id);
create table public.application_events (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,application_id uuid not null,
 from_status text,to_status text not null,message text not null default '' check(length(message)<=2000),
 occurred_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,application_id) references public.applications(organization_id,id)
);
create index application_events_timeline on public.application_events(application_id,occurred_at,id);
insert into public.application_events(organization_id,application_id,to_status,message,occurred_at) select organization_id,id,status,'Existing application imported',submitted_at from public.applications;
create table public.application_notes (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,application_id uuid not null,
 author_id uuid not null references public.accounts(id),body text not null check(length(trim(body)) between 1 and 5000),created_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,application_id) references public.applications(organization_id,id)
);
create index application_notes_timeline on public.application_notes(application_id,created_at,id);
create function private.can_review_application(org uuid,application uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.applications a where a.organization_id=org and a.id=application and a.candidate_id<>private.active_actor() and private.can_manage_job(org,a.job_id))
$$;
create function private.can_read_application_details(org uuid,application uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.applications a where a.organization_id=org and a.id=application and (a.candidate_id=private.active_actor() or (a.status<>'withdrawn' and private.can_review_application(org,a.id))))
$$;
alter table public.application_details enable row level security;
alter table public.application_events enable row level security;
alter table public.application_notes enable row level security;
revoke all on public.application_details,public.application_events,public.application_notes from anon,authenticated;
grant select on public.application_details,public.application_events,public.application_notes to authenticated;
create policy application_shared_details on public.application_details for select to authenticated using(private.can_read_application_details(organization_id,application_id));
create policy application_history on public.application_events for select to authenticated using(exists(select 1 from public.applications a where a.id=application_id and a.organization_id=application_events.organization_id));
create policy recruitment_notes on public.application_notes for select to authenticated using(private.can_review_application(organization_id,application_id));
create function private.record_application_status() returns trigger language plpgsql security definer set search_path='' as $$
declare previous text;
begin
 if tg_op='UPDATE' then
  if old.status=new.status then return new; end if;
  previous:=old.status;
 end if;
 insert into public.application_events(organization_id,application_id,from_status,to_status,message)
 values(new.organization_id,new.id,previous,new.status,coalesce(current_setting('app.status_message',true),''));
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(new.organization_id,private.active_actor(),'application.'||new.status,new.id);
 return new;
end; $$;
create trigger application_status_history after insert or update of status on public.applications for each row execute function private.record_application_status();

drop function public.apply_to_job(uuid);
create function public.apply_to_job(p_job uuid,p_document uuid default null,p_contact_email text default '',p_phone text default '',p_cover_letter text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare job public.jobs;actor uuid:=private.active_actor();application uuid;org uuid;cv uuid;email_address text;
begin
 if actor is null then raise exception 'Not permitted' using errcode='42501'; end if;
 select organization_id into org from public.jobs where id=p_job;
 perform 1 from public.organizations where id=org for update;
 select * into job from public.jobs where id=p_job for update;
 if job.id is null or job.status<>'published' or not private.company_is_public(job.organization_id) or (job.application_deadline is not null and job.application_deadline<=clock_timestamp()) then raise exception 'This job is not accepting applications'; end if;
 select id into application from public.applications where job_id=job.id and candidate_id=actor and status not in ('withdrawn','rejected');
 if application is not null then return application; end if;
 if not exists(select 1 from public.candidate_profiles where user_id=actor) then raise exception 'Create a candidate profile before applying'; end if;
 perform 1 from public.accounts where id=actor for update;
 cv:=p_document;
 if cv is null then select current_cv_id into cv from public.candidate_profiles where user_id=actor; end if;
 perform 1 from public.candidate_documents where id=cv and user_id=actor and scan_status='clean' for update;
 if not found then raise exception 'Choose a clean, verified CV before applying'; end if;
 if p_contact_email='' then select email into email_address from auth.users where id=actor; else email_address:=trim(p_contact_email); end if;
 if email_address is null or email_address !~ '^[^ @]+@[^ @]+\.[^ @]+$' or length(email_address)>254 or p_phone is null or p_cover_letter is null then raise exception 'Invalid application details'; end if;
 perform set_config('app.status_message','Application submitted',true);
 insert into public.applications(organization_id,job_id,candidate_id,candidate_name,candidate_headline,job_title,company_name)
 select job.organization_id,job.id,actor,a.display_name,p.headline,job.title,c.company_name from public.accounts a join public.candidate_profiles p on p.user_id=a.id join public.company_profiles c on c.organization_id=job.organization_id where a.id=actor returning id into application;
 insert into public.application_details(application_id,organization_id,candidate_id,document_id,contact_email,phone,cover_letter,profile_snapshot,consented_at)
 values(application,job.organization_id,actor,cv,email_address,p_phone,p_cover_letter,private.candidate_snapshot(actor),clock_timestamp());
 return application;
end; $$;
create function public.transition_application(p_org uuid,p_application uuid,p_expected_version integer,p_status text,p_message text default '') returns void
language plpgsql security definer set search_path='' as $$
declare app public.applications;
begin
 perform 1 from public.organizations where id=p_org for update;
 if not private.can_review_application(p_org,p_application) then raise exception 'Not permitted' using errcode='42501'; end if;
 select * into app from public.applications where organization_id=p_org and id=p_application for update;
 if p_expected_version is null or app.version<>p_expected_version then raise exception 'Record changed. Reload and try again.' using errcode='40001'; end if;
 if p_status is null or not (
 (app.status='submitted' and p_status in ('screening','assessment','interview','rejected')) or
 (app.status='screening' and p_status in ('assessment','interview','offer','rejected')) or
 (app.status='assessment' and p_status in ('screening','interview','rejected')) or
 (app.status='interview' and p_status in ('offer','rejected')) or
 (app.status='offer' and p_status in ('hired','rejected'))) then raise exception 'Invalid application transition'; end if;
 if p_message is null or length(p_message)>2000 then raise exception 'Invalid status message'; end if;
 perform set_config('app.status_message',p_message,true);
 update public.applications set status=p_status,version=version+1 where id=app.id;
end; $$;
create function public.withdraw_application(p_application uuid,p_expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare app public.applications; actor uuid:=private.active_actor(); org uuid;
begin
 if actor is null then raise exception 'Not permitted' using errcode='42501'; end if;
 select organization_id into org from public.applications where id=p_application and candidate_id=actor;
 perform 1 from public.organizations where id=org for update;
 select * into app from public.applications where id=p_application and candidate_id=actor for update;
 if app.id is null then raise exception 'Not permitted' using errcode='42501'; end if;
 if p_expected_version is null or app.version<>p_expected_version then raise exception 'Record changed. Reload and try again.' using errcode='40001'; end if;
 if app.status in ('withdrawn','rejected','hired') then raise exception 'Application is already final'; end if;
 perform set_config('app.status_message','Candidate withdrew application',true);
 update public.applications set status='withdrawn',version=version+1 where id=app.id;
end; $$;
create function public.add_application_note(p_org uuid,p_application uuid,p_body text) returns void
language plpgsql security definer set search_path='' as $$
declare note uuid;
begin
 perform 1 from public.organizations where id=p_org for update;
 if not private.can_review_application(p_org,p_application) then raise exception 'Not permitted' using errcode='42501'; end if;
 if (select count(*) from public.application_notes where application_id=p_application)>=500 then raise exception 'Note limit reached'; end if;
 insert into public.application_notes(organization_id,application_id,author_id,body) values(p_org,p_application,private.active_actor(),trim(p_body)) returning id into note;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(p_org,private.active_actor(),'application.note.added',note);
end; $$;

create function private.can_read_cv(path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.candidate_documents d where d.object_key=path and d.scan_status='clean' and
 (d.user_id=private.active_actor() or exists(select 1 from public.application_details x join public.applications a on a.id=x.application_id and a.organization_id=x.organization_id where x.document_id=d.id and a.status<>'withdrawn' and private.can_review_application(a.organization_id,a.id))))
$$;
create policy cv_insert on storage.objects for insert to authenticated with check(bucket_id='candidate-cvs' and exists(select 1 from public.candidate_documents d where d.object_key=name and d.user_id=private.active_actor() and d.scan_status='pending'));
create policy cv_read on storage.objects for select to authenticated using(bucket_id='candidate-cvs' and private.can_read_cv(name));
create function public.authorize_cv_download(p_document uuid,p_application uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare doc public.candidate_documents; actor uuid:=private.active_actor(); app public.applications;
begin
 if actor is null then raise exception 'Not permitted' using errcode='42501'; end if;
 if p_application is not null then
  select * into app from public.applications where id=p_application;
  if app.id is null or (app.candidate_id<>actor and not private.can_review_application(app.organization_id,app.id)) then raise exception 'Not permitted' using errcode='42501'; end if;
  perform 1 from public.organizations where id=app.organization_id for update;
  select * into app from public.applications where id=p_application for update;
 end if;
 perform 1 from public.accounts where id=actor for update;
 select * into doc from public.candidate_documents where id=p_document for update;
 if doc.id is null or doc.scan_status<>'clean' then raise exception 'CV unavailable' using errcode='42501'; end if;
 if doc.user_id<>actor and (app.id is null or app.status='withdrawn' or not private.can_review_application(app.organization_id,app.id) or not exists(select 1 from public.application_details where application_id=app.id and document_id=doc.id and candidate_id=doc.user_id)) then raise exception 'Not permitted' using errcode='42501'; end if;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(case when doc.user_id=actor then null else app.organization_id end,actor,'cv.download.authorized',doc.id);
 return jsonb_build_object('path',doc.object_key,'filename',doc.filename);
end; $$;

create table public.saved_jobs (
 user_id uuid not null references public.accounts(id),job_id uuid not null references public.jobs(id),
 job_title text not null,company_name text not null,created_at timestamptz not null default now(),primary key(user_id,job_id)
);
alter table public.saved_jobs enable row level security;
revoke all on public.saved_jobs from anon,authenticated;
grant select on public.saved_jobs to authenticated;
create policy saved_job_self on public.saved_jobs for select to authenticated using(user_id=private.active_actor());
create function public.set_saved_job(p_job uuid,p_saved boolean) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_actor();job public.jobs;
begin
 if actor is null or p_saved is null then raise exception 'Not permitted' using errcode='42501'; end if;
 if not p_saved then delete from public.saved_jobs where user_id=actor and job_id=p_job; return; end if;
 select * into job from public.jobs where id=p_job;
 if job.id is null or job.status<>'published' or not private.company_is_public(job.organization_id) or (job.application_deadline is not null and job.application_deadline<=clock_timestamp()) then raise exception 'Job unavailable'; end if;
 perform 1 from public.accounts where id=actor for update;
 if (select count(*) from public.saved_jobs where user_id=actor)>=500 then raise exception 'Saved job limit reached'; end if;
 insert into public.saved_jobs(user_id,job_id,job_title,company_name) select actor,job.id,job.title,company_name from public.company_profiles where organization_id=job.organization_id on conflict do nothing;
end; $$;

revoke all on function private.candidate_snapshot(uuid),private.can_review_application(uuid,uuid),private.can_read_application_details(uuid,uuid),private.record_application_status(),private.can_read_cv(text) from public,anon,authenticated;
grant execute on function private.can_review_application(uuid,uuid),private.can_read_application_details(uuid,uuid),private.can_read_cv(text) to authenticated;
revoke all on function public.save_professional_profile(text,text,text[],text,text,integer),public.save_candidate_entry(text,jsonb,uuid),public.delete_candidate_entry(text,uuid),public.get_public_candidate(text),public.begin_cv_upload(text,integer,text),public.finish_cv_scan(uuid,text,text),public.set_current_cv(uuid),public.apply_to_job(uuid,uuid,text,text,text),public.transition_application(uuid,uuid,integer,text,text),public.withdraw_application(uuid,integer),public.add_application_note(uuid,uuid,text),public.authorize_cv_download(uuid,uuid),public.set_saved_job(uuid,boolean) from public,anon,authenticated;
grant execute on function public.get_public_candidate(text) to anon,authenticated;
grant execute on function public.finish_cv_scan(uuid,text,text) to service_role;
grant execute on function public.save_professional_profile(text,text,text[],text,text,integer),public.save_candidate_entry(text,jsonb,uuid),public.delete_candidate_entry(text,uuid),public.begin_cv_upload(text,integer,text),public.set_current_cv(uuid),public.apply_to_job(uuid,uuid,text,text,text),public.transition_application(uuid,uuid,integer,text,text),public.withdraw_application(uuid,integer),public.add_application_note(uuid,uuid,text),public.authorize_cv_download(uuid,uuid),public.set_saved_job(uuid,boolean) to authenticated;
