'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import type { FormState } from '@/lib/forms';
import { formFailure } from '@/lib/errors';
import { reviewMonitoring } from './server';
export async function monitoringReviewAction(_:FormState,form:FormData):Promise<FormState>{const ids=z.object({org:z.uuid(),attempt:z.uuid()}).safeParse({org:form.get('org'),attempt:form.get('attempt')});if(!ids.success)return {error:'Invalid monitoring review.'};try{await reviewMonitoring(ids.data.org,ids.data.attempt,{outcome:form.get('outcome'),rationale:form.get('rationale')});revalidatePath(`/org/${ids.data.org}/assessment-integrity/${ids.data.attempt}`);return {message:'Context recorded. No grade or hiring stage was changed.'};}catch(error){if(error instanceof z.ZodError)return {error:'Choose a review outcome and give 5–2000 characters of context.'};return formFailure(error);}}
