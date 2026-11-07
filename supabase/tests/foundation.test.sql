begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users(id,email,email_confirmed_at) values
 ('11111111-1111-4111-8111-111111111111','alice@example.test',now()),
 ('22222222-2222-4222-8222-222222222222','bob@example.test',now());
insert into auth.sessions(id,user_id,aal) values
 ('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','aal1'),
 ('22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222','aal1');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","aal":"aal1","session_id":"22222222-2222-4222-8222-222222222222"}',true);
select public.save_candidate_profile('Bob','Private');
select public.register_organization('Bob Inc');
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","aal":"aal1","session_id":"11111111-1111-4111-8111-111111111111"}',true);
select is((select count(*)::int from public.accounts),1,'Only own account visible');
select is((select count(*)::int from public.candidate_profiles),0,'Other candidate profile hidden');
select is((select count(*)::int from public.organizations),0,'Other tenant hidden');
select is((select count(*)::int from public.memberships),0,'Other tenant memberships hidden');
select is((select count(*)::int from public.audit_events),0,'Other tenant audit hidden');
select throws_ok($$update public.accounts set status='active'$$,'42501',null,'Direct account status writes denied');
select throws_ok($$update public.memberships set role='owner'$$,'42501',null,'Direct role escalation denied');
select is(public.platform_admin_status(),false,'No self-assigned platform role');
reset role;
set local role anon;
select throws_ok($$select * from public.candidate_profiles$$,'42501',null,'Anonymous private reads denied');
reset role;
select * from finish();
rollback;
