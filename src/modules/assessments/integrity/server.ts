import 'server-only';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/context';
import { requireApplication } from '@/modules/applications/server/service';
import { databaseError,DomainError } from '@/lib/errors';
import { monitoringBatchSchema,monitorReviewSchema } from './contracts';
export async function recordMonitoring(attemptId:string,input:unknown){const id=z.uuid().parse(attemptId);const v=monitoringBatchSchema.parse(input);const {db}=await requireUser();const {data,error}=await db.rpc('record_assessment_integrity',{p_attempt:id,p_session:v.sessionId,p_disclosure:v.disclosure,p_events:v.events,p_release:v.release});if(error)throw databaseError(error);return data;}
export async function monitoringContext(org:string,attemptId:string){const id=z.uuid().parse(attemptId);const {db}=await requireUser();const {data:t,error}=await db.from('assessment_attempts').select('id,application_id,organization_id,state,attempt_number').eq('id',id).eq('organization_id',org).maybeSingle();if(error||!t)throw new DomainError('Attempt unavailable',404);const context=await requireApplication(org,t.application_id);return {...context,attempt:t};}
export async function reviewMonitoring(org:string,attemptId:string,input:unknown){const v=monitorReviewSchema.parse(input);const {db}=await monitoringContext(org,attemptId);const {error}=await db.rpc('review_assessment_monitoring',{p_attempt:attemptId,p_outcome:v.outcome,p_rationale:v.rationale});if(error)throw databaseError(error);}
export async function readActivity(attemptId:string,options:{org?:string;before?:number;kind?:string}={}){
 const id=z.uuid().parse(attemptId);const {db,user}=await requireUser();
 const attempt=options.org?(await monitoringContext(options.org,id)).attempt:(await db.from('assessment_attempts').select('id,application_id,state,attempt_number').eq('id',id).eq('candidate_id',user.id).maybeSingle()).data;
 if(!attempt)throw new DomainError('Attempt unavailable',404);
 let query=db.from('assessment_integrity_events').select('id,sequence,kind,source,client_observed_at,received_at',{count:'exact'}).eq('attempt_id',id).order('sequence',{ascending:false}).limit(101);
 if(options.before)query=query.lt('sequence',options.before);if(options.kind)query=query.eq('kind',options.kind);
 const [events,ack,reviews]=await Promise.all([query,db.from('assessment_integrity_acknowledgements').select('disclosure_version,acknowledged_at').eq('attempt_id',id).maybeSingle(),options.org?db.from('assessment_monitor_reviews').select('id,outcome,rationale,reviewed_at').eq('attempt_id',id).order('reviewed_at',{ascending:false}).limit(50):Promise.resolve({data:[],error:null})]);
 if(events.error||ack.error||reviews.error)throw new Error('Unable to load monitoring activity');
 return {attempt,events:(events.data??[]).slice(0,100),next:events.data&&events.data.length>100?events.data[99].sequence:null,ack:ack.data,reviews:reviews.data??[]};
}
