import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { publicJob } from '@/modules/jobs/server/queries';
import { companyForJob } from '@/modules/companies/server/queries';
import { ActionForm } from '@/components/action-form';
import { savedJobAction } from '@/modules/jobs/server/saved-actions';
import { Button } from '@/components/ui/button';
import { humanize,dateTime } from '@/lib/format';
export default async function JobDetail({params}:{params:Promise<{jobId:string}>}) {
  const {jobId}=await params;
  if(!z.uuid().safeParse(jobId).success) notFound();
  const job=await publicJob(jobId);
  if(!job) notFound();
  const company=await companyForJob(job.organization_id);
  if(!company) notFound();
  return <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]"><article className="space-y-7"><Link href="/jobs">← All opportunities</Link><header><Link href={`/companies/${company.slug}`}>{company.company_name}</Link><h1 className="mt-4 text-4xl font-bold">{job.title}</h1><p className="mt-4 text-muted-foreground">{job.department&&`${job.department} · `}{job.location}</p><div className="mt-4 flex flex-wrap gap-2"><span className="badge">{job.work_mode}</span><span className="badge">{humanize(job.job_type)}</span><span className="badge">{job.positions} {job.positions===1?'position':'positions'}</span></div></header><section className="panel"><h2 className="text-xl font-bold">About the opportunity</h2><p className="mt-5 whitespace-pre-wrap leading-relaxed">{job.description}</p></section><section className="panel space-y-4"><h2 className="text-xl font-bold">What you’ll bring</h2><p>Experience: {job.experience_min}{job.experience_max!==null?`–${job.experience_max}`:'+'} years</p>{job.education&&<p>Education: {job.education}</p>}<ul aria-label="Required skills" className="flex flex-wrap gap-2">{job.required_skills.map(s=><li className="badge" key={s}>{s}</li>)}</ul></section></article><aside className="space-y-5"><section className="panel space-y-5"><h2 className="text-xl font-bold">Take the next step</h2>{job.salary_min!==null&&<p className="font-semibold">{job.salary_currency} {Number(job.salary_min).toLocaleString()}–{Number(job.salary_max).toLocaleString()} / {job.salary_period}</p>}{job.application_deadline&&<p className="text-sm">Apply by {dateTime(job.application_deadline)} PKT</p>}{job.assessment_version_id&&<p className="text-sm">The hiring team has attached an assessment to this role.</p>}<Button asChild><Link href={`/jobs/${job.id}/apply`}>Apply for this role</Link></Button><ActionForm action={savedJobAction} label="Save job"><input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="saved" value="true" /></ActionForm><p className="text-sm"><Link href="/candidate">Create or update your candidate profile</Link></p></section><p className="text-sm"><Link href={`/jobs/${job.id}/report`}>Report this job</Link> · <Link href="/account/reports">Your reports</Link></p><section className="panel"><h2 className="font-bold">Get to know the team</h2><p className="mt-3"><Link href={`/companies/${company.slug}`}>{company.company_name} →</Link></p></section></aside></div>;
}
