'use server';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/context';
import { databaseError,formFailure } from '@/lib/errors';
import type { FormState } from '@/lib/forms';
export async function preferencesAction(_:FormState,form:FormData):Promise<FormState>{const {db}=await requireUser();try{const {error}=await db.rpc('set_notification_preferences',{p_email:form.get('emailEnabled')==='on'});if(error)throw databaseError(error);revalidatePath('/account/notifications');return {message:'Preferences saved. They apply to future updates; pending deliveries recheck your preference.'};}catch(error){return formFailure(error);}}
