import { z } from 'zod';
import { apiGuard,apiError,json,readJson } from '@/lib/api';
import { submitAttempt } from '@/modules/assessments/server/execution';
export async function POST(request:Request,{params}:{params:Promise<{attemptId:string}>}){const denied=await apiGuard(request,true);if(denied)return denied;try{z.object({}).strict().parse(await readJson(request));await submitAttempt((await params).attemptId);return json({ok:true});}catch(error){return apiError(error);}}
