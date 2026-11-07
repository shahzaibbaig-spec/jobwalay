'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { FormState } from '@/lib/forms';
export function ActionForm({ action, children, label }: { action: (state: FormState, form: FormData) => Promise<FormState>; children: React.ReactNode; label: string }) {
  const [state, submit, pending] = useActionState(action, {});
  const [validationError, setValidationError] = useState('');
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.error || state.message || state.token) feedback.current?.focus();
  }, [state]);
  return <form action={submit} className="space-y-5" onInput={() => setValidationError('')} onInvalidCapture={event => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.validity.tooShort) {
      setValidationError(`Please use at least ${input.minLength} characters for ${input.name === 'password' ? 'your password' : 'this field'}.`);
    } else {
      setValidationError('Please complete all required fields and enter a valid email address where requested.');
    }
  }}>{children}
    <div ref={feedback} tabIndex={-1} aria-live="polite" className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
      {(validationError || state.error) && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{validationError || state.error}</p>}
      {!validationError && state.message && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-900">{state.message}</p>}
      {state.token && <p className="break-all rounded border p-3 font-mono select-all">{state.token}</p>}
    </div>
    <Button type="submit" disabled={pending}>{pending ? 'Please wait…' : label}</Button>
  </form>;
}
