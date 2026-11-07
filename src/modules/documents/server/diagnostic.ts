import 'server-only';
import { createHash,timingSafeEqual } from 'node:crypto';
import { appUrl } from '@/lib/env/server';
import { documentScanner } from '@/server/document-scanner';
import { scanCv,validateCv,pingScanner,scannerVersion } from './scan';
import { cleanPdfFixture,infectedPdfFixture,antivirusTestBytes } from './scan-fixtures';
let active=false;
const result=(body:unknown,status:number)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'}});
export async function scannerDiagnostic(request:Request){
 const expected=process.env.CLAMAV_DIAGNOSTIC_TOKEN;
 const hostname=new URL(request.url).hostname;
 if(process.env.NODE_ENV!=='development'||!expected||expected.length<64||!['localhost','127.0.0.1','[::1]'].includes(hostname))return result({error:'Not found'},404);
 const supplied=request.headers.get('x-clamav-diagnostic-token')??'';
 if(!timingSafeEqual(createHash('sha256').update(expected).digest(),createHash('sha256').update(supplied).digest()))return result({error:'Not found'},404);
 if(request.headers.get('origin')!==new URL(appUrl()).origin)return result({error:'Origin not allowed'},403);
 if(active)return result({error:'A scanner diagnostic is already running'},429);
 active=true;
 try{
  const scanner=documentScanner();await pingScanner(scanner);
  const version=await scannerVersion(scanner),clean=cleanPdfFixture(),infected=infectedPdfFixture();validateCv(clean);validateCv(infected);
  const cleanResult=await scanCv(clean,scanner),infectedResult=await scanCv(infected,scanner),eicarResult=await scanCv(antivirusTestBytes(),scanner);
  const ready=cleanResult==='clean'&&infectedResult==='rejected'&&eicarResult==='rejected';
  // Never call scanner.finish: diagnostics must not create or change records.
  return result({status:ready?'ready':'unsafe_scanner_response',runtime:'nodejs',version,clean:cleanResult,infected:infectedResult,eicar:eicarResult,scanCommitConfigured:true,databaseWrites:0},ready?200:503);
 }catch{return result({status:'unavailable',runtime:'nodejs',uploads:'blocked',databaseWrites:0},503);}finally{active=false;}
}
