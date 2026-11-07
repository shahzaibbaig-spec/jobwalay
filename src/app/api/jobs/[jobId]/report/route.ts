import { apiGuard,apiError,json,readJson } from '@/lib/api';
import { reportAbuse } from '@/modules/administration/server';
import { z } from 'zod';
export async function POST(request:Request,{params}:{params:Promise<{jobId:string}>}){const denied=await apiGuard(request,true);if(denied)return denied;try{const body=z.object({category:z.string(),details:z.string()}).strict().parse(await readJson(request));await reportAbuse({...body,jobId:(await params).jobId});return json({ok:true},201);}catch(error){return apiError(error);}}
