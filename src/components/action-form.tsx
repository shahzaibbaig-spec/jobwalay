'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import type { FormState } from '@/lib/forms';
export function ActionForm({ action, children, label }: { action: (state: FormState, form: FormData) => Promise<FormState>; children: React.ReactNode; label: string }) {
  const [state, submit, pending] = useActionState(action, {});
  return <form action={submit} className="space-y-5">{children}
    <div aria-live="polite">{state.error && <p role="alert" className="text-red-800">{state.error}</p>}{state.message && <p>{state.message}</p>}{state.token && <p className="break-all rounded border p-3 font-mono select-all">{state.token}</p>}</div>
    <Button type="submit" disabled={pending}>{pending ? 'Please wait…' : label}</Button>
  </form>;
}
