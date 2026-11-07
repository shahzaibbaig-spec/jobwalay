'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { FormState } from '@/lib/forms';
import { formFailure } from '@/lib/errors';
import { companySchema, imageKindSchema, reviewSchema, verificationSchema } from '../schemas';
import { requestVerification, reviewVerification, saveCompany, uploadCompanyImage } from './service';
function invalid(error: z.ZodError): FormState { return {error:error.issues.map(i=>`${i.path.join(' ')}: ${i.message}`).slice(0,3).join('. ')}; }
function refresh(org?:string) {
  if(org) { revalidatePath(`/org/${org}`); revalidatePath(`/org/${org}/profile`); revalidatePath(`/org/${org}/verification`); }
  revalidatePath('/companies','layout'); revalidatePath('/jobs','layout'); revalidatePath('/admin');
}
export async function saveCompanyAction(_:FormState,form:FormData):Promise<FormState> {
  const input=companySchema.safeParse(Object.fromEntries(form));
  if(!input.success) return invalid(input.error);
  try { const org=await saveCompany(input.data); refresh(org); return {message:'Company profile saved. Public visibility requires verification.'}; }
  catch(error) { return formFailure(error); }
}
export async function requestVerificationAction(_:FormState,form:FormData):Promise<FormState> {
  const input=verificationSchema.safeParse(Object.fromEntries(form));
  if(!input.success) return invalid(input.error);
  try { refresh(await requestVerification(input.data)); return {message:'Verification request submitted.'}; }
  catch(error) { return formFailure(error); }
}
export async function reviewVerificationAction(_:FormState,form:FormData):Promise<FormState> {
  const input=reviewSchema.safeParse(Object.fromEntries(form));
  if(!input.success) return invalid(input.error);
  try { await reviewVerification(input.data); refresh(); return {message:'Verification decision recorded.'}; }
  catch(error) { return formFailure(error); }
}
export async function uploadImageAction(_:FormState,form:FormData):Promise<FormState> {
  const input=z.object({organizationId:z.uuid(),kind:imageKindSchema}).safeParse(Object.fromEntries(form));
  if(!input.success) return invalid(input.error);
  try { refresh(await uploadCompanyImage(input.data.organizationId,input.data.kind,form.get('image'))); return {message:'Company image updated.'}; }
  catch(error) { return formFailure(error); }
}
