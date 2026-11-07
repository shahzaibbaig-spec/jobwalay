import type { FormState } from './forms';
export class DomainError extends Error {constructor(message:string,public status=400){super(message);}}
export function databaseError(error: { code?: string; message: string }) {
  if(error.message==='Too many requests. Try again later.')return new DomainError(error.message,429);
  if (error.code === '40001') return new DomainError('This record changed. Reload the page before saving again.',409);
  if (error.code === '23505') return new DomainError('A record with those details already exists. Reload before trying again.');
  if (error.code === '42501') return new DomainError('You do not have permission for this operation.',403);
  const safe = new Set([
    'Give a reason in 5 to 2000 characters','Invalid abuse report','Independent reviewer required','Administrator accounts require the trusted provisioning process','Invalid account status','Invalid organization status','Account unavailable','Report unavailable','Invalid report decision','Invalid directory filter','Invalid analytics period','Invalid queue page',
    'Acknowledge the assessment monitoring rules before starting','Invalid monitoring session','Monitoring collection has closed','Invalid integrity event batch','Invalid integrity event','Integrity event ID was reused','Integrity event limit reached','Monitoring session limit reached','Invalid monitoring review',
    'Publishing requires a verified, public company profile', 'Job deadline has passed',
    'Published jobs require a future deadline', 'Archived jobs cannot be edited', 'Invalid job transition',
    'Create a candidate profile before applying', 'This job is not accepting applications',
    'Resolve the pending verification request before changing company name or website',
    'Save a company profile first', 'Organization is already verified', 'Image unavailable',
    'Choose a clean, verified CV before applying','CV upload limit reached. Try again later.',
    'Invalid application transition','Application is already final','Profile entry limit reached','Saved job limit reached','Job unavailable',
    'Create a new version before editing a published assessment','Assessment is already published','Assessment deadline has passed',
    'Assessment must contain 1 to 200 questions','Approved pool does not have enough questions','Question pools and fixed selections must not overlap',
    'Pool must be approved','A draft version already exists','Only published assessments can be revised',
    'Question unavailable','Pool unavailable','Assessment question limit reached','Question bank limit reached',
    'Pool questions must be approved and belong to this organization','Choose 1 to 200 approved questions',
    'No published assessment is assigned','Maximum attempts reached','An assessment attempt is already active',
    'Assessment invitation is unavailable or expired','Retakes are disabled','A passing attempt already exists','Retake approval is required','Retake cooldown has not elapsed',
    'Attempt is closed or expired','Attempt is cancelled','Invalid assessment response','Invalid selected options','Invalid numerical response','Invalid written response',
    'Attempt must be closed before review','Invalid written review','Explain the issue in 5 to 2000 characters','Integrity report limit reached','Invalid integrity review',
    'Retake is not permitted by the configured policy','Appeal is not permitted by the configured policy','Invalid appeal decision',
  ]);
  return new DomainError(safe.has(error.message) ? error.message : 'Unable to save changes. Check your entries and try again.');
}
export function formFailure(error: unknown): FormState {
  if (error instanceof DomainError) return { error: error.message };
  throw error; // Preserve Next.js redirects/notFound and unexpected failures.
}
