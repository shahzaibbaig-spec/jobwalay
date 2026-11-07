import 'server-only';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireOrganization,requireUser } from '@/lib/auth/context';
import { databaseError,DomainError } from '@/lib/errors';
import { createAssessmentSchema,settingsSchema,questionSchema,poolSchema,versionOperationSchema } from '../schemas';
import { disclosureVersion } from '../integrity/contracts';
export async function requireAssessment(org:string,id:string){const context=await requireOrganization(org);if(!z.uuid().safeParse(id).success)notFound();const {data:assessment,error}=await context.db.from('assessments').select('id,title,job_id,organization_id').eq('organization_id',org).eq('id',id).maybeSingle();if(error)throw new Error('Unable to load assessment');if(!assessment)notFound();return {...context,assessment};}
export async function requireVersion(org:string,id:string){const context=await requireOrganization(org);if(!z.uuid().safeParse(id).success)notFound();const {data:version,error}=await context.db.from('assessment_versions').select('*').eq('organization_id',org).eq('id',id).maybeSingle();if(error)throw new Error('Unable to load version');if(!version)notFound();return {...context,version};}
export async function createAssessment(input:unknown){const v=createAssessmentSchema.parse(input);const {db}=await requireOrganization(v.organizationId);const {data,error}=await db.rpc('create_assessment',{p_org:v.organizationId,p_title:v.title,p_job:v.jobId||undefined});if(error)throw databaseError(error);return data;}
export async function saveSettings(input:unknown){const {organizationId,versionId,revision,...settings}=settingsSchema.parse(input);const {db}=await requireVersion(organizationId,versionId);const {error}=await db.rpc('save_assessment_settings',{p_org:organizationId,p_version:versionId,p_revision:revision,p_input:settings});if(error)throw databaseError(error);}
export async function createQuestion(input:unknown){const {organizationId,sourceId,...question}=questionSchema.parse(input);const {db}=await requireOrganization(organizationId);const {data,error}=await db.rpc('save_bank_question',{p_org:organizationId,p_input:question,p_source:sourceId||undefined});if(error)throw databaseError(error);return data;}
export async function approveQuestion(org:string,question:string){z.uuid().parse(question);const {db}=await requireOrganization(org,true);const {error}=await db.rpc('approve_bank_question',{p_org:org,p_question:question});if(error)throw databaseError(error);}
export async function createPool(input:unknown){const v=poolSchema.parse(input);const {db}=await requireOrganization(v.organizationId);const {data,error}=await db.rpc('save_question_pool',{p_org:v.organizationId,p_name:v.name,p_questions:v.questions});if(error)throw databaseError(error);return data;}
export async function approvePool(org:string,pool:string){z.uuid().parse(pool);const {db}=await requireOrganization(org,true);const {error}=await db.rpc('approve_question_pool',{p_org:org,p_pool:pool});if(error)throw databaseError(error);}
export async function changeVersion(input:unknown){const v=versionOperationSchema.parse(input);const {db}=await requireVersion(v.organizationId,v.versionId);let result:string|undefined;
 if(v.operation==='publish'){const {error}=await db.rpc('publish_assessment',{p_org:v.organizationId,p_version:v.versionId,p_revision:v.revision});if(error)throw databaseError(error);}
 if(v.operation==='revise'){const {data,error}=await db.rpc('revise_assessment',{p_org:v.organizationId,p_version:v.versionId});if(error)throw databaseError(error);result=data;}
 if(v.operation==='question'){const {error}=await db.rpc('set_assessment_question',{p_org:v.organizationId,p_version:v.versionId,p_question:v.questionId,p_points:v.points,p_position:v.position,p_remove:v.remove==='true'});if(error)throw databaseError(error);}
 if(v.operation==='pool'){const {error}=await db.rpc('set_assessment_pool',{p_org:v.organizationId,p_version:v.versionId,p_pool:v.poolId,p_count:v.count,p_points:v.points,p_remove:v.remove==='true'});if(error)throw databaseError(error);}
 return result;
}
export async function startAttempt(input:unknown,disclosure:unknown){const id=z.uuid().parse(input);z.literal(disclosureVersion).parse(disclosure);const {db}=await requireUser();const {data,error}=await db.rpc('start_assessment_attempt',{p_application:id,p_disclosure:disclosureVersion});if(error)throw databaseError(error);return data;}
export async function readAttempt(input:unknown){
 const id=z.uuid().parse(input);const {db,user}=await requireUser();
 const fields='id,application_id,version_id,attempt_number,state,started_at,deadline_at,closed_at,settings_snapshot';
 const {data:initialAttempt,error}=await db.from('assessment_attempts').select(fields).eq('id',id).eq('candidate_id',user.id).maybeSingle();if(error)throw new Error('Unable to load attempt');if(!initialAttempt)throw new DomainError('Assessment attempt unavailable',404);
 let attempt=initialAttempt;
 const {data:serverTime,error:clockError}=await db.rpc('assessment_server_time');if(clockError)throw new Error('Unable to synchronize assessment time');
 if(attempt.state==='in_progress'&&new Date(attempt.deadline_at).getTime()<=new Date(serverTime).getTime()){
  const {error:closed}=await db.rpc('submit_assessment_attempt',{p_attempt:id});if(closed)throw databaseError(closed);
  const refreshed=await db.from('assessment_attempts').select(fields).eq('id',id).eq('candidate_id',user.id).single();if(refreshed.error)throw new Error('Unable to load closed attempt');attempt=refreshed.data;
 }
 const [questions,responses,result,appeals]=await Promise.all([
 db.from('assessment_attempt_questions').select('id,kind,prompt,options,category,difficulty,max_points,position').eq('attempt_id',id).order('position'),
 db.from('assessment_responses').select('question_id,answer,revision,saved_at').eq('attempt_id',id),
 db.from('assessment_results').select('attempt_id,outcome,objective_points,earned_points,max_points,total_score,percentage,passing_percentage,pending_written,integrity_holds,open_appeals,result_revision').eq('attempt_id',id).maybeSingle(),
 db.from('assessment_appeals').select('id,reason,decision,resolution_message,created_at').eq('attempt_id',id),
 ]);if([questions,responses,result,appeals].some(r=>r.error))throw new Error('Unable to load assessment delivery');
 return {attempt,server_time:serverTime,questions:questions.data??[],responses:responses.data??[],result:result.data,appeals:appeals.data??[]};
}
