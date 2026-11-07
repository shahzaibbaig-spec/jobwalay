'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { invalid, type FormState } from '@/lib/forms';
import { requireOrganization, requireUser } from '@/lib/auth/context';
import { acceptInvitation, inviteMember, registerOrganization } from './service';
export async function organizationAction(_: FormState, form: FormData): Promise<FormState> {
  const name = z.string().trim().min(2).max(120).safeParse(form.get('name'));
  if (!name.success) return invalid();
  const id = await registerOrganization(name.data);
  redirect(`/org/${id}/admin`);
}
export async function inviteAction(_: FormState, form: FormData): Promise<FormState> {
  const { inviteSchema } = await import('../schemas');
  const input = inviteSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return invalid();
  await requireOrganization(input.data.organizationId, true);
  try { return { token: await inviteMember(input.data), message: 'Share this single-use code securely with the invited email recipient. It expires in 7 days.' }; }
  catch { return { error: 'Invitation failed. Check permissions and hourly limits.' }; }
}
export async function acceptAction(_: FormState, form: FormData): Promise<FormState> {
  const { tokenSchema } = await import('../schemas');
  const input = tokenSchema.safeParse(form.get('token'));
  if (!input.success) return invalid();
  await requireUser();
  let id: string;
  try { id = await acceptInvitation(input.data); }
  catch { return { error: 'Invalid, expired, used, or mismatched invitation. Existing members cannot accept another invitation.' }; }
  redirect(`/org/${id}`);
}
export async function revokeAction(form: FormData) {
  const org = z.uuid().parse(form.get('organizationId'));
  const member = z.uuid().parse(form.get('memberId'));
  const { db } = await requireOrganization(org, true);
  const { error } = await db.rpc('revoke_member', { p_org: org, p_member: member });
  if (error) throw new Error('Cannot revoke this member');
  revalidatePath(`/org/${org}/admin`);
}
