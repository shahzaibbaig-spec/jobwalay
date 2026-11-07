import 'server-only';
import { ZodError } from 'zod';
import { appUrl } from '@/lib/env/server';
import { createClient } from '@/lib/supabase/server';
import { DomainError } from './errors';
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});}
export async function apiGuard(request:Request,mutation=false){
 if(mutation&&request.headers.get('origin')!==new URL(appUrl()).origin)return json({error:'Request origin is not allowed'},403);
 const db=await createClient();const {data:{user},error}=await db.auth.getUser();if(error||!user?.email_confirmed_at)return json({error:'Authentication required'},401);
 const {data:account}=await db.from('accounts').select('id,onboarded_at').eq('id',user.id).maybeSingle();if(!account?.onboarded_at)return json({error:'Account unavailable or onboarding required'},403);
 const {error:quota}=await db.rpc('consume_request_quota',{p_mutation:mutation});if(quota){if(quota.message==='Too many requests. Try again later.')return Response.json({error:'Too many requests. Try again later.'},{status:429,headers:{'Retry-After':'60','Cache-Control':'private, no-store'}});return json({error:'Account unavailable'},403);}
 return null;
}
export async function readJson(request:Request){
 if(!request.headers.get('content-type')?.includes('application/json'))throw new DomainError('Use application/json');
 const reader=request.body?.getReader();if(!reader)throw new DomainError('Request body required');let bytes=0;const chunks:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>128*1024){await reader.cancel();throw new DomainError('Request body is too large');}chunks.push(value);}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;}catch{throw new DomainError('Invalid JSON');}
}
export function apiError(error:unknown){if(error instanceof ZodError)return json({error:'Validation failed',issues:error.issues.map(i=>({path:i.path,message:i.message}))},400);if(error instanceof DomainError){if(error.status===429)return Response.json({error:error.message},{status:429,headers:{'Retry-After':'60','Cache-Control':'private, no-store'}});return json({error:error.message},error.status);}throw error;}
