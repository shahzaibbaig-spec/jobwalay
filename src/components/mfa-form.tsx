'use client';
import { useActionState, useState, useTransition } from 'react';
import { enrollMfa, verifyMfa, type MfaState } from '@/modules/identity/server/mfa';
import { Button } from '@/components/ui/button';
export function MfaForm({ verifiedFactorId }: { verifiedFactorId?: string }) {
  const [enrollment,setEnrollment] = useState<MfaState>({});
  const [pending,start] = useTransition();
  const [state,submit,verifying] = useActionState(verifyMfa,{});
  const factorId = verifiedFactorId ?? enrollment.factorId;
  return <div className="space-y-5">{!factorId && <Button disabled={pending} onClick={() => start(async () => setEnrollment(await enrollMfa()))}>{pending?'Preparing…':'Set up authenticator'}</Button>}{enrollment.secret && <div><p>Enter this setup key in your authenticator app, then verify its six-digit code. Keep this key private.</p><code className="mt-3 block break-all select-all rounded border p-3">{enrollment.secret}</code></div>}{factorId && <form action={submit} className="space-y-5"><input type="hidden" name="factorId" value={factorId} /><label className="block">Authenticator code<input className="field mt-2" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required /></label><Button disabled={verifying}>Verify authenticator</Button></form>}<p role="status">{state.error ?? enrollment.error}</p></div>;
}
