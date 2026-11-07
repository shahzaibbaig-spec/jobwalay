import Link from 'next/link';
import { requireOrganization } from '@/lib/auth/context';
import { applicationFilterSchema,stages } from '@/modules/applications/schemas';
import { Field } from '@/components/field';
import { Button } from '@/components/ui/button';
import { dateTime } from '@/lib/format';
export default async function Applications({params,searchParams}:{params:Promise<{orgId:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const {orgId}=await params;const {db,user,membership}=await requireOrganization(orgId);const parsed=applicationFilterSchema.safeParse(await searchParams);const f=parsed.success?parsed.data:applicationFilterSchema.parse({});
  let jobQuery=db.from('jobs').select('id,title').eq('organization_id',orgId).order('title').limit(1000);
  if(membership.role==='recruiter'){const {data:assigned,error}=await db.from('job_members').select('job_id').eq('membership_id',membership.id);if(error)throw new Error('Unable to load job filters');jobQuery=jobQuery.in('id',assigned?.map(a=>a.job_id)??[]);}
  const {data:jobOptions,error:jobError}=await jobQuery;if(jobError)throw new Error('Unable to load job filters');
  let query=db.from('applications').select('id,job_title,candidate_name,candidate_headline,status,submitted_at',{count:'exact'}).eq('organization_id',orgId).neq('candidate_id',user.id).order('submitted_at',{ascending:false}).order('id',{ascending:false});
  if(f.q)query=query.ilike('candidate_name',`%${f.q.replace(/[\\%_]/g,'\\$&')}%`);if(f.status)query=query.eq('status',f.status);if(f.job)query=query.eq('job_id',f.job);
  const {data,error,count}=await query.range((f.page-1)*20,f.page*20-1);if(error)throw new Error('Unable to load applicants');
  const next=(page:number)=>`?${new URLSearchParams({...f,page:String(page)})}`;
  return <section className="space-y-7"><header><h1 className="text-3xl font-bold">Recruitment inbox</h1><p className="mt-3">{count??0} accessible applications. Recruiters see only assigned jobs; you cannot review your own application.</p></header><form className="panel grid items-end gap-4 sm:grid-cols-2"><Field name="q" label="Search candidate name" maxLength={100} required={false} defaultValue={f.q} /><label className="block space-y-2"><span>Hiring stage</span><select name="status" className="field" defaultValue={f.status}><option value="">All stages</option>{stages.map(s=><option key={s}>{s}</option>)}</select></label><label className="block space-y-2"><span>Job</span><select name="job" className="field" defaultValue={f.job}><option value="">All accessible jobs</option>{jobOptions?.map(j=><option key={j.id} value={j.id}>{j.title}</option>)}</select></label><Button>Filter applications</Button></form><ul className="space-y-4">{data?.map(a=><li className="panel" key={a.id}><span className="badge">{a.status}</span><h2 className="mt-3 text-xl font-bold"><Link href={`/org/${orgId}/applications/${a.id}`}>{a.candidate_name}</Link></h2><p className="mt-2">{a.candidate_headline}</p><p className="mt-2 text-muted-foreground">{a.job_title} · Applied {dateTime(a.submitted_at)} PKT</p></li>)}</ul>{!data?.length&&<p className="panel">No applications match these filters.</p>}<nav className="flex gap-5" aria-label="Application pages">{f.page>1&&<Link href={next(f.page-1)}>Previous</Link>}{f.page*20<(count??0)&&<Link href={next(f.page+1)}>Next</Link>}</nav></section>;
}
