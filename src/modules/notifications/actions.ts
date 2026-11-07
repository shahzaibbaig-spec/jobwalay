'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/context';
export async function markRead(form:FormData){const id=z.uuid().parse(form.get('id'));const {db}=await requireUser();const {error}=await db.rpc('mark_notification_read',{p_id:id});if(error)throw new Error('Unable to mark notification read');revalidatePath('/notifications');}
