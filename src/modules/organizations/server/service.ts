import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { requireOrganization, requireUser } from '@/lib/auth/context';
import { inviteSchema, organizationSchema, tokenSchema } from '../schemas';
export async function registerOrganization(input: unknown) {
  const name = organizationSchema.parse(input);
  const { db } = await requireUser();
  const { data, error } = await db.rpc('register_organization', { p_name: name });
  if (error || !data) throw new Error('Unable to register organization');
  return data;
}
export async function inviteMember(input: unknown) {
  const values = inviteSchema.parse(input);
  const { db } = await requireOrganization(values.organizationId, true);
  const token = randomBytes(32).toString('hex');
  const { error } = await db.rpc('invite_member', { p_org: values.organizationId, p_email: values.email, p_role: values.role, p_hash: hashToken(token) });
  if (error) throw new Error('Unable to invite member. Check permissions and hourly limit.');
  return token;
}
export function hashToken(token: string) { return createHash('sha256').update(token).digest('hex'); }
export async function acceptInvitation(input: unknown) {
  const token = tokenSchema.parse(input);
  const { db } = await requireUser();
  const { data, error } = await db.rpc('accept_invitation', { p_hash: hashToken(token) });
  if (error || !data) throw new Error('Invitation unavailable. Check email, expiry and existing membership.');
  return data;
}
