import { z } from 'zod';
const reason=z.string().trim().min(5).max(2000);
export const pageFilter=z.object({page:z.coerce.number().int().min(1).max(10000).default(1),q:z.string().trim().max(100).default('')});
export const adminOperation=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('job'),id:z.uuid(),hidden:z.union([z.boolean(),z.enum(['true','false'])]).transform(v=>v===true||v==='true'),version:z.coerce.number().int().positive(),reason}).strict(),
 z.object({operation:z.literal('report'),id:z.uuid(),version:z.coerce.number().int().positive(),state:z.enum(['resolved','dismissed']),reason}).strict(),
 z.object({operation:z.literal('account'),id:z.uuid(),status:z.enum(['active','suspended']),reason}).strict(),
 z.object({operation:z.literal('organization'),id:z.uuid(),status:z.enum(['active','suspended']),reason}).strict(),
]);
export const abuseSchema=z.object({jobId:z.uuid(),category:z.enum(['fraud','discrimination','misleading','unsafe','spam','other']),details:z.string().trim().min(10).max(2000)}).strict();
export const analyticsFilter=z.object({days:z.coerce.number().int().min(1).max(365).default(30)});
export const overviewSchema=z.object({accounts:z.number(),active_organizations:z.number(),verification_pending:z.number(),open_reports:z.number(),hidden_jobs:z.number(),assessment_outcomes:z.record(z.string(),z.number()),email_states:z.record(z.string(),z.number())});
export const analyticsSchema=z.object({days:z.number(),jobs:z.number(),stages:z.record(z.string(),z.number()),outcomes:z.record(z.string(),z.number())});
export const userDirectorySchema=z.array(z.object({id:z.uuid(),display_name:z.string(),status:z.string(),created_at:z.string()}));
export const jobDirectorySchema=z.array(z.object({id:z.uuid(),organization_id:z.uuid(),title:z.string(),status:z.string(),moderation_status:z.string(),version:z.number()}));
export const integrityQueueSchema=z.array(z.object({id:z.uuid(),application_id:z.uuid(),attempt_number:z.number(),state:z.string(),outcome:z.string(),overlap_observed:z.boolean()}));
export const platformIntegritySchema=z.array(z.object({organization_id:z.uuid(),name:z.string(),pending:z.number()}));
