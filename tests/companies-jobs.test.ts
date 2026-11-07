import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import { readFile } from 'node:fs/promises';
import type { PGlite } from '@electric-sql/pglite';
import { database } from '../scripts/database-harness.mjs';
import { jobSchema } from '../src/modules/jobs/schemas';
import { companySchema } from '../src/modules/companies/schemas';
const uid=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const owner=uid(1),other=uid(2),recruiter=uid(3),candidate=uid(4),outsider=uid(5),platform=uid(6);
let db:PGlite; let org:string; let foreignOrg:string; let recruiterMembership:string; let foreignAssessment:string; let assessment:string; let draftAssessment:string;
const input={title:'Platform Engineer',description:'Build accessible and secure applications with a collaborative product team. Own features across the stack and help improve delivery.',department:'Engineering',location:'Karachi',work_mode:'hybrid',job_type:'full_time',experience_min:2,experience_max:5,education:'Equivalent practical experience accepted',required_skills:['TypeScript','PostgreSQL'],salary_min:100000,salary_max:200000,salary_currency:'PKR',salary_period:'monthly',application_deadline:null,positions:2,assessment_version_id:null};
async function as(user:string,aal='aal1') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,aal,session_id:user})]);
  await db.exec('set role authenticated');
}
async function anon() { await db.exec('reset role'); await db.query("select set_config('request.jwt.claims','{}',false)"); await db.exec('set role anon'); }
async function scalar<T>(sql:string,params:unknown[]=[]){ return (await db.query<{value:T}>(sql,params)).rows[0]?.value; }
async function createCompany(actor:string,slug:string,approved=true) {
  await as(actor);
  const id=await scalar<string>("select public.register_organization('Example Company') as value");
  await db.query('select public.save_company_profile($1,0,$2)',[id,JSON.stringify({company_name:'Example Company',slug,industry:'Technology',location:'Karachi',website:'https://company.example',description:'A fictional company with a collaborative and thoughtful team.',is_public:true})]);
  if(approved) { await db.exec('reset role'); await db.query("update public.organizations set verification_status='approved' where id=$1",[id]); await as(actor); }
  return id;
}
async function createJob(overrides:Record<string,unknown>={},actor=owner,tenant=org) {
  await as(actor);
  return scalar<string>('select public.save_job($1,0,$2) as value',[tenant,JSON.stringify({...input,...overrides})]);
}
async function transition(id:string,status:string,actor=owner,tenant=org) {
  await as(actor);
  const version=await scalar<number>('select version as value from public.jobs where id=$1',[id]);
  return db.query('select public.transition_job($1,$2,$3,$4)',[tenant,id,version,status]);
}
beforeAll(async()=>{
  db=await database();
  for(const id of [owner,other,recruiter,candidate,outsider,platform]) await db.query('insert into auth.users values($1,$2,now())',[id,`${id}@example.test`]);
  await db.exec('insert into auth.sessions(id,user_id) select id,id from auth.users');
  await db.exec("update public.accounts set display_name='Synthetic User',onboarded_at=now()");
  await db.query('insert into private.platform_administrators values($1,now())',[platform]);
  org=await createCompany(owner,'example-company'); foreignOrg=await createCompany(other,'foreign-company');
  await db.exec('reset role');
  recruiterMembership=await scalar<string>("insert into public.memberships(organization_id,user_id,role) values($1,$2,'recruiter') returning id as value",[org,recruiter]);
  const a=await scalar<string>("insert into public.assessments(organization_id,title) values($1,'Engineering basics') returning id as value",[org]);
  assessment=await scalar<string>("insert into public.assessment_versions(organization_id,assessment_id,version_number,status) values($1,$2,1,'published') returning id as value",[org,a]);
  draftAssessment=await scalar<string>("insert into public.assessment_versions(organization_id,assessment_id,version_number,status) values($1,$2,2,'draft') returning id as value",[org,a]);
  const b=await scalar<string>("insert into public.assessments(organization_id,title) values($1,'Other tenant test') returning id as value",[foreignOrg]);
  foreignAssessment=await scalar<string>("insert into public.assessment_versions(organization_id,assessment_id,version_number,status) values($1,$2,1,'published') returning id as value",[foreignOrg,b]);
  await as(candidate); await db.exec("select public.save_candidate_profile('Software Engineer','Private candidate biography')");
  const cv=await scalar<string>("select public.begin_cv_upload('fixture.pdf',20,$1) as value",['a'.repeat(64)]);
  await db.query("insert into storage.objects(bucket_id,name,metadata) values('candidate-cvs',$1,$2)",[`${candidate}/${cv}.pdf`,JSON.stringify({mimetype:'application/pdf',size:20})]);
  await db.exec('reset role;set role service_role');await db.query("select public.finish_cv_scan($1,$2,'clean')",[cv,'a'.repeat(64)]);await as(candidate);
},30000);
afterAll(async()=>{await db?.close();});

describe('company and job authorization using real PostgreSQL roles',()=>{
  it('keeps drafts hidden from anonymous and unrelated users, including full-text search',async()=>{
    const job=await createJob();
    await anon();
    expect(await scalar<number>('select count(*)::int as value from public.jobs where id=$1',[job])).toBe(0);
    expect(await scalar<number>("select count(*)::int as value from public.jobs where search_document @@ websearch_to_tsquery('english','Engineer')")).toBe(0);
    await as(other);
    expect(await scalar<number>('select count(*)::int as value from public.jobs where id=$1',[job])).toBe(0);
    await as(owner);
    expect(await scalar<number>('select count(*)::int as value from public.jobs where id=$1',[job])).toBe(1);
  });
  it('finds published jobs by a required skill absent from the title and description',async()=>{
    const job=await createJob({required_skills:['Elixir']}); await transition(job,'published'); await anon();
    expect(await scalar<number>("select count(*)::int as value from public.jobs where id=$1 and search_document @@ websearch_to_tsquery('english','Elixir')",[job])).toBe(1);
  });
  it('rejects cross-tenant mutation through direct RPC and direct table writes',async()=>{
    const job=await createJob(); await as(other);
    await expect(db.query('select public.save_job($1,1,$2,$3)',[org,JSON.stringify(input),job])).rejects.toThrow(/Not permitted/);
    await expect(db.query("select public.transition_job($1,$2,1,'published')",[org,job])).rejects.toThrow(/Not permitted/);
    await expect(db.query('select public.save_company_profile($1,1,$2)',[org,'{}'])).rejects.toThrow(/Not permitted/);
    await expect(db.query("update public.jobs set status='published' where id=$1",[job])).rejects.toThrow(/permission denied/);
    await expect(db.query("insert into public.jobs(organization_id,title,description,location,work_mode,job_type) values($1,'Attack','Forged private job data must be rejected by database grants.','Karachi','onsite','full_time')",[org])).rejects.toThrow(/permission denied/);
  });
  it('grants recruiter access only to created/assigned jobs and revokes it immediately',async()=>{
    const job=await createJob(); await as(recruiter);
    expect(await scalar<number>('select count(*)::int as value from public.jobs where id=$1',[job])).toBe(0);
    await expect(db.query('select public.save_job($1,1,$2,$3)',[org,JSON.stringify(input),job])).rejects.toThrow(/Not permitted/);
    await as(owner); await db.query('select public.assign_job_recruiter($1,$2,$3,true)',[org,job,recruiterMembership]);
    await as(recruiter); await db.query('select public.save_job($1,1,$2,$3)',[org,JSON.stringify({...input,title:'Recruiter edit'}),job]);
    const created=await createJob({},recruiter);
    expect(await scalar<number>('select count(*)::int as value from public.job_members where job_id=$1 and membership_id=$2',[created,recruiterMembership])).toBe(1);
    await as(owner); await db.query('select public.assign_job_recruiter($1,$2,$3,false)',[org,job,recruiterMembership]);
    await as(recruiter);
    await expect(db.query('select public.save_job($1,2,$2,$3)',[org,JSON.stringify(input),job])).rejects.toThrow(/Not permitted/);
    await expect(db.query('select public.assign_job_recruiter($1,$2,$3,true)',[org,job,recruiterMembership])).rejects.toThrow(/Not permitted/);
    await expect(db.query('select public.request_verification($1,$2,$3,$4)',[org,'Legal Name','REG-123',''])).rejects.toThrow(/Not permitted/);
  });
  it('enforces same-tenant assessment versions through function and composite FK',async()=>{
    await expect(createJob({assessment_version_id:foreignAssessment})).rejects.toThrow(/Assessment must/);
    await expect(createJob({assessment_version_id:draftAssessment})).rejects.toThrow(/Assessment must/);
    const job=await createJob({assessment_version_id:assessment});
    expect(await scalar<string>('select assessment_version_id as value from public.jobs where id=$1',[job])).toBe(assessment);
    await db.exec('reset role');
    await expect(db.query('update public.jobs set assessment_version_id=$1 where id=$2',[foreignAssessment,job])).rejects.toThrow(/foreign key/);
    await as(owner);
    await expect(db.query('select public.assign_job_recruiter($1,$2,$3,true)',[foreignOrg,job,recruiterMembership])).rejects.toThrow(/Not permitted/);
  });
  it('requires verification and public profile before publishing',async()=>{
    const pending=await createCompany(owner,'pending-company',false);
    const job=await createJob({},owner,pending);
    await expect(transition(job,'published',owner,pending)).rejects.toThrow(/verified, public company/);
    await anon(); expect(await scalar<number>('select count(*)::int as value from public.company_profiles where organization_id=$1',[pending])).toBe(0);
  });
  it('prevents stale updates, invalid salary ranges and invalid transitions',async()=>{
    const job=await createJob();
    await db.query('select public.save_job($1,1,$2,$3)',[org,JSON.stringify({...input,title:'Updated job'}),job]);
    await expect(db.query('select public.save_job($1,1,$2,$3)',[org,JSON.stringify(input),job])).rejects.toThrow(/Record changed/);
    await expect(db.query('select public.save_job($1,null,$2,$3)',[org,JSON.stringify(input),job])).rejects.toThrow(/Record changed/);
    await expect(createJob({salary_max:500})).rejects.toThrow(/check constraint/);
    await expect(transition(job,'closed')).rejects.toThrow(/Invalid job transition/);
    await transition(job,'archived');
    await expect(transition(job,'published')).rejects.toThrow(/Invalid job transition/);
    await expect(db.query('select public.save_job($1,3,$2,$3)',[org,JSON.stringify(input),job])).rejects.toThrow(/Archived/);
  });
  it('deduplicates submissions, freezes minimal profile snapshot and hides other applications',async()=>{
    const job=await createJob(); await transition(job,'published');
    await as(candidate);
    const results=await Promise.all([1,2].map(()=>scalar<string>('select public.apply_to_job($1) as value',[job])));
    expect(results[0]).toBe(results[1]);
    expect(await scalar<number>('select count(*)::int as value from public.applications where job_id=$1',[job])).toBe(1);
    await db.exec("select public.save_candidate_profile('Changed headline','Still private')");
    expect(await scalar<string>('select candidate_headline as value from public.applications where job_id=$1',[job])).toBe('Software Engineer');
    await as(outsider); expect(await scalar<number>('select count(*)::int as value from public.applications where job_id=$1',[job])).toBe(0);
    await as(recruiter); expect(await scalar<number>('select count(*)::int as value from public.applications where job_id=$1',[job])).toBe(0);
    await as(owner); expect(await scalar<number>('select count(*)::int as value from public.applications where job_id=$1',[job])).toBe(1);
    expect(await scalar<number>('select count(*)::int as value from public.candidate_profiles where user_id=$1',[candidate])).toBe(0);
  });
  it('rejects new applications after close, archive or deadline, including direct RPC',async()=>{
    const closed=await createJob(),expired=await createJob({application_deadline:new Date(Date.now()+60000).toISOString()}),archived=await createJob();
    await transition(closed,'published'); await transition(closed,'closed');
    await transition(expired,'published'); await transition(archived,'archived');
    await db.exec('reset role'); await db.query("update public.jobs set application_deadline=now()-interval '1 second' where id=$1",[expired]);
    await as(candidate);
    for(const id of [closed,expired,archived]) await expect(db.query('select public.apply_to_job($1)',[id])).rejects.toThrow(/not accepting applications/);
    await anon(); for(const id of [closed,expired,archived]) expect(await scalar<number>('select count(*)::int as value from public.jobs where id=$1',[id])).toBe(0);
  });
  it('rejects publishing expired drafts and hides jobs when their organization is suspended',async()=>{
    const expired=await createJob({application_deadline:'2020-01-01T00:00:00Z'});
    await expect(transition(expired,'published')).rejects.toThrow(/deadline has passed/);
    const local=await createCompany(other,'suspended-company'); const job=await createJob({},other,local); await transition(job,'published',other,local);
    await db.exec('reset role'); await db.query("update public.organizations set status='suspended' where id=$1",[local]);
    await as(candidate); await expect(db.query('select public.apply_to_job($1)',[job])).rejects.toThrow(/not accepting applications/);
    await as(other); await expect(db.query('select public.save_job($1,2,$2,$3)',[local,JSON.stringify(input),job])).rejects.toThrow(/Not permitted/);
    await anon(); expect(await scalar<number>('select count(*)::int as value from public.jobs where id=$1',[job])).toBe(0);
  });
  it('keeps verification requests private, requires MFA and prevents duplicate/replayed decisions',async()=>{
    const tenant=await createCompany(owner,'verify-company',false);
    const request=await scalar<string>("select public.request_verification($1,'Example Legal','REG-123','Private details') as value",[tenant]);
    await expect(db.query("select public.request_verification($1,'Example Legal','REG-123','')",[tenant])).rejects.toThrow(/unique constraint/);
    await as(other); expect(await scalar<number>('select count(*)::int as value from public.verification_requests where id=$1',[request])).toBe(0);
    await expect(db.query("select public.review_verification($1,'approved','Looks valid')",[request])).rejects.toThrow(/Not permitted/);
    await as(platform); await expect(db.query("select public.review_verification($1,'approved','Looks valid')",[request])).rejects.toThrow(/Not permitted/);
    await as(platform,'aal2'); await db.query("select public.review_verification($1,'approved','Registration independently checked')",[request]);
    await expect(db.query("select public.review_verification($1,'rejected','Changed mind')",[request])).rejects.toThrow(/Invalid review/);
    await anon(); expect(await scalar<number>('select count(*)::int as value from public.company_profiles where organization_id=$1',[tenant])).toBe(1);
    await expect(db.exec('select * from public.verification_requests')).rejects.toThrow(/permission denied/);
  });
  it('requires independent verification and permits a new request after rejection',async()=>{
    const own=await createCompany(platform,'platform-owned-company',false);
    const ownRequest=await scalar<string>("select public.request_verification($1,'Platform Owned','REG-OWN','') as value",[own]);
    await as(platform,'aal2');
    await expect(db.query("select public.review_verification($1,'approved','Identity checked')",[ownRequest])).rejects.toThrow(/Independent reviewer/);
    const tenant=await createCompany(owner,'rejected-company',false);
    const request=await scalar<string>("select public.request_verification($1,'Example Legal','REG-REJECT','') as value",[tenant]);
    await as(platform,'aal2'); await db.query("select public.review_verification($1,'rejected','Registration could not be verified')",[request]);
    await as(owner);
    expect(await scalar<string>('select verification_status as value from public.organizations where id=$1',[tenant])).toBe('rejected');
    const retry=await scalar<string>("select public.request_verification($1,'Example Legal','REG-CORRECTED','Corrected registration details') as value",[tenant]);
    expect(retry).not.toBe(request);
  });
  it('invalidates verification on identity changes and prevents changing an identity under review',async()=>{
    const tenant=await createCompany(owner,'identity-change-company');
    const data={company_name:'New Legal Company',slug:'identity-change-company',industry:'Technology',location:'Karachi',website:'https://company.example',description:'A changed identity needs another independent verification.',is_public:true};
    await db.query('select public.save_company_profile($1,1,$2)',[tenant,JSON.stringify(data)]);
    expect(await scalar<string>('select verification_status as value from public.organizations where id=$1',[tenant])).toBe('pending');
    await db.query("select public.request_verification($1,'New Legal Company','NEW-123','')",[tenant]);
    await expect(db.query('select public.save_company_profile($1,2,$2)',[tenant,JSON.stringify({...data,website:'https://changed.example'})])).rejects.toThrow(/pending verification/);
    await anon(); expect(await scalar<number>('select count(*)::int as value from public.company_profiles where organization_id=$1',[tenant])).toBe(0);
  });
  it('isolates image uploads and keeps unpublished company images inaccessible',async()=>{
    const tenant=await createCompany(owner,'image-company',false);
    const path=`${tenant}/logo/20000000-0000-4000-8000-000000000001.webp`;
    await as(other);
    await expect(db.query("insert into storage.objects(bucket_id,name,metadata) values('company-assets',$1,'{\"mimetype\":\"image/webp\"}')",[path])).rejects.toThrow(/row-level security/);
    await as(owner);
    await db.query("insert into storage.objects(bucket_id,name,metadata) values('company-assets',$1,'{\"mimetype\":\"image/webp\"}')",[path]);
    await db.query("select public.set_company_image($1,'logo',$2)",[tenant,path]);
    await expect(db.query("select public.set_company_image($1,'logo',$2)",[org,path])).rejects.toThrow(/Invalid image/);
    await db.query('delete from storage.objects where name=$1',[path]);
    expect(await scalar<number>('select count(*)::int as value from storage.objects where name=$1',[path])).toBe(1);
    await anon(); expect(await scalar<number>('select count(*)::int as value from storage.objects where name=$1',[path])).toBe(0);
    await db.exec('reset role'); await db.query("update public.organizations set verification_status='approved' where id=$1",[tenant]);
    await anon(); expect(await scalar<number>('select count(*)::int as value from storage.objects where name=$1',[path])).toBe(1);
  });
  it('audits mutations and does not allow tenant reassignment or forged same-tenant relations',async()=>{
    const job=await createJob();
    expect(await scalar<number>("select count(*)::int as value from public.audit_events where target_id=$1 and action='job.created'",[job])).toBe(1);
    await expect(db.query('update public.jobs set organization_id=$1 where id=$2',[foreignOrg,job])).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
    await expect(db.query('insert into public.job_members values($1,$2,$3)',[foreignOrg,job,recruiterMembership])).rejects.toThrow(/foreign key/);
  });
  it('allows organization administrators to manage jobs without assignment but denies revoked recruiters',async()=>{
    const job=await createJob();
    await db.exec('reset role');
    await db.query("insert into public.memberships(organization_id,user_id,role) values($1,$2,'admin')",[org,outsider]);
    await as(outsider);
    await db.query('select public.save_job($1,1,$2,$3)',[org,JSON.stringify({...input,title:'Administrator edit'}),job]);
    await transition(job,'published',outsider);
    const ownJob=await createJob({},recruiter);
    await as(owner); await db.query('select public.revoke_member($1,$2)',[org,recruiterMembership]);
    await as(recruiter);
    expect(await scalar<number>('select count(*)::int as value from public.jobs where id=$1',[ownJob])).toBe(0);
    await expect(db.query('select public.save_job($1,1,$2,$3)',[org,JSON.stringify(input),ownJob])).rejects.toThrow(/Not permitted/);
    await expect(db.query('select public.save_job($1,0,$2)',[org,JSON.stringify(input)])).rejects.toThrow(/Not permitted/);
  });
});
describe('form validation',()=>{
  it('validates salary/experience bounds and normalizes skills and Pakistan deadlines',()=>{
    const form={...input,organizationId:org,jobId:'',version:0,assessment_version_id:'',application_deadline:'2027-01-01T12:30',required_skills:'React, TypeScript, React'};
    const parsed=jobSchema.parse(form);
    expect(parsed.required_skills).toEqual(['React','TypeScript']);
    expect(parsed.application_deadline).toBe('2027-01-01T12:30:00+05:00');
    expect(jobSchema.safeParse({...form,salary_max:1}).success).toBe(false);
    expect(jobSchema.safeParse({...form,experience_max:1}).success).toBe(false);
    expect(companySchema.safeParse({organizationId:org,version:0,company_name:'Company',slug:'bad/slug',industry:'Technology',location:'Karachi',website:'javascript:alert(1)',description:'A fictional company description',is_public:true}).success).toBe(false);
  });
});
describe('synthetic seed data',()=>{
  it('loads idempotently and exposes only open jobs at verified public companies',async()=>{
    const seeded=await database();
    try {
      const seed=await readFile('supabase/seed.sql','utf8'); await seeded.exec(seed); await seeded.exec(seed);
      await seeded.exec('set role anon');
      const jobs=await seeded.query<{title:string}>('select title from public.jobs order by title');
      expect(jobs.rows.map(j=>j.title)).toEqual(['Product Designer','Senior Full-stack Engineer']);
      expect((await seeded.query('select * from public.company_profiles')).rows).toHaveLength(2);
    } finally { await seeded.close(); }
  },30000);
});
