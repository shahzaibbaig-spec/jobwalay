import { z } from 'zod';
import { apiGuard,apiError,json,readJson } from '@/lib/api';
import { startAttempt } from '@/modules/assessments/server/service';
import { disclosureVersion } from '@/modules/assessments/integrity/contracts';
export async function POST(request:Request){const denied=await apiGuard(request,true);if(denied)return denied;try{const body=z.object({applicationId:z.uuid(),monitoringDisclosure:z.literal(disclosureVersion)}).strict().parse(await readJson(request));return json({id:await startAttempt(body.applicationId,body.monitoringDisclosure)},201);}catch(error){return apiError(error);}}
