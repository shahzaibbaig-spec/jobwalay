# Security design

This is the platform security contract. Implemented controls include verified-email accounts, HttpOnly SSR sessions, current-session/account checks, membership/assigned-job RLS, audited mutations, hashed invitations, MFA-gated independent verification reviews, private company image policies and atomic job/application eligibility. See README.md and the workflow documents for current setup and tests; implementation does not imply production deployment.

Current extensions implement private scan-gated CV storage, application-specific sharing, withdrawal revocation, internal notes, status history, public professional projections and private-key assessments. [Assessment execution](assessment-execution.md) documents strict server answer validation, database-clock deadlines checked after locks, immutable objective evidence, authorized append-only written reviews, review holds, retakes/appeals and generic in-app notifications. Ordinary users cannot invoke grading internals or the privileged expiry sweep. Native multi-connection PostgreSQL race tests supplement actual-role PGlite tests. Full live Supabase/ClamAV/browser validation, retention automation and operational hardening remain gates.

## Threat model and authorization

The [local ClamAV setup](clamav-local-setup.md) now has a verified loopback-bound real engine, server-side readiness checks, strict filename/size/MIME validation and fail-closed protocol handling. A token-protected development-only fixed-fixture diagnostic proves backend connectivity without creating live records; it is disabled in production. All existing scan-result grants and private CV RLS remain unchanged.

Administration uses current AAL2 platform checks, independent decisions, protected moderation state and transactional audits. Account suspension tombstones existing sessions so reactivation cannot revive them. Abuse reports and their audit entries do not expose reporter identities to organization owners. Tenant analytics and integrity queues require current assigned-job access. Quotas are database-backed but fixed-window and transaction-dependent; upstream Auth/Storage/public traffic controls remain required. Opt-in email uses permission-rechecked, bounded private worker leases and generic authenticated links. See [operations and limitations](administration-reliability.md).

Disclosed [browser monitoring](assessment-integrity.md) is an untrusted observation channel. Strict allowlists exclude URLs, media, biometrics, answer content and client cheating classifications. Receipt timestamps and overlap observations are server-derived; source events can still be suppressed or falsified by hostile clients. Bounded ingestion, deduplication, immutable logs, tenant RLS and audited contextual review protect the channel. Raw telemetry never drives automatic rejection or grading. Production still requires browser/accessibility validation and deployment-specific retention operations.

Protect candidate PII/CVs, tenant hiring records, question keys, grading integrity, verification evidence and platform credentials. Assume malicious candidates, recruiters from another organization, compromised accounts, forged requests, duplicate jobs and accidental privileged-client use.

| Threat | Required control | Verification |
| --- | --- | --- |
| Guessed tenant/resource IDs | Server permission checks, RLS, composite tenant FKs | Cross-tenant read/write and relation-forgery tests |
| Self-promotion or fake verification | Restricted grants and authorized procedures | Direct REST/RPC updates to protected fields denied |
| Stale membership/session | Current DB membership and account status on operations | Revoked member and suspended account immediately lose business access |
| Answer/score manipulation | Private keys, sanitized DTOs, immutable versions, server graders | Inspect responses/bundles and attempt direct score writes |
| Stolen document URLs | Private bucket, current authorization, short-lived download issuance | Unrelated users denied even knowing object key |
| Duplicate/racing actions | Locks, uniqueness, idempotency and atomic transitions | Parallel submit/apply/shortlist tests |
| Privileged worker abuse | Narrow entry points, canonical state checks, restricted secrets | Wrong tenant/state jobs fail and leave trace |

Do not use user-editable Auth metadata for permissions. Platform capabilities are provisioned through a controlled administrative process; organization roles live in memberships. Require MFA/step-up verification for platform administration and ownership changes. A support capability is not permission to browse all CVs. Document an exceptional-access process with reason, time bound and audit before enabling it.

## Server and browser boundaries

- Validate every untrusted form, route parameter, JSON payload, search filter and worker message using Zod. Reject unknown privileged fields, enforce lengths and parse IDs/enums. Return safe field errors; keep internals out of responses.
- Treat Server Actions and Route Handlers as independently callable endpoints. Verify identity and capability inside each service, not just in layouts or proxy. Use current Supabase SSR verification, never trust a cookie's session object by itself.
- Use request-scoped user Supabase clients for normal work. Service/secret credentials are server-only and exceptional; never place them in NEXT_PUBLIC variables, client props, browser storage, logs, fixtures or bundles. Only public Supabase URL and publishable key belong in browser configuration.
- Secret-bearing modules import `server-only`; separate environment schemas stop server values flowing into client exports. CI checks bundle content and known credential patterns. Redact authorization headers and tokens.
- Set authenticated responses to private/no-store and exclude them from shared caches. Keep any public cache keys and projections independent of user context. Session refresh must propagate cookie updates to request and response using the supported SSR adapter.
- Enforce allowed origins on custom mutation handlers and appropriate CSRF protections for cookie-authenticated requests. Retain framework origin checks for actions. Webhooks require provider signature verification, replay window and deduplication. Worker ingress uses independent authentication and replay-resistant job identifiers.
- Use CSP, secure transport, appropriate cookie settings, safe rendering and allowlisted redirects. Rich text requires sanitization; avoid arbitrary HTML. Rate limit authentication, invitations, uploads, attempt writes and downloads using a shared store; do not rely on process memory across instances.

## Database boundary

Enable RLS on every exposed business table and explicit grants on all schemas/functions. Policies use authenticated identity plus current membership/assignment. Restrict role/status/owner/score columns independently; row policies alone do not prevent a permitted user changing privileged fields. Use invoker functions by default. Audit every SECURITY DEFINER function for fixed search_path, qualified references, explicit actor checks and narrow execution grants.

Administrative and service credentials can bypass RLS. They must not be used as the normal server client. Workers receive minimal canonical IDs and execute narrowly scoped procedures; any unavoidable broad service credential is isolated in worker infrastructure, never used to honor arbitrary client filters or storage paths. Record this residual blast radius and rotate secrets on exposure. See [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## CVs and verification documents

Use separate private buckets for CVs and verification evidence. Implemented CV keys use `user-id/document-id.pdf`, without PII in names; every replacement uses a new document ID. CVs are PDF only, maximum 10 MiB. Validate size, extension, MIME and file signature; never treat a browser MIME declaration as proof. Deny overwrite/upsert so an attached CV version cannot silently change. The implemented ClamAV/scan-completion contract is detailed in docs/candidate-workflow.md; the following storage rules also guide future verification-document workflows.

1. Authenticated upload-intent operation creates owner-bound metadata and a bounded upload authorization for a generated path. Storage INSERT policy validates bucket, path, owner and pending metadata; users cannot mark a document clean.
2. New files remain quarantined. An isolated scanner checks malware and format; failures remain inaccessible. The serving path authorizes both ownership/sharing and scan status.
3. Applying records a specific immutable CV version. Recruiter access requires current active organization, permitted job/application access and the exact application-document link; sharing one CV does not share later uploads.
4. Downloads go through an authenticated authorization endpoint, which logs issuance. Prefer server-mediated downloads where immediate revocation is required. If issuing `createSignedUrl`, use a short expiry (proposed 60 seconds) and acknowledge that an already issued URL remains a bearer token until it expires. Never log or persist signed URLs.
5. Serve as attachment with safe filename and no sniffing; never inline untrusted PDF content in the application origin. Delete through the Storage API with durable cleanup jobs, not by deleting storage catalog rows directly.

Storage policies also block direct unauthorized SELECT, UPDATE and DELETE; an application endpoint alone is insufficient. Recruiter access can be restricted to server-mediated download while direct owner access remains owner-policy controlled. See [Storage access control](https://supabase.com/docs/guides/storage/security/access-control) and [private downloads](https://supabase.com/docs/guides/storage/serving/downloads).

## Assessment integrity

Publish immutable assessment/question/rubric versions. Store correct answers separately in a non-exposed schema; never include them in RSC payloads, action responses, generated client fixtures or downloadable question JSON. Author key access requires a separate server capability.

The server determines question selection, start time, allowed attempts and deadline from database time. Serialize save and finalization through organization/application/attempt locks. Freeze responses at submission/expiry; never accept client scores, pass flags, timings or grade versions. The durable expiry sweep finalizes abandoned attempts and grades within the same transaction. Sanitize objective responses against allowed option IDs. Individual accommodation overrides require a future audited policy workflow.

Initial graders cover single-choice and exact-set multi-choice with versioned partial-credit rules if supported. Bound numeric values and rounding precisely; store integer points or fixed decimal values, never floating-point pass decisions. Compute normalized thresholds using integer basis points and define zero-maximum-point handling as invalid publication. Free text requires manual review initially. Do not execute candidate code inside Next.js or the database; future coding assessments require a separate resource-limited sandbox architecture.

Workers grade immutable snapshots idempotently. A grade records grader version, rubric version and input hash. Retry uses leases/backoff; exhausted retries alert operators rather than fabricating scores. Grade release and shortlist eligibility are distinct decisions. Store reproducible rule inputs and audit automatic and manual changes. Do not expose keys through detailed feedback before configured release. Rate limits and question randomization can reduce abuse but do not prove absence of cheating.

## Audit, privacy and operational safety

Log verification, membership/ownership changes, publication, application transitions, grading/regrading, shortlist decisions, privileged access, document download issuance and deletion. Record actor/system identity, organization, action, target, outcome, timestamp and request ID; redact free-text answers, contact data, CV content, secrets and signed URLs. Important mutations fail if transactional auditing fails. Rejected security requests go to a separate structured security log.

Normal users cannot mutate/delete audit rows; privileged retention/pseudonymization is a distinct controlled job. Restrict raw audit reads and export capabilities. Define retention schedules for CVs, rejected applications, verification evidence, responses and logs before launch; test cleanup against backups and restores. Browser downloads cannot be recalled once a recipient saves a file.

Use separate environments, dependency/secret scanning, least-privilege deployment accounts and reviewed migrations. Monitor unusual download volume, failed authorization, job failures and grading lag. Have an incident runbook for token/secret rotation, disabling downloads, suspending accounts, retaining evidence and restoring backups. Recovery targets and hosting region remain launch decisions.
