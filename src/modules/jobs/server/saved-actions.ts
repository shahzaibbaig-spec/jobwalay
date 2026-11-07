'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/context';
import { databaseError } from '@/lib/errors';
import type { FormState } from '@/lib/forms';
export async function savedJobAction(_:FormState,form:FormData):Promise<FormState>{
  const v=z.object({jobId:z.uuid(),saved:z.enum(['true','false'])}).safeParse(Object.fromEntries(form));if(!v.success)return {error:'Invalid saved job request.'};
  const {db}=await requireUser();const {error}=await db.rpc('set_saved_job',{p_job:v.data.jobId,p_saved:v.data.saved==='true'});
  if(error)return {error:databaseError(error).message};revalidatePath('/candidate/saved');return {message:v.data.saved==='true'?'Job saved.':'Saved job removed.'};
}
