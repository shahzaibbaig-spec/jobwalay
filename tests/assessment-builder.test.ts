import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { database } from '../scripts/database-harness.mjs';
import { questionSchema,settingsSchema } from '../src/modules/assessments/schemas';
const uid=(n:number)=>`40000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const owner=uid(1),recruiter=uid(2),unassigned=uid(3),candidate=uid(4),otherCandidate=uid(5);
const org='a0000000-0000-4000-8000-000000000001',foreign='a0000000-0000-4000-8000-000000000002',job='c0000000-0000-4000-8000-000000000001';
let db:PGlite;let assessment:string;let version:string;let bankChoice:string;let numerical:string;let written:string;let pool:string;let application:string;let attempt:string;
async function as(user:string){await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,session_id:user,aal:'aal1'})]);await db.exec('set role authenticated');}
async function scalar<T>(sql:string,values:unknown[]=[]){return (await db.query<{value:T}>(sql,values)).rows[0]?.value;}
async function question(kind:string,overrides:Record<string,unknown>={}){await as(owner);const data={kind,prompt:`A valid ${kind} assessment question?`,category:'Engineering',difficulty:'medium',options:['single_choice','multiple_select'].includes(kind)?[{id:'a',text:'First'},{id:'b',text:'Second'},{id:'c',text:'Third'}]:[],answer:kind==='numerical'?{value:42,tolerance:0.5}:kind==='written'?{rubric:'Review reasoning, clarity and supporting evidence.'}:{correct_ids:kind==='multiple_select'?['a','c']:['b']},...overrides};return scalar<string>('select public.save_bank_question($1,$2) as value',[org,JSON.stringify(data)]);}
async function revision(id=version){return scalar<number>('select revision as value from public.assessment_versions where id=$1',[id]);}
beforeAll(async()=>{db=await database();await db.exec(await readFile('supabase/seed.sql','utf8'));for(const user of [owner,recruiter,unassigned,candidate,otherCandidate])await db.query('insert into auth.users values($1,$2,now())',[user,`${user}@example.test`]);await db.exec("insert into auth.sessions(id,user_id) select id,id from auth.users;update public.accounts set display_name='Assessment Fixture',onboarded_at=now()");
 await db.query("insert into public.memberships(organization_id,user_id,role) values($1,$2,'owner'),($1,$3,'recruiter'),($1,$4,'recruiter')",[org,owner,recruiter,unassigned]);
 await db.query('insert into public.job_members(organization_id,job_id,membership_id) select $1,$2,id from public.memberships where organization_id=$1 and user_id=$3',[org,job,recruiter]);
 for(const user of [candidate,otherCandidate]){await as(user);await db.exec("select public.save_candidate_profile('Candidate','My biography')");const cv=await scalar<string>("select public.begin_cv_upload('cv.pdf',20,$1) as value",['c'.repeat(64)]);await db.query("insert into storage.objects(bucket_id,name,metadata) values('candidate-cvs',$1,$2)",[`${user}/${cv}.pdf`,JSON.stringify({mimetype:'application/pdf',size:20})]);await db.exec('reset role;set role service_role');await db.query("select public.finish_cv_scan($1,$2,'clean')",[cv,'c'.repeat(64)]);}
 bankChoice=await question('single_choice');const multiple=await question('multiple_select');numerical=await question('numerical');written=await question('written');
 for(const q of [bankChoice,multiple])await db.query('select public.approve_bank_question($1,$2)',[org,q]);
 pool=await scalar<string>('select public.save_question_pool($1,$2,$3) as value',[org,'Approved engineering pool',[bankChoice,multiple]]);await db.query('select public.approve_question_pool($1,$2)',[org,pool]);
 assessment=await scalar<string>('select public.create_assessment($1,$2,$3) as value',[org,'Job-linked engineering assessment',job]);version=await scalar<string>('select id as value from public.assessment_versions where assessment_id=$1',[assessment]);
},30000);
afterAll(async()=>{await db?.close();});
describe('assessment authoring permissions and approval',()=>{
 it('restricts editing to authorized recruiters and rejects candidate settings changes',async()=>{
  for(const user of [candidate,unassigned]){await as(user);expect(await scalar<number>('select count(*)::int as value from public.assessment_versions where id=$1',[version])).toBe(0);await expect(db.query('select public.save_assessment_settings($1,$2,1,$3)',[org,version,JSON.stringify({duration_minutes:10,passing_percentage:70,max_attempts:1,summary:''})])).rejects.toThrow(/Not permitted/);await expect(db.query('select public.create_assessment($1,$2,$3)',[org,'Unauthorized linked assessment',job])).rejects.toThrow(/Not permitted/);}
  await as(recruiter);expect(await scalar<number>('select count(*)::int as value from public.assessment_versions where id=$1',[version])).toBe(1);
  await db.query('select public.save_assessment_settings($1,$2,1,$3)',[org,version,JSON.stringify({duration_minutes:25,passing_percentage:75,max_attempts:1,deadline:'',summary:'Read the questions carefully.'})]);
 });
 it('keeps keys out of normal table reads and denies foreign-tenant keys and pools',async()=>{
  await as(candidate);await expect(db.query('select public.get_author_question($1,$2)',[org,bankChoice])).rejects.toThrow(/Not permitted/);await expect(db.exec('select * from private.bank_answer_keys')).rejects.toThrow(/permission denied/);expect(await scalar<number>('select count(*)::int as value from public.bank_questions')).toBe(0);
  await as(owner);await expect(db.exec('select * from private.bank_answer_keys')).rejects.toThrow(/permission denied/);const authored=await scalar<{answer:{correct_ids:string[]}}> ('select public.get_author_question($1,$2) as value',[org,bankChoice]);expect(authored.answer.correct_ids).toEqual(['b']);
  await expect(db.query('select public.save_question_pool($1,$2,$3)',[foreign,'Forged pool',[bankChoice]])).rejects.toThrow(/Not permitted/);
  await as(unassigned);await expect(db.query('select public.get_author_question($1,$2)',[org,bankChoice])).rejects.toThrow(/Not permitted/);
 });
 it('validates numerical answers, MCQ keys, manual rubrics and approved-pool governance',async()=>{
  await expect(question('numerical',{answer:{value:1,tolerance:-1}})).rejects.toThrow(/Invalid numerical/);
  await expect(question('single_choice',{answer:{correct_ids:['missing']}})).rejects.toThrow(/Invalid correct/);
  await expect(question('single_choice',{answer:{}})).rejects.toThrow(/Invalid correct/);
  await expect(question('written',{answer:{rubric:''}})).rejects.toThrow(/Invalid manual/);
  await as(recruiter);await expect(db.query('select public.approve_question_pool($1,$2)',[org,pool])).rejects.toThrow(/Not permitted/);
  await as(owner);await expect(db.query('select public.save_question_pool($1,$2,$3)',[org,'Not approved pool',[numerical]])).rejects.toThrow(/must be approved/);
 });
});
describe('publishing, preview data and immutable versions',()=>{
 it('rejects a past assessment deadline at publication',async()=>{
  await as(owner);const temporary=await scalar<string>('select public.create_assessment($1,$2) as value',[org,'Deadline validation assessment']);const v=await scalar<string>('select id as value from public.assessment_versions where assessment_id=$1',[temporary]);
  await db.query('select public.save_assessment_settings($1,$2,1,$3)',[org,v,JSON.stringify({duration_minutes:10,passing_percentage:70,max_attempts:1,deadline:'2020-01-01T00:00:00Z',summary:''})]);
  await expect(db.query('select public.publish_assessment($1,$2,2)',[org,v])).rejects.toThrow(/deadline has passed/);
 });
 it('requires content, approved pool capacity and disjoint question selections',async()=>{
  await as(owner);await expect(db.query('select public.publish_assessment($1,$2,$3)',[org,version,await revision()])).rejects.toThrow(/1 to 200/);
  await db.query('select public.set_assessment_question($1,$2,$3,4,1)',[org,version,numerical]);await db.query('select public.set_assessment_question($1,$2,$3,6,2)',[org,version,written]);
  await db.query('select public.set_assessment_pool($1,$2,$3,3,2)',[org,version,pool]);await expect(db.query('select public.publish_assessment($1,$2,$3)',[org,version,await revision()])).rejects.toThrow(/enough questions/);
  await db.query('select public.set_assessment_pool($1,$2,$3,2,2)',[org,version,pool]);await db.query('select public.set_assessment_question($1,$2,$3,1,3)',[org,version,bankChoice]);await expect(db.query('select public.publish_assessment($1,$2,$3)',[org,version,await revision()])).rejects.toThrow(/must not overlap/);
  await db.query('select public.set_assessment_question($1,$2,$3,1,3,true)',[org,version,bankChoice]);
 });
 it('publishes weighted questions and attaches the exact version to the linked job',async()=>{
  await as(owner);await db.query('select public.publish_assessment($1,$2,$3)',[org,version,await revision()]);expect(await scalar<string>('select assessment_version_id as value from public.jobs where id=$1',[job])).toBe(version);
  expect(await scalar<number>('select sum(max_points)::int as value from public.assessment_version_questions where version_id=$1',[version])).toBe(10);
  const rows=(await db.query('select q.prompt,q.options,q.kind from public.assessment_version_questions i join public.bank_questions q on q.id=i.question_id where i.version_id=$1',[version])).rows;
  expect(JSON.stringify(rows)).not.toMatch(/correct_ids|tolerance|rubric|grader_version/);
 });
 it('never mutates published settings, questions, keys or approved pool contents',async()=>{
  await as(owner);await expect(db.query('select public.save_assessment_settings($1,$2,1,$3)',[org,version,'{}'])).rejects.toThrow(/Create a new version/);
  await expect(db.query('select public.set_assessment_question($1,$2,$3,100,1)',[org,version,numerical])).rejects.toThrow(/Create a new version/);
  await db.exec('reset role');
  await expect(db.query('update public.assessment_versions set max_attempts=10 where id=$1',[version])).rejects.toThrow(/immutable/);
  await expect(db.query('update public.assessment_version_questions set max_points=100 where version_id=$1',[version])).rejects.toThrow(/immutable/);
  await expect(db.query("update private.bank_answer_keys set key='{}' where question_id=$1",[numerical])).rejects.toThrow(/immutable/);
  await expect(db.query('delete from public.question_pool_members where pool_id=$1',[pool])).rejects.toThrow(/immutable/);
 });
});
describe('candidate-safe frozen attempt contracts',()=>{
 it('starts an authorized attempt with random pool selections and frozen option permutations',async()=>{
  await as(candidate);application=await scalar<string>('select public.apply_to_job($1) as value',[job]);attempt=await scalar<string>('select public.start_assessment_attempt($1, $q$browser-integrity-v1$q$) as value',[application]);expect(await scalar<string>('select public.start_assessment_attempt($1, $q$browser-integrity-v1$q$) as value',[application])).toBe(attempt);
  const questions=(await db.query<{id:string;kind:string;options:{id:string;text:string}[];max_points:number}>('select id,kind,prompt,options,max_points,category,difficulty from public.assessment_attempt_questions where attempt_id=$1 order by position',[attempt])).rows;
  expect(questions).toHaveLength(4);const choices=questions.filter(q=>q.kind==='single_choice'||q.kind==='multiple_select');expect(choices).toHaveLength(2);for(const q of choices)expect(q.options.map(o=>o.id).sort()).toEqual(['a','b','c']);
  const again=(await db.query('select id,kind,prompt,options,max_points,category,difficulty from public.assessment_attempt_questions where attempt_id=$1 order by position',[attempt])).rows;expect(again).toEqual(questions);
  expect(JSON.stringify(questions)).not.toMatch(/correct_ids|tolerance|rubric|grader_version/);
  await expect(db.exec('select * from private.attempt_answer_keys')).rejects.toThrow(/permission denied/);await expect(db.exec("update public.assessment_attempts set settings_snapshot='{}'")).rejects.toThrow(/permission denied/);
 });
 it('denies another candidate’s attempt, manual question changes and grader-key mutations',async()=>{
  await as(otherCandidate);expect(await scalar<number>('select count(*)::int as value from public.assessment_attempt_questions where attempt_id=$1',[attempt])).toBe(0);await expect(db.query('select public.start_assessment_attempt($1, $q$browser-integrity-v1$q$)',[application])).rejects.toThrow(/Not permitted/);
  await db.exec('reset role');await expect(db.query("update public.assessment_attempts set settings_snapshot='{}' where id=$1",[attempt])).rejects.toThrow(/immutable/);
  await expect(db.query("update public.assessment_attempt_questions set prompt='Changed' where attempt_id=$1",[attempt])).rejects.toThrow(/immutable/);
  expect(await scalar<number>('select count(*)::int as value from private.attempt_answer_keys k join public.assessment_attempt_questions q on q.id=k.attempt_question_id where q.attempt_id=$1',[attempt])).toBe(4);
 });
 it('creates a new draft for published edits without changing existing applications or attempts',async()=>{
  await as(owner);const newer=await scalar<string>('select public.revise_assessment($1,$2) as value',[org,version]);expect(newer).not.toBe(version);
  await db.query('select public.save_assessment_settings($1,$2,1,$3)',[org,newer,JSON.stringify({duration_minutes:60,passing_percentage:85,max_attempts:3,deadline:'',summary:'New revision'})]);
  const r=await scalar<number>('select revision as value from public.assessment_versions where id=$1',[newer]);await db.query('select public.publish_assessment($1,$2,$3)',[org,newer,r]);expect(await scalar<string>('select assessment_version_id as value from public.jobs where id=$1',[job])).toBe(newer);
  await as(candidate);expect(await scalar<string>('select assessment_version_id as value from public.applications where id=$1',[application])).toBe(version);const snapshot=await scalar<{duration_minutes:number;passing_percentage:number}>('select settings_snapshot as value from public.assessment_attempts where id=$1',[attempt]);expect(snapshot.duration_minutes).toBe(25);expect(Number(snapshot.passing_percentage)).toBe(75);
 });
 it('enforces max attempts and revokes question delivery after withdrawal',async()=>{
  await db.exec('reset role');await db.query("update public.assessment_attempts set state='expired' where id=$1",[attempt]);await as(candidate);await expect(db.query('select public.start_assessment_attempt($1, $q$browser-integrity-v1$q$)',[application])).rejects.toThrow(/Maximum attempts/);
  await db.query('select public.withdraw_application($1,1)',[application]);expect(await scalar<number>('select count(*)::int as value from public.assessment_attempt_questions where attempt_id=$1',[attempt])).toBe(0);
 });
});
describe('assessment input contracts',()=>{
 it('rejects mismatched answer types and unsafe settings',()=>{
  const base={organizationId:org,sourceId:'',kind:'numerical',prompt:'What is the result?',category:'Math',difficulty:'easy',options:[]};expect(questionSchema.safeParse({...base,answer:{value:42,tolerance:0.1}}).success).toBe(true);expect(questionSchema.safeParse({...base,answer:{rubric:'Not numerical'}}).success).toBe(false);expect(questionSchema.safeParse({...base,answer:{value:Infinity,tolerance:0}}).success).toBe(false);
  expect(settingsSchema.safeParse({organizationId:org,versionId:job,revision:1,duration_minutes:0,passing_percentage:101,max_attempts:0,deadline:'',summary:''}).success).toBe(false);
 });
});
