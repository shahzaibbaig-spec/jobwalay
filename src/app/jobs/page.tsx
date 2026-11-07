import Link from 'next/link';
import { searchSchema,jobTypes,workModes } from '@/modules/jobs/schemas';
import { searchJobs } from '@/modules/jobs/server/queries';
import { JobCard } from '@/modules/jobs/components/job-card';
import { Field } from '@/components/field';
import { Button } from '@/components/ui/button';
import { humanize } from '@/lib/format';
export default async function Jobs({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const parsed=searchSchema.safeParse(await searchParams);
  const filters=parsed.success?parsed.data:searchSchema.parse({});
  const {jobs,next}=await searchJobs(filters);
  const nextParams=new URLSearchParams({...filters,cursor:next??''});
  return <div className="space-y-8"><header className="max-w-2xl"><p className="text-sm font-semibold tracking-widest text-secondary">FIND YOUR NEXT CHAPTER</p><h1 className="mt-3 text-4xl font-bold">Good work starts here.</h1><p className="mt-4 text-muted-foreground">Explore opportunities from verified companies and find a team where you can grow.</p></header><form className="panel space-y-5" action="/jobs"><div className="grid gap-5 sm:grid-cols-2"><Field label="Job title, keyword or skill" name="q" required={false} maxLength={100} defaultValue={filters.q} /><Field label="Location" name="location" required={false} maxLength={100} defaultValue={filters.location} /><label className="block space-y-2"><span>Work arrangement</span><select className="field" name="mode" defaultValue={filters.mode}><option value="">Any arrangement</option>{workModes.map(v=><option value={v} key={v}>{v}</option>)}</select></label><label className="block space-y-2"><span>Job type</span><select className="field" name="type" defaultValue={filters.type}><option value="">Any job type</option>{jobTypes.map(v=><option value={v} key={v}>{humanize(v)}</option>)}</select></label></div><Button type="submit">Find jobs</Button></form>{!parsed.success&&<p role="alert">Some search filters were invalid. Please use the fields above.</p>}<section aria-label="Job results">{jobs.length?<div className="grid gap-5 md:grid-cols-2">{jobs.map(job=><JobCard key={job.id} job={job} />)}</div>:<div className="panel"><h2 className="text-xl font-bold">No matching jobs yet</h2><p className="mt-3">Try a broader keyword or a different location.</p></div>}</section>{next&&<Link href={`/jobs?${nextParams}`}>More opportunities →</Link>}</div>;
}
