'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ActionForm } from '@/components/action-form';
import { Field } from '@/components/field';
import { authLink } from '@/lib/auth/destination';
import { signup } from '../server/actions';

export function SignupExperience({ next, message }: { next: string; message?: string }) {
  const [purpose, setPurpose] = useState(next === '/organizations/new' ? 'hire' : 'work');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const confirmInput = useRef<HTMLInputElement>(null);
  const destination = purpose === 'hire' ? '/organizations/new' : next.startsWith('/jobs/') ? next : '/dashboard';
  const matching = confirmation.length > 0 && confirmation === password;
  useEffect(() => {
    confirmInput.current?.setCustomValidity(confirmation && confirmation !== password ? 'Your passwords do not match.' : '');
  }, [password, confirmation]);

  return <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border bg-white shadow-xl shadow-blue-950/5 lg:grid-cols-[0.9fr_1.1fr]">
    <aside className="relative order-last overflow-hidden bg-brand-navy p-7 text-white sm:p-10 lg:order-first lg:flex lg:flex-col lg:justify-between">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-cyan/20 blur-3xl" aria-hidden="true" />
      <div className="relative space-y-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">YOUR NEXT CHAPTER</p>
        <h2 className="max-w-sm text-3xl font-bold leading-tight text-white! sm:text-4xl">A little ambition.<br />A world of possibility.</h2>
        <p className="max-w-sm leading-relaxed text-blue-100">Find your next opportunity or the people who will help your business grow.</p>
        <ul className="hidden space-y-5 py-5 lg:block">
          {['Discover jobs that fit your next move', 'Build your professional profile', 'Bring your company and hiring team together'].map((item, index) => <li key={item} className="flex items-start gap-3 text-sm leading-relaxed"><span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/25 text-xs">0{index + 1}</span>{item}</li>)}
        </ul>
      </div>
      <p className="relative mt-8 text-sm text-blue-200">One account. Opportunities on both sides.</p>
    </aside>
    <section className="p-6 sm:p-10">
      <div className="mb-7 flex items-center gap-2 text-xs font-semibold text-muted-foreground" aria-label="Account setup steps"><span className="rounded-full bg-brand-soft px-3 py-1.5 text-primary">1 · Create account</span><span aria-hidden="true">→</span><span>2 · Verify email</span></div>
      <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
      <p className="mb-7 mt-3 text-sm leading-relaxed text-muted-foreground">{destination.startsWith('/jobs/') ? 'Create an account to continue with your selected job application.' : 'Choose where you want to start. You can look for work and hire with the same account.'}</p>
      {message && <p role="status" className="mb-5 rounded-lg border bg-brand-soft p-4 text-sm">{message.slice(0, 200)}</p>}
      <ActionForm action={signup} label="Create account" submitClassName="w-full min-h-12 text-base">
        <input type="hidden" name="next" value={destination} />
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">I’m here to</legend>
          <div className="grid grid-cols-2 gap-3">
            {[{ value: 'work', title: 'Find a job', description: 'Explore opportunities' }, { value: 'hire', title: 'Hire talent', description: 'Build your team' }].map(option => <label key={option.value} className={`cursor-pointer rounded-xl border p-3 transition-colors sm:p-4 ${purpose === option.value ? 'border-primary bg-brand-soft ring-1 ring-primary' : 'hover:border-primary/50 hover:bg-slate-50'}`}>
              <span className="flex items-center gap-2"><input type="radio" name="purpose" value={option.value} checked={purpose === option.value} onChange={() => setPurpose(option.value)} /><span className="text-sm font-semibold">{option.title}</span></span>
              <span className="mt-2 block text-xs text-muted-foreground">{option.description}</span>
            </label>)}
          </div>
        </fieldset>
        <Field label="Email address" name="email" type="email" maxLength={254} placeholder="you@example.com" autoCapitalize="none" spellCheck={false} />
        <div className="space-y-2">
          <label htmlFor="signup-password" className="text-sm font-semibold">Password</label>
          <div className="relative"><input id="signup-password" className="field pr-20" name="password" type={visible ? 'text' : 'password'} required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} aria-describedby="signup-password-hint" /><button type="button" className="absolute inset-y-1 right-1 rounded-md px-3 text-sm font-semibold text-primary hover:bg-brand-soft" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? 'Hide' : 'Show'}</button></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className={`h-full rounded-full transition-all ${password.length >= 12 ? 'bg-secondary' : 'bg-primary'}`} style={{ width: `${Math.min(password.length / 12, 1) * 100}%` }} /></div>
          <p id="signup-password-hint" className="text-xs text-muted-foreground">{password.length >= 12 ? 'Minimum length reached. Use a unique password you don’t use elsewhere.' : 'Use 12–128 characters. A memorable passphrase works well.'}</p>
        </div>
        <div className="space-y-2"><label htmlFor="signup-confirm-password" className="text-sm font-semibold">Confirm password</label><input ref={confirmInput} id="signup-confirm-password" className="field" name="confirmPassword" type={visible ? 'text' : 'password'} required maxLength={128} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} aria-describedby="signup-confirm-hint" aria-invalid={confirmation.length > 0 && !matching} /><p id="signup-confirm-hint" aria-live="polite" className={`text-xs ${confirmation && !matching ? 'text-red-800' : 'text-muted-foreground'}`}>{confirmation ? matching ? 'Passwords match.' : 'Your passwords do not match yet.' : 'Enter your password again to confirm.'}</p></div>
        <p className="text-xs leading-relaxed text-muted-foreground">We’ll send a verification link to your email. Your candidate profile starts private. Company registration includes verification before job publication.</p>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-muted-foreground">Already have an account? <Link href={authLink('/login', destination)} className="font-semibold">Sign in</Link></p>
      <p className="mt-4 text-center text-sm"><Link href="/jobs">Browse jobs without an account</Link></p>
    </section>
  </div>;
}
