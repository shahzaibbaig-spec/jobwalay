'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { formFailure } from '@/lib/errors';
import type { FormState } from '@/lib/forms';
import { adminMutation,reportAbuse } from './server';
const input=(form:FormData)=>Object.fromEntries([...form].filter(([key])=>!key.startsWith('$ACTION_')));
export async function administrationAction(_:FormState,form:FormData):Promise<FormState>{try{await adminMutation(input(form));revalidatePath('/admin','layout');revalidatePath('/jobs','layout');return {message:'Decision recorded and audited.'};}catch(error){if(error instanceof z.ZodError)return {error:'Check the decision fields and give a reason in 5–2000 characters.'};return formFailure(error);}}
export async function abuseReportAction(_:FormState,form:FormData):Promise<FormState>{try{await reportAbuse(input(form));return {message:'Report received. An independent moderator will review it; reporting does not automatically remove a job.'};}catch(error){if(error instanceof z.ZodError)return {error:'Choose a category and describe the issue in 10–2000 characters.'};return formFailure(error);}}
