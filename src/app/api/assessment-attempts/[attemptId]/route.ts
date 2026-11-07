import { apiGuard,apiError,json } from '@/lib/api';
import { readAttempt } from '@/modules/assessments/server/service';
export async function GET(request:Request,{params}:{params:Promise<{attemptId:string}>}){const denied=await apiGuard(request);if(denied)return denied;try{return json(await readAttempt((await params).attemptId));}catch(error){return apiError(error);}}
