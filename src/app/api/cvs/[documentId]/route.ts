import { z } from 'zod';
import { requireUser } from '@/lib/auth/context';
export async function GET(request:Request,{params}:{params:Promise<{documentId:string}>}) {
  const id=z.uuid().safeParse((await params).documentId);const rawApp=new URL(request.url).searchParams.get('application');
  const application=z.uuid().optional().safeParse(rawApp??undefined);
  if(!id.success||!application.success)return new Response(null,{status:404});
  const {db}=await requireUser();
  const authorized=await db.rpc('authorize_cv_download',{p_document:id.data,p_application:application.data});
  const metadata=z.object({path:z.string(),filename:z.string()}).safeParse(authorized.data);
  if(authorized.error||!metadata.success)return new Response(null,{status:404,headers:{'Cache-Control':'private, no-store'}});
  const {data,error}=await db.storage.from('candidate-cvs').download(metadata.data.path);
  if(error||!data)return new Response(null,{status:404,headers:{'Cache-Control':'private, no-store'}});
  const name=metadata.data.filename.replace(/[^a-zA-Z0-9._ -]/g,'_');
  return new Response(data,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${name}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}
