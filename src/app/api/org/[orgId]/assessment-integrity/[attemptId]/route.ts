import { apiGuard,apiError,json,readJson } from '@/lib/api';
import { readActivity,reviewMonitoring } from '@/modules/assessments/integrity/server';
import { activityFilters } from '@/modules/assessments/integrity/contracts';
type Context={params:Promise<{orgId:string;attemptId:string}>};
export async function GET(request:Request,{params}:Context){const denied=await apiGuard(request);if(denied)return denied;try{const {orgId,attemptId}=await params;const search=new URL(request.url).searchParams;const filters=activityFilters.parse({before:search.get('before')??undefined,kind:search.get('kind')||undefined});return json(await readActivity(attemptId,{...filters,org:orgId}));}catch(error){return apiError(error);}}
export async function PATCH(request:Request,{params}:Context){const denied=await apiGuard(request,true);if(denied)return denied;try{const {orgId,attemptId}=await params;await reviewMonitoring(orgId,attemptId,await readJson(request));return json({ok:true});}catch(error){return apiError(error);}}
