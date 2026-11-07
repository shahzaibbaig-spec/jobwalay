import { requireUser } from '@/lib/auth/context';
import { ActionForm } from '@/components/action-form';
import { Field } from '@/components/field';
import { authDestination } from '@/lib/auth/destination';
import { onboardingAction } from '@/modules/identity/server/actions';
export default async function Onboarding({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = authDestination((await searchParams).next);
  const { account } = await requireUser(false, next);
  return <section className="max-w-lg space-y-6"><h1 className="text-3xl font-bold">Let’s get to know you</h1><p>Start with your name. You can build a candidate profile, join hiring teams, or do both.</p><ActionForm action={onboardingAction} label="Continue"><input type="hidden" name="next" value={next} /><Field name="name" label="Your name" maxLength={100} defaultValue={account.display_name} /></ActionForm></section>;
}
