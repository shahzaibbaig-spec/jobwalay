import { z } from 'zod';
export const stages=['submitted','screening','assessment','shortlisted','interview','offer','hired','rejected','withdrawn'] as const;
export const nextStages:Record<string,string[]>={submitted:['screening','assessment','interview','rejected'],screening:['assessment','interview','offer','rejected'],assessment:['screening','interview','rejected'],shortlisted:['interview','offer','rejected'],interview:['offer','rejected'],offer:['hired','rejected']};
export const applicationSchema=z.object({jobId:z.uuid(),documentId:z.uuid(),contact_email:z.email().max(254),phone:z.string().max(50),cover_letter:z.string().max(5000),consent:z.literal('on')});
export const stageSchema=z.object({organizationId:z.uuid(),applicationId:z.uuid(),version:z.coerce.number().int().positive(),status:z.enum(stages).exclude(['submitted','withdrawn']),message:z.string().max(2000)});
export const noteSchema=z.object({organizationId:z.uuid(),applicationId:z.uuid(),body:z.string().trim().min(1).max(5000)});
export const withdrawSchema=z.object({applicationId:z.uuid(),version:z.coerce.number().int().positive()});
export const applicationFilterSchema=z.object({q:z.string().trim().max(100).default(''),status:z.union([z.enum(stages),z.literal('')]).default(''),job:z.union([z.uuid(),z.literal('')]).default(''),page:z.coerce.number().int().min(1).max(1000).default(1)});
