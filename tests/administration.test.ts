import { randomUUID } from 'node:crypto';
import { beforeAll,afterAll,describe,it,expect } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { database } from '../scripts/database-harness.mjs';
import { acting,engineFixture,start,value,answerAll } from './helpers/engine-fixture';
let db:PGlite;beforeAll(async()=>{db=await database();},30000);afterAll(async()=>{await db?.close();});
async function admin(user:string,aal='aal2'){await acting(db,user);await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,session_id:user,aal})]);}
async function provision(user:string){await db.exec('reset role');await db.query('insert into private.platform_administrators(user_id) values($1)',[user]);await admin(user);}
describe('platform moderation, isolation and reliability',()=>{
 it('requires current AAL2 platform authority and returns only narrow user projections',async()=>{
  const f=await engineFixture(db);await expect(db.query('select public.platform_overview()')).rejects.toThrow(/Not permitted/);await provision(f.outsider);await admin(f.outsider,'aal1');await expect(db.query("select public.admin_directory('users')")).rejects.toThrow(/Not permitted/);await admin(f.outsider);
  const users=await value<Record<string,unknown>[]>(db,"select public.admin_directory('users',1,'Engine fixture') as value");expect(users.length).toBeGreaterThan(0);expect(Object.keys(users[0]).sort()).toEqual(['created_at','display_name','id','status']);
  expect(await value<number>(db,'select count(*)::int as value from public.candidate_profiles where user_id=$1',[f.candidate])).toBe(0);await expect(db.query('select * from private.attempt_answer_keys')).rejects.toThrow(/permission denied/);
  await expect(db.query('select public.manage_account($1,$2,$3)',[f.outsider,'suspended','Cannot disable platform administrator'])).rejects.toThrow(/trusted provisioning/);
 });
 it('hides moderated jobs from discovery and blocks new applications without deleting existing records',async()=>{
  const f=await engineFixture(db),other=await engineFixture(db);await provision(f.outsider);const version=await value<number>(db,'select version as value from public.jobs where id=$1',[f.job]); // Public published job is readable, not its private applicants.
  await db.query('select public.moderate_job($1,true,$2,$3)',[f.job,version,'Verified fraudulent listing requires removal']);await expect(db.query('select public.moderate_job($1,false,$2,$3)',[f.job,version,'A stale moderator must not restore this listing'])).rejects.toThrow(/Record changed/);
  await db.exec('reset role;set role anon');expect(await value<number>(db,'select count(*)::int as value from public.jobs where id=$1',[f.job])).toBe(0);
  await acting(db,other.candidate);await expect(db.query('select public.apply_to_job($1)',[f.job])).rejects.toThrow(/not accepting/);
  await acting(db,f.owner);expect(await value<number>(db,'select count(*)::int as value from public.applications where job_id=$1',[f.job])).toBe(1);await expect(db.query("update public.jobs set moderation_status='visible' where id=$1",[f.job])).rejects.toThrow(/permission denied/);
  await admin(f.outsider);await db.query('select public.moderate_job($1,false,$2,$3)',[f.job,version+1,'Issue independently reviewed and resolved']);
  await db.exec('reset role;set role anon');expect(await value<number>(db,'select count(*)::int as value from public.jobs where id=$1',[f.job])).toBe(1);
 });
 it('keeps abuse reports private, requires independent resolution and never hides on report alone',async()=>{
  const f=await engineFixture(db);const report=await value<string>(db,"select public.report_job_abuse($1,'misleading','The advertised salary is misleading and needs review') as value",[f.job]);
  await acting(db,f.owner);expect(await value<number>(db,'select count(*)::int as value from public.abuse_reports where id=$1',[report])).toBe(0);expect(await value<number>(db,"select count(*)::int as value from public.audit_events where target_id=$1 and action='job.abuse.reported'",[report])).toBe(0);expect(await value<string>(db,'select moderation_status as value from public.jobs where id=$1',[f.job])).toBe('visible');
  await provision(f.owner);await expect(db.query("select public.resolve_abuse_report($1,1,'resolved','Reviewing my own organization is forbidden')",[report])).rejects.toThrow(/Independent/);await provision(f.outsider);await db.query("select public.resolve_abuse_report($1,1,'resolved','Independent review completed; no removal necessary')",[report]);
  await acting(db,f.candidate);expect(await value<string>(db,'select state as value from public.abuse_reports where id=$1',[report])).toBe('resolved');await expect(db.query("update public.abuse_reports set state='open' where id=$1",[report])).rejects.toThrow(/permission denied/);
 });
 it('revokes existing sessions on suspension and does not revive them on reactivation',async()=>{
  const f=await engineFixture(db);await provision(f.outsider);await db.query("select public.manage_account($1,'suspended','Account temporarily restricted after review')",[f.candidate]);await acting(db,f.candidate);expect(await value<number>(db,'select count(*)::int as value from public.candidate_profiles')).toBe(0);
  await admin(f.outsider);await db.query("select public.manage_account($1,'active','Account review is complete; allow new sessions')",[f.candidate]);await acting(db,f.candidate);expect(await value<number>(db,'select count(*)::int as value from public.accounts')).toBe(0);
  const session=randomUUID();await db.exec('reset role');await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,f.candidate]);await acting(db,f.candidate);await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:f.candidate,session_id:session,aal:'aal1'})]);expect(await value<number>(db,'select count(*)::int as value from public.candidate_profiles')).toBe(1);
 });
 it('suspends organizations independently and audits decisions without reasons in the public audit payload',async()=>{
  const f=await engineFixture(db);await provision(f.outsider);await db.query("select public.manage_organization($1,'suspended','An independent operational suspension reason')",[f.org]);await acting(db,f.owner);expect(await value<number>(db,'select count(*)::int as value from public.memberships where organization_id=$1',[f.org])).toBe(0);await db.exec('reset role;set role anon');expect(await value<number>(db,'select count(*)::int as value from public.jobs where id=$1',[f.job])).toBe(0);
  await admin(f.outsider);await db.query("select public.manage_organization($1,'active','Organization operational review completed')",[f.org]);const count=await value<number>(db,"select count(*)::int as value from public.audit_events where organization_id=$1 and action in ('organization.suspended','organization.active')",[f.org]);expect(count).toBe(2);await expect(db.query('select * from private.administration_decisions')).rejects.toThrow(/permission denied/);
  await db.exec('reset role');await expect(db.query("update public.audit_events set action='forged' where organization_id=$1",[f.org])).rejects.toThrow(/immutable/);
 });
 it('scopes recruitment and pass/fail analytics to currently assigned jobs',async()=>{
  const f=await engineFixture(db),other=await engineFixture(db);const attempt=await start(db,f);await answerAll(db,attempt);await db.query('select public.submit_assessment_attempt($1)',[attempt]);
  await acting(db,f.owner);const job2=await value<string>(db,'select public.save_job($1,0,$2) as value',[f.org,JSON.stringify({title:'Second restricted job',description:'Another separate job for authorization testing.',department:'Engineering',location:'Karachi',work_mode:'onsite',job_type:'full_time',required_skills:[],experience_min:0,positions:1})]);await db.query("select public.transition_job($1,$2,1,'published')",[f.org,job2]);await acting(db,other.candidate);await db.query('select public.apply_to_job($1)',[job2]);
  await db.exec('reset role');const membership=randomUUID();await db.query("insert into public.memberships(id,organization_id,user_id,role) values($1,$2,$3,'recruiter')",[membership,f.org,f.outsider]);await db.query('insert into public.job_members values($1,$2,$3)',[f.org,f.job,membership]);await acting(db,f.outsider);
  const stats=await value<{jobs:number;stages:Record<string,number>;outcomes:Record<string,number>}>(db,'select public.recruitment_analytics($1) as value',[f.org]);expect(stats.jobs).toBe(1);expect(stats.stages).toEqual({shortlisted:1});expect(stats.outcomes).toEqual({passed:1});await expect(db.query('select public.recruitment_analytics($1)',[other.org])).rejects.toThrow(/Not permitted/);
 });
 it('does not queue visibility alone as an integrity finding and isolates pending review queues',async()=>{
  const f=await engineFixture(db);const a=await start(db,f);await db.query("select public.record_assessment_integrity($1,$2,'browser-integrity-v1',$3)",[a,randomUUID(),JSON.stringify([{id:randomUUID(),kind:'visibility_hidden',observedAt:new Date().toISOString()}])]);await acting(db,f.owner);expect(await value(db,'select public.integrity_review_queue($1) as value',[f.org])).toEqual([]);
  const written=await engineFixture(db,{},['written']);const wa=await start(db,written);await answerAll(db,wa);await db.query('select public.submit_assessment_attempt($1)',[wa]);await acting(db,written.owner);const queue=await value<{id:string}[]>(db,'select public.integrity_review_queue($1) as value',[written.org]);expect(queue.map(q=>q.id)).toEqual([wa]);await acting(db,f.owner);await expect(db.query('select public.integrity_review_queue($1)',[written.org])).rejects.toThrow(/Not permitted/);
 });
 it('enforces fixed-window quotas for HTTP admissions and direct database writes',async()=>{
  const f=await engineFixture(db);await db.exec('reset role');await db.query("insert into private.action_limits values($1,'http.read',date_trunc('minute',clock_timestamp()),239)",[f.candidate]);await acting(db,f.candidate);await db.query('select public.consume_request_quota(false)');await expect(db.query('select public.consume_request_quota(false)')).rejects.toThrow(/Too many/);await expect(db.query("select private.consume_limit('http.read',999999)")).rejects.toThrow(/permission denied/);
  await db.exec('reset role');await db.query("insert into private.action_limits values($1,'business.write',date_trunc('minute',clock_timestamp()),120) on conflict(actor_id,scope,bucket) do update set hits=120",[f.owner]);await acting(db,f.owner);const version=await value<number>(db,'select version as value from public.jobs where id=$1',[f.job]);await expect(db.query("select public.transition_job($1,$2,$3,'closed')",[f.org,f.job,version])).rejects.toThrow(/Too many/);
 });
});
