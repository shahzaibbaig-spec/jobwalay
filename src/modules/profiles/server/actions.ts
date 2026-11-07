'use server';
import { revalidatePath } from 'next/cache';
import type { FormState } from '@/lib/forms';
import { saveProfile,saveEntry,deleteEntry } from './service';
import { profileSchema,entrySchema,deleteEntrySchema } from '../schemas';
import { formFailure } from '@/lib/errors';
import type { ZodError } from 'zod';
function validation(error:ZodError):FormState{return {error:error.issues.slice(0,3).map(i=>`${i.path.join(' ')}: ${i.message}`).join('. ')};}
function refresh(){revalidatePath('/candidate','layout');revalidatePath('/candidates','layout');}
export async function profileAction(_: FormState, form: FormData): Promise<FormState> {
  const input = profileSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return validation(input.error);
  try {await saveProfile(input.data);refresh();return {message:'Professional profile saved.'};}catch(error){return formFailure(error);}
}
export async function entryAction(_:FormState,form:FormData):Promise<FormState>{
  const input=entrySchema.safeParse(Object.fromEntries(form));
  if(!input.success)return validation(input.error);
  try{await saveEntry(input.data);refresh();return {message:'Profile entry saved.'};}catch(error){return formFailure(error);}
}
export async function deleteEntryAction(_:FormState,form:FormData):Promise<FormState>{
  const input=deleteEntrySchema.safeParse(Object.fromEntries(form));if(!input.success)return validation(input.error);
  try{await deleteEntry(input.data);refresh();return {message:'Profile entry removed.'};}catch(error){return formFailure(error);}
}
