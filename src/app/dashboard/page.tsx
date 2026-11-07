import Link from 'next/link';
import { requireUser } from '@/lib/auth/context';
import { logout } from '@/modules/identity/server/actions';
import { Button } from '@/components/ui/button';
export default async function Dashboard() {
  const { db, user, account } = await requireUser();
  const { data: memberships, error } = await db.from('memberships').select('id,organization_id,role').eq('user_id', user.id).eq('status','active');
  if (error) throw new Error('Unable to load workspaces');
  const { data: admin } = await db.rpc('platform_admin_status');
  return <div className="space-y-8"><div><p className="text-sm text-secondary">YOUR WORKSPACES</p><h1 className="mt-2 text-3xl font-bold">Hello, {account.display_name}</h1><p className="mt-3 text-muted-foreground">Choose where you’d like to work today.</p></div><div className="grid gap-5 md:grid-cols-2"><section className="rounded-xl border bg-white p-6"><h2 className="text-xl font-bold">Job seeker</h2><p className="my-4">Build a private profile for your next opportunity.</p><Link href="/candidate">Open candidate dashboard →</Link></section>{memberships?.map(m => <section key={m.id} className="rounded-xl border bg-white p-6"><h2 className="text-xl font-bold">Hiring workspace</h2><p className="my-4 capitalize">{m.role}</p><Link href={`/org/${m.organization_id}`}>Recruiter dashboard →</Link>{m.role !== 'recruiter' && <p className="mt-3"><Link href={`/org/${m.organization_id}/admin`}>Organization administration →</Link></p>}</section>)}{admin && <section className="rounded-xl border bg-white p-6"><h2 className="text-xl font-bold">Platform administration</h2><p className="my-4">MFA verification is required.</p><Link href="/admin">Open platform dashboard →</Link></section>}</div><div className="flex flex-wrap gap-6"><Link href="/organizations/new">Register an organization</Link><Link href="/invitations">Accept an invitation</Link></div><form action={logout}><Button variant="outline">Sign out everywhere</Button></form></div>;
}
