import { apiGuard,apiError,json,readJson } from '@/lib/api';
import { adminMutation,adminOverview } from '@/modules/administration/server';
export async function GET(request:Request){const denied=await apiGuard(request);if(denied)return denied;try{return json(await adminOverview());}catch(error){return apiError(error);}}
export async function POST(request:Request){const denied=await apiGuard(request,true);if(denied)return denied;try{await adminMutation(await readJson(request));return json({ok:true});}catch(error){return apiError(error);}}
