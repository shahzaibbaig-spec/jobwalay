# Administration and reliability

Migrations 009–010 add platform operations, abuse reports, quotas, session revocation tombstones and opt-in email delivery. Apply every migration in order before deploying the application. Regenerate types with `npm run db:types`, or `npm run db:types:embedded` without Docker. These modules use the installed Next.js App Router, Supabase and Zod APIs; the repository lockfile fixes exact versions.

## Administration and review

`/admin` requires a current, verified, active account, a private platform administrator assignment and AAL2. The same requirement is enforced by SQL procedures and RLS, independently of layout/UI checks. Provision operators through the trusted process in README.md; there is no public administrator signup or role assignment endpoint.

| Route | Capability |
| --- | --- |
| `/admin` | Actual aggregate account, organization, verification, report, assessment outcome and email-state counts |
| `/admin/verification` | Paginated pending organization requests; existing independent, reasoned review workflow |
| `/admin/jobs` | Search published/closed/archived job metadata, hide/restore using expected version and reason; no draft/answer access |
| `/admin/reports` | Independent abuse-report queue and versioned resolution; separate link to job moderation |
| `/admin/users` | Narrow display-name/UUID/status directory and audited suspension/reactivation |
| `/admin/organizations` | Independent organization suspension/reactivation |
| `/admin/integrity` | Pending review-outcome totals by organization, without candidate evidence |
| `/admin/audit` | Paginated platform action history |
| `/org/{id}/analytics` | Recruitment stages and assessment outcomes for currently authorized jobs/applications |
| `/org/{id}/integrity` | Authorized manual/integrity/appeal reviews, follow-ups and unreviewed overlap observations |
| `/org/{id}/audit` | Organization owner/admin audit history only |

Moderators cannot decide verification, job/report or organization moderation for organizations where they hold an active membership. Reporting never automatically hides a job. Hiding changes a protected moderation field, removes public discovery, and blocks new applications in SQL even through direct RPC. It preserves existing applications, profiles, grades and history. Recruiters cannot clear moderation through ordinary edits or republishing. Submission and moderation serialize through the organization lock, so a racing application is either admitted before hiding or rejected after hiding. Existing application retries may still return the original application without creating a new one.

Verified signed-in users report public jobs at `/jobs/{id}/report`; `/account/reports` shows their own reports/resolutions. Organization members receive neither other reporters’ identities nor report details. Report audit events are platform-only, including when a reporter has an application that could otherwise reveal their UUID. Other moderation actions are visible as tenant audit events without sensitive reasons. Full decision rationales are stored in restricted append-only `private.administration_decisions`; trusted operations can inspect them. Application and candidate private data are not made globally readable by platform privileges.

Account suspension immediately invalidates business access and records revocation tombstones for existing Auth session IDs. Reactivation does not revive those sessions; a new sign-in is required. Managed Auth tables are not modified. The platform UI cannot suspend/reactivate itself or other provisioned platform administrator accounts: use the audited trusted operator process. Organization suspension removes public discovery and current membership-based access while preserving records. These controls do not revoke already downloaded documents or undo an external email already in flight.

Analytics count application cohorts by submission date (1–365 days); displayed job counts are current authorized jobs. Outcome counts are attempts, including retakes. Pass rate is passed / (passed + failed), excluding pending manual/integrity/appeal outcomes. No zero-denominator rate is invented. Platform statistics are all-time aggregate oversight and do not expose candidate drill-downs. Organization recruiters see assigned jobs only, and current permission checks exclude self-review. Raw browser observations remain contextual: queue placement does not create a confirmed flag or automatic rejection.

## Reliability and limits

Database fixed-minute quotas serialize concurrent admissions by actor/scope. HTTP API admission limits are 600 mutations/minute and 240 reads/minute per verified account. The larger mutation allowance supports an explicit flush of up to 200 assessment answers. Common business row writes are limited to 120/minute; assessment response inserts/changes to 240/minute. Abuse reports are 5/minute, administration mutations 30/minute and email preferences 10/minute. Existing invitation, CV and integrity-specific limits still apply. Quotas cannot be raised by clients; ordinary roles cannot invoke the private helper or edit counters. API exhaustion returns HTTP 429 with a 60-second retry hint and no-store caching. New indexes cover queues, recent audits, directories, review outcomes and joins; existing full-text/job cursor indexes remain in use.

Quota buckets are fixed windows, not a global sliding-window/DDoS defense. API admission RPCs commit separately from handler operations. Limits enforced inside business transactions roll back with failed operations, so they primarily bound admitted HTTP requests and successful direct database writes. Public search, Supabase Auth/Storage and invalid direct RPC traffic also require upstream rate limits/WAF and database resource budgets. Do not trust client-forwarded IP headers without a configured trusted proxy. Trusted migrations and worker operations intentionally do not consume a candidate’s business-write quota. Schedule bounded cleanup of old quota buckets through a trusted administrative job; a retention automation worker is not shipped here.

Search already uses anonymous-client RLS plus stable `(published_at,id)` keyset pagination, 20 results with a lookahead and filter-preserving next links. Draft, hidden, expired and closed jobs are excluded from discovery. Cursor values are bounded and parsed through Zod before interpolation. Management, report, notification, audit and review lists use bounded pages with lookahead and stable tie ordering. Offset lists are operational lists, not immutable exports: concurrent changes can shift pages. Use trusted exports/snapshot isolation for formal audit extracts.

App-level loading, route error and global error boundaries provide responsive, accessible progress/retry states without rendering raw exceptions or credentials. Mutation forms show validation/conflict errors and pending state. Server guards and RLS remain authoritative even if a client skips these controls.

CV uploads remain private, immutable-versioned and capped at 10 MiB. MIME/size checks run before buffering; byte checks require a supported PDF header and a final EOF with whitespace only, rejecting simple prefixed/appended polyglots. These are prefilters, not a complete PDF parser or proof of harmless content. ClamAV INSTREAM must explicitly return clean; missing scanner, errors, incomplete replies and malware fail closed. Use a current isolated scanner, configure encrypted/unscannable content rejection, test oversized/malformed PDFs and apply download authorization on every request. Downloads are attachments with no-store, nosniff and sandbox headers. No permanent public CV URLs are created. Full PDF content disarm/reconstruction and automated quarantine retention remain future hardening options.

## Notification and email operations

In-app notifications remain durable and permission-scoped. Organization verification/moderation updates now notify current organization owners/admins. `/notifications` is paginated; `/account/notifications` records the candidate/recruiter’s optional transactional email preference. Email is **off by default**. Enabling affects future notifications, not historical notices.

The enqueue trigger creates a private delivery record only for opted-in recipients. Claims are service-role-only, bounded to 10, use `FOR UPDATE SKIP LOCKED`, and issue five-minute lease tokens. Claims recheck current preference, active/verified account email and relevant current organization/job permission. Revoked/unverified/opted-out recipients are skipped. The worker cannot accept arbitrary recipient addresses from public APIs. Provider acceptance is recorded only with the current lease token. Failed attempts back off and stop after five claims or a 23-hour delivery horizon. Dead and skipped records remain inspectable through trusted operations; dashboard counts do not reveal recipient addresses.

`npm run worker:notifications` runs the isolated worker; `-- --once` performs one tick. It uses the fixed Resend HTTPS endpoint, a verified sender, 15-second request timeout and a stable `notification-v1/{id}` idempotency key. The 23-hour horizon stays within the provider’s documented 24-hour deduplication window. This is not a guarantee of exactly-once inbox delivery. Keep template version, sender and APP_URL stable for outstanding retries. Provider acceptance does not prove inbox delivery, and bounce/complaint webhooks are not implemented. Permissions can change after claim or a process can fail around provider acceptance; generic email content and authenticated links limit exposure. Resolve ambiguous/dead deliveries against provider records before any controlled replay, rather than blindly retrying beyond the horizon.

Versioned templates contain fixed messages, a trusted APP_URL `/notifications` sign-in link and an email-preference link. They never interpolate applicant content, scores, CVs, keys, private review text or arbitrary URLs. Unknown event types get a generic update. Worker logs contain status/error codes only; never log recipients, tokens, provider bodies or credentials. No real email is sent by tests in this repository. Provider integration needs staging validation before enabling production delivery.

Environment:

| Variable | Use |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Existing public RLS-constrained Supabase settings |
| APP_URL | Trusted origin; production HTTPS, no path/query/credentials; worker and Auth redirects |
| SUPABASE_SERVICE_ROLE_KEY | Server-only scanner/isolated workers; never NEXT_PUBLIC or browser imports |
| CLAMAV_HOST / CLAMAV_PORT | Private scanner endpoint (default port 3310), required for clean CV release |
| EMAIL_DELIVERY_ENABLED | Default false; worker refuses delivery until explicitly true |
| RESEND_API_KEY | Server-only sending credential for the isolated worker |
| EMAIL_FROM | Verified plain sender address, no display-name/header input |

Supabase Auth verification/recovery SMTP is configured separately in Supabase, not through the recruitment notification queue. Configure Auth rate limits and redirect allowlists there. Do not provision production service credentials to the web client or browser test runner.

## Verification commands and limits

Run `npm ci`, `npm run db:types:embedded`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:races`, `npm run build` and `npm run test:e2e`. Install the browser once with `npx playwright install chromium`. The Playwright suite starts a loopback production server on port 3177 and uses that origin for guarded requests; `TEST_APP_URL` changes the local origin. `E2E_EXTERNAL_SERVER=true` uses an already-running local server. Browser smoke checks run without a real Supabase project, but they do not claim authenticated hiring success.

`npm test` uses real migrated PGlite tables and anon/authenticated roles, including administration, moderation, session tombstones, tenant/job analytics, report privacy, immutable audits, quotas, leases and template validation. The database hiring-journey test covers published job, scan-gated fixture application, assessment, shortlist, interview, offer, hire, history and notification records. Its synthetic Auth/clean-scan fixtures are explicitly not a live SMTP/Storage/ClamAV/browser test. `npm run test:races` uses native PostgreSQL and independent transactions for quota admissions, worker claims, moderation/application races and existing assessment races.

For the real browser journey, start isolated local Supabase with all migrations and a real private ClamAV service, configure `.env.local`, build the application, then run `npm run test:e2e:hiring`. The runner captures local CLI credentials in memory and refuses non-loopback projects. It provisions synthetic verified accounts and a preverified company as fixture preconditions, then uses real browser sign-in, job publication, PDF upload/scan, application, disclosed assessment, grading/shortlist and employer stages through hired. It suspends fixture accounts and revokes sessions afterward while preserving audited records; reset the local database when finished. This test does not assert the initial email verification/independent company-review UI, which have separate authorization/Auth tests. It never uses production accounts, provider email delivery or fake scanner-clean responses.

The live hiring test is skipped in default Playwright runs unless explicitly configured. A missing local stack produces a failed/unavailable live command, never an invented pass. Also run `npm run test:integration` and `npm run db:test` against full Supabase for Auth/HTTP/pgTAP validation. Manual keyboard/screen-reader/device review, representative load tests, actual provider SMTP/Resend checks, retention, backups and recovery remain production gates. See [production deployment checklist](production-deployment-checklist.md).

References: [Next.js error handling](https://nextjs.org/docs/app/getting-started/error-handling), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [database functions](https://supabase.com/docs/guides/database/functions), [Playwright web server](https://playwright.dev/docs/test-webserver), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
