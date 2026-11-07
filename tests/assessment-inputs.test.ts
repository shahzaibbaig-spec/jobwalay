import { describe,it,expect } from 'vitest';
import { answerSchema,saveAnswerSchema,employerReviewSchema,issueSchema } from '../src/modules/assessments/execution-schemas';
const questionId='11111111-1111-4111-8111-111111111111';
describe('strict assessment HTTP input contracts',()=>{
 it('rejects fabricated score, role, timing, settings and nested answer-key fields',()=>{
  const valid={questionId,revision:0,answer:{selected_ids:['b']}};
  expect(saveAnswerSchema.safeParse(valid).success).toBe(true);
  for(const extra of [{score:100},{percentage:100},{role:'admin'},{deadline_at:'2099-01-01'},{settings_snapshot:{passing_percentage:0}}])expect(saveAnswerSchema.safeParse({...valid,...extra}).success).toBe(false);
  expect(saveAnswerSchema.safeParse({...valid,answer:{selected_ids:['b'],correct_ids:['b']}}).success).toBe(false);
  expect(saveAnswerSchema.safeParse({...valid,revision:-1}).success).toBe(false);
 });
 it('accepts bounded decimal values without executable expressions or nonfinite numbers',()=>{
  for(const value of [null,42,'42.5','-0.25','1e3'])expect(answerSchema.safeParse({value}).success).toBe(true);
  for(const value of [Infinity,NaN,'Infinity','NaN','1e99','eval(42)','42; DROP TABLE jobs'])expect(answerSchema.safeParse({value}).success).toBe(false);
 });
 it('bounds written responses, reasons and review operations',()=>{
  expect(answerSchema.safeParse({text:'a'.repeat(10001)}).success).toBe(false);
  expect(issueSchema.safeParse({reason:'Bad'}).success).toBe(false);
  expect(issueSchema.safeParse({reason:'A valid issue',score:100}).success).toBe(false);
  expect(employerReviewSchema.safeParse({operation:'written',questionId,revision:0,points:Infinity,rationale:'A detailed review'}).success).toBe(false);
  expect(employerReviewSchema.safeParse({operation:'set_total_score',points:100}).success).toBe(false);
 });
});
