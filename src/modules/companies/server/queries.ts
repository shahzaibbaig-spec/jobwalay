import 'server-only';
import { publicClient } from '@/lib/supabase/public';
export async function publicCompany(slug:string) {
  const {data,error}=await publicClient().from('company_profiles').select('organization_id,company_name,slug,industry,location,website,description,logo_path,cover_path').eq('slug',slug).maybeSingle();
  if(error) throw new Error('Unable to load company');
  return data;
}
export async function companyForJob(org:string) {
  const {data,error}=await publicClient().from('company_profiles').select('company_name,slug').eq('organization_id',org).maybeSingle();
  if(error) throw new Error('Unable to load company');
  return data;
}
