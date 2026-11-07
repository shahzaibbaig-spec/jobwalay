import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { database } from '../scripts/database-harness.mjs';
const id=(n:number)=>`30000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const alice=id(1),bob=id(2),owner=id(3),recruiter=id(4),stranger=id(5);
const org='a0000000-0000-4000-8000-000000000001',job='c0000000-0000-4000-8000-000000000001';
let db:PGlite;let cvA:string;let cvB:string;let app:string;let recruiterMembership:string;
async function as(user:string){await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,session_id:user,aal:'aal1'})]);await db.exec('set role authenticated');}
async function scalar<T>(sql:string,params:unknown[]=[]){return (await db.query<{value:T}>(sql,params)).rows[0]?.value;}
async function cv(user:string,result='clean'){
 await as(user);const document=await scalar<string>("select public.begin_cv_upload('resume.pdf',42,$1) as value",['b'.repeat(64)]);
 await db.query("insert into storage.objects(bucket_id,name,metadata) values('candidate-cvs',$1,$2)",[`${user}/${document}.pdf`,JSON.stringify({mimetype:'application/pdf',size:42})]);
 await db.exec('reset role;set role service_role');await db.query('select public.finish_cv_scan($1,$2,$3)',[document,'b'.repeat(64),result]);await as(user);return document;
}
beforeAll(async()=>{
 db=await database();await db.exec(await readFile('supabase/seed.sql','utf8'));
 for(const user of [alice,bob,owner,recruiter,stranger])await db.query('insert into auth.users values($1,$2,now())',[user,`${user}@example.test`]);
 await db.exec("insert into auth.sessions(id,user_id) select id,id from auth.users;update public.accounts set display_name='Professional Candidate',onboarded_at=now()");
 await db.query("insert into public.memberships(organization_id,user_id,role) values($1,$2,'owner')",[org,owner]);
 recruiterMembership=await scalar<string>("insert into public.memberships(organization_id,user_id,role) values($1,$2,'recruiter') returning id as value",[org,recruiter]);
 for(const user of [alice,bob]){await as(user);await db.query("select public.save_candidate_profile('Engineer','My private biography')");}
 cvA=await cv(alice);cvB=await cv(bob);
},30000);
afterAll(async()=>{await db?.close();});
describe('professional profiles and saved jobs',()=>{
 it('keeps experience private and rejects another candidate’s edits/deletions',async()=>{
  await as(alice);const entry=await scalar<string>('select public.save_candidate_entry($1,$2) as value',['experience',JSON.stringify({company:'Example',title:'Engineer',location:'Karachi',started_on:'2020-01-01',ended_on:'',description:'Private experience'})]);
  await as(bob);expect(await scalar<number>('select count(*)::int as value from public.candidate_experiences where id=$1',[entry])).toBe(0);
  await expect(db.query('select public.delete_candidate_entry($1,$2)',['experience',entry])).rejects.toThrow(/Entry unavailable/);
  await expect(db.query('select public.save_candidate_entry($1,$2,$3)',['experience',JSON.stringify({company:'Changed',title:'Changed',started_on:'2020-01-01'}),entry])).rejects.toThrow(/Entry unavailable/);
 });
 it('publishes only the opted-in professional projection and removes it when switched private',async()=>{
  await as(alice);const version=await scalar<number>('select version as value from public.candidate_profiles');
  await db.query("select public.save_professional_profile('Engineer','Public professional bio',array['TypeScript'],'alice-professional','public',$1)",[version]);
  await db.exec('reset role;set role anon');const publicProfile=await scalar<Record<string,unknown>>("select public.get_public_candidate('alice-professional') as value");
  expect(publicProfile.headline).toBe('Engineer');expect(publicProfile.experiences).toBeDefined();
  for(const field of ['user_id','current_cv_id','email','applications','notes','documents'])expect(publicProfile).not.toHaveProperty(field);
  await expect(db.exec('select * from public.candidate_profiles')).rejects.toThrow(/permission denied/);
  await as(alice);const latest=await scalar<number>('select version as value from public.candidate_profiles');
  await db.query("select public.save_professional_profile('Engineer','Private again',array['TypeScript'],'alice-professional','private',$1)",[latest]);
  await db.exec('reset role;set role anon');expect(await scalar("select public.get_public_candidate('alice-professional') as value")).toBeNull();
 });
 it('isolates saved jobs and permits removal after a job closes',async()=>{
  await as(alice);await db.query('select public.set_saved_job($1,true)',[job]);await db.query('select public.set_saved_job($1,true)',[job]);expect(await scalar<number>('select count(*)::int as value from public.saved_jobs')).toBe(1);
  await as(bob);expect(await scalar<number>('select count(*)::int as value from public.saved_jobs')).toBe(0);
  await expect(db.query('select public.set_saved_job($1,true)',['c0000000-0000-4000-8000-000000000004'])).rejects.toThrow(/Job unavailable/);
  await as(alice);await db.query('select public.set_saved_job($1,false)',[job]);expect(await scalar<number>('select count(*)::int as value from public.saved_jobs')).toBe(0);
 });
});
describe('private CV storage and release',()=>{
 it('denies another user’s metadata, paths, downloads and forged scan success',async()=>{
  await as(bob);expect(await scalar<number>('select count(*)::int as value from public.candidate_documents where id=$1',[cvA])).toBe(0);
  expect(await scalar<number>('select count(*)::int as value from storage.objects where name=$1',[`${alice}/${cvA}.pdf`])).toBe(0);
  await expect(db.query('select public.authorize_cv_download($1)',[cvA])).rejects.toThrow(/Not permitted/);
  await expect(db.query("select public.finish_cv_scan($1,$2,'clean')",[cvB,'b'.repeat(64)])).rejects.toThrow(/permission denied/);
  await expect(db.query('select public.set_current_cv($1)',[cvA])).rejects.toThrow(/CV unavailable/);
  await expect(db.query("update public.candidate_documents set scan_status='clean' where id=$1",[cvB])).rejects.toThrow(/permission denied/);
  await expect(db.query("insert into storage.objects(bucket_id,name) values('candidate-cvs',$1)",[`${alice}/${id(99)}.pdf`])).rejects.toThrow(/row-level security/);
 });
 it('never releases rejected or failed scans and never allows CV overwrite',async()=>{
  const rejected=await cv(bob,'rejected'),failed=await cv(bob,'error');
  for(const document of [rejected,failed])await expect(db.query('select public.authorize_cv_download($1)',[document])).rejects.toThrow(/CV unavailable/);
  await db.query("update storage.objects set metadata='{}' where name=$1",[`${bob}/${cvB}.pdf`]);
  expect(await scalar<string>("select metadata->>'mimetype' as value from storage.objects where name=$1",[`${bob}/${cvB}.pdf`])).toBe('application/pdf');
  await db.exec('reset role;set role anon');expect(await scalar<number>("select count(*)::int as value from storage.objects where bucket_id='candidate-cvs'")).toBe(0);
 });
});
describe('application ownership, duplicates, history and closed jobs',()=>{
 it('submits one active application with an immutable profile/CV snapshot and initial history',async()=>{
  await as(alice);const values=await Promise.all([1,2].map(()=>scalar<string>('select public.apply_to_job($1,$2,$3,$4,$5) as value',[job,cvA,'alice@example.test','12345','My cover letter'])));app=values[0];expect(values[1]).toBe(app);
  expect(await scalar<number>('select count(*)::int as value from public.applications where job_id=$1',[job])).toBe(1);
  expect(await scalar<number>('select count(*)::int as value from public.application_events where application_id=$1',[app])).toBe(1);
  await db.exec("select public.save_candidate_profile('New headline','New private bio')");const replacement=await cv(alice);
  expect(replacement).not.toBe(cvA);expect(await scalar<string>('select document_id as value from public.application_details where application_id=$1',[app])).toBe(cvA);
  expect(await scalar<string>("select profile_snapshot->>'headline' as value from public.application_details where application_id=$1",[app])).toBe('Engineer');
 });
 it('denies unrelated organizations, unassigned recruiters, other candidates and raw status writes',async()=>{
  for(const user of [bob,stranger,recruiter]){await as(user);expect(await scalar<number>('select count(*)::int as value from public.application_details where application_id=$1',[app])).toBe(0);await expect(db.query("select public.transition_application($1,$2,1,'screening','')",[org,app])).rejects.toThrow(/Not permitted/);await expect(db.query('select public.authorize_cv_download($1,$2)',[cvA,app])).rejects.toThrow(/Not permitted/);}
  await as(alice);await expect(db.query("update public.applications set status='hired' where id=$1",[app])).rejects.toThrow(/permission denied/);await expect(db.query("select public.add_application_note($1,$2,'Self note')",[org,app])).rejects.toThrow(/Not permitted/);
 });
 it('allows assigned hiring staff to view only the shared snapshot and original CV, with internal notes hidden from candidates',async()=>{
  await as(owner);await db.query('select public.assign_job_recruiter($1,$2,$3,true)',[org,job,recruiterMembership]);await as(recruiter);
  expect(await scalar<number>('select count(*)::int as value from public.application_details where application_id=$1',[app])).toBe(1);
  expect(await scalar<number>('select count(*)::int as value from public.candidate_profiles where user_id=$1',[alice])).toBe(0);
  const metadata=await scalar<{path:string}>('select public.authorize_cv_download($1,$2) as value',[cvA,app]);expect(metadata.path).toBe(`${alice}/${cvA}.pdf`);
  await db.query("select public.add_application_note($1,$2,'Internal interview preparation')",[org,app]);
  await as(alice);expect(await scalar<number>('select count(*)::int as value from public.application_notes where application_id=$1',[app])).toBe(0);
 });
 it('records each status change and rejects stale/invalid transitions',async()=>{
  await as(recruiter);await db.query("select public.transition_application($1,$2,1,'screening','We are reviewing your application')",[org,app]);
  await expect(db.query("select public.transition_application($1,$2,1,'interview','')",[org,app])).rejects.toThrow(/Record changed/);
  await expect(db.query("select public.transition_application($1,$2,2,'hired','')",[org,app])).rejects.toThrow(/Invalid application transition/);
  await as(alice);expect(await scalar<number>('select count(*)::int as value from public.application_events where application_id=$1',[app])).toBe(2);
  expect(await scalar<string>('select status as value from public.applications where id=$1',[app])).toBe('screening');
 });
 it('withdrawal creates history, revokes profile/CV access, and permits a fresh application',async()=>{
  await as(alice);await db.query('select public.withdraw_application($1,2)',[app]);expect(await scalar<number>('select count(*)::int as value from public.application_events where application_id=$1',[app])).toBe(3);
  await as(recruiter);expect(await scalar<number>('select count(*)::int as value from public.application_details where application_id=$1',[app])).toBe(0);await expect(db.query('select public.authorize_cv_download($1,$2)',[cvA,app])).rejects.toThrow(/Not permitted/);expect(await scalar<number>('select count(*)::int as value from storage.objects where name=$1',[`${alice}/${cvA}.pdf`])).toBe(0);
  await as(alice);const fresh=await scalar<string>('select public.apply_to_job($1) as value',[job]);expect(fresh).not.toBe(app);expect(await scalar<number>('select count(*)::int as value from public.applications where job_id=$1 and status not in (\'withdrawn\',\'rejected\')',[job])).toBe(1);
 });
 it('rejects closed, expired, draft and archived jobs even by direct RPC, and rejects another user’s CV',async()=>{
  await as(bob);for(const suffix of ['3','4','5','6'])await expect(db.query('select public.apply_to_job($1,$2)',['c0000000-0000-4000-8000-00000000000'+suffix,cvB])).rejects.toThrow(/not accepting applications/);
  await expect(db.query('select public.apply_to_job($1,$2)',[job,cvA])).rejects.toThrow(/Choose a clean/);
 });
 it('revoked job membership immediately loses document and applicant access',async()=>{
  await as(owner);await db.query('select public.assign_job_recruiter($1,$2,$3,false)',[org,job,recruiterMembership]);await as(recruiter);
  expect(await scalar<number>('select count(*)::int as value from public.application_details')).toBe(0);await expect(db.query('select public.authorize_cv_download($1,$2)',[cvA,app])).rejects.toThrow(/Not permitted/);
 });
});
