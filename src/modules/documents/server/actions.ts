'use server';
import { revalidatePath } from 'next/cache';
import type { FormState } from '@/lib/forms';
import { formFailure } from '@/lib/errors';
import { z } from 'zod';
import { chooseCv,uploadCv } from './service';
export async function uploadCvAction(_:FormState,form:FormData):Promise<FormState>{
  try{await uploadCv(form.get('cv'));revalidatePath('/candidate','layout');return {message:'CV scanned and saved. Existing applications keep their original CV version.'};}catch(error){return formFailure(error);}
}
export async function chooseCvAction(_:FormState,form:FormData):Promise<FormState>{
  const id=z.uuid().safeParse(form.get('documentId'));if(!id.success)return {error:'Choose a CV.'};
  try{await chooseCv(id.data);revalidatePath('/candidate','layout');return {message:'Current CV updated.'};}catch(error){return formFailure(error);}
}
