'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { FormState } from '@/lib/forms';
import { formFailure } from '@/lib/errors';
import { jobSchema, transitionSchema, assignmentSchema } from '../schemas';
import { assignRecruiter, saveJob, transitionJob } from './service';
function refresh(org:string) { revalidatePath(`/org/${org}`,'layout'); revalidatePath('/jobs','layout'); revalidatePath('/companies','layout'); }
export async function saveJobAction(_:FormState,form:FormData):Promise<FormState> {
  const input=jobSchema.safeParse(Object.fromEntries(form));
  if(!input.success) return {error:input.error.issues.slice(0,3).map(i=>`${i.path.join(' ')}: ${i.message}`).join('. ')};
  let saved;
  try { saved=await saveJob(input.data); refresh(saved.organizationId); }
  catch(error) { return formFailure(error); }
  redirect(`/org/${saved.organizationId}/jobs/${saved.id}`);
}
export async function transitionJobAction(_:FormState,form:FormData):Promise<FormState> {
  const input=transitionSchema.safeParse(Object.fromEntries(form));
  if(!input.success) return {error:'Invalid job transition request.'};
  try { refresh(await transitionJob(input.data)); return {message:'Job status updated.'}; }
  catch(error) { return formFailure(error); }
}
export async function assignRecruiterAction(_:FormState,form:FormData):Promise<FormState> {
  const input=assignmentSchema.safeParse(Object.fromEntries(form));
  if(!input.success) return {error:'Choose a recruiter and assignment action.'};
  // Service parses raw string values so a second parse cannot invert the boolean.
  try { refresh(await assignRecruiter(Object.fromEntries(form))); return {message:'Recruiter assignment updated.'}; }
  catch(error) { return formFailure(error); }
}
