import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ActionForm } from '@/components/action-form';
import { Field } from '@/components/field';
import { login, signup, forgotPassword, resetPassword, resendVerification } from '@/modules/identity/server/actions';
import { requireUser } from '@/lib/auth/context';
import { authDestination, authLink } from '@/lib/auth/destination';
import { SignupExperience } from '@/modules/identity/components/signup-experience';
const flows = {
  login: { title: 'Welcome back', label: 'Sign in', action: login, email: true, password: true },
  signup: { title: 'Start your next chapter', label: 'Create account', action: signup, email: true, password: true },
  'forgot-password': { title: 'Reset your password', label: 'Send reset email', action: forgotPassword, email: true, password: false },
  'reset-password': { title: 'Choose a new password', label: 'Update password', action: resetPassword, email: false, password: true },
  verify: { title: 'Verify your email', label: 'Resend verification', action: resendVerification, email: true, password: false },
};
export default async function AuthPage({ params, searchParams }: { params: Promise<{ flow: string }>; searchParams: Promise<{ message?: string; next?: string }> }) {
  const { flow } = await params;
  if (!Object.hasOwn(flows, flow)) notFound();
  const config = flows[flow as keyof typeof flows];
  if (flow === 'reset-password') await requireUser(false);
  const { message, next: rawNext } = await searchParams;
  const next = authDestination(rawNext);
  if (flow === 'signup') return <SignupExperience next={next} message={message} />;
  return <section className="mx-auto max-w-md rounded-2xl border bg-white p-8 shadow-sm"><h1 className="mb-3 text-3xl font-bold">{config.title}</h1><p className="mb-7 text-muted-foreground">{next === '/organizations/new' ? 'Sign in or create an account to list your company and post jobs.' : next.startsWith('/jobs/') ? 'Sign in or create an account to apply for this job. Browsing jobs is free and open to everyone.' : 'Your candidate profile and hiring workspaces, together.'}</p>{message && <p role="status" className="mb-5">{message.slice(0,200)}</p>}<ActionForm action={config.action} label={config.label}><input type="hidden" name="next" value={next} />{config.email && <Field label="Email address" name="email" type="email" maxLength={254} />}{config.password && <Field label="Password (12–128 characters)" name="password" type="password" minLength={12} maxLength={128} />}</ActionForm><p className="mt-5 text-sm"><Link href="/jobs">Browse jobs without an account</Link></p><div className="mt-7 flex flex-wrap gap-4 text-sm"><Link href={authLink('/login', next)}>Sign in</Link><Link href={authLink('/signup', next)}>Create account</Link><Link href="/forgot-password">Forgot password?</Link></div></section>;
}
