import { z } from 'zod';
const numeric=z.union([z.number().finite().min(-1e12).max(1e12).transform(String),z.string().max(64).regex(/^[+-]?([0-9]+(\.[0-9]+)?|\.[0-9]+)([eE][+-]?[0-9]{1,2})?$/).refine(v=>Number.isFinite(Number(v))&&Math.abs(Number(v))<=1e12),z.null()]);
export const answerSchema=z.union([z.object({selected_ids:z.array(z.string().max(40)).max(10)}).strict(),z.object({value:numeric}).strict(),z.object({text:z.string().max(10000)}).strict()]);
export type AssessmentAnswer=z.infer<typeof answerSchema>;
export const saveAnswerSchema=z.object({questionId:z.uuid(),answer:answerSchema,revision:z.number().int().min(0)}).strict();
export const issueSchema=z.object({reason:z.string().trim().min(5).max(2000)}).strict();
export const employerReviewSchema=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('written'),questionId:z.uuid(),points:z.coerce.number().finite().min(0).max(1000),rationale:z.string().trim().min(5).max(2000),revision:z.coerce.number().int().min(0)}).strict(),
 z.object({operation:z.literal('integrity'),flagId:z.uuid(),resolution:z.enum(['cleared','confirmed']),reason:z.string().trim().min(5).max(2000)}).strict(),
 z.object({operation:z.literal('appeal'),appealId:z.uuid(),decision:z.enum(['upheld','reviewed','retake_approved']),message:z.string().trim().min(5).max(2000)}).strict(),
 z.object({operation:z.literal('retake'),reason:z.string().trim().min(5).max(2000)}).strict(),
 z.object({operation:z.literal('flag'),reason:z.string().trim().min(5).max(2000)}).strict(),
]);
export const resultSummarySchema=z.object({attempt_id:z.uuid(),outcome:z.enum(['passed','failed','manual_review','integrity_review','appeal_review']),objective_points:z.number(),earned_points:z.number(),max_points:z.number(),total_score:z.number().nullable(),percentage:z.number().nullable(),passing_percentage:z.number(),pending_written:z.number(),integrity_holds:z.number(),open_appeals:z.number(),result_revision:z.number()});
export const invitationSchema=z.object({id:z.uuid(),state:z.string(),expires_at:z.string(),title:z.string(),summary:z.string(),duration_minutes:z.number(),passing_percentage:z.number(),max_attempts:z.number(),retake_policy:z.string(),retake_delay_minutes:z.number(),approved_through:z.number(),question_count:z.number()});
