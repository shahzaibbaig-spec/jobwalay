import { z } from 'zod';
import { apiGuard,apiError,json,readJson } from '@/lib/api';
import { createQuestion } from '@/modules/assessments/server/service';
export async function POST(request:Request,{params}:{params:Promise<{orgId:string}>}){const denied=await apiGuard(request,true);if(denied)return denied;try{const orgId=z.uuid().parse((await params).orgId);const body=z.record(z.string(),z.unknown()).parse(await readJson(request));return json({id:await createQuestion({...body,organizationId:orgId})},201);}catch(error){return apiError(error);}}
