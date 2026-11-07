create table public.notification_preferences(user_id uuid primary key references public.accounts(id),email_enabled boolean not null default false,updated_at timestamptz not null default clock_timestamp());
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from public,anon,authenticated;
grant select on public.notification_preferences to authenticated;
create policy notification_preferences_self on public.notification_preferences for select to authenticated using(user_id=private.active_actor());
create function public.set_notification_preferences(p_email boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.consume_limit('notification.preferences',10);if p_email is null then raise exception 'Invalid notification preference';end if;
 insert into public.notification_preferences(user_id,email_enabled) values(private.active_actor(),p_email) on conflict(user_id) do update set email_enabled=excluded.email_enabled,updated_at=clock_timestamp();
 insert into public.audit_events(actor_id,action,target_id) values(private.active_actor(),'notifications.preferences.updated',private.active_actor());
end; $$;
create table private.notification_emails (
 id uuid primary key references public.user_notifications(id),state text not null default 'pending' check(state in ('pending','processing','sent','skipped','dead')),
 attempts integer not null default 0,available_at timestamptz not null default clock_timestamp(),created_at timestamptz not null default clock_timestamp(),
 lease_token uuid,lease_until timestamptz,provider_id text,last_error text check(last_error in ('provider_error','delivery_expired')),completed_at timestamptz
);
create index email_pending on private.notification_emails(available_at,id) where state in ('pending','processing');
alter table private.notification_emails enable row level security;
revoke all on private.notification_emails from public,anon,authenticated;
create function private.enqueue_notification_email() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.notification_preferences where user_id=new.user_id and email_enabled) then insert into private.notification_emails(id) values(new.id) on conflict do nothing;end if;
 return new;
end; $$;
create trigger enqueue_notification_email after insert on public.user_notifications for each row execute function private.enqueue_notification_email();
-- Organization-only notices have no application. No candidate data is added.
drop policy notification_owner on public.user_notifications;
create policy notification_owner on public.user_notifications for select to authenticated using(user_id=private.active_actor() and (audience='candidate' or (application_id is not null and private.can_review_application(organization_id,application_id)) or (application_id is null and private.org_role(organization_id) in ('owner','admin'))));
create function private.notify_organization_operation() returns trigger language plpgsql security definer set search_path='' as $$
declare org uuid;kind text;
begin
 if tg_table_name='verification_requests' then if old.state=new.state then return new;end if;org:=new.organization_id;kind:='organization_update';
 elsif tg_table_name='jobs' then if old.moderation_status=new.moderation_status then return new;end if;org:=new.organization_id;kind:='job_moderation';
 else return new;end if;
 insert into public.user_notifications(user_id,organization_id,audience,kind,event_key) select m.user_id,org,'employer',kind,kind||':'||new.id::text||':'||gen_random_uuid()::text from public.memberships m where m.organization_id=org and m.status='active' and m.role in ('owner','admin');
 return new;
end; $$;
create trigger verification_notice after update of state on public.verification_requests for each row execute function private.notify_organization_operation();
create trigger moderation_notice after update of moderation_status on public.jobs for each row execute function private.notify_organization_operation();
create function public.claim_notification_emails(p_limit integer default 10) returns jsonb language plpgsql security definer set search_path='' as $$
declare item record;n public.user_notifications;recipient text;claimed jsonb:='[]';token uuid;
begin
 if p_limit is null or p_limit not between 1 and 10 then raise exception 'Invalid processing limit';end if;
 for item in select * from private.notification_emails where (state='pending' and available_at<=clock_timestamp()) or (state='processing' and lease_until<=clock_timestamp()) order by available_at,id for update skip locked limit p_limit loop
  select * into n from public.user_notifications where id=item.id;recipient:=null;
  if item.attempts>=5 or item.created_at<clock_timestamp()-interval '23 hours' then update private.notification_emails set state='dead',completed_at=clock_timestamp(),last_error='delivery_expired' where id=item.id;continue;end if;
  if exists(select 1 from public.notification_preferences p where p.user_id=n.user_id and p.email_enabled) and (n.audience='candidate' or (n.application_id is not null and exists(select 1 from public.applications a join public.memberships m on m.organization_id=a.organization_id join public.organizations o on o.id=m.organization_id where a.id=n.application_id and o.status='active' and m.user_id=n.user_id and m.status='active' and (m.role in ('owner','admin') or exists(select 1 from public.job_members j where j.membership_id=m.id and j.job_id=a.job_id)))) or (n.application_id is null and exists(select 1 from public.memberships m join public.organizations o on o.id=m.organization_id where m.organization_id=n.organization_id and o.status='active' and m.user_id=n.user_id and m.status='active' and m.role in ('owner','admin')))) then
   select u.email into recipient from auth.users u join public.accounts a on a.id=u.id where u.id=n.user_id and a.status='active' and u.email_confirmed_at is not null;
  end if;
  if recipient is null then update private.notification_emails set state='skipped',completed_at=clock_timestamp() where id=item.id;continue;end if;
  token:=gen_random_uuid();update private.notification_emails set state='processing',attempts=attempts+1,lease_token=token,lease_until=clock_timestamp()+interval '5 minutes' where id=item.id;
  claimed:=claimed||jsonb_build_array(jsonb_build_object('id',item.id,'token',token,'recipient',recipient,'kind',n.kind));
 end loop;
 return claimed;
end; $$;
create function public.complete_notification_email(p_id uuid,p_token uuid,p_success boolean,p_provider_id text default null) returns void language plpgsql security definer set search_path='' as $$
declare item private.notification_emails;
begin
 select * into item from private.notification_emails where id=p_id for update;
 if item.id is null or item.state<>'processing' or p_token is null or item.lease_token<>p_token or item.lease_until<=clock_timestamp() then raise exception 'Delivery lease unavailable';end if;
 if p_success is null or (p_success and (p_provider_id is null or length(p_provider_id) not between 1 and 200)) then raise exception 'Invalid delivery receipt';end if;
 update private.notification_emails set state=case when p_success then 'sent' when attempts>=5 then 'dead' else 'pending' end,provider_id=case when p_success then p_provider_id else null end,
 last_error=case when p_success then null else 'provider_error' end,available_at=clock_timestamp()+make_interval(secs=>30*power(2,attempts)::int),lease_token=null,lease_until=null,completed_at=case when p_success or attempts>=5 then clock_timestamp() else null end where id=p_id;
end; $$;
create or replace function public.platform_overview() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_platform_admin() then raise exception 'Not permitted' using errcode='42501';end if;
 return jsonb_build_object('accounts',(select count(*) from public.accounts),'active_organizations',(select count(*) from public.organizations where status='active'),'verification_pending',(select count(*) from public.verification_requests where state='pending'),'open_reports',(select count(*) from public.abuse_reports where state='open'),'hidden_jobs',(select count(*) from public.jobs where moderation_status='hidden'),
 'assessment_outcomes',(select coalesce(jsonb_object_agg(outcome,n),'{}') from(select outcome,count(*) n from public.assessment_results group by outcome) x),
 'email_states',(select coalesce(jsonb_object_agg(state,n),'{}') from(select state,count(*) n from private.notification_emails group by state) x));
end; $$;
revoke all on function private.enqueue_notification_email(),private.notify_organization_operation() from public,anon,authenticated;
revoke all on function public.set_notification_preferences(boolean),public.claim_notification_emails(integer),public.complete_notification_email(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.set_notification_preferences(boolean) to authenticated;
grant execute on function public.claim_notification_emails(integer),public.complete_notification_email(uuid,uuid,boolean,text) to service_role;
