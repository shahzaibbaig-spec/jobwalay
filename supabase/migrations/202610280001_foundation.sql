-- All writes go through narrow, audited functions. No service key in the app.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.accounts (
 id uuid primary key references auth.users(id) on delete restrict,
 display_name text not null default '' check (length(display_name) <= 100),
 status text not null default 'active' check (status in ('active','suspended')),
 onboarded_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.candidate_profiles (
 user_id uuid primary key references public.accounts(id),
 headline text not null check (length(headline) between 1 and 160),
 bio text not null default '' check (length(bio) <= 3000),
 updated_at timestamptz not null default now()
);
create table public.organizations (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(name) between 2 and 120),
 status text not null default 'active' check (status in ('active','suspended')),
 verification_status text not null default 'pending' check (verification_status in ('pending','approved','rejected')),
 created_at timestamptz not null default now()
);
create table public.memberships (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 user_id uuid not null references public.accounts(id),
 role text not null check (role in ('owner','admin','recruiter')),
 status text not null default 'active' check (status in ('active','revoked')),
 unique(organization_id,user_id), unique(organization_id,id)
);
create index memberships_actor on public.memberships(user_id,organization_id,status);
create table private.platform_administrators (
 user_id uuid primary key references public.accounts(id),
 created_at timestamptz not null default now()
);
create table public.organization_invitations (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 email text not null check (length(email) <= 254 and email = lower(email)),
 role text not null check (role in ('admin','recruiter')),
 token_hash text not null unique,
 invited_by uuid not null references public.accounts(id),
 expires_at timestamptz not null default now() + interval '7 days',
 accepted_at timestamptz,
 created_at timestamptz not null default now()
);
create index invitation_tenant on public.organization_invitations(organization_id);
create table public.audit_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid references public.organizations(id),
 actor_id uuid references public.accounts(id),
 action text not null,
 target_id uuid,
 occurred_at timestamptz not null default now()
);
create index audit_tenant on public.audit_events(organization_id,occurred_at);

create function private.bootstrap_account() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.accounts(id) values(new.id);
 return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.bootstrap_account();
insert into public.accounts(id) select id from auth.users on conflict do nothing;

create function private.active_actor() returns uuid
language sql stable security definer set search_path = '' as $$
 select a.id from public.accounts a join auth.users u on u.id=a.id
 where a.id=auth.uid() and a.status='active' and u.email_confirmed_at is not null
 and exists (select 1 from auth.sessions s where s.user_id=a.id
   and s.id::text=auth.jwt()->>'session_id' and (s.not_after is null or s.not_after>now()))
$$;
create function private.org_role(org uuid) returns text
language sql stable security definer set search_path = '' as $$
 select m.role from public.memberships m join public.organizations o on o.id=m.organization_id
 where m.organization_id=org and m.user_id=private.active_actor()
 and m.status='active' and o.status='active'
$$;
create function private.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select coalesce(auth.jwt()->>'aal','')='aal2' and exists
 (select 1 from private.platform_administrators where user_id=private.active_actor())
$$;

alter table public.accounts enable row level security;
alter table public.candidate_profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.audit_events enable row level security;
alter table private.platform_administrators enable row level security;

revoke all on public.accounts,public.candidate_profiles,public.organizations,public.memberships,public.organization_invitations,public.audit_events from anon,authenticated;
grant select on public.accounts,public.candidate_profiles,public.organizations,public.memberships,public.audit_events to authenticated;
-- Hashes never leave the database, even for organization administrators.
grant select(id,organization_id,email,role,expires_at,accepted_at,created_at) on public.organization_invitations to authenticated;
create policy account_self on public.accounts for select to authenticated using(id=private.active_actor());
create policy candidate_self on public.candidate_profiles for select to authenticated using(user_id=private.active_actor());
create policy organization_member on public.organizations for select to authenticated using(private.org_role(id) is not null or private.is_platform_admin());
create policy membership_read on public.memberships for select to authenticated using(
 private.org_role(organization_id) in ('owner','admin') or (user_id=private.active_actor() and private.org_role(organization_id) is not null));
create policy invitation_admin on public.organization_invitations for select to authenticated using(private.org_role(organization_id) in ('owner','admin'));
create policy audit_admin on public.audit_events for select to authenticated using(private.org_role(organization_id) in ('owner','admin') or private.is_platform_admin());

create function public.complete_onboarding(p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.active_actor();
begin
 if actor is null or length(trim(p_name)) not between 1 and 100 then raise exception 'Not permitted' using errcode='42501'; end if;
 update public.accounts set display_name=trim(p_name),onboarded_at=coalesce(onboarded_at,now()) where id=actor;
 insert into public.audit_events(actor_id,action,target_id) values(actor,'account.onboarded',actor);
end; $$;
create function public.save_candidate_profile(p_headline text,p_bio text) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.active_actor();
begin
 if actor is null then raise exception 'Not permitted' using errcode='42501'; end if;
 insert into public.candidate_profiles(user_id,headline,bio) values(actor,trim(p_headline),p_bio)
 on conflict(user_id) do update set headline=excluded.headline,bio=excluded.bio,updated_at=now();
 insert into public.audit_events(actor_id,action,target_id) values(actor,'candidate.saved',actor);
end; $$;
create function public.register_organization(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.active_actor(); org uuid;
begin
 if actor is null then raise exception 'Not permitted' using errcode='42501'; end if;
 insert into public.organizations(name) values(trim(p_name)) returning id into org;
 insert into public.memberships(organization_id,user_id,role) values(org,actor,'owner');
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(org,actor,'organization.registered',org);
 return org;
end; $$;
create function public.invite_member(p_org uuid,p_email text,p_role text,p_hash text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare invitation uuid; actor uuid := private.active_actor();
begin
 perform 1 from public.organizations where id=p_org for update;
 if private.org_role(p_org) not in ('owner','admin') or private.org_role(p_org) is null then raise exception 'Not permitted' using errcode='42501'; end if;
 if p_role not in ('admin','recruiter') or p_hash !~ '^[a-f0-9]{64}$' or p_email !~ '^[^ @]+@[^ @]+\.[^ @]+$' then raise exception 'Invalid invitation'; end if;
 -- Bound issuance per organization in the shared database, not process memory.
 if (select count(*) from public.organization_invitations where organization_id=p_org and created_at > now()-interval '1 hour') >= 30 then raise exception 'Invitation limit reached'; end if;
 insert into public.organization_invitations(organization_id,email,role,token_hash,invited_by)
 values(p_org,lower(trim(p_email)),p_role,p_hash,actor) returning id into invitation;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(p_org,actor,'membership.invited',invitation);
 return invitation;
end; $$;
create function public.accept_invitation(p_hash text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare inv public.organization_invitations; actor uuid := private.active_actor(); address text;
begin
 if actor is null then raise exception 'Not permitted' using errcode='42501'; end if;
 select lower(email) into address from auth.users where id=actor;
 select * into inv from public.organization_invitations where token_hash=p_hash for update;
 if inv.id is null or inv.email<>address or inv.accepted_at is not null or inv.expires_at<=now() then raise exception 'Invalid or expired invitation' using errcode='42501'; end if;
 perform 1 from public.organizations where id=inv.organization_id and status='active' for update;
 if not found then raise exception 'Organization unavailable' using errcode='42501'; end if;
 -- Never overwrite an existing membership role or silently reactivate revoked members.
 if exists(select 1 from public.memberships where organization_id=inv.organization_id and user_id=actor) then raise exception 'Membership already exists'; end if;
 insert into public.memberships(organization_id,user_id,role) values(inv.organization_id,actor,inv.role);
 update public.organization_invitations set accepted_at=now() where id=inv.id;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(inv.organization_id,actor,'membership.accepted',inv.id);
 return inv.organization_id;
end; $$;
create function public.revoke_member(p_org uuid,p_member uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare target public.memberships;
begin
 perform 1 from public.organizations where id=p_org for update;
 if coalesce(private.org_role(p_org),'') not in ('owner','admin') then raise exception 'Not permitted' using errcode='42501'; end if;
 select * into target from public.memberships where id=p_member and organization_id=p_org for update;
 if target.id is null or target.role='owner' or (target.role='admin' and private.org_role(p_org)<>'owner') then raise exception 'Cannot revoke this membership' using errcode='42501'; end if;
 update public.memberships set status='revoked' where id=target.id;
 insert into public.audit_events(organization_id,actor_id,action,target_id) values(p_org,private.active_actor(),'membership.revoked',target.id);
end; $$;
create function public.platform_admin_status() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from private.platform_administrators where user_id=private.active_actor())
$$;
-- Role presence is safe to disclose to the actor; actual access always requires AAL2.
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.active_actor(),private.org_role(uuid),private.is_platform_admin() to authenticated;
revoke all on function public.complete_onboarding(text),public.save_candidate_profile(text,text),public.register_organization(text),public.invite_member(uuid,text,text,text),public.accept_invitation(text),public.revoke_member(uuid,uuid),public.platform_admin_status() from public,anon,authenticated;
grant execute on function public.complete_onboarding(text),public.save_candidate_profile(text,text),public.register_organization(text),public.invite_member(uuid,text,text,text),public.accept_invitation(text),public.revoke_member(uuid,uuid),public.platform_admin_status() to authenticated;
