'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import type { FormState } from '@/lib/forms';
import { formFailure } from '@/lib/errors';
import { appealAttempt,reviewAttempt } from './execution';
export async function appealAction(_:FormState,form:FormData):Promise<FormState>{const id=z.uuid().safeParse(form.get('attemptId'));const reason=z.string().trim().min(5).max(2000).safeParse(form.get('reason'));if(!id.success||!reason.success)return {error:'Explain your appeal in 5 to 2000 characters.'};try{await appealAttempt(id.data,{reason:reason.data});revalidatePath('/candidate','layout');return {message:'Your appeal has been sent for human review.'};}catch(error){return formFailure(error);}}
export async function employerReviewAction(_:FormState,form:FormData):Promise<FormState>{const {organizationId,attemptId,...input}=Object.fromEntries([...form].filter(([key])=>!key.startsWith('$ACTION_')));const ids=z.object({organizationId:z.uuid(),attemptId:z.uuid()}).safeParse({organizationId,attemptId});if(!ids.success)return {error:'Invalid review request.'};try{await reviewAttempt(ids.data.organizationId,ids.data.attemptId,input);revalidatePath('/org','layout');revalidatePath('/candidate','layout');return {message:'Review recorded. The server recalculated eligibility.'};}catch(error){if(error instanceof z.ZodError)return {error:error.issues.map(i=>i.message).join('. ')};return formFailure(error);}}
