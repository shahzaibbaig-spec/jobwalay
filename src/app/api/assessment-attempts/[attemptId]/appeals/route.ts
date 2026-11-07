import { apiGuard,apiError,json,readJson } from '@/lib/api';
import { appealAttempt } from '@/modules/assessments/server/execution';
export async function POST(request:Request,{params}:{params:Promise<{attemptId:string}>}){const denied=await apiGuard(request,true);if(denied)return denied;try{await appealAttempt((await params).attemptId,await readJson(request));return json({ok:true});}catch(error){return apiError(error);}}
