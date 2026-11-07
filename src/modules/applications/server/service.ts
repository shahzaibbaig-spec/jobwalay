import 'server-only';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireOrganization,requireUser } from '@/lib/auth/context';
import { requireJob } from '@/modules/jobs/server/service';
import { databaseError } from '@/lib/errors';
import { applicationSchema,noteSchema,stageSchema,withdrawSchema } from '../schemas';
export async function requireApplication(org:string,id:string){
  if(!z.uuid().safeParse(id).success)notFound();
  const context=await requireOrganization(org);
  const {data:application,error}=await context.db.from('applications').select('*').eq('organization_id',org).eq('id',id).maybeSingle();
  if(error)throw new Error('Unable to load application');
  if(!application||application.candidate_id===context.user.id)notFound();
  await requireJob(org,application.job_id);
  return {...context,application};
}
export async function submitApplication(input:unknown){
  const v=applicationSchema.parse(input);const {db}=await requireUser();
  const {data,error}=await db.rpc('apply_to_job',{p_job:v.jobId,p_document:v.documentId,p_contact_email:v.contact_email,p_phone:v.phone,p_cover_letter:v.cover_letter});
  if(error)throw databaseError(error);return data;
}
export async function moveApplication(input:unknown){
  const v=stageSchema.parse(input);const {db}=await requireApplication(v.organizationId,v.applicationId);
  const {error}=await db.rpc('transition_application',{p_org:v.organizationId,p_application:v.applicationId,p_expected_version:v.version,p_status:v.status,p_message:v.message});if(error)throw databaseError(error);
}
export async function addNote(input:unknown){
  const v=noteSchema.parse(input);const {db}=await requireApplication(v.organizationId,v.applicationId);
  const {error}=await db.rpc('add_application_note',{p_org:v.organizationId,p_application:v.applicationId,p_body:v.body});if(error)throw databaseError(error);
}
export async function withdrawApplication(input:unknown){
  const v=withdrawSchema.parse(input);const {db}=await requireUser();
  const {error}=await db.rpc('withdraw_application',{p_application:v.applicationId,p_expected_version:v.version});if(error)throw databaseError(error);
}
