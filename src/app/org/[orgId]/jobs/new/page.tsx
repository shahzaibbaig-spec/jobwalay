import Link from 'next/link';
import { requireOrganization } from '@/lib/auth/context';
import { JobForm } from '@/modules/jobs/components/job-form';
export default async function NewJob({params}:{params:Promise<{orgId:string}>}) {
  const {orgId}=await params;
  const {db}=await requireOrganization(orgId);
  const {data:profile}=await db.from('company_profiles').select('organization_id').eq('organization_id',orgId).maybeSingle();
  if(!profile) return <section className="panel"><h1 className="text-2xl font-bold">Set up your company profile first</h1><p className="mt-4">Ask an organization administrator to complete the profile before creating jobs.</p><Link href={`/org/${orgId}`}>Return to jobs</Link></section>;
  const {data:versions,error}=await db.from('assessment_versions').select('id,version_number,assessments(title)').eq('organization_id',orgId).eq('status','published');
  if(error) throw new Error('Unable to load assessments');
  return <div className="max-w-3xl space-y-7"><header><h1 className="text-3xl font-bold">Create a job</h1><p className="mt-3 text-muted-foreground">Start with a private draft. Review the details before publishing.</p></header><JobForm org={orgId} assessments={versions?.map(v=>({id:v.id,label:`${v.assessments?.title??'Assessment'} · v${v.version_number}`}))??[]} /></div>;
}
