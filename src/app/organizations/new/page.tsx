import { requireUser } from '@/lib/auth/context';
import { ActionForm } from '@/components/action-form';
import { Field } from '@/components/field';
import { organizationAction } from '@/modules/organizations/server/actions';
export default async function NewOrganization() { await requireUser(true, '/organizations/new'); return <section className="max-w-lg space-y-6"><h1 className="text-3xl font-bold">Bring your team together</h1><p>You’ll become the organization owner. Registration starts in pending verification and does not authorize job publication.</p><ActionForm action={organizationAction} label="Register organization"><Field name="name" label="Organization name" minLength={2} maxLength={120} /></ActionForm></section>; }
