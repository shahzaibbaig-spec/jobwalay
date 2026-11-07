import 'server-only';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canManageTeam } from '@/modules/organizations/schemas';
import { z } from 'zod';
export async function requireUser(onboarded = true) {
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) redirect('/login');
  if (!user.email_confirmed_at) redirect('/verify');
  const { data: account } = await db.from('accounts').select('id,display_name,status,onboarded_at').eq('id', user.id).single();
  if (!account || account.status !== 'active') redirect('/login?message=Account+unavailable');
  if (onboarded && !account.onboarded_at) redirect('/onboarding');
  return { db, user, account };
}
export async function requireOrganization(rawId: string, manage = false) {
  const id = z.uuid().safeParse(rawId);
  if (!id.success) notFound();
  const context = await requireUser();
  const { data: membership } = await context.db.from('memberships').select('id,role,organization_id').eq('organization_id', id.data).eq('user_id', context.user.id).eq('status', 'active').single();
  if (!membership || (manage && !canManageTeam(membership.role))) notFound();
  const { data: organization } = await context.db.from('organizations').select('id,name,verification_status').eq('id', id.data).single();
  if (!organization) notFound();
  return { ...context, membership, organization };
}
export async function requirePlatformAdmin() {
  const context = await requireUser();
  const { data } = await context.db.rpc('platform_admin_status');
  if (!data) notFound();
  const { data: assurance, error } = await context.db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || assurance?.currentLevel !== 'aal2') redirect('/account/security');
  return context;
}
