import { apiGuard,apiError,json,readJson } from '@/lib/api';
import { saveAnswer } from '@/modules/assessments/server/execution';
export async function PATCH(request:Request,{params}:{params:Promise<{attemptId:string}>}){const denied=await apiGuard(request,true);if(denied)return denied;try{return json({revision:await saveAnswer((await params).attemptId,await readJson(request))});}catch(error){return apiError(error);}}
