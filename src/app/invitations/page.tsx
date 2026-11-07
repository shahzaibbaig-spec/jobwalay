import { requireUser } from '@/lib/auth/context';
import { ActionForm } from '@/components/action-form';
import { Field } from '@/components/field';
import { acceptAction } from '@/modules/organizations/server/actions';
export default async function Invitations() { const { user } = await requireUser(); return <section className="max-w-lg space-y-6"><h1 className="text-3xl font-bold">Join your hiring team</h1><p>Signed in as {user.email}. Your verified email must match the invitation recipient.</p><ActionForm action={acceptAction} label="Accept invitation"><Field name="token" label="Invitation code" minLength={64} maxLength={64} /></ActionForm></section>; }
