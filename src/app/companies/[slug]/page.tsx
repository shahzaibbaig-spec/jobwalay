import { notFound } from 'next/navigation';
import { z } from 'zod';
import { CompanyBrand } from '@/modules/companies/components/brand';
import { searchJobs } from '@/modules/jobs/server/queries';
import { publicCompany } from '@/modules/companies/server/queries';
import { JobCard } from '@/modules/jobs/components/job-card';
import Link from 'next/link';
export default async function CompanyPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{cursor?:string}>}) {
  const {slug}=await params;
  if(!z.string().max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).safeParse(slug).success) notFound();
  const company=await publicCompany(slug);
  if(!company) notFound();
  const paramsSearch=await searchParams;
  const cursor=typeof paramsSearch.cursor==='string'?paramsSearch.cursor.slice(0,400):'';
  const {jobs,next}=await searchJobs({cursor},company.organization_id);
  return <div className="space-y-8"><CompanyBrand org={company.organization_id} name={company.company_name} logo={!!company.logo_path} cover={!!company.cover_path} /><header><div className="flex flex-wrap items-center gap-3"><h1 className="text-4xl font-bold">{company.company_name}</h1><span className="badge">Verified organization</span></div><p className="mt-3 text-muted-foreground">{company.industry} · {company.location}</p>{company.website&&<a className="mt-4 inline-block" href={company.website} target="_blank" rel="noopener noreferrer">Visit website ↗</a>}</header><section className="panel"><h2 className="text-xl font-bold">About the company</h2><p className="mt-5 whitespace-pre-wrap leading-relaxed">{company.description}</p></section><section><h2 className="mb-5 text-2xl font-bold">Open opportunities</h2>{jobs.length?<div className="grid gap-5 md:grid-cols-2">{jobs.map(job=><JobCard key={job.id} job={job} />)}</div>:<p className="panel">No open jobs right now. Check back soon.</p>}{next&&<p className="mt-5"><Link href={`?cursor=${encodeURIComponent(next)}`}>More jobs →</Link></p>}</section></div>;
}
