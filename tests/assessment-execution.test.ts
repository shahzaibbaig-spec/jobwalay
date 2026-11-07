import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { database } from '../scripts/database-harness.mjs';
import { acting,answerAll,engineFixture,start,value } from './helpers/engine-fixture';
let db:PGlite;
beforeAll(async()=>{db=await database();},30000);afterAll(async()=>{await db?.close();});
describe('transactional assessment execution and grading',()=>{
 it('retries a failed expiry transaction without partial grades or sensitive diagnostic content',async()=>{
  const f=await engineFixture(db,{expireInMs:1800});const attempt=await start(db,f);await answerAll(db,attempt);await db.exec('reset role');
  // A transient database failure models worker interruption before commit.
  await db.exec("create function private.test_grade_failure() returns trigger language plpgsql as $$begin raise exception 'synthetic sensitive content';end;$$; create trigger test_grade_failure before insert on public.assessment_results for each row execute function private.test_grade_failure()");
  try{
   await new Promise(r=>setTimeout(r,1900));await db.exec('set role service_role');expect(await value<number>(db,'select public.process_assessment_expiry(1) as value')).toBe(0);await db.exec('reset role');
   expect(await value<string>(db,'select state as value from public.assessment_attempts where id=$1',[attempt])).toBe('in_progress');expect(await value<number>(db,'select count(*)::int as value from private.objective_grade_runs where attempt_id=$1',[attempt])).toBe(0);
   expect(await value<string>(db,'select code as value from private.assessment_engine_errors where attempt_id=$1',[attempt])).toBe('P0001');
  }finally{await db.exec('reset role;drop trigger test_grade_failure on public.assessment_results;drop function private.test_grade_failure()');}
  await db.exec('set role service_role');expect(await value<number>(db,'select public.process_assessment_expiry(1) as value')).toBe(1);await acting(db,f.candidate);expect(await value<string>(db,'select outcome as value from public.assessment_results where attempt_id=$1',[attempt])).toBe('passed');
 });
 it('uses the exact passing threshold rather than rounding a near miss into a pass',async()=>{
  const f=await engineFixture(db,{passing_percentage:66.67});const attempt=await start(db,f);const qs=await answerAll(db,attempt);
  const numerical=qs.find(q=>q.kind==='numerical')!;await db.query('select public.save_assessment_response($1,$2,$3,1)',[attempt,numerical.id,JSON.stringify({value:'43'})]);await db.query('select public.submit_assessment_attempt($1)',[attempt]);
  expect(Number(await value(db,'select percentage as value from public.assessment_results where attempt_id=$1',[attempt]))).toBe(66.67);
  expect(await value<string>(db,'select outcome as value from public.assessment_results where attempt_id=$1',[attempt])).toBe('failed');
  expect(await value<string>(db,'select status as value from public.applications where id=$1',[f.application])).toBe('submitted');
 });
 it('rechecks current employer authority when reviewing a closed attempt',async()=>{
  const f=await engineFixture(db,{},['written']);const attempt=await start(db,f);const qs=await answerAll(db,attempt);await db.query('select public.submit_assessment_attempt($1)',[attempt]);
  await db.exec('reset role');await db.query("update public.accounts set status='suspended' where id=$1",[f.owner]);await acting(db,f.owner);
  expect(await value<number>(db,'select count(*)::int as value from public.assessment_results where attempt_id=$1',[attempt])).toBe(0);
  await expect(db.query('select public.get_employer_assessment_result($1)',[attempt])).rejects.toThrow(/Not permitted/);
  await expect(db.query('select public.review_written_answer($1,$2,10,$3,0)',[attempt,qs[0].id,'Suspended employer cannot award points'])).rejects.toThrow(/Not permitted/);
 });
 it('rolls closure, grades, notifications and shortlisting back together on transaction failure',async()=>{
  const f=await engineFixture(db);const attempt=await start(db,f);await answerAll(db,attempt);
  await db.exec('begin');await db.query('select public.submit_assessment_attempt($1)',[attempt]);await db.exec('rollback');
  expect(await value<string>(db,'select state as value from public.assessment_attempts where id=$1',[attempt])).toBe('in_progress');
  expect(await value<number>(db,'select count(*)::int as value from public.assessment_results where attempt_id=$1',[attempt])).toBe(0);
  expect(await value<string>(db,'select status as value from public.applications where id=$1',[f.application])).toBe('submitted');
  expect(await value<number>(db,"select count(*)::int as value from public.user_notifications where application_id=$1 and kind='assessment_result'",[f.application])).toBe(0);
  await db.query('select public.submit_assessment_attempt($1)',[attempt]);expect(await value<string>(db,'select outcome as value from public.assessment_results where attempt_id=$1',[attempt])).toBe('passed');
 });
 it('rejects cross-attempt question IDs, unauthorized saves/submits and private worker calls',async()=>{
  const f=await engineFixture(db),other=await engineFixture(db);const a=await start(db,f);const b=await start(db,other);const foreign=await value<string>(db,'select id as value from public.assessment_attempt_questions where attempt_id=$1 limit 1',[b]);
  await acting(db,f.candidate);await expect(db.query('select public.save_assessment_response($1,$2,$3,0)',[a,foreign,JSON.stringify({selected_ids:['b']})])).rejects.toThrow(/Invalid assessment response/);
  await expect(db.query('select public.submit_assessment_attempt($1)',[b])).rejects.toThrow(/Not permitted/);
  await expect(db.query('select public.process_assessment_expiry(50)')).rejects.toThrow(/permission denied/);
  await acting(db,f.outsider);await expect(db.query('select public.save_assessment_response($1,$2,$3,0)',[a,foreign,JSON.stringify({selected_ids:['b']})])).rejects.toThrow(/Not permitted/);
 });
 it('honors disabled appeals and cancels execution when an application is rejected',async()=>{
  const f=await engineFixture(db,{appeals_enabled:false});const attempt=await start(db,f);await db.query('select public.submit_assessment_attempt($1)',[attempt]);
  await expect(db.query('select public.appeal_assessment($1,$2)',[attempt,'Please review this failed assessment'])).rejects.toThrow(/not permitted/);
  const second=await start(db,f);await acting(db,f.owner);const revision=await value<number>(db,'select version as value from public.applications where id=$1',[f.application]);await db.query("select public.transition_application($1,$2,$3,'rejected','Role no longer available')",[f.org,f.application,revision]);
  await acting(db,f.candidate);expect(await value<string>(db,'select state as value from public.assessment_attempts where id=$1',[second])).toBe('cancelled');
  expect(await value<number>(db,'select count(*)::int as value from public.assessment_attempt_questions where attempt_id=$1',[second])).toBe(0);
  await expect(db.query('select public.start_assessment_attempt($1, $q$browser-integrity-v1$q$)',[f.application])).rejects.toThrow(/already final/);
  await expect(db.query('select public.submit_assessment_attempt($1)',[second])).rejects.toThrow(/cancelled/);
 });
 it('issues an invitation atomically and starts only the invited candidate',async()=>{
  const f=await engineFixture(db);expect(f.invitation).toBeTruthy();expect(await value<number>(db,"select count(*)::int as value from public.user_notifications where kind='assessment_invitation' and application_id=$1",[f.application])).toBe(1);
  await acting(db,f.outsider);await expect(db.query('select public.start_assessment_attempt($1, $q$browser-integrity-v1$q$)',[f.application])).rejects.toThrow(/Not permitted/);
  const attempt=await start(db,f);expect(await value<string>(db,'select public.start_assessment_attempt($1, $q$browser-integrity-v1$q$) as value',[f.application])).toBe(attempt);
  expect(await value<number>(db,'select count(*)::int as value from public.assessment_attempt_questions where attempt_id=$1',[attempt])).toBe(3);
 });
 it('grades weighted exact-choice/multiple-select and numerical tolerance and shortlists exactly once',async()=>{
  const f=await engineFixture(db);const attempt=await start(db,f);await answerAll(db,attempt);await db.query('select public.submit_assessment_attempt($1)',[attempt]);
  const result=(await db.query<Record<string,unknown>>('select * from public.assessment_results where attempt_id=$1',[attempt])).rows[0];expect(Number(result.total_score)).toBe(30);expect(Number(result.percentage)).toBe(100);expect(result.outcome).toBe('passed');
  expect(await value<string>(db,'select status as value from public.applications where id=$1',[f.application])).toBe('shortlisted');
  await db.query('select public.submit_assessment_attempt($1)',[attempt]);
  expect(await value<number>(db,"select count(*)::int as value from public.application_events where application_id=$1 and to_status='shortlisted'",[f.application])).toBe(1);
  expect(await value<number>(db,'select count(*)::int as value from public.assessment_result_history where attempt_id=$1',[attempt])).toBe(1);
  await db.query('reset role');expect(await value<number>(db,'select count(*)::int as value from private.objective_grade_runs where attempt_id=$1',[attempt])).toBe(1);
 });
 it('leaves failing candidates not shortlisted without rejecting their applications',async()=>{
  const f=await engineFixture(db);const attempt=await start(db,f);await answerAll(db,attempt,false);await db.query('select public.submit_assessment_attempt($1)',[attempt]);
  expect(await value<string>(db,'select outcome as value from public.assessment_results where attempt_id=$1',[attempt])).toBe('failed');expect(await value<string>(db,'select status as value from public.applications where id=$1',[f.application])).toBe('submitted');
 });
 it('enforces revisions and immutable answers after submission, rejecting score fields and foreign options',async()=>{
  const f=await engineFixture(db);const attempt=await start(db,f);const q=await value<string>(db,"select id as value from public.assessment_attempt_questions where attempt_id=$1 and kind='single_choice'",[attempt]);
  for(const payload of [{selected_ids:['b'],score:100},{selected_ids:['not-in-snapshot']},{selected_ids:['b','b']}])await expect(db.query('select public.save_assessment_response($1,$2,$3,0)',[attempt,q,JSON.stringify(payload)])).rejects.toThrow(/Invalid selected/);
  expect(await value<number>(db,'select public.save_assessment_response($1,$2,$3,0) as value',[attempt,q,JSON.stringify({selected_ids:['b']})])).toBe(1);
  expect(await value<number>(db,'select public.save_assessment_response($1,$2,$3,0) as value',[attempt,q,JSON.stringify({selected_ids:['b']})])).toBe(1);
  await expect(db.query('select public.save_assessment_response($1,$2,$3,0)',[attempt,q,JSON.stringify({selected_ids:['a']})])).rejects.toThrow(/Answer changed/);
  await expect(db.query("insert into public.assessment_results(attempt_id) values($1)",[attempt])).rejects.toThrow(/permission denied/);
  await db.query('select public.submit_assessment_attempt($1)',[attempt]);await expect(db.query('select public.save_assessment_response($1,$2,$3,1)',[attempt,q,JSON.stringify({selected_ids:['a']})])).rejects.toThrow(/closed or expired/);
 });
 it('does not execute expressions, accept NaN/Infinity or expose answer keys before closure',async()=>{
  const f=await engineFixture(db);const attempt=await start(db,f);const q=await value<string>(db,"select id as value from public.assessment_attempt_questions where attempt_id=$1 and kind='numerical'",[attempt]);
  for(const v of ['eval(42)','42; DROP TABLE public.jobs','NaN','Infinity','1e99'])await expect(db.query('select public.save_assessment_response($1,$2,$3,0)',[attempt,q,JSON.stringify({value:v})])).rejects.toThrow(/Invalid numerical/);
  await expect(db.exec('select * from private.attempt_answer_keys')).rejects.toThrow(/permission denied/);
  await acting(db,f.owner);await expect(db.query('select public.get_employer_assessment_result($1)',[attempt])).rejects.toThrow(/must be closed/);
 });
 it('requires written review for final scores and recomputes safely from frozen rubric/points',async()=>{
  const f=await engineFixture(db,{},['single_choice','written']);const attempt=await start(db,f);const rows=await answerAll(db,attempt);await db.query('select public.submit_assessment_attempt($1)',[attempt]);
  let result=(await db.query<Record<string,unknown>>('select * from public.assessment_results where attempt_id=$1',[attempt])).rows[0];expect(result.outcome).toBe('manual_review');expect(result.total_score).toBeNull();expect(result.percentage).toBeNull();
  await acting(db,f.owner);const written=rows.find(q=>q.kind==='written')!.id;
  await expect(db.query('select public.review_written_answer($1,$2,11,$3,0)',[attempt,written,'Review exceeds frozen maximum'])).rejects.toThrow(/Invalid written/);
  await db.query('select public.review_written_answer($1,$2,8,$3,0)',[attempt,written,'Reasoning is accurate and well supported']);
  result=(await db.query<Record<string,unknown>>('select * from public.assessment_results where attempt_id=$1',[attempt])).rows[0];expect(Number(result.total_score)).toBe(18);expect(Number(result.percentage)).toBe(90);expect(result.outcome).toBe('passed');
  await expect(db.query('select public.review_written_answer($1,$2,1,$3,0)',[attempt,written,'Stale review should not overwrite'])).rejects.toThrow(/Record changed/);
  await acting(db,f.candidate);await expect(db.query('select public.review_written_answer($1,$2,10,$3,1)',[attempt,written,'Candidate cannot award own points'])).rejects.toThrow(/Not permitted/);
 });
 it('holds flags for review instead of auto-rejection and clears/pauses only automatic shortlists',async()=>{
  const f=await engineFixture(db);const attempt=await start(db,f);await answerAll(db,attempt);await db.query('select public.report_assessment_integrity($1,$2)',[attempt,'Connection disruption affected my session']);await db.query('select public.submit_assessment_attempt($1)',[attempt]);
  expect(await value<string>(db,'select outcome as value from public.assessment_results where attempt_id=$1',[attempt])).toBe('integrity_review');expect(await value<string>(db,'select status as value from public.applications where id=$1',[f.application])).toBe('submitted');
  await acting(db,f.owner);const detail=await value<{flags:{id:string}[]}>(db,'select public.get_employer_assessment_result($1) as value',[attempt]);const flag=detail.flags[0].id;
  await db.query("select public.resolve_assessment_integrity($1,'cleared',$2)",[flag,'Reviewed connection logs and cleared the issue']);expect(await value<string>(db,'select status as value from public.applications where id=$1',[f.application])).toBe('shortlisted');
  await db.query('select public.report_assessment_integrity($1,$2)',[attempt,'New evidence requires human review']);expect(await value<string>(db,'select status as value from public.applications where id=$1',[f.application])).toBe('assessment');
  expect(await value<number>(db,"select count(*)::int as value from public.application_events where application_id=$1 and to_status='rejected'",[f.application])).toBe(0);
 });
 it('enforces automatic retake limits and approval-only policies',async()=>{
  const f=await engineFixture(db,{retake_policy:'approval',max_attempts:2});const attempt=await start(db,f);await answerAll(db,attempt,false);await db.query('select public.submit_assessment_attempt($1)',[attempt]);
  await expect(db.query('select public.start_assessment_attempt($1, $q$browser-integrity-v1$q$)',[f.application])).rejects.toThrow(/approval is required/);
  await acting(db,f.owner);await db.query('select public.approve_assessment_retake($1,$2)',[f.application,'An additional permitted attempt was approved']);
  const second=await start(db,f);expect(second).not.toBe(attempt);await answerAll(db,second,false);await db.query('select public.submit_assessment_attempt($1)',[second]);await expect(db.query('select public.start_assessment_attempt($1, $q$browser-integrity-v1$q$)',[f.application])).rejects.toThrow(/Maximum attempts/);
 });
 it('blocks disabled retakes and cooldowns and preserves policies in new versions',async()=>{
  for(const settings of [{retake_policy:'none'},{retake_delay_minutes:60}]){const f=await engineFixture(db,settings);const attempt=await start(db,f);await db.query('select public.submit_assessment_attempt($1)',[attempt]);await expect(db.query('select public.start_assessment_attempt($1, $q$browser-integrity-v1$q$)',[f.application])).rejects.toThrow(settings.retake_policy?/disabled/:/cooldown/);await acting(db,f.owner);const draft=await value<string>(db,'select public.revise_assessment($1,$2) as value',[f.org,f.version]);const row=(await db.query<Record<string,unknown>>('select retake_policy,retake_delay_minutes from public.assessment_versions where id=$1',[draft])).rows[0];if(settings.retake_policy)expect(row.retake_policy).toBe('none');else expect(row.retake_delay_minutes).toBe(60);}
 });
 it('supports one appeal with employer resolution and never lets the candidate approve a retake',async()=>{
  const f=await engineFixture(db,{retake_policy:'approval'});const attempt=await start(db,f);await db.query('select public.submit_assessment_attempt($1)',[attempt]);await db.query('select public.appeal_assessment($1,$2)',[attempt,'I believe a technical issue affected this result']);
  const appeal=await value<string>(db,'select id as value from public.assessment_appeals where attempt_id=$1',[attempt]);expect(await value<string>(db,'select outcome as value from public.assessment_results where attempt_id=$1',[attempt])).toBe('appeal_review');
  await expect(db.query('select public.appeal_assessment($1,$2)',[attempt,'Duplicate appeal should be prevented'])).rejects.toThrow(/not permitted/);
  await expect(db.query("select public.resolve_assessment_appeal($1,'retake_approved',$2)",[appeal,'Candidate cannot approve this decision'])).rejects.toThrow(/Not permitted/);
  await acting(db,f.owner);await db.query("select public.resolve_assessment_appeal($1,'retake_approved',$2)",[appeal,'Reviewed the issue and approved a permitted retake']);expect(await start(db,f)).not.toBe(attempt);
 });
 it('expires on server time and grades only saved answers, including abandoned attempts',async()=>{
  const f=await engineFixture(db,{expireInMs:1800});const attempt=await start(db,f);const q=await value<string>(db,"select id as value from public.assessment_attempt_questions where attempt_id=$1 and kind='single_choice'",[attempt]);await db.query('select public.save_assessment_response($1,$2,$3,0)',[attempt,q,JSON.stringify({selected_ids:['b']})]);
  await new Promise(r=>setTimeout(r,1900));await expect(db.query('select public.save_assessment_response($1,$2,$3,1)',[attempt,q,JSON.stringify({selected_ids:['a']})])).rejects.toThrow(/closed or expired/);
  await db.exec('reset role;set role service_role');expect(await value<number>(db,'select public.process_assessment_expiry(50) as value')).toBeGreaterThan(0);await acting(db,f.candidate);expect(await value<string>(db,'select state as value from public.assessment_attempts where id=$1',[attempt])).toBe('expired');expect(Number(await value(db,'select total_score as value from public.assessment_results where attempt_id=$1',[attempt]))).toBe(10);
 });
 it('isolates results and notifications and preserves manual decisions on later reviews',async()=>{
  const f=await engineFixture(db);const attempt=await start(db,f);await answerAll(db,attempt);await db.query('select public.submit_assessment_attempt($1)',[attempt]);await acting(db,f.outsider);
  expect(await value<number>(db,'select count(*)::int as value from public.assessment_results where attempt_id=$1',[attempt])).toBe(0);expect(await value<number>(db,'select count(*)::int as value from public.user_notifications where application_id=$1',[f.application])).toBe(0);await expect(db.query('select public.get_employer_assessment_result($1)',[attempt])).rejects.toThrow(/Not permitted/);
  await acting(db,f.owner);const revision=await value<number>(db,'select version as value from public.applications where id=$1',[f.application]);await db.query("select public.transition_application($1,$2,$3,'interview','Invitation to interview')",[f.org,f.application,revision]);await db.query('select public.report_assessment_integrity($1,$2)',[attempt,'A later issue needs human review']);expect(await value<string>(db,'select status as value from public.applications where id=$1',[f.application])).toBe('interview');
 });
});
