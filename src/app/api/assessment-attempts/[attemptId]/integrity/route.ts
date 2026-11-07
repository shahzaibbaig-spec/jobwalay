import { apiGuard,apiError,json,readJson } from '@/lib/api';
import { recordMonitoring } from '@/modules/assessments/integrity/server';
export async function POST(request:Request,{params}:{params:Promise<{attemptId:string}>}){const denied=await apiGuard(request,true);if(denied)return denied;try{return json(await recordMonitoring((await params).attemptId,await readJson(request)));}catch(error){return apiError(error);}}
