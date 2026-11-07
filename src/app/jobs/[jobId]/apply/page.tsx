import { notFound } from 'next/navigation';
import { z } from 'zod';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/context';
import { publicJob } from '@/modules/jobs/server/queries';
import { ActionForm } from '@/components/action-form';
import { Field } from '@/components/field';
import { applyAction } from '@/modules/applications/server/actions';
export default async function ApplicationForm({params}:{params:Promise<{jobId:string}>}){
  const {jobId}=await params;if(!z.uuid().safeParse(jobId).success)notFound();const {db,user}=await requireUser();const job=await publicJob(jobId);if(!job)notFound();
  const [profile,documents,active]=await Promise.all([db.from('candidate_profiles').select('current_cv_id').eq('user_id',user.id).maybeSingle(),db.from('candidate_documents').select('id,filename,created_at').eq('user_id',user.id).eq('scan_status','clean').order('created_at',{ascending:false}).limit(100),db.from('applications').select('id').eq('job_id',jobId).eq('candidate_id',user.id).not('status','in','(withdrawn,rejected)').maybeSingle()]);
  if(profile.error||documents.error||active.error)throw new Error('Unable to prepare application');
  if(active.data)return <section className="panel max-w-xl"><h1 className="text-2xl font-bold">You have an active application</h1><p className="mt-4"><Link href={`/candidate/applications/${active.data.id}`}>View application and status →</Link></p></section>;
  return <section className="max-w-2xl space-y-7"><header><h1 className="text-3xl font-bold">Apply for {job.title}</h1><p className="mt-3">Review your profile and choose the CV you want to share.</p></header>{!profile.data||!documents.data?.length?<p className="panel">Complete your <Link href="/candidate/profile">professional profile</Link> and <Link href="/candidate/cv">upload a CV that passes its security scan</Link> before applying.</p>:<div className="panel"><ActionForm action={applyAction} label="Submit application"><input name="jobId" type="hidden" value={jobId} /><Field name="contact_email" label="Contact email" type="email" maxLength={254} defaultValue={user.email} /><Field name="phone" label="Phone (optional)" type="tel" required={false} maxLength={50} /><label className="block space-y-2"><span>CV version</span><select className="field" name="documentId" defaultValue={profile.data.current_cv_id??documents.data[0].id}>{documents.data.map(d=><option value={d.id} key={d.id}>{d.filename} · {d.created_at.slice(0,10)}</option>)}</select></label><label className="block space-y-2"><span>Cover letter (optional)</span><textarea className="field min-h-48" name="cover_letter" maxLength={5000} /></label><label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" name="consent" required /><span>I agree to share my professional profile snapshot, contact details, cover letter and selected CV with the authorized hiring team for this job.</span></label></ActionForm></div>}</section>;
}
