import { z } from 'zod';
export const workModes=['remote','hybrid','onsite'] as const;
export const jobTypes=['full_time','part_time','contract','internship','temporary'] as const;
const optionalNumber=z.preprocess(v=>v===''||v==null?null:v,z.coerce.number().finite().nullable());
export const jobSchema=z.object({
  organizationId:z.uuid(),jobId:z.union([z.uuid(),z.literal('')]),version:z.coerce.number().int().min(0),
  title:z.string().trim().min(3).max(160),description:z.string().trim().min(40).max(20000),
  department:z.string().trim().max(120),location:z.string().trim().min(2).max(160),
  work_mode:z.enum(workModes),job_type:z.enum(jobTypes),
  experience_min:z.coerce.number().int().min(0).max(60),experience_max:optionalNumber.refine(v=>v===null||Number.isInteger(v)&&v>=0&&v<=60,'Use whole years from 0 to 60.'),
  education:z.string().trim().max(500),
  required_skills:z.preprocess(v=>typeof v==='string'?v.split(',').map(s=>s.trim()).filter(Boolean):v,z.array(z.string().trim().min(1).max(60)).max(30)).transform(v=>[...new Set(v)]),
  salary_min:optionalNumber.refine(v=>v===null||v>=0&&v<=9_999_999_999.99,'Salary is out of range.'),
  salary_max:optionalNumber.refine(v=>v===null||v>=0&&v<=9_999_999_999.99,'Salary is out of range.'),
  salary_currency:z.string().trim().toUpperCase().regex(/^([A-Z]{3})?$/,'Use a three-letter currency code.'),
  salary_period:z.enum(['hourly','monthly','yearly']),
  application_deadline:z.preprocess(v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)?`${v}:00+05:00`:v,z.union([z.literal(''),z.iso.datetime({offset:true})])),
  positions:z.coerce.number().int().min(1).max(1000),assessment_version_id:z.union([z.uuid(),z.literal('')]),
}).superRefine((v,ctx)=>{
  if(v.experience_max!==null&&v.experience_max<v.experience_min) ctx.addIssue({code:'custom',path:['experience_max'],message:'Maximum experience must be at least the minimum.'});
  const noSalary=v.salary_min===null&&v.salary_max===null&&v.salary_currency==='';
  if(!noSalary&&(v.salary_min===null||v.salary_max===null||v.salary_currency===''||v.salary_max<v.salary_min)) ctx.addIssue({code:'custom',path:['salary_max'],message:'Provide both salary limits and currency, with maximum at least minimum.'});
});
export const transitionSchema=z.object({organizationId:z.uuid(),jobId:z.uuid(),version:z.coerce.number().int().positive(),status:z.enum(['published','closed','archived'])});
export const assignmentSchema=z.object({organizationId:z.uuid(),jobId:z.uuid(),membershipId:z.uuid(),assign:z.enum(['true','false']).transform(v=>v==='true')});
export const searchSchema=z.object({q:z.string().trim().max(100).default(''),location:z.string().trim().max(100).default(''),mode:z.union([z.enum(workModes),z.literal('')]).default(''),type:z.union([z.enum(jobTypes),z.literal('')]).default(''),cursor:z.string().max(400).default('')});
export const cursorSchema=z.object({at:z.iso.datetime({offset:true}),id:z.uuid()});
