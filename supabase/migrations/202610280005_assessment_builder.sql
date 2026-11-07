alter table public.assessments add column created_by uuid references public.accounts(id);
alter table public.assessments add column job_id uuid;
alter table public.assessments add foreign key(organization_id,job_id) references public.jobs(organization_id,id);
alter table public.assessment_versions add column duration_minutes integer not null default 30 check(duration_minutes between 1 and 240);
alter table public.assessment_versions add column passing_percentage numeric(5,2) not null default 70 check(passing_percentage between 0 and 100);
alter table public.assessment_versions add column max_attempts integer not null default 1 check(max_attempts between 1 and 10);
alter table public.assessment_versions add column deadline timestamptz;
alter table public.assessment_versions add column revision integer not null default 1 check(revision>0);
alter table public.assessment_versions add column builder_ready boolean not null default false;
alter table public.assessment_versions add column published_at timestamptz;
create unique index assessment_one_draft on public.assessment_versions(assessment_id) where status='draft';

create table public.bank_questions (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),created_by uuid not null references public.accounts(id),
 source_id uuid,kind text not null check(kind in ('single_choice','multiple_select','numerical','written')),
 prompt text not null check(length(trim(prompt)) between 5 and 10000),options jsonb not null default '[]' check(jsonb_typeof(options)='array' and jsonb_array_length(options)<=10),
 category text not null check(length(trim(category)) between 1 and 100),difficulty text not null check(difficulty in ('easy','medium','hard')),
 state text not null default 'draft' check(state in ('draft','approved')),created_at timestamptz not null default clock_timestamp(),unique(organization_id,id),
 foreign key(organization_id,source_id) references public.bank_questions(organization_id,id)
);
create index bank_question_catalog on public.bank_questions(organization_id,state,category,difficulty);
create table private.bank_answer_keys (
 organization_id uuid not null,question_id uuid primary key,key jsonb not null,
 foreign key(organization_id,question_id) references public.bank_questions(organization_id,id)
);
create table public.question_pools (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),name text not null check(length(trim(name)) between 3 and 160),
 state text not null default 'draft' check(state in ('draft','approved')),created_by uuid not null references public.accounts(id),unique(organization_id,id)
);
create table public.question_pool_members (
 organization_id uuid not null,pool_id uuid not null,question_id uuid not null,primary key(pool_id,question_id),
 foreign key(organization_id,pool_id) references public.question_pools(organization_id,id),foreign key(organization_id,question_id) references public.bank_questions(organization_id,id)
);
create index pool_question_lookup on public.question_pool_members(question_id);
create table public.assessment_version_questions (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,version_id uuid not null,question_id uuid not null,
 max_points numeric(8,2) not null check(max_points between 0.01 and 1000),position integer not null check(position between 1 and 200),unique(version_id,question_id),
 foreign key(organization_id,version_id) references public.assessment_versions(organization_id,id),foreign key(organization_id,question_id) references public.bank_questions(organization_id,id)
);
create index version_question_lookup on public.assessment_version_questions(organization_id,version_id);
create table public.assessment_pool_rules (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,version_id uuid not null,pool_id uuid not null,
 draw_count integer not null check(draw_count between 1 and 50),max_points numeric(8,2) not null check(max_points between 0.01 and 1000),unique(version_id,pool_id),
 foreign key(organization_id,version_id) references public.assessment_versions(organization_id,id),foreign key(organization_id,pool_id) references public.question_pools(organization_id,id)
);
create index version_pool_lookup on public.assessment_pool_rules(organization_id,version_id);
create function private.can_manage_assessment(org uuid,assessment uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.assessments a where a.id=assessment and a.organization_id=org and
 (private.org_role(org) in ('owner','admin') or (private.org_role(org)='recruiter' and ((a.job_id is null and a.created_by=private.active_actor()) or (a.job_id is not null and private.can_manage_job(org,a.job_id))))))
$$;
create function private.can_edit_assessment_version(org uuid,version uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.assessment_versions v where v.organization_id=org and v.id=version and private.can_manage_assessment(org,v.assessment_id))
$$;
-- Narrow the original catalog policies to author/assigned-job permissions.
drop policy assessments_team on public.assessments;
drop policy versions_team on public.assessment_versions;
create policy assessment_author on public.assessments for select to authenticated using(private.can_manage_assessment(organization_id,id));
create policy version_author on public.assessment_versions for select to authenticated using(private.can_edit_assessment_version(organization_id,id));
alter table public.bank_questions enable row level security;
alter table private.bank_answer_keys enable row level security;
alter table public.question_pools enable row level security;
alter table public.question_pool_members enable row level security;
alter table public.assessment_version_questions enable row level security;
alter table public.assessment_pool_rules enable row level security;
revoke all on public.bank_questions,public.question_pools,public.question_pool_members,public.assessment_version_questions,public.assessment_pool_rules from anon,authenticated;
grant select on public.bank_questions,public.question_pools,public.question_pool_members,public.assessment_version_questions,public.assessment_pool_rules to authenticated;
create policy bank_team on public.bank_questions for select to authenticated using(private.org_role(organization_id) is not null);
create policy pools_team on public.question_pools for select to authenticated using(private.org_role(organization_id) is not null);
create policy pool_members_team on public.question_pool_members for select to authenticated using(private.org_role(organization_id) is not null);
create policy assessment_questions_author on public.assessment_version_questions for select to authenticated using(private.can_edit_assessment_version(organization_id,version_id));
create policy assessment_pools_author on public.assessment_pool_rules for select to authenticated using(private.can_edit_assessment_version(organization_id,version_id));

create function public.save_bank_question(p_org uuid,p_input jsonb,p_source uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;kind text;options jsonb;key jsonb;answer text;ids text[];
begin
 perform 1 from public.organizations where id=p_org for update;
 if private.org_role(p_org) is null then raise exception 'Not permitted' using errcode='42501'; end if;
 if p_source is not null and not exists(select 1 from public.bank_questions where id=p_source and organization_id=p_org and (created_by=private.active_actor() or private.org_role(p_org) in ('owner','admin'))) then raise exception 'Not permitted' using errcode='42501'; end if;
 if p_input is null or jsonb_typeof(p_input)<>'object' or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('kind','prompt','options','category','difficulty','answer')) then raise exception 'Invalid question'; end if;
 kind:=p_input->>'kind';options:=coalesce(p_input->'options','[]'::jsonb);key:=p_input->'answer';
 if key is null or jsonb_typeof(key)<>'object' or jsonb_typeof(options)<>'array' then raise exception 'Invalid answer key'; end if;
 if kind in ('single_choice','multiple_select') then
  if jsonb_array_length(options) not between 2 and 10 or exists(select 1 from jsonb_array_elements(options) o where jsonb_typeof(o)<>'object' or coalesce(o->>'id','') !~ '^[a-zA-Z0-9_-]{1,40}$' or length(trim(coalesce(o->>'text',''))) not between 1 and 1000 or exists(select 1 from jsonb_object_keys(o) k where k not in ('id','text'))) then raise exception 'Invalid options'; end if;
  select array_agg(o->>'id') into ids from jsonb_array_elements(options) o;
  if cardinality(ids)<>(select count(distinct x) from unnest(ids) x) or jsonb_typeof(key->'correct_ids') is distinct from 'array' or jsonb_array_length(key->'correct_ids')<1 or (kind='single_choice' and jsonb_array_length(key->'correct_ids')<>1) then raise exception 'Invalid correct options'; end if;
  if exists(select 1 from jsonb_array_elements(key->'correct_ids') x where jsonb_typeof(x)<>'string') or jsonb_array_length(key->'correct_ids')<>(select count(distinct x) from jsonb_array_elements_text(key->'correct_ids') x) then raise exception 'Invalid correct options'; end if;
  if exists(select 1 from jsonb_array_elements_text(key->'correct_ids') x where not x=any(ids)) or exists(select 1 from jsonb_object_keys(key) k where k<>'correct_ids') then raise exception 'Invalid correct options'; end if;
  key:=jsonb_build_object('correct_ids',key->'correct_ids','grader_version','exact-set-v1');
 elsif kind='numerical' then
  if jsonb_array_length(options)<>0 or (key->>'value') is null or (key->>'tolerance') is null or exists(select 1 from jsonb_object_keys(key) k where k not in ('value','tolerance')) then raise exception 'Invalid numerical answer'; end if;
  if (key->>'value')::numeric not between -1e12 and 1e12 or (key->>'tolerance')::numeric not between 0 and 1e6 then raise exception 'Invalid numerical answer'; end if;
  key:=jsonb_build_object('value',(key->>'value')::numeric,'tolerance',(key->>'tolerance')::numeric,'grader_version','absolute-tolerance-v1');
 elsif kind='written' then
  if jsonb_array_length(options)<>0 or length(trim(coalesce(key->>'rubric',''))) not between 5 and 5000 or exists(select 1 from jsonb_object_keys(key) k where k<>'rubric') then raise exception 'Invalid manual rubric'; end if;
  key:=jsonb_build_object('rubric',key->>'rubric','grader_version','manual-review-v1');
 else raise exception 'Invalid question type'; end if;
 if (select count(*) from public.bank_questions where organization_id=p_org)>=2000 then raise exception 'Question bank limit reached'; end if;
 insert into public.bank_questions(organization_id,created_by,source_id,kind,prompt,options,category,difficulty) values(p_org,private.active_actor(),p_source,kind,p_input->>'prompt',options,p_input->>'category',p_input->>'difficulty') returning id into result;
 insert into private.bank_answer_keys values(p_org,result,key);
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(p_org,private.active_actor(),'assessment.question.created',result);
 return result;
end; $$;
create function public.get_author_question(p_org uuid,p_question uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if private.org_role(p_org) is null then raise exception 'Not permitted' using errcode='42501'; end if;
 if not exists(select 1 from public.bank_questions where id=p_question and organization_id=p_org and (created_by=private.active_actor() or private.org_role(p_org) in ('owner','admin'))) then raise exception 'Not permitted' using errcode='42501';end if;
 return (select jsonb_build_object('question',to_jsonb(q),'answer',k.key) from public.bank_questions q join private.bank_answer_keys k on k.question_id=q.id and k.organization_id=q.organization_id where q.organization_id=p_org and q.id=p_question);
end; $$;
create function public.approve_bank_question(p_org uuid,p_question uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.organizations where id=p_org for update;
 if coalesce(private.org_role(p_org),'') not in ('owner','admin') then raise exception 'Not permitted' using errcode='42501'; end if;
 update public.bank_questions set state='approved' where id=p_question and organization_id=p_org and state='draft';
 if not found then raise exception 'Question unavailable'; end if;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(p_org,private.active_actor(),'assessment.question.approved',p_question);
end; $$;
create function public.save_question_pool(p_org uuid,p_name text,p_questions uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare pool uuid;question uuid;
begin
 perform 1 from public.organizations where id=p_org for update;
 if private.org_role(p_org) is null then raise exception 'Not permitted' using errcode='42501'; end if;
 if p_questions is null or cardinality(p_questions) not between 1 and 200 then raise exception 'Choose 1 to 200 approved questions'; end if;
 if exists(select 1 from unnest(p_questions) q where not exists(select 1 from public.bank_questions b where b.id=q and b.organization_id=p_org and b.state='approved')) then raise exception 'Pool questions must be approved and belong to this organization'; end if;
 insert into public.question_pools(organization_id,name,created_by) values(p_org,trim(p_name),private.active_actor()) returning id into pool;
 foreach question in array p_questions loop insert into public.question_pool_members values(p_org,pool,question) on conflict do nothing; end loop;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(p_org,private.active_actor(),'assessment.pool.created',pool);
 return pool;
end; $$;
create function public.approve_question_pool(p_org uuid,p_pool uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.organizations where id=p_org for update;
 if coalesce(private.org_role(p_org),'') not in ('owner','admin') then raise exception 'Not permitted' using errcode='42501'; end if;
 update public.question_pools set state='approved' where id=p_pool and organization_id=p_org and state='draft';
 if not found then raise exception 'Pool unavailable'; end if;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(p_org,private.active_actor(),'assessment.pool.approved',p_pool);
end; $$;

create function public.create_assessment(p_org uuid,p_title text,p_job uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare assessment uuid;
begin
 perform 1 from public.organizations where id=p_org for update;
 if private.org_role(p_org) is null or (p_job is not null and (not private.can_manage_job(p_org,p_job) or not exists(select 1 from public.jobs where id=p_job and organization_id=p_org))) then raise exception 'Not permitted' using errcode='42501'; end if;
 insert into public.assessments(organization_id,title,created_by,job_id) values(p_org,trim(p_title),private.active_actor(),p_job) returning id into assessment;
 insert into public.assessment_versions(organization_id,assessment_id,version_number,status) values(p_org,assessment,1,'draft');
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(p_org,private.active_actor(),'assessment.created',assessment);
 return assessment;
end; $$;
create function public.save_assessment_settings(p_org uuid,p_version uuid,p_revision integer,p_input jsonb) returns void language plpgsql security definer set search_path='' as $$
declare version public.assessment_versions;
begin
 perform 1 from public.organizations where id=p_org for update;
 if not private.can_edit_assessment_version(p_org,p_version) then raise exception 'Not permitted' using errcode='42501'; end if;
 select * into version from public.assessment_versions where id=p_version and organization_id=p_org for update;
 if version.status<>'draft' then raise exception 'Create a new version before editing a published assessment'; end if;
 if p_revision is null or p_revision<>version.revision then raise exception 'Record changed. Reload and try again.' using errcode='40001'; end if;
 if p_input is null or jsonb_typeof(p_input)<>'object' or exists(select 1 from jsonb_object_keys(p_input) k where k not in ('duration_minutes','passing_percentage','max_attempts','deadline','summary')) then raise exception 'Invalid assessment settings'; end if;
 update public.assessment_versions set duration_minutes=(p_input->>'duration_minutes')::integer,passing_percentage=(p_input->>'passing_percentage')::numeric,max_attempts=(p_input->>'max_attempts')::integer,deadline=nullif(p_input->>'deadline','')::timestamptz,summary=coalesce(p_input->>'summary',''),revision=revision+1 where id=version.id;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(p_org,private.active_actor(),'assessment.settings.saved',version.id);
end; $$;
create function public.set_assessment_question(p_org uuid,p_version uuid,p_question uuid,p_points numeric,p_position integer,p_remove boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.organizations where id=p_org for update;
 if not private.can_edit_assessment_version(p_org,p_version) then raise exception 'Not permitted' using errcode='42501'; end if;
 if not exists(select 1 from public.assessment_versions where id=p_version and status='draft') then raise exception 'Create a new version before editing a published assessment'; end if;
 if not exists(select 1 from public.bank_questions where id=p_question and organization_id=p_org) then raise exception 'Question unavailable'; end if;
 if p_remove then delete from public.assessment_version_questions where version_id=p_version and question_id=p_question;
 else
  if (select count(*) from public.assessment_version_questions where version_id=p_version)>=200 then raise exception 'Assessment question limit reached'; end if;
  insert into public.assessment_version_questions(organization_id,version_id,question_id,max_points,position) values(p_org,p_version,p_question,p_points,p_position) on conflict(version_id,question_id) do update set max_points=excluded.max_points,position=excluded.position;
 end if;
 update public.assessment_versions set revision=revision+1 where id=p_version;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(p_org,private.active_actor(),'assessment.question.changed',p_version);
end; $$;
create function public.set_assessment_pool(p_org uuid,p_version uuid,p_pool uuid,p_count integer,p_points numeric,p_remove boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.organizations where id=p_org for update;
 if not private.can_edit_assessment_version(p_org,p_version) then raise exception 'Not permitted' using errcode='42501'; end if;
 if not exists(select 1 from public.assessment_versions where id=p_version and status='draft') then raise exception 'Create a new version before editing a published assessment'; end if;
 if not exists(select 1 from public.question_pools where id=p_pool and organization_id=p_org and state='approved') then raise exception 'Pool must be approved'; end if;
 if p_remove then delete from public.assessment_pool_rules where version_id=p_version and pool_id=p_pool;
 else insert into public.assessment_pool_rules(organization_id,version_id,pool_id,draw_count,max_points) values(p_org,p_version,p_pool,p_count,p_points) on conflict(version_id,pool_id) do update set draw_count=excluded.draw_count,max_points=excluded.max_points; end if;
 update public.assessment_versions set revision=revision+1 where id=p_version;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(p_org,private.active_actor(),'assessment.pool.changed',p_version);
end; $$;
create function public.revise_assessment(p_org uuid,p_version uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare base public.assessment_versions;result uuid;number integer;
begin
 perform 1 from public.organizations where id=p_org for update;
 if not private.can_edit_assessment_version(p_org,p_version) then raise exception 'Not permitted' using errcode='42501'; end if;
 select * into base from public.assessment_versions where id=p_version and organization_id=p_org;
 if base.status<>'published' then raise exception 'Only published assessments can be revised'; end if;
 if exists(select 1 from public.assessment_versions where assessment_id=base.assessment_id and status='draft') then raise exception 'A draft version already exists'; end if;
 select max(version_number)+1 into number from public.assessment_versions where assessment_id=base.assessment_id;
 insert into public.assessment_versions(organization_id,assessment_id,version_number,status,summary,duration_minutes,passing_percentage,max_attempts,deadline)
 values(p_org,base.assessment_id,number,'draft',base.summary,base.duration_minutes,base.passing_percentage,base.max_attempts,base.deadline) returning id into result;
 insert into public.assessment_version_questions(organization_id,version_id,question_id,max_points,position) select p_org,result,question_id,max_points,position from public.assessment_version_questions where version_id=base.id;
 insert into public.assessment_pool_rules(organization_id,version_id,pool_id,draw_count,max_points) select p_org,result,pool_id,draw_count,max_points from public.assessment_pool_rules where version_id=base.id;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(p_org,private.active_actor(),'assessment.version.created',result);
 return result;
end; $$;
create function public.publish_assessment(p_org uuid,p_version uuid,p_revision integer) returns void language plpgsql security definer set search_path='' as $$
declare version public.assessment_versions;assessment public.assessments;total integer;
begin
 perform 1 from public.organizations where id=p_org for update;
 if not private.can_edit_assessment_version(p_org,p_version) then raise exception 'Not permitted' using errcode='42501'; end if;
 select * into version from public.assessment_versions where id=p_version and organization_id=p_org for update;
 if version.status<>'draft' then raise exception 'Assessment is already published'; end if;
 if p_revision is null or p_revision<>version.revision then raise exception 'Record changed. Reload and try again.' using errcode='40001'; end if;
 if version.deadline is not null and version.deadline<=clock_timestamp() then raise exception 'Assessment deadline has passed'; end if;
 select (select count(*) from public.assessment_version_questions where version_id=version.id)+coalesce((select sum(draw_count) from public.assessment_pool_rules where version_id=version.id),0) into total;
 if total not between 1 and 200 then raise exception 'Assessment must contain 1 to 200 questions'; end if;
 if exists(select 1 from (select question_id from public.assessment_version_questions where version_id=version.id union select m.question_id from public.assessment_pool_rules r join public.question_pool_members m on m.pool_id=r.pool_id where r.version_id=version.id) q where not exists(select 1 from private.bank_answer_keys k where k.question_id=q.question_id and k.organization_id=p_org)) then raise exception 'Question answer key unavailable'; end if;
 if exists(select 1 from public.assessment_pool_rules r where r.version_id=version.id and (not exists(select 1 from public.question_pools p where p.id=r.pool_id and p.state='approved') or r.draw_count>(select count(*) from public.question_pool_members m where m.pool_id=r.pool_id))) then raise exception 'Approved pool does not have enough questions'; end if;
 -- Disjoint draws guarantee the requested count without repeated questions.
 if exists(select 1 from (select q.question_id from public.assessment_version_questions q where q.version_id=version.id union all select m.question_id from public.assessment_pool_rules r join public.question_pool_members m on m.pool_id=r.pool_id where r.version_id=version.id) x group by question_id having count(*)>1) then raise exception 'Question pools and fixed selections must not overlap'; end if;
 update public.assessment_versions set status='published',builder_ready=true,published_at=clock_timestamp(),revision=revision+1 where id=version.id;
 select * into assessment from public.assessments where id=version.assessment_id;
 if assessment.job_id is not null then
  if not private.can_manage_job(p_org,assessment.job_id) then raise exception 'Not permitted' using errcode='42501'; end if;
  if exists(select 1 from public.jobs where id=assessment.job_id and status='archived') then raise exception 'Archived jobs cannot be edited'; end if;
  update public.jobs set assessment_version_id=version.id,version=public.jobs.version+1,updated_at=now() where id=assessment.job_id and organization_id=p_org;
 end if;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(p_org,private.active_actor(),'assessment.published',version.id);
end; $$;

-- Application binding and candidate-safe frozen attempts. Answering/grading are
-- separate delivery operations; candidates receive no answer-key table grants.
alter table public.applications add column assessment_version_id uuid;
alter table public.applications add foreign key(organization_id,assessment_version_id) references public.assessment_versions(organization_id,id);
update public.applications a set assessment_version_id=j.assessment_version_id from public.jobs j where j.id=a.job_id;
create function private.bind_application_assessment() returns trigger language plpgsql security definer set search_path='' as $$
begin select assessment_version_id into new.assessment_version_id from public.jobs where id=new.job_id and organization_id=new.organization_id;return new;end; $$;
create trigger bind_assessment before insert on public.applications for each row execute function private.bind_application_assessment();
create table public.assessment_attempts (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,application_id uuid not null,candidate_id uuid not null,
 version_id uuid not null,attempt_number integer not null,state text not null default 'in_progress' check(state in ('in_progress','expired','cancelled','submitted')),
 started_at timestamptz not null default clock_timestamp(),deadline_at timestamptz not null,settings_snapshot jsonb not null,
 unique(organization_id,id),unique(version_id,candidate_id,attempt_number),
 foreign key(organization_id,application_id,candidate_id) references public.applications(organization_id,id,candidate_id),foreign key(organization_id,version_id) references public.assessment_versions(organization_id,id)
);
create unique index one_active_assessment_attempt on public.assessment_attempts(version_id,candidate_id) where state='in_progress';
create table public.assessment_attempt_questions (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,attempt_id uuid not null,source_question_id uuid not null,
 kind text not null,prompt text not null,options jsonb not null,category text not null,difficulty text not null,max_points numeric(8,2) not null,position integer not null,
 unique(organization_id,id),unique(attempt_id,source_question_id),foreign key(organization_id,attempt_id) references public.assessment_attempts(organization_id,id),foreign key(organization_id,source_question_id) references public.bank_questions(organization_id,id)
);
create table private.attempt_answer_keys (
 organization_id uuid not null,attempt_question_id uuid primary key,key jsonb not null,
 foreign key(organization_id,attempt_question_id) references public.assessment_attempt_questions(organization_id,id)
);
alter table public.assessment_attempts enable row level security;
alter table public.assessment_attempt_questions enable row level security;
alter table private.attempt_answer_keys enable row level security;
revoke all on public.assessment_attempts,public.assessment_attempt_questions from anon,authenticated;
grant select on public.assessment_attempts,public.assessment_attempt_questions to authenticated;
create policy attempt_candidate on public.assessment_attempts for select to authenticated using(candidate_id=private.active_actor());
create policy attempt_questions_candidate on public.assessment_attempt_questions for select to authenticated using(exists(select 1 from public.assessment_attempts t join public.applications a on a.id=t.application_id where t.id=attempt_id and t.organization_id=assessment_attempt_questions.organization_id and t.candidate_id=private.active_actor() and t.state='in_progress' and t.deadline_at>clock_timestamp() and a.status<>'withdrawn'));
create function public.start_assessment_attempt(p_application uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.active_actor();app public.applications;version public.assessment_versions;result uuid;number integer;selected record;question public.bank_questions;instance uuid;position integer:=0;options jsonb;existing public.assessment_attempts;
begin
 if actor is null then raise exception 'Not permitted' using errcode='42501'; end if;
 select * into app from public.applications where id=p_application and candidate_id=actor;
 if app.id is null then raise exception 'Not permitted' using errcode='42501'; end if;
 perform 1 from public.organizations where id=app.organization_id and status='active' for update;
 if not found then raise exception 'Organization unavailable'; end if;
 select * into app from public.applications where id=p_application and candidate_id=actor for update;
 if app.status in ('withdrawn','rejected','hired') then raise exception 'Application is already final'; end if;
 select * into version from public.assessment_versions where id=app.assessment_version_id and organization_id=app.organization_id and status='published' and builder_ready;
 if version.id is null then raise exception 'No published assessment is assigned'; end if;
 if version.deadline is not null and version.deadline<=clock_timestamp() then raise exception 'Assessment deadline has passed'; end if;
 select * into existing from public.assessment_attempts where version_id=version.id and candidate_id=actor and state='in_progress' for update;
 if existing.id is not null then
  if existing.deadline_at>clock_timestamp() and existing.application_id=app.id then return existing.id; end if;
  if existing.deadline_at>clock_timestamp() then raise exception 'An assessment attempt is already active'; end if;
  update public.assessment_attempts set state='expired' where id=existing.id;
 end if;
 select count(*)+1 into number from public.assessment_attempts where version_id=version.id and candidate_id=actor;
 if number>version.max_attempts then raise exception 'Maximum attempts reached'; end if;
 insert into public.assessment_attempts(organization_id,application_id,candidate_id,version_id,attempt_number,deadline_at,settings_snapshot)
 values(app.organization_id,app.id,actor,version.id,number,least(clock_timestamp()+make_interval(mins=>version.duration_minutes),coalesce(version.deadline,'infinity'::timestamptz)),jsonb_build_object('duration_minutes',version.duration_minutes,'passing_percentage',version.passing_percentage,'max_attempts',version.max_attempts,'assessment_version',version.version_number,'grading_version','objective-v1')) returning id into result;
 for selected in
  select q.question_id,q.max_points,q.position as ordering from public.assessment_version_questions q where q.version_id=version.id
  union all
  select draw.question_id,r.max_points,1000 as ordering from public.assessment_pool_rules r cross join lateral(select m.question_id from public.question_pool_members m where m.pool_id=r.pool_id order by random() limit r.draw_count) draw where r.version_id=version.id
  order by ordering,question_id
 loop
  position:=position+1;select * into question from public.bank_questions where id=selected.question_id;
  select coalesce(jsonb_agg(o order by random()),'[]'::jsonb) into options from jsonb_array_elements(question.options) o;
  insert into public.assessment_attempt_questions(organization_id,attempt_id,source_question_id,kind,prompt,options,category,difficulty,max_points,position)
  values(app.organization_id,result,question.id,question.kind,question.prompt,options,question.category,question.difficulty,selected.max_points,position) returning id into instance;
  insert into private.attempt_answer_keys select app.organization_id,instance,key from private.bank_answer_keys where question_id=question.id;
  if not found then raise exception 'Question answer key unavailable';end if;
 end loop;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(app.organization_id,actor,'assessment.attempt.started',result);
 return result;
end; $$;
create function private.cancel_withdrawn_attempts() returns trigger language plpgsql security definer set search_path='' as $$
begin if new.status='withdrawn' then update public.assessment_attempts set state='cancelled' where application_id=new.id and state='in_progress';end if;return new;end; $$;
create trigger cancel_assessment_on_withdrawal after update of status on public.applications for each row execute function private.cancel_withdrawn_attempts();

-- Published settings/items and bank content cannot be mutated even by a future
-- privileged integration. A new bank row or assessment version is required.
create function private.protect_assessment_version() returns trigger language plpgsql set search_path='' as $$
begin if old.status='published' then raise exception 'Published assessment versions are immutable';end if;if tg_op='DELETE' then return old;end if;return new;end; $$;
create trigger immutable_assessment_version before update or delete on public.assessment_versions for each row execute function private.protect_assessment_version();
create function private.protect_assessment_item() returns trigger language plpgsql security definer set search_path='' as $$
declare version uuid;
begin
 if tg_op='DELETE' then version:=old.version_id;else version:=new.version_id;end if;
 if exists(select 1 from public.assessment_versions where id=version and status='published') or (tg_op='UPDATE' and exists(select 1 from public.assessment_versions where id=old.version_id and status='published')) then raise exception 'Published assessment versions are immutable';end if;
 if tg_op='DELETE' then return old;else return new;end if;
end; $$;
create trigger immutable_version_questions before insert or update or delete on public.assessment_version_questions for each row execute function private.protect_assessment_item();
create trigger immutable_version_pools before insert or update or delete on public.assessment_pool_rules for each row execute function private.protect_assessment_item();
create function private.protect_bank_content() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and new.state='approved' and old.state='draft' and (to_jsonb(new)-'state')=(to_jsonb(old)-'state') then return new;end if;
 raise exception 'Question content is immutable; create a new revision';
end; $$;
create trigger immutable_bank_question before update or delete on public.bank_questions for each row execute function private.protect_bank_content();
create function private.deny_content_mutation() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Frozen assessment content is immutable';end; $$;
create trigger immutable_bank_key before update or delete on private.bank_answer_keys for each row execute function private.deny_content_mutation();
create trigger immutable_attempt_key before update or delete on private.attempt_answer_keys for each row execute function private.deny_content_mutation();
create trigger immutable_attempt_question before update or delete on public.assessment_attempt_questions for each row execute function private.deny_content_mutation();
create function private.protect_pool() returns trigger language plpgsql security definer set search_path='' as $$
declare pool uuid;
begin
 if tg_op='DELETE' then pool:=old.pool_id;else pool:=new.pool_id;end if;
 if exists(select 1 from public.question_pools where id=pool and state='approved') or (tg_op='UPDATE' and exists(select 1 from public.question_pools where id=old.pool_id and state='approved')) then raise exception 'Approved pools are immutable';end if;
 if tg_op='DELETE' then return old;end if;return new;
end; $$;
create trigger immutable_pool_members before insert or update or delete on public.question_pool_members for each row execute function private.protect_pool();
create function private.protect_pool_metadata() returns trigger language plpgsql set search_path='' as $$
begin if old.state='approved' then raise exception 'Approved pools are immutable';end if;if tg_op='DELETE' then return old;end if;return new;end; $$;
create trigger immutable_approved_pool before update or delete on public.question_pools for each row execute function private.protect_pool_metadata();
create function private.protect_attempt_settings() returns trigger language plpgsql set search_path='' as $$
begin if (to_jsonb(new)-'state')<>(to_jsonb(old)-'state') then raise exception 'Attempt settings are immutable';end if;return new;end; $$;
create trigger frozen_attempt_settings before update on public.assessment_attempts for each row execute function private.protect_attempt_settings();
revoke all on private.bank_answer_keys,private.attempt_answer_keys from public,anon,authenticated;
revoke all on function private.can_manage_assessment(uuid,uuid),private.can_edit_assessment_version(uuid,uuid),private.bind_application_assessment(),private.cancel_withdrawn_attempts(),private.protect_assessment_version(),private.protect_assessment_item(),private.protect_bank_content(),private.deny_content_mutation(),private.protect_pool(),private.protect_pool_metadata(),private.protect_attempt_settings() from public,anon,authenticated;
grant execute on function private.can_manage_assessment(uuid,uuid),private.can_edit_assessment_version(uuid,uuid) to authenticated;
revoke all on function public.save_bank_question(uuid,jsonb,uuid),public.get_author_question(uuid,uuid),public.approve_bank_question(uuid,uuid),public.save_question_pool(uuid,text,uuid[]),public.approve_question_pool(uuid,uuid),public.create_assessment(uuid,text,uuid),public.save_assessment_settings(uuid,uuid,integer,jsonb),public.set_assessment_question(uuid,uuid,uuid,numeric,integer,boolean),public.set_assessment_pool(uuid,uuid,uuid,integer,numeric,boolean),public.revise_assessment(uuid,uuid),public.publish_assessment(uuid,uuid,integer),public.start_assessment_attempt(uuid) from public,anon,authenticated;
grant execute on function public.save_bank_question(uuid,jsonb,uuid),public.get_author_question(uuid,uuid),public.approve_bank_question(uuid,uuid),public.save_question_pool(uuid,text,uuid[]),public.approve_question_pool(uuid,uuid),public.create_assessment(uuid,text,uuid),public.save_assessment_settings(uuid,uuid,integer,jsonb),public.set_assessment_question(uuid,uuid,uuid,numeric,integer,boolean),public.set_assessment_pool(uuid,uuid,uuid,integer,numeric,boolean),public.revise_assessment(uuid,uuid),public.publish_assessment(uuid,uuid,integer),public.start_assessment_attempt(uuid) to authenticated;
