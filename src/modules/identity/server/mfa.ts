'use server';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/context';
export type MfaState = { error?: string; secret?: string; factorId?: string };
export async function enrollMfa(): Promise<MfaState> {
  const { db } = await requireUser();
  const { data: factors, error: listError } = await db.auth.mfa.listFactors();
  if (listError) return { error: 'Unable to load factors.' };
  if (factors.totp.some(f => f.status === 'verified')) return { error: 'An authenticator is already enrolled. Use its current code.' };
  for (const factor of factors.all.filter(f => f.status === 'unverified')) {
    const { error } = await db.auth.mfa.unenroll({ factorId: factor.id });
    if (error) return { error: 'Unable to replace unfinished enrollment.' };
  }
  const { data, error } = await db.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Jobwalay authenticator' });
  if (error) return { error: 'Unable to enroll authenticator.' };
  return { secret: data.totp.secret, factorId: data.id };
}
export async function verifyMfa(_: MfaState, form: FormData): Promise<MfaState> {
  const input = z.object({ factorId: z.uuid(), code: z.string().regex(/^\d{6}$/) }).safeParse(Object.fromEntries(form));
  if (!input.success) return { error: 'Enter the six-digit authenticator code.' };
  const { db } = await requireUser();
  const { error } = await db.auth.mfa.challengeAndVerify(input.data);
  if (error) return { error: 'Verification failed. Try a new code.' };
  redirect('/dashboard');
}
