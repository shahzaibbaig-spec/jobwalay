# Jobwalay

Next.js App Router recruitment platform with Supabase authentication, candidate profiles and private CVs, multiple organization memberships, company verification, job management/discovery, saved jobs and applicant tracking. Assessments include a question bank, approved pools, immutable versions, timed autosave, server grading, human review, retakes/appeals, automatic shortlisting and in-app notifications.

Visitors can browse published jobs and company pages without an account. Applying or registering a company requires sign-in/signup; these entry points preserve the selected application or company-registration destination through authentication and onboarding. Email verification resumes that destination in the same browser within one hour. Employers must complete company verification before publishing vacancies. Drafts and private hiring records remain restricted.

## Local setup

Requires Node.js 22.12+ (tested on 24), npm, and Docker Desktop with Linux containers running. On Windows PowerShell use `npm.cmd` / `npx.cmd` if execution policy blocks npm.ps1.

The local config enables Auth, PostgreSQL, API, email testing and Storage. Studio, Realtime, Edge Runtime and Analytics remain disabled. Ensure sufficient disk space for local images before starting Docker. Storage serves company branding and private CVs. CV scan completion additionally needs the isolated server-only scanner configuration described below.

```sh
npm ci
npx supabase start
npx supabase db reset
```

Copy `.env.example` to `.env.local`. Run `npx supabase status` locally and set the public URL and publishable/legacy anon key. Never use the service-role or secret key. Then:

Alternatively, `npm run setup:local` creates `.env.local` from the local CLI status with only public configuration; it refuses to overwrite an existing file.

```sh
npm run dev
```

Open http://localhost:3000. Create an account and open its confirmation email in the local Mailpit inbox (URL printed by `supabase start`). Follow the link in the same browser that requested signup: the callback exchanges a PKCE authorization code using an HttpOnly cookie. Complete onboarding, then create a candidate profile and/or register an organization. One account can do both and join multiple organizations.

## Environment and Auth configuration

| Variable | Location | Purpose |
| --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | App | Supabase project URL; public |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | App | Publishable key (or local legacy anon key); public and RLS constrained |
| APP_URL | Server only | Trusted absolute application origin for Auth redirects, e.g. http://localhost:3000 |

Ordinary requests use no service credential or database password. CV uploads additionally require server-only SUPABASE_SERVICE_ROLE_KEY, CLAMAV_HOST and optional CLAMAV_PORT; see [CV setup](docs/candidate-workflow.md). The isolated scanner commits scan results. The optional standalone assessment expiry worker also needs the service key; Supabase Cron is an alternative requiring no app worker credential. Normal assessment, download and recruiting services remain user-scoped. Never commit `.env.local` or expose this key with NEXT_PUBLIC. Production requires HTTPS and separate Supabase projects per environment. Set the Auth Site URL to APP_URL; allowlist exactly APP_URL/auth/callback and APP_URL/auth/callback?flow=recovery. Keep email confirmations enabled, minimum password length 12, and configure production SMTP, Auth rate limits, session lifetimes and abuse protection. The checked-in local config enables confirmations. Leave default PKCE-compatible confirmation/recovery email templates; do not replace them with implicit-token redirects.

Reset passwords at `/forgot-password`; follow the recovery email, set a new password, then sign in again. Authenticated users may also update their password through `/reset-password`. Password updates and logout revoke all sessions. RLS checks the JWT session_id against auth.sessions as well as active account, confirmed email and current tenant membership. There is no browser Supabase client: cookies are HttpOnly, same-site Lax and Secure in production. Proxy refreshes tokens; pages/services independently verify users through Auth and query current database permissions.

## Organization invitations

Register at `/organizations/new`. The owner can open `/org/{id}/admin`, issue a recruiter or administrator invitation, and copy the displayed single-use code. Send it through your existing secure channel; this phase does not send invitation emails. The verified recipient signs in, completes onboarding, and enters the code at `/invitations`. Codes expire after seven days and are stored only as SHA-256 hashes. An existing membership is never promoted/reactivated by invitation acceptance. Issuance is limited to 30 per organization/hour in PostgreSQL.

Owners/admins can revoke eligible memberships. Admins cannot revoke other admins; nobody can remove an owner through this foundation. Ownership transfer and role editing need a dedicated audited workflow in a later slice. Recruiters cannot manage teams or read other members' private profiles. They can create jobs and manage jobs assigned to them. Owners/admins manage all company jobs and assign active recruiters from each job's editor. Registration starts pending verification and grants no publishing permission.

## Platform administrator provisioning

Platform privileges cannot be requested through signup metadata or application forms. Have the intended operator verify their email, onboard, and enroll/verify TOTP at `/account/security` before provisioning. Then use a trusted database administration session:

```sql
begin;
insert into private.platform_administrators(user_id)
values ('REPLACE_WITH_EXISTING_ACCOUNT_UUID');
insert into public.audit_events(actor_id,action,target_id)
values (null,'platform.admin.provisioned','REPLACE_WITH_EXISTING_ACCOUNT_UUID');
commit;
```

`/admin` requires both the private assignment and AAL2, including in RLS; users verify a fresh authenticator code after each new login. It shows organization oversight and the private verification queue without granting access to candidate profiles. Reviewers must be independent of the organization being reviewed. Revoke privileges in the same controlled database process and record `platform.admin.revoked`. Keep provisioning access restricted; there is deliberately no public bootstrap-admin endpoint.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run test:races
npm run db:test
npm run build
npm run db:types
```

`npm test` runs the real migration against embedded PostgreSQL (PGlite) with Auth-schema fixtures and actual anon/authenticated roles. It covers private-record isolation, tenant isolation, forbidden writes, direct RPC forgery, invitations/replay/expiry, revoked memberships/sessions, platform MFA and suspended/unverified accounts. It does not mock RLS policy results. `db:test` additionally runs pgTAP against the full local Supabase database. `db:types` regenerates the Supabase client contract from that database after migrations. Use local Supabase for Auth email and session integration; embedded fixtures alone do not verify GoTrue/SMTP behavior.

With local Supabase and the application running on port 3000, run `npm run test:integration`. This captures local test credentials in memory and checks email verification, recovery-token password updates, real authenticated HTTP requests, forbidden organization/admin pages and revoked sessions. Set TEST_APP_URL to use a different local app port. Live tests are skipped by the default test command. The suite retains suspended synthetic fixture accounts and audited history in the local database; run `npx supabase db reset` after testing when ready to discard local data. Never point test fixtures at production.

TypeScript checks application/test sources strictly. `skipLibCheck` avoids upstream PGlite Emscripten and Supabase WebAuthn declaration conflicts with the current TypeScript DOM definitions; it does not disable application type checking.

When Docker is unavailable, `npm run db:types:embedded` generates the public client contract by introspecting the migration applied to embedded PostgreSQL. This is how the checked-in initial contract was generated. `npm run test:http` checks public rendering and anonymous server redirects against a running local application; it is separate from authenticated integration tests.

Current environment limitation: the initial full Supabase startup exhausted host disk during image extraction and Docker became unavailable. The embedded PostgreSQL tests and application checks can run independently; full-stack pgTAP, email/session integration and authenticated HTTP checks must be run once Docker has adequate space. Build output and this task's temporary downloaded CLI cache were preserved at `D:\Jobwalay-auth-build-20261028` and `D:\Jobwalay-auth-npx-20261028` to recover host space. Neither contains application secrets.

Dashboard routes are `/candidate`, `/org/{id}`, `/org/{id}/admin`, `/admin`, with `/dashboard` providing workspace selection. Authorization is enforced in server contexts/services, database functions, grants and RLS; route groups and UI visibility are not authorization.

Company/job workflows, image constraints, verification review, recruiter assignments, sample catalog data and assessment-attachment boundaries are documented in [Companies and jobs](docs/company-jobs.md). The company dashboard is `/org/{id}`; public discovery starts at `/jobs`. Local database resets now load `supabase/seed.sql` after all migrations. It creates fictional catalog records and no login credentials.

Candidate profile/CV setup, application history, secure downloads and employer stages/notes are covered in [Candidate workflow](docs/candidate-workflow.md). Assessment authoring, approval, versioning, frozen attempt boundaries and JSON API examples are in [Assessment builder](docs/assessment-builder.md). Apply all migrations before running the application, then regenerate database types. Without a configured private ClamAV daemon, CV uploads remain unavailable; quarantined files cannot be used for applications. Existing accounts/profiles can continue without enabling public visibility.

See [architecture](docs/architecture.md), [security](docs/security.md) and [implementation plan](docs/implementation-plan.md) for the wider platform design. Do not enable future modules before their security gates are implemented.

Local CV antivirus setup is available through `compose.clamav.yml`, `npm run clamav:configure`, `npm run clamav:check` and `npm run test:clamav`. See the [configuration and test record](docs/clamav-local-setup.md) for exact environment changes, loopback networking, fail-closed behavior, EICAR checks and the no-live-database-write verification boundary. CV downloads remain blocked until a scan result is committed clean.

Secure timed execution, autosave, transactional server grading, written/integrity review, automatic shortlisting, retakes, appeals and in-app notifications are implemented. Follow [Assessment execution](docs/assessment-execution.md) to configure the required expiry scheduler (`supabase/assessment-cron.sql` or `npm run worker:assessments`). Apply migrations 006–007 before deploying. `npm run test:races` runs independent transactions against disposable native PostgreSQL 17; the default PGlite suite alone does not test concurrent database sessions. Optional email delivery is implemented but disabled until configured; SMS and automated proctoring are not configured.

Migration 008 adds [disclosed browser activity monitoring](docs/assessment-integrity.md), optional fullscreen, reconnection handling, candidate activity/support views and an authorized recruiter review dashboard. Apply it before deploying the monitoring UI. Start API callers must now provide `monitoringDisclosure: "browser-integrity-v1"`. Raw activity and contextual reviews never automatically change grades or hiring stages. The separate Safe Exam Browser interface is a future integration boundary; no SEB enforcement or invasive surveillance is enabled.

Migrations 009–010 add [administration and reliability](docs/administration-reliability.md): moderation/report queues, independent user/organization controls, scoped analytics and integrity queues, audit pages, database quotas, paginated operations, loading/error boundaries and optional transactional email delivery. Email is opt-in and disabled until `EMAIL_DELIVERY_ENABLED=true` and an isolated worker/provider are configured. See `.env.example`, `npm run worker:notifications`, browser checks with `npm run test:e2e`, and the opt-in real-stack journey `npm run test:e2e:hiring`. Follow the [production deployment checklist](docs/production-deployment-checklist.md); implementation alone is not production validation.
