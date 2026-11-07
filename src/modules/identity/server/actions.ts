'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { appUrl } from '@/lib/env/server';
import { credentialsSchema, emailSchema, passwordSchema } from '../schemas';
import { onboard } from './service';
import { requireUser } from '@/lib/auth/context';
import { z } from 'zod';
import { invalid, type FormState } from '@/lib/forms';
import { cookies } from 'next/headers';
import { authDestination, authDestinationCookie } from '@/lib/auth/destination';

async function rememberDestination(value: unknown) {
  const jar = await cookies();
  jar.set(authDestinationCookie, authDestination(value), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: 60 * 60,
  });
}
export async function login(_: FormState, form: FormData): Promise<FormState> {
  const input = credentialsSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return invalid();
  const db = await createClient();
  const { error } = await db.auth.signInWithPassword(input.data);
  if (error) return { error: 'Unable to sign in. Check your credentials and verify your email.' };
  (await cookies()).delete(authDestinationCookie);
  redirect(authDestination(form.get('next')));
}
export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const input = credentialsSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return invalid();
  await rememberDestination(form.get('next'));
  const db = await createClient();
  const { error } = await db.auth.signUp({ ...input.data, options: { emailRedirectTo: `${appUrl()}/auth/callback` } });
  if (error) return { error: 'Unable to register. Please try again later.' };
  return { message: 'Check your email for a verification link. If already registered, sign in or reset your password.' };
}
export async function resendVerification(_: FormState, form: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(form.get('email'));
  if (!email.success) return invalid();
  await rememberDestination(form.get('next'));
  const db = await createClient();
  await db.auth.resend({ type: 'signup', email: email.data, options: { emailRedirectTo: `${appUrl()}/auth/callback` } });
  return { message: 'If eligible, a verification email has been sent.' };
}
export async function forgotPassword(_: FormState, form: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(form.get('email'));
  if (!email.success) return invalid();
  const db = await createClient();
  await db.auth.resetPasswordForEmail(email.data, { redirectTo: `${appUrl()}/auth/callback?flow=recovery` });
  return { message: 'If eligible, a password reset email has been sent.' };
}
export async function resetPassword(_: FormState, form: FormData): Promise<FormState> {
  const input = passwordSchema.safeParse(form.get('password'));
  if (!input.success) return invalid();
  const { db } = await requireUser(false);
  const { error } = await db.auth.updateUser({ password: input.data });
  if (error) return { error: 'Password update failed. Request a new reset link.' };
  const { error: signOutError } = await db.auth.signOut({ scope: 'global' });
  if (signOutError) return { error: 'Password updated, but session revocation failed. Please sign out and contact support if it persists.' };
  redirect('/login?message=Password+updated.+Please+sign+in.');
}
export async function logout() {
  const db = await createClient();
  const { error } = await db.auth.signOut({ scope: 'global' });
  if (error) throw new Error('Sign out failed. Try again.');
  redirect('/login');
}
export async function onboardingAction(_: FormState, form: FormData): Promise<FormState> {
  // Auth redirects must propagate; only validation is converted to field feedback.
  const name = z.string().trim().min(1).max(100).safeParse(form.get('name'));
  if (!name.success) return invalid();
  await onboard(name.data);
  redirect(authDestination(form.get('next')));
}
