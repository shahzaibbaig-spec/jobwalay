import { z } from 'zod';
export const questionKinds=['single_choice','multiple_select','numerical','written'] as const;
export const difficulties=['easy','medium','hard'] as const;
const uuidOrEmpty=z.union([z.uuid(),z.literal('')]);
export const createAssessmentSchema=z.object({organizationId:z.uuid(),title:z.string().trim().min(3).max(160),jobId:uuidOrEmpty.default('')});
export const settingsSchema=z.object({organizationId:z.uuid(),versionId:z.uuid(),revision:z.coerce.number().int().positive(),duration_minutes:z.coerce.number().int().min(1).max(240),passing_percentage:z.coerce.number().finite().min(0).max(100),max_attempts:z.coerce.number().int().min(1).max(10),deadline:z.preprocess(v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)?`${v}:00+05:00`:v,z.union([z.literal(''),z.iso.datetime({offset:true})])),summary:z.string().max(2000),retake_policy:z.enum(['none','automatic','approval']).optional(),retake_delay_minutes:z.coerce.number().int().min(0).max(10080).optional(),appeals_enabled:z.union([z.boolean(),z.enum(['true','false']).transform(v=>v==='true')]).optional(),appeal_window_hours:z.coerce.number().int().min(1).max(168).optional(),invitation_window_hours:z.coerce.number().int().min(1).max(720).optional()});
export const questionSchema=z.object({organizationId:z.uuid(),sourceId:uuidOrEmpty.default(''),kind:z.enum(questionKinds),prompt:z.string().trim().min(5).max(10000),category:z.string().trim().min(1).max(100),difficulty:z.enum(difficulties),options:z.array(z.object({id:z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),text:z.string().trim().min(1).max(1000)})).max(10),answer:z.union([z.object({correct_ids:z.array(z.string()).min(1).max(10)}).strict(),z.object({value:z.number().finite().min(-1e12).max(1e12),tolerance:z.number().finite().min(0).max(1e6)}).strict(),z.object({rubric:z.string().trim().min(5).max(5000)}).strict()])}).superRefine((q,ctx)=>{
  if(q.kind==='single_choice'||q.kind==='multiple_select'){
    if(!('correct_ids' in q.answer)||q.options.length<2||new Set(q.options.map(o=>o.id)).size!==q.options.length||q.answer.correct_ids.some(id=>!q.options.some(o=>o.id===id))||new Set(q.answer.correct_ids).size!==q.answer.correct_ids.length||(q.kind==='single_choice'&&q.answer.correct_ids.length!==1))ctx.addIssue({code:'custom',message:'Provide 2–10 unique options and valid correct option IDs.'});
  }else if(q.options.length||(q.kind==='numerical'?!('value' in q.answer):!('rubric' in q.answer)))ctx.addIssue({code:'custom',message:'Provide an answer or rubric matching the question type; non-choice questions have no options.'});
});
export const poolSchema=z.object({organizationId:z.uuid(),name:z.string().trim().min(3).max(160),questions:z.array(z.uuid()).min(1).max(200)});
const base={organizationId:z.uuid(),versionId:z.uuid()};
export const versionOperationSchema=z.discriminatedUnion('operation',[
 z.object({...base,operation:z.literal('publish'),revision:z.coerce.number().int().positive()}),z.object({...base,operation:z.literal('revise')}),
 z.object({...base,operation:z.literal('question'),questionId:z.uuid(),points:z.coerce.number().finite().min(0.01).max(1000),position:z.coerce.number().int().min(1).max(200),remove:z.enum(['true','false']).default('false')}),
 z.object({...base,operation:z.literal('pool'),poolId:z.uuid(),count:z.coerce.number().int().min(1).max(50),points:z.coerce.number().finite().min(0.01).max(1000),remove:z.enum(['true','false']).default('false')}),
]);
