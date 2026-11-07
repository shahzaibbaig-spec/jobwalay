import { apiGuard,apiError,json,readJson } from '@/lib/api';
import { employerResult,reviewAttempt } from '@/modules/assessments/server/execution';
export async function GET(request:Request,{params}:{params:Promise<{orgId:string;attemptId:string}>}){const denied=await apiGuard(request);if(denied)return denied;try{const p=await params;return json(await employerResult(p.orgId,p.attemptId));}catch(error){return apiError(error);}}
export async function PATCH(request:Request,{params}:{params:Promise<{orgId:string;attemptId:string}>}){const denied=await apiGuard(request,true);if(denied)return denied;try{const p=await params;await reviewAttempt(p.orgId,p.attemptId,await readJson(request));return json({ok:true});}catch(error){return apiError(error);}}
