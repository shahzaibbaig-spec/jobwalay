import 'server-only';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireOrganization } from '@/lib/auth/context';
import { databaseError } from '@/lib/errors';
import { assignmentSchema, jobSchema, transitionSchema } from '../schemas';
export async function requireJob(org:string,id:string) {
  const context=await requireOrganization(org);
  if(!z.uuid().safeParse(id).success) notFound();
  if(context.membership.role==='recruiter') {
    const {data}=await context.db.from('job_members').select('job_id').eq('organization_id',org).eq('job_id',id).eq('membership_id',context.membership.id).maybeSingle();
    if(!data) notFound();
  }
  const {data:job,error}=await context.db.from('jobs').select('*').eq('organization_id',org).eq('id',id).maybeSingle();
  if(error) throw new Error('Unable to load job');
  if(!job) notFound();
  return {...context,job};
}
export async function saveJob(input:unknown) {
  const {organizationId,jobId,version,...job}=jobSchema.parse(input);
  const context=jobId?await requireJob(organizationId,jobId):await requireOrganization(organizationId);
  const {data,error}=await context.db.rpc('save_job',{p_org:organizationId,p_job_id:jobId||undefined,p_expected_version:version,p_input:{...job,salary_currency:job.salary_currency||null,application_deadline:job.application_deadline||null,assessment_version_id:job.assessment_version_id||null}});
  if(error) throw databaseError(error);
  return {organizationId,id:data};
}
export async function transitionJob(input:unknown) {
  const v=transitionSchema.parse(input);
  const {db}=await requireJob(v.organizationId,v.jobId);
  const {error}=await db.rpc('transition_job',{p_org:v.organizationId,p_job_id:v.jobId,p_expected_version:v.version,p_status:v.status});
  if(error) throw databaseError(error);
  return v.organizationId;
}
export async function assignRecruiter(input:unknown) {
  const v=assignmentSchema.parse(input);
  const {db}=await requireOrganization(v.organizationId,true);
  const {error}=await db.rpc('assign_job_recruiter',{p_org:v.organizationId,p_job_id:v.jobId,p_membership:v.membershipId,p_assign:v.assign});
  if(error) throw databaseError(error);
  return v.organizationId;
}
