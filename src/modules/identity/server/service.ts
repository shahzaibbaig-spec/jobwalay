import 'server-only';
import { requireUser } from '@/lib/auth/context';
import { nameSchema } from '../schemas';
export async function onboard(value: unknown) {
  const name = nameSchema.parse(value);
  const { db } = await requireUser(false);
  const { error } = await db.rpc('complete_onboarding', { p_name: name });
  if (error) throw new Error('Unable to save account');
}
