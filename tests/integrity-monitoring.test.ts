import { randomUUID } from 'node:crypto';
import { beforeAll,afterAll,describe,it,expect } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { database } from '../scripts/database-harness.mjs';
import { acting,engineFixture,start,value,answerAll } from './helpers/engine-fixture';
import { disclosureVersion,monitoringBatchSchema,monitorReviewSchema } from '../src/modules/assessments/integrity/contracts';
let db:PGlite;beforeAll(async()=>{db=await database();},30000);afterAll(async()=>{await db?.close();});
const event=(kind='visibility_hidden')=>({id:randomUUID(),kind,observedAt:'2026-01-01T00:00:00.000Z'});
async function record(attempt:string,session:string,events:unknown[]=[],release=false){return value<{accepted:string[];simultaneous:boolean}>(db,'select public.record_assessment_integrity($1,$2,$3,$4,$5) as value',[attempt,session,disclosureVersion,JSON.stringify(events),release]);}
describe('integrity observations, permissions and review',()=>{
 it('requires disclosure before starting and records an immutable server acknowledgment',async()=>{
  const f=await engineFixture(db);await expect(db.query('select public.start_assessment_attempt($1)',[f.application])).rejects.toThrow(/Acknowledge/);
  const attempt=await start(db,f);expect(await value<string>(db,'select disclosure_version as value from public.assessment_integrity_acknowledgements where attempt_id=$1',[attempt])).toBe(disclosureVersion);
  await expect(db.query('update public.assessment_integrity_acknowledgements set acknowledged_at=now() where attempt_id=$1',[attempt])).rejects.toThrow(/permission denied/);
  await expect(db.query('select private.start_disclosed_execution($1)',[f.application])).rejects.toThrow(/permission denied/);
 });
 it('timestamps receipts on the server, deduplicates delivery, and refuses mutations or forged fields',async()=>{
  const f=await engineFixture(db);const attempt=await start(db,f),session=randomUUID(),observation=event();
  expect((await record(attempt,session,[observation])).accepted).toEqual([observation.id]);await record(attempt,session,[observation]);
  expect(await value<number>(db,'select count(*)::int as value from public.assessment_integrity_events where attempt_id=$1',[attempt])).toBe(1);
  expect(await value<boolean>(db,"select received_at>client_observed_at and received_at between clock_timestamp()-interval '1 minute' and clock_timestamp() as value from public.assessment_integrity_events where attempt_id=$1",[attempt])).toBe(true);
  for(const altered of [{...observation,received_at:'2099-01-01'},{...observation,source:'server'},event('simultaneous_session'),{...event(),url:'https://private.example'}])await expect(record(attempt,session,[altered])).rejects.toThrow(/Invalid integrity event/);
  await expect(record(attempt,session,[{...observation,kind:'window_blur'}])).rejects.toThrow(/ID was reused/);
  await expect(db.query('delete from public.assessment_integrity_events where attempt_id=$1',[attempt])).rejects.toThrow(/permission denied/);
  await db.exec('reset role');await expect(db.query('update public.assessment_integrity_events set kind=$2 where attempt_id=$1',[attempt,'window_focus'])).rejects.toThrow(/immutable/i);
 });
 it('isolates candidate and tenant records and denies forged session/attempt relations',async()=>{
  const f=await engineFixture(db),other=await engineFixture(db);const attempt=await start(db,f),session=randomUUID();await record(attempt,session,[event()]);
  await acting(db,other.owner);expect(await value<number>(db,'select count(*)::int as value from public.assessment_integrity_events where attempt_id=$1',[attempt])).toBe(0);await expect(db.query('select public.review_assessment_monitoring($1,$2,$3)',[attempt,'follow_up','Cross-tenant review attempt'])).rejects.toThrow(/Not permitted/);
  await acting(db,f.outsider);await expect(record(attempt,session,[event()])).rejects.toThrow(/Not permitted/);
  await acting(db,f.candidate);await expect(db.query("insert into public.assessment_integrity_events(organization_id,attempt_id,session_id,kind,source) values($1,$2,$3,'simultaneous_session','server')",[other.org,attempt,session])).rejects.toThrow(/permission denied/);
  await db.exec('reset role');await expect(db.query("insert into public.assessment_integrity_events(organization_id,attempt_id,session_id,kind,source) values($1,$2,$3,'simultaneous_session','server')",[other.org,attempt,session])).rejects.toThrow(/foreign key/);
 });
 it('records overlapping document sessions with deduplication, release and stale-lease handling',async()=>{
  const f=await engineFixture(db);const attempt=await start(db,f),a=randomUUID(),b=randomUUID();expect((await record(attempt,a)).simultaneous).toBe(false);expect((await record(attempt,b)).simultaneous).toBe(true);await record(attempt,b);
  expect(await value<number>(db,"select count(*)::int as value from public.assessment_integrity_events where attempt_id=$1 and source='server'",[attempt])).toBe(1);
  await record(attempt,a,[],true);expect((await record(attempt,b)).simultaneous).toBe(false);
  // Delayed packets cannot revive a released document.
  await record(attempt,a);expect((await record(attempt,b)).simultaneous).toBe(false);
  await db.exec('reset role');await db.query("update public.assessment_monitor_sessions set last_seen_at=clock_timestamp()-interval '46 seconds' where attempt_id=$1",[attempt]);await acting(db,f.candidate);expect((await record(attempt,randomUUID())).simultaneous).toBe(false);
 });
 it('never converts browser observations or contextual reviews into cheating findings or rejection',async()=>{
  const f=await engineFixture(db);const attempt=await start(db,f);await record(attempt,randomUUID(),[event(),event('fullscreen_exit'),event('network_offline')]);await record(attempt,randomUUID());await answerAll(db,attempt);await db.query('select public.submit_assessment_attempt($1)',[attempt]);
  expect(await value<string>(db,'select outcome as value from public.assessment_results where attempt_id=$1',[attempt])).toBe('passed');expect(await value<string>(db,'select status as value from public.applications where id=$1',[f.application])).toBe('shortlisted');
  await acting(db,f.owner);await db.query('select public.review_assessment_monitoring($1,$2,$3)',[attempt,'follow_up','Ask about assistive software and connectivity']);await db.query('select public.review_assessment_monitoring($1,$2,$3)',[attempt,'context_explained','Candidate explained system and network interruptions']);
  expect(await value<number>(db,'select count(*)::int as value from public.assessment_monitor_reviews where attempt_id=$1',[attempt])).toBe(2);expect(await value<string>(db,'select status as value from public.applications where id=$1',[f.application])).toBe('shortlisted');
  await expect(db.query('update public.assessment_monitor_reviews set outcome=$2 where attempt_id=$1',[attempt,'follow_up'])).rejects.toThrow(/permission denied/);
  await acting(db,f.candidate);expect(await value<number>(db,'select count(*)::int as value from public.assessment_monitor_reviews where attempt_id=$1',[attempt])).toBe(0);await expect(db.query('select public.review_assessment_monitoring($1,$2,$3)',[attempt,'context_explained','Candidate cannot append employer reviews'])).rejects.toThrow(/Not permitted/);
 });
 it('rechecks revoked recruiter access and rejects anonymous ingestion',async()=>{
  const f=await engineFixture(db);const attempt=await start(db,f);await record(attempt,randomUUID(),[event()]);await db.exec('reset role');await db.query("update public.memberships set status='revoked' where organization_id=$1 and user_id=$2",[f.org,f.owner]);await acting(db,f.owner);
  expect(await value<number>(db,'select count(*)::int as value from public.assessment_integrity_events where attempt_id=$1',[attempt])).toBe(0);await expect(db.query('select public.review_assessment_monitoring($1,$2,$3)',[attempt,'follow_up','Revoked owner cannot review'])).rejects.toThrow(/Not permitted/);
  await db.exec('reset role;set role anon');await expect(record(attempt,randomUUID())).rejects.toThrow(/permission denied/);
 });
 it('bounds ingestion while keeping duplicate retries safe at the rate limit',async()=>{
  const f=await engineFixture(db);const attempt=await start(db,f),session=randomUUID();const first=event();await expect(record(attempt,session,Array.from({length:21},()=>event()))).rejects.toThrow(/batch/);
  await record(attempt,session,[first,...Array.from({length:19},()=>event())]);for(let i=0;i<5;i++)await record(attempt,session,Array.from({length:20},()=>event()));
  await expect(record(attempt,session,[event()])).rejects.toThrow(/limit reached/);expect((await record(attempt,session,[first])).accepted).toEqual([first.id]);
 });
 it('accepts delayed offline observations after closure without changing grade history and stops cancelled attempts',async()=>{
  const f=await engineFixture(db);const attempt=await start(db,f),session=randomUUID();await record(attempt,session);await db.query('select public.submit_assessment_attempt($1)',[attempt]);await record(attempt,session,[event('network_offline'),event('network_online')]);
  expect(await value<number>(db,'select result_revision as value from public.assessment_results where attempt_id=$1',[attempt])).toBe(1);
  const f2=await engineFixture(db),a2=await start(db,f2);await db.query('select public.withdraw_application($1,1)',[f2.application]);await expect(record(a2,randomUUID(),[event()])).rejects.toThrow(/collection has closed/);
 });
});
describe('monitoring input minimization',()=>{
 it('rejects server event types, client timestamps for receipt, payloads and cheating classifications',()=>{
  const base={sessionId:randomUUID(),disclosure:disclosureVersion,events:[event()]};expect(monitoringBatchSchema.safeParse(base).success).toBe(true);
  for(const bad of [{...base,receivedAt:new Date().toISOString()},{...base,events:[event('simultaneous_session')]},{...base,events:[{...event(),url:'private'}]},{...base,events:[{...event(),score:100}]}])expect(monitoringBatchSchema.safeParse(bad).success).toBe(false);
  expect(monitorReviewSchema.safeParse({outcome:'confirmed_cheating',rationale:'A tab was hidden'}).success).toBe(false);
 });
});
