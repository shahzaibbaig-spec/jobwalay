import 'server-only';
import { requirePlatformAdmin,requireOrganization,requireUser } from '@/lib/auth/context';
import { databaseError } from '@/lib/errors';
import { adminOperation,abuseSchema,pageFilter,overviewSchema,userDirectorySchema,jobDirectorySchema,analyticsFilter,analyticsSchema,integrityQueueSchema,platformIntegritySchema } from './schemas';
export async function adminOverview(){const {db}=await requirePlatformAdmin();const {data,error}=await db.rpc('platform_overview');if(error)throw databaseError(error);return overviewSchema.parse(data);}
export async function adminDirectory(kind:'users'|'jobs',input:unknown){const filters=pageFilter.parse(input);const {db}=await requirePlatformAdmin();const {data,error}=await db.rpc('admin_directory',{p_kind:kind,p_page:filters.page,p_query:filters.q});if(error)throw databaseError(error);return {data,filters};}
export async function usersDirectory(input:unknown){const {data,filters}=await adminDirectory('users',input);return {rows:userDirectorySchema.parse(data),filters};}
export async function jobsDirectory(input:unknown){const {data,filters}=await adminDirectory('jobs',input);return {rows:jobDirectorySchema.parse(data),filters};}
export async function adminMutation(input:unknown){const v=adminOperation.parse(input);const {db}=await requirePlatformAdmin();let error;
 if(v.operation==='job')({error}=await db.rpc('moderate_job',{p_job:v.id,p_hidden:v.hidden,p_expected_version:v.version,p_reason:v.reason}));
 if(v.operation==='report')({error}=await db.rpc('resolve_abuse_report',{p_report:v.id,p_expected_version:v.version,p_state:v.state,p_reason:v.reason}));
 if(v.operation==='account')({error}=await db.rpc('manage_account',{p_user:v.id,p_status:v.status,p_reason:v.reason}));
 if(v.operation==='organization')({error}=await db.rpc('manage_organization',{p_org:v.id,p_status:v.status,p_reason:v.reason}));
 if(error)throw databaseError(error);
}
export async function reportAbuse(input:unknown){const v=abuseSchema.parse(input);const {db}=await requireUser();const {error}=await db.rpc('report_job_abuse',{p_job:v.jobId,p_category:v.category,p_details:v.details});if(error)throw databaseError(error);}
export async function organizationAnalytics(org:string,input:unknown){const {days}=analyticsFilter.parse(input);const {db}=await requireOrganization(org);const {data,error}=await db.rpc('recruitment_analytics',{p_org:org,p_days:days});if(error)throw databaseError(error);return analyticsSchema.parse(data);}
export async function organizationReviewQueue(org:string,input:unknown){const {page}=pageFilter.parse(input);const {db}=await requireOrganization(org);const {data,error}=await db.rpc('integrity_review_queue',{p_org:org,p_page:page});if(error)throw databaseError(error);return integrityQueueSchema.parse(data);}
export async function platformReviewQueue(input:unknown){const {page}=pageFilter.parse(input);const {db}=await requirePlatformAdmin();const {data,error}=await db.rpc('integrity_review_queue',{p_page:page});if(error)throw databaseError(error);return platformIntegritySchema.parse(data);}
