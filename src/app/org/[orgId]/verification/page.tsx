import { requireOrganization } from '@/lib/auth/context';
import { ActionForm } from '@/components/action-form';
import { Field } from '@/components/field';
import { requestVerificationAction } from '@/modules/companies/server/actions';
import { dateTime } from '@/lib/format';
export default async function Verification({params}:{params:Promise<{orgId:string}>}) {
  const {orgId}=await params;
  const {db,organization}=await requireOrganization(orgId,true);
  const {data:requests,error}=await db.from('verification_requests').select('id,legal_name,state,review_reason,created_at').eq('organization_id',orgId).order('created_at',{ascending:false}).limit(20);
  if(error) throw new Error('Unable to load verification');
  const pending=requests?.some(r=>r.state==='pending');
  return <section className="max-w-2xl space-y-8"><header><p className="text-sm text-secondary">TRUST & VERIFICATION</p><h1 className="mt-3 text-3xl font-bold">Verify your organization</h1><p className="mt-3">Current status: <strong>{organization.verification_status}</strong>. Verification is required before your company and jobs can be published.</p></header>{!pending&&organization.verification_status!=='approved'&&<div className="panel"><ActionForm action={requestVerificationAction} label="Submit verification request"><input type="hidden" name="organizationId" value={orgId} /><Field label="Registered legal name" name="legal_name" minLength={2} maxLength={200} /><Field label="Registration number" name="registration_number" minLength={2} maxLength={120} /><label className="block space-y-2"><span>Additional information (optional)</span><textarea className="field min-h-28" name="notes" maxLength={3000} /></label><p className="text-sm text-muted-foreground">These details are private to organization administrators and platform reviewers. Do not include personal identity documents or passwords.</p></ActionForm></div>}{pending&&<p className="panel">Your request is awaiting an independent platform review.</p>}<div><h2 className="mb-4 text-xl font-bold">Request history</h2><ul className="space-y-4">{requests?.map(r=><li className="panel" key={r.id}><span className="badge">{r.state}</span><p className="mt-3 font-semibold">{r.legal_name}</p><p className="mt-2 text-sm">{dateTime(r.created_at)} PKT</p>{r.review_reason&&<p className="mt-3">Reviewer: {r.review_reason}</p>}</li>)}</ul></div></section>;
}
