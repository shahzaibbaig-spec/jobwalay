# Incremental implementation plan

Implemented: authentication, candidate/company profiles, scan-gated CVs, verification/jobs/saved jobs, ATS, assessments, integrity monitoring, platform moderation/user controls, scoped analytics, review/audit queues, rate limits and optional leased email delivery. See the workflow documents for exact contracts and required scheduling. Native PostgreSQL race tests and anonymous browser checks run independently of Docker. Full live Supabase Auth/Storage/ClamAV hiring, actual provider delivery, complete assistive-technology validation, interview scheduling and production operations remain gates.

## Phase 0 — Architecture review (this change)

Deliver requirements, boundaries, proposed folders, logical schema, security rules and contributor instructions. Review unresolved product decisions: hosting region, retention, job/team visibility, assessment accommodations, shortlist release rules and capacity envelope. These decisions may refine defaults without changing module boundaries.

Exit: six requested documents exist and agree on tenancy, permissions, grading and privacy. Runtime checks are inapplicable until scaffolding.

## Phase 1 — Toolchain and authenticated foundation

Scaffold Next.js App Router with TypeScript strict mode. Resolve compatible current stable versions of Next.js/React, Tailwind, shadcn/ui, Zod, Supabase JS/SSR and tooling; inspect package manifests and official release documentation, commit one package-manager lockfile and record runtime requirements. Add lint, typecheck, build and focused test commands rather than assuming scripts exist. Use the current ESLint CLI rather than legacy `next lint` instructions.

Create only directories needed for the slice, environment validation, an example env file with placeholders, SSR browser/server clients, session refresh proxy, login/recovery/logout and authenticated identity service. Initialize local Supabase migrations and generated types. Add accounts, organizations, memberships, invitations, role helpers and audit infrastructure. Implement an accessible minimal shell and organization creation/switching.

Exit: a clean checkout can install from lockfile, start locally and reset the database. Unauthenticated, suspended, revoked and cross-tenant requests fail in real JWT-context tests. Invitation replay/self-promotion/last-owner removal are blocked. Run lint, typecheck, production build, policy integration and auth smoke tests in CI.

## Phase 2 — Profiles and secure documents

Build candidate profiles, owner-only contacts, public safe projections and company profiles. Add private CV and verification buckets, metadata, upload intents, scan worker, quarantine and authorized download service. Establish outbox/worker leases and retry monitoring now because scans are asynchronous.

Exit: private profiles stay private; public output excludes sensitive fields; files remain blocked until clean; path guessing, MIME spoofing, overwrite and unrelated-user downloads fail. Test keyboard/screen-reader form flows and narrow-screen layouts. Verify worker retries and abandoned-upload cleanup.

## Phase 3 — Verification and jobs

Add restricted platform verifier provisioning, MFA-gated review, evidence access, immutable decisions and organization suspension. Add job authoring, approved-organization publication, closing, public search/filter/pagination and saved jobs using PostgreSQL indexes.

Exit: pending/suspended organizations cannot publish, drafts never leak, moderation decisions audit atomically, filters remain bounded and query plans meet the chosen staging target. Exercise the visitor-to-job-detail flow end to end.

## Phase 4 — Applications and ATS

Add idempotent apply with explicit document-sharing consent, frozen profile/CV references, job assignments, pipeline configuration, notes and optimistic-concurrency transitions. Provide candidate status/withdrawal and recruiter accessible list/pipeline views. Queue notifications without exposing sensitive content in emails.

Exit: parallel applications produce one row; same-tenant mismatched jobs/documents and cross-tenant assignments fail; reviewers cannot read unassigned applications; candidate cannot see internal notes. Withdrawal races, stale transitions and document authorization after membership revocation are tested.

## Phase 5 — Assessment delivery

Implement assessment authoring with private answer keys, immutable publication, job assignment, candidate invitation, accommodation, server-clock attempt start, autosave/resume and atomic submission/expiry. Public DTOs contain no answer keys. Deploy durable expiry sweep and freeze response sets.

Implemented delivery: authorized invitation/start/resume, frozen versions/policies, safe questions, timed autosave and atomic submission/expiry. Tests cover foreign records, frozen versions and concurrent saves/submissions. A configured expiry scheduler is required for abandoned attempts. Accommodations and browser/accessibility validation remain follow-up work.

## Phase 6 — Grading and shortlisting

Implemented grading: versioned deterministic choice/numerical contracts, conservative written review, immutable objective evidence, append-only manual corrections and result history. Latest eligible passing attempts automatically shortlist; flags and appeals enter review; failing attempts never automatically reject. Policies bound retakes/appeals. Generic durable in-app notifications contain no assessment content.

Verification covers scoring, unanswered items, review, tampering, rollback, deadlines, retakes, duplicate finalization and real concurrent sessions. Objective regrading and general multi-assessment shortlist rule authoring are deferred; current jobs bind one version and manual corrections preserve history. Configure Cron or the isolated worker, monitor backlog/private error records, and validate representative load before production.

## Phase 7 — Production readiness

Administration/reliability code is implemented: independent platform operations, abuse moderation, scoped analytics/review queues, quotas, audit UI, email preferences/private delivery worker, operational pagination, loading/error boundaries and a runnable browser suite. [Deployment checklist](production-deployment-checklist.md) items remain evidence-based gates. Full live Supabase/Storage/ClamAV hiring, actual provider delivery, load/restore drills, retention and assistive-technology review must be completed in a configured environment; they are not implied by local unit/build checks.

Finish retention/erasure automation, provider bounce/complaint handling and environment-specific incident runbooks. Validate the implemented moderation/audit/notification modules under representative concurrency and tune indexes from measured plans. Complete assistive-technology review, full live RLS/Storage/HTTP tests, secret scans, backup restore drills and a deployment rollback exercise.

Exit: product owner agrees retention/region/review policy and operational owner accepts measurable SLOs/RPO/RTO. All required CI checks pass against a migration-built database. Stage a full journey from verified organization and published job to application, assessment, grade and reviewed shortlist before production deployment.

## Delivery rules

The integrity monitoring slice is implemented: disclosure-aware starts, optional fullscreen, browser signals, bounded reconnection delivery, server overlap observations and authorized append-only contextual review. [Limitations and live gates](assessment-integrity.md) include real browser/assistive-technology validation and retention operations. A separate Safe Exam Browser adapter interface is defined; implementing and validating an actual adapter remains future work. No default webcam/biometric module is planned in this slice.

- Each change should complete one narrow workflow, including authorization, error states and audit requirements. Do not build all module shells at once.
- Use additive migrations and backwards-compatible release sequencing; destructive changes require explicit migration and recovery design.
- Recheck APIs against installed versions on every package upgrade. Do not copy deprecated auth helpers, synchronous Next.js request APIs or old Tailwind initialization commands.
- Test important behavior and trust boundaries, not implementation details. Expand testing when the change or failures justify it; documentation-only changes need consistency and reference checks, not invented runtime tests.
- Keep integration-specific details behind adapters. Defer dedicated search, event brokers, microservices and candidate-code sandboxes until needed.

## Official implementation references

- [Next.js authentication](https://nextjs.org/docs/app/guides/authentication), [data security](https://nextjs.org/docs/app/guides/data-security), [Proxy convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage policies](https://supabase.com/docs/guides/storage/security/access-control)
- [Tailwind Next.js installation](https://tailwindcss.com/docs/installation/framework-guides/nextjs), [shadcn/ui Next.js](https://ui.shadcn.com/docs/installation/next), [Zod 4](https://zod.dev/v4)
