import Link from 'next/link';
import { z } from 'zod';
import { requireOrganization } from '@/lib/auth/context';
import { Button } from '@/components/ui/button';
import { dateTime } from '@/lib/format';
export default async function JobsDashboard({params,searchParams}:{params:Promise<{orgId:string}>;searchParams:Promise<{status?:string;page?:string}>}) {
  const {orgId}=await params;
  const {db,organization,membership}=await requireOrganization(orgId);
  const filters=z.object({status:z.enum(['','draft','published','closed','archived']).catch(''),page:z.coerce.number().int().min(1).max(1000).catch(1)}).parse(await searchParams);
  let query=db.from('jobs').select('id,title,department,location,status,application_deadline,created_at',{count:'exact'}).eq('organization_id',orgId).order('created_at',{ascending:false}).order('id',{ascending:false});
  if(membership.role==='recruiter') {
    const {data:assignments,error}=await db.from('job_members').select('job_id').eq('organization_id',orgId).eq('membership_id',membership.id);
    if(error) throw new Error('Unable to load assignments');
    query=query.in('id',assignments?.map(a=>a.job_id)??[]);
  }
  if(filters.status) query=query.eq('status',filters.status);
  const {data:jobs,error,count}=await query.range((filters.page-1)*20,filters.page*20-1);
  if(error) throw new Error('Unable to load jobs');
  const {data:profile}=await db.from('company_profiles').select('slug,is_public').eq('organization_id',orgId).maybeSingle();
  return <div className="space-y-8"><header className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-sm font-semibold tracking-widest text-secondary">COMPANY JOB DASHBOARD</p><h1 className="mt-3 text-3xl font-bold">Build your next great team</h1><p className="mt-3 text-muted-foreground">{organization.name} · {count??0} jobs{membership.role==='recruiter'?' assigned to you':''}</p></div>{profile?<Button asChild><Link href={`/org/${orgId}/jobs/new`}>Create a job</Link></Button>:membership.role!=='recruiter'&&<Button asChild><Link href={`/org/${orgId}/profile`}>Set up company profile</Link></Button>}</header>
    {organization.verification_status!=='approved'&&<p className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">Your organization is {organization.verification_status}. You can prepare drafts; publication requires an approved, public company profile.</p>}{profile&&<p><Link href={`/companies/${profile.slug}`}>View public company page</Link></p>}
    <nav aria-label="Filter jobs" className="flex flex-wrap gap-3">{['','draft','published','closed','archived'].map(status=><Link key={status} href={`/org/${orgId}${status?`?status=${status}`:''}`} aria-current={filters.status===status?'page':undefined} className={`rounded-full border px-4 py-2 text-sm capitalize ${filters.status===status?'bg-brand-navy text-white':'bg-white'}`}>{status||'All jobs'}</Link>)}</nav>
    {!jobs?.length?<section className="panel"><h2 className="text-xl font-bold">No jobs here yet</h2><p className="mt-3">{membership.role==='recruiter'?'Create a draft or ask an administrator to assign you to an existing job.':'Create a draft to start planning your next hire.'}</p></section>:<ul className="grid gap-4 md:grid-cols-2">{jobs.map(job=><li key={job.id} className="panel"><div className="flex flex-wrap justify-between gap-3"><span className="badge">{job.status}</span>{job.application_deadline&&new Date(job.application_deadline)<=new Date()&&<span className="text-sm font-semibold text-amber-800">Deadline passed</span>}</div><h2 className="mt-4 text-xl font-bold"><Link href={`/org/${orgId}/jobs/${job.id}`}>{job.title}</Link></h2><p className="mt-2 text-muted-foreground">{job.department&&`${job.department} · `}{job.location}</p><p className="mt-4 text-sm text-muted-foreground">Created {dateTime(job.created_at)} PKT</p></li>)}</ul>}
    <nav aria-label="Job pages" className="flex gap-6">{filters.page>1&&<Link href={`?status=${filters.status}&page=${filters.page-1}`}>Previous</Link>}{filters.page*20<(count??0)&&<Link href={`?status=${filters.status}&page=${filters.page+1}`}>Next</Link>}</nav>
  </div>;
}
