import 'server-only';
import { publicClient } from '@/lib/supabase/public';
import { cursorSchema, searchSchema } from '../schemas';
export const publicJobFields='id,organization_id,title,description,department,location,work_mode,job_type,experience_min,experience_max,education,required_skills,salary_min,salary_max,salary_currency,salary_period,application_deadline,positions,assessment_version_id,published_at';
export async function searchJobs(input:unknown,organizationId?:string) {
  const filters=searchSchema.parse(input);
  // An anonymous client prevents a hiring member's draft-read policy expanding discovery.
  const db=publicClient();
  let query=db.from('jobs').select(publicJobFields).eq('status','published').order('published_at',{ascending:false}).order('id',{ascending:false}).limit(21);
  if(organizationId) query=query.eq('organization_id',organizationId);
  if(filters.q) query=query.textSearch('search_document',filters.q,{type:'websearch',config:'english'});
  if(filters.location) query=query.ilike('location',`%${filters.location.replace(/[\\%_]/g,'\\$&')}%`);
  if(filters.mode) query=query.eq('work_mode',filters.mode);
  if(filters.type) query=query.eq('job_type',filters.type);
  if(filters.cursor) {
    let parsed;
    try { parsed=cursorSchema.safeParse(JSON.parse(Buffer.from(filters.cursor,'base64url').toString())); } catch { parsed=null; }
    if(parsed?.success) query=query.or(`published_at.lt.${parsed.data.at},and(published_at.eq.${parsed.data.at},id.lt.${parsed.data.id})`);
  }
  const {data,error}=await query;
  if(error) throw new Error('Unable to search jobs');
  const rows=data??[];
  const jobs=rows.slice(0,20);
  const last=jobs.at(-1);
  const next=rows.length>20&&last?.published_at?Buffer.from(JSON.stringify({at:last.published_at,id:last.id})).toString('base64url'):null;
  return {jobs,next};
}
export async function publicJob(id:string) {
  const {data,error}=await publicClient().from('jobs').select(publicJobFields).eq('id',id).eq('status','published').maybeSingle();
  if(error) throw new Error('Unable to load job');
  return data;
}
