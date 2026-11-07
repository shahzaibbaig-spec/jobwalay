import 'server-only';
import { requireJob } from '@/modules/jobs/server/service';
export async function jobApplications(org:string,id:string) {
  const {db}=await requireJob(org,id);
  const {data,error}=await db.from('applications').select('id,candidate_name,candidate_headline,submitted_at').eq('organization_id',org).eq('job_id',id).order('submitted_at',{ascending:false}).limit(100);
  if(error) throw new Error('Unable to load applications');
  return data??[];
}
