import 'server-only';
import { notFound } from 'next/navigation';
import { requireAssessment } from './service';
export async function assessmentBuilder(org:string,id:string,versionId?:string){const context=await requireAssessment(org,id);const {data:versions,error}=await context.db.from('assessment_versions').select('*').eq('organization_id',org).eq('assessment_id',id).order('version_number',{ascending:false});if(error)throw new Error('Unable to load versions');const version=versionId?versions?.find(v=>v.id===versionId):versions?.[0];if(!version)notFound();const [items,rules,bank,pools]=await Promise.all([
 context.db.from('assessment_version_questions').select('id,question_id,max_points,position,bank_questions(id,kind,prompt,options,category,difficulty)').eq('organization_id',org).eq('version_id',version.id).order('position'),
 context.db.from('assessment_pool_rules').select('id,pool_id,draw_count,max_points,question_pools(name)').eq('organization_id',org).eq('version_id',version.id),
 context.db.from('bank_questions').select('id,prompt,kind,state,category,difficulty').eq('organization_id',org).order('created_at',{ascending:false}).limit(2000),
 context.db.from('question_pools').select('id,name').eq('organization_id',org).eq('state','approved').limit(500),
]);if([items,rules,bank,pools].some(r=>r.error))throw new Error('Unable to load assessment content');return {...context,version,versions:versions??[],items:items.data??[],rules:rules.data??[],bank:bank.data??[],pools:pools.data??[]};}
