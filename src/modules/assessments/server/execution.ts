import 'server-only';
import { z } from 'zod';
import { requireUser,requireOrganization } from '@/lib/auth/context';
import { requireApplication } from '@/modules/applications/server/service';
import { databaseError,DomainError } from '@/lib/errors';
import { saveAnswerSchema,employerReviewSchema,issueSchema } from '../execution-schemas';
export async function saveAnswer(attemptId:string,input:unknown){const id=z.uuid().parse(attemptId);const v=saveAnswerSchema.parse(input);const {db}=await requireUser();const {data,error}=await db.rpc('save_assessment_response',{p_attempt:id,p_question:v.questionId,p_answer:v.answer,p_revision:v.revision});if(error)throw databaseError(error);return data;}
export async function submitAttempt(attemptId:unknown){const id=z.uuid().parse(attemptId);const {db}=await requireUser();const {error}=await db.rpc('submit_assessment_attempt',{p_attempt:id});if(error)throw databaseError(error);}
export async function reportIssue(attemptId:unknown,input:unknown){const id=z.uuid().parse(attemptId);const v=issueSchema.parse(input);const {db}=await requireUser();const {error}=await db.rpc('report_assessment_integrity',{p_attempt:id,p_reason:v.reason});if(error)throw databaseError(error);}
export async function appealAttempt(attemptId:unknown,input:unknown){const id=z.uuid().parse(attemptId);const v=issueSchema.parse(input);const {db}=await requireUser();const {error}=await db.rpc('appeal_assessment',{p_attempt:id,p_reason:v.reason});if(error)throw databaseError(error);}
export async function employerResult(org:string,attemptId:string){const id=z.uuid().parse(attemptId);const context=await requireOrganization(org);const {data:attempt,error}=await context.db.from('assessment_attempts').select('id,application_id').eq('organization_id',org).eq('id',id).maybeSingle();if(error||!attempt)throw new DomainError('Attempt unavailable',404);await requireApplication(org,attempt.application_id);const {data,error:resultError}=await context.db.rpc('get_employer_assessment_result',{p_attempt:id});if(resultError)throw databaseError(resultError);return data;}
export async function reviewAttempt(org:string,attemptId:string,input:unknown){
 const v=employerReviewSchema.parse(input);const id=z.uuid().parse(attemptId);const context=await requireOrganization(org);const {data:attempt}=await context.db.from('assessment_attempts').select('application_id').eq('organization_id',org).eq('id',id).maybeSingle();if(!attempt)throw new DomainError('Attempt unavailable',404);await requireApplication(org,attempt.application_id);
 if(v.operation==='written'){const {error}=await context.db.rpc('review_written_answer',{p_attempt:id,p_question:v.questionId,p_points:v.points,p_rationale:v.rationale,p_expected_revision:v.revision});if(error)throw databaseError(error);}
 if(v.operation==='flag'){const {error}=await context.db.rpc('report_assessment_integrity',{p_attempt:id,p_reason:v.reason});if(error)throw databaseError(error);}
 if(v.operation==='retake'){const {error}=await context.db.rpc('approve_assessment_retake',{p_application:attempt.application_id,p_reason:v.reason});if(error)throw databaseError(error);}
 // Resolve IDs only after proving they belong to this authorized application's
 // result. The SQL functions independently recheck their own resource scope.
 if(v.operation==='integrity'||v.operation==='appeal'){
  const detail=z.object({flags:z.array(z.object({id:z.string()})),appeals:z.array(z.object({id:z.string()}))}).parse(await employerResult(org,id));
  if(v.operation==='integrity'){if(!detail.flags.some(f=>f.id===v.flagId))throw new DomainError('Flag unavailable',404);const {error}=await context.db.rpc('resolve_assessment_integrity',{p_flag:v.flagId,p_resolution:v.resolution,p_reason:v.reason});if(error)throw databaseError(error);}
  else{if(!detail.appeals.some(a=>a.id===v.appealId))throw new DomainError('Appeal unavailable',404);const {error}=await context.db.rpc('resolve_assessment_appeal',{p_appeal:v.appealId,p_decision:v.decision,p_message:v.message});if(error)throw databaseError(error);}
 }
}
