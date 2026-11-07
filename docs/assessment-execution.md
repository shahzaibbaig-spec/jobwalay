# Assessment execution and review

Implemented by migrations 006–007. Apply every migration in order before deploying the application. Regenerate the database contract with `npm run db:types` against local Supabase, or `npm run db:types:embedded` without Docker. Existing closed preview attempts enter integrity review when processed; missing historical responses are never treated as reliable evidence of failure.

## Candidate and employer journey

Applying to a job with a published, builder-ready assessment creates an invitation and notification in the application transaction. Eligibility uses the existing application/CV/job checks. An invitation expires at the earlier of the assessment deadline and its configured validity. Existing eligible applications are backfilled by migration 006. Applications without a bound builder-ready assessment receive no invitation.

Candidates open their application to start/resume a permitted attempt or request a configured retake. The server fixes selected questions, shuffled option order, keys, points, grading contracts, policy settings, start and deadline. Each answer autosaves after a short debounce, with a revision number and visible save/error status. Submission flushes saves first. On expiry, only answers committed before the database deadline count. Browser timers are advisory; changing the device clock or bypassing the UI grants no time.

After closure candidates see aggregate points, percentage and outcome, with an appeal form where policy allows. They never receive keys or question-level correctness. Employers open an applicant's assessment history to see closed responses, frozen keys/rubrics, objective points, manual reviews, flags and appeals. Current organization/job authorization is checked on every request and in SQL. Keys remain unavailable through this result endpoint while an attempt is active.

## Transactions and grading

RPCs use organization → application → attempt locks in a consistent order. Start, immutable snapshot creation and author-conflict checks commit together. A partial unique index prevents concurrent active attempts per candidate/version, with attempt-number uniqueness as a second constraint. Retrying start returns the same active attempt. Different concurrent saves with the same revision conflict; identical lost-acknowledgment retries are safe.

Submission/expiry changes state, grades, records results/history, updates the application stage, audits and inserts notifications in one PostgreSQL transaction. A unique immutable objective run per attempt makes repeated submission and worker retries idempotent. No HTTP process must keep running after its response. A failed transaction leaves no partial grade or shortlist. A stable result fingerprint prevents duplicate history and notifications when nothing changed. Corrections to manual reviews append a new review revision and recompute the aggregate; objective evidence is immutable.

Single-choice and multiple-select use exact set equality (all-or-nothing question weight). Numerical questions use decimal arithmetic and the frozen absolute tolerance. Unanswered objective/written questions earn zero. Nonempty written answers require an authorized rubric-based review before final score or percentage is released, even if objective points alone appear sufficient. This deliberately conservative rule prevents incomplete manual scoring. All weights and awarded manual points are bounded by the frozen question maximum. Pass/fail compares exact totals against the frozen percentage threshold; rounded two-decimal display values do not determine passing. Unknown/missing grading contracts enter integrity review. No code or expressions are evaluated.

Only the latest passing attempt with no application-wide unresolved integrity flag or appeal can automatically move submitted/screening/assessment applications to `shortlisted`. Failing candidates retain their existing stage. Flags enter review, never automatic rejection. A later flag pauses an automatic shortlist; interview/offer/hired/rejected/withdrawn decisions are preserved. Written reviews, flag decisions and appeals are authorized, audited human actions. Rejected/hired/withdrawn applications cancel active attempts and cannot restart them. A confirmed integrity finding continues to hold automatic shortlisting until explicitly cleared; it does not itself reject the applicant.

## Retakes and appeals

Published versions configure `retake_policy` (`none`, `automatic`, `approval`), maximum attempts, cooldown minutes, invitation validity, appeals enabled and appeal window hours. Attempts freeze their policies; changing published settings requires a new version. An automatic retake requires a failed result; pending review requires employer approval. Approval cannot override a disabled retake policy, maximum attempts, deadline or cooldown. A passing result cannot be retaken. Approval is a bounded allowance for the next attempt, so repeated approval does not silently increase the cap.

One appeal is allowed per closed failed/review attempt within its frozen window. It holds automatic shortlisting across the application until resolved. Authorized employers may uphold, record a completed review, or approve a permitted retake. An appeal decision does not fabricate points: change written points through the versioned written-review operation, and resolve integrity evidence separately with a reason.

## Required expiry scheduling

Run **one** of these trusted schedulers in every deployed environment. Page reads also close expired attempts, but abandoned attempts require a scheduler. Autosaves enforce the deadline independently of scheduler lag.

1. Enable Supabase Cron (`pg_cron`) and run [assessment-cron.sql](../supabase/assessment-cron.sql) through a trusted database administration connection. The fixed SQL job runs every 15 seconds, without an exposed HTTP secret. Inspect Cron run history for failures.
2. Run `npm run worker:assessments` as a supervised server process. It reads `.env.local`; provide `NEXT_PUBLIC_SUPABASE_URL` and server-only `SUPABASE_SERVICE_ROLE_KEY`. `npm run worker:assessments -- --once` performs one tick for an external scheduler. Keep this privileged process and credential isolated from browsers, logs and build artifacts. Ordinary web assessment operations use authenticated user clients.

The RPC processes batches of 50 (hard maximum 100), claims organizations using `FOR UPDATE SKIP LOCKED`, and retries closed attempts lacking grades. Monitor expired/ungraded backlog and `private.assessment_engine_errors` with trusted operational access. Errors record SQLSTATE, never answers. A failed item remains eligible for retry. Configure alerts for repeated failures and increase scheduling capacity when representative load warrants it.

Notifications are durable, deduplicated **in-app** records at `/notifications`. Content uses fixed generic messages and authorized application links, without answer keys, CVs, scores, reasons or untrusted HTML. Notification RLS removes employer access after permission revocation. This implementation sends no external email/SMS; a future delivery adapter needs bounded retries, deduplication and verified recipients.

## HTTP contracts

All private endpoints require a valid session; mutation origin checks, bounded JSON and strict Zod validation apply. SQL independently validates candidate identity, current membership, state, question ownership, allowed option IDs, finite bounded numbers and deadlines. Submitted scores/settings/roles are rejected. Never log bodies containing candidate responses or private keys.

| Endpoint | Input / response |
| --- | --- |
| POST `/api/assessment-attempts` | `{applicationId,monitoringDisclosure:"browser-integrity-v1"}` → permitted frozen attempt |
| GET `/api/assessment-attempts/{id}` | Own safe questions, responses/revisions, DB time, aggregate result and appeals; questions are unavailable after closure |
| PATCH `/api/assessment-attempts/{id}/responses` | `{questionId,revision,answer}` → committed revision |
| POST `/api/assessment-attempts/{id}/submit` | Strict empty object `{}`; idempotent closure |
| POST `/api/assessment-attempts/{id}/issues` | `{reason}` → human integrity review |
| POST `/api/assessment-attempts/{id}/appeals` | `{reason}` → policy-bounded appeal |
| GET `/api/org/{org}/assessment-results/{id}` | Closed-only authorized detailed result |
| PATCH `/api/org/{org}/assessment-results/{id}` | `operation`: written, integrity, appeal, retake or flag |

Answers are `{selected_ids:["option-id"]}`, `{value:"42.5"}` (or null), or `{text:"Written reasoning"}`. Initial revision is zero. Conflicting revisions return HTTP 409; reload the attempt before resolving a conflict. Written review requires questionId, points, rationale and expected revision; other reviews require the relevant flagId/appealId and a reason/message. IDs never grant authority.

## Verification and operational limits

`npm test` applies migrations to PGlite and checks actual authenticated/anonymous grants and RLS, tampering, expiry, review, retakes, appeals, transaction rollback and history. `npm run test:races` starts disposable native PostgreSQL 17 on loopback and uses independent transactions with lock barriers to test concurrent starts, retakes, conflicting saves, save versus submit, duplicate submits and time expiry across a waiting lock. No Docker or application secrets are required. Its ignored `.test-postgres` directories contain synthetic data only. Do not point test tooling at production.

Run lint, typecheck and build as well. These database checks do not replace full Supabase Auth/PostgREST/browser integration, accessibility review, production load testing, SMTP configuration or operational monitoring. The existing opt-in live Supabase suite remains a separate gate. Integrity reporting is a review mechanism, not automated proctoring or a claim to detect cheating.

References: [PostgreSQL row locks](https://www.postgresql.org/docs/17/explicit-locking.html), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase Cron](https://supabase.com/docs/guides/cron), [Cron jobs](https://supabase.com/docs/guides/cron/quickstart).

Migration 008 adds [browser integrity observations](assessment-integrity.md), immutable disclosure receipts, optional fullscreen and contextual review. Telemetry is isolated from grading and shortlisting. Explicit candidate support reports and formal integrity holds still use the engine’s existing review workflow. New starts require the versioned monitoring disclosure in both SQL and HTTP calls.
