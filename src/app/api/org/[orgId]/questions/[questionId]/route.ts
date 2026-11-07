import { z } from 'zod';
import { apiGuard,apiError,json,readJson } from '@/lib/api';
import { approveQuestion } from '@/modules/assessments/server/service';
export async function PATCH(request:Request,{params}:{params:Promise<{orgId:string;questionId:string}>}){const denied=await apiGuard(request,true);if(denied)return denied;try{const {orgId,questionId}=z.object({orgId:z.uuid(),questionId:z.uuid()}).parse(await params);z.object({operation:z.literal('approve')}).parse(await readJson(request));await approveQuestion(orgId,questionId);return json({ok:true});}catch(error){return apiError(error);}}
