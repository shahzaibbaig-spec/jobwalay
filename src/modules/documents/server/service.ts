import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/context';
import { databaseError,DomainError } from '@/lib/errors';
import { documentScanner } from '@/server/document-scanner';
import { scanCv,validateCv,validateCvFile,pingScanner } from './scan';
export async function uploadCv(file:unknown) {
  const {db,user}=await requireUser();
  validateCvFile(file);
  const bytes=Buffer.from(await file.arrayBuffer());validateCv(bytes);
  if(bytes.length!==file.size)throw new DomainError('The uploaded file size does not match its content.');
  const scanner=documentScanner(); // Fail before reserving/uploading if unconfigured.
  await pingScanner(scanner); // A disconnected scanner must not create a new upload.
  const hash=createHash('sha256').update(bytes).digest('hex');
  const filename=(file.name.replace(/[^a-zA-Z0-9 ._-]/g,'_').slice(0,150).replace(/\.pdf$/i,'')||'CV')+'.pdf';
  const {data:document,error}=await db.rpc('begin_cv_upload',{p_filename:filename,p_size:bytes.length,p_sha256:hash});
  if(error||!document)throw databaseError(error??{message:'CV upload failed'});
  const path=`${user.id}/${document}.pdf`;
  const uploaded=await db.storage.from('candidate-cvs').upload(path,bytes,{contentType:'application/pdf',upsert:false});
  if(uploaded.error){await scanner.finish(document,hash,'error');throw new DomainError('CV upload failed. Please try again.');}
  let result:'clean'|'rejected';
  try{result=await scanCv(bytes,scanner);}catch(error){await scanner.finish(document,hash,'error');throw error;}
  await scanner.finish(document,hash,result);
  if(result==='rejected')throw new DomainError('The CV was rejected by the security scan. Upload a different PDF.');
}
export async function chooseCv(input:unknown){
  const id=z.uuid().parse(input);const {db}=await requireUser();
  const {error}=await db.rpc('set_current_cv',{p_document:id});if(error)throw databaseError(error);
}
