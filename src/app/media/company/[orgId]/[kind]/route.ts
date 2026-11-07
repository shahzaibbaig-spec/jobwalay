import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { imageKindSchema } from '@/modules/companies/schemas';
export async function GET(_:Request,{params}:{params:Promise<{orgId:string;kind:string}>}) {
  const input=z.object({orgId:z.uuid(),kind:imageKindSchema}).safeParse(await params);
  if(!input.success) return new Response(null,{status:404});
  const db=await createClient();
  const {data:profile}=await db.from('company_profiles').select('logo_path,cover_path').eq('organization_id',input.data.orgId).maybeSingle();
  const path=input.data.kind==='logo'?profile?.logo_path:profile?.cover_path;
  if(!path) return new Response(null,{status:404});
  const {data,error}=await db.storage.from('company-assets').download(path);
  if(error||!data) return new Response(null,{status:404});
  return new Response(data,{headers:{'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}
