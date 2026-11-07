import { requireUser } from '@/lib/auth/context';
import { MfaForm } from '@/components/mfa-form';
export default async function Security() {
  const { db } = await requireUser();
  const { data,error } = await db.auth.mfa.listFactors();
  if (error) throw new Error('Unable to load authenticator');
  const { data: assurance } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  return <section className="max-w-lg space-y-6"><h1 className="text-3xl font-bold">Secure your account</h1><p>Use a TOTP authenticator app. Platform administration requires a verified second factor in your current session.</p><p>Current assurance: {assurance?.currentLevel ?? 'unavailable'}</p><MfaForm verifiedFactorId={data.totp.find(f => f.status==='verified')?.id} /></section>;
}
