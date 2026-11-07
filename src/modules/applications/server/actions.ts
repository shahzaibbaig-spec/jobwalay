'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { FormState } from '@/lib/forms';
import { formFailure } from '@/lib/errors';
import { applicationSchema,stageSchema,noteSchema,withdrawSchema } from '../schemas';
import { submitApplication,moveApplication,addNote,withdrawApplication } from './service';
function refresh(){revalidatePath('/candidate','layout');revalidatePath('/org','layout');}
export async function applyAction(_:FormState,form:FormData):Promise<FormState> {
  const input=applicationSchema.safeParse(Object.fromEntries(form));
  if(!input.success)return {error:'Choose a verified CV, provide a valid contact email, and confirm sharing. Cover letters are limited to 5,000 characters.'};
  let id:string;try{id=await submitApplication(input.data);refresh();}catch(error){return formFailure(error);}
  redirect(`/candidate/applications/${id}`);
}
export async function stageAction(_:FormState,form:FormData):Promise<FormState>{const input=stageSchema.safeParse(Object.fromEntries(form));if(!input.success)return {error:'Choose a valid stage and a message up to 2,000 characters.'};try{await moveApplication(input.data);refresh();return {message:'Hiring stage updated and history recorded.'};}catch(error){return formFailure(error);}}
export async function noteAction(_:FormState,form:FormData):Promise<FormState>{const input=noteSchema.safeParse(Object.fromEntries(form));if(!input.success)return {error:'Write a note from 1 to 5,000 characters.'};try{await addNote(input.data);refresh();return {message:'Internal note added.'};}catch(error){return formFailure(error);}}
export async function withdrawAction(_:FormState,form:FormData):Promise<FormState>{const input=withdrawSchema.safeParse(Object.fromEntries(form));if(!input.success)return {error:'Invalid application.'};try{await withdrawApplication(input.data);refresh();return {message:'Application withdrawn. Future employer access to your profile snapshot and CV is revoked.'};}catch(error){return formFailure(error);}}
