import { z } from 'zod';
import { apiGuard,apiError,json,readJson } from '@/lib/api';
import { approvePool } from '@/modules/assessments/server/service';
export async function PATCH(request:Request,{params}:{params:Promise<{orgId:string;poolId:string}>}){const denied=await apiGuard(request,true);if(denied)return denied;try{const {orgId,poolId}=z.object({orgId:z.uuid(),poolId:z.uuid()}).parse(await params);z.object({operation:z.literal('approve')}).parse(await readJson(request));await approvePool(orgId,poolId);return json({ok:true});}catch(error){return apiError(error);}}
