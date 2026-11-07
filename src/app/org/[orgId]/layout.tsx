import Link from 'next/link';
import { requireOrganization } from '@/lib/auth/context';
export default async function OrganizationLayout({params,children}:{params:Promise<{orgId:string}>;children:React.ReactNode}) {
  const {orgId}=await params;
  const {organization,membership}=await requireOrganization(orgId);
  return <><nav aria-label="Organization" className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-b pb-5 text-sm"><strong>{organization.name}</strong><Link href={`/org/${orgId}`}>Jobs</Link><Link href={`/org/${orgId}/applications`}>Applicants</Link><Link href={`/org/${orgId}/assessments`}>Assessments</Link><Link href={`/org/${orgId}/analytics`}>Analytics</Link><Link href={`/org/${orgId}/integrity`}>Review queue</Link>{membership.role!=='recruiter'&&<><Link href={`/org/${orgId}/profile`}>Company profile</Link><Link href={`/org/${orgId}/verification`}>Verification</Link><Link href={`/org/${orgId}/admin`}>Team & invitations</Link><Link href={`/org/${orgId}/audit`}>Audit logs</Link></>}<Link href="/dashboard">Switch workspace</Link></nav>{children}</>;
}
