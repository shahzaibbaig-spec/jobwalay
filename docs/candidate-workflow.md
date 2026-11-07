# Candidate and employer workflow

## Candidate experience

`/candidate` lists the signed-in user's applications and links to profile, CV and saved-job management. `/candidate/profile` edits a headline, biography, skills, work experience, education and certifications. Each work/education/certification entry can be edited or removed; date ranges and bounded field lengths are validated with Zod and SQL constraints. Profiles default private.

An explicit public-visibility setting and unique URL slug enable `/candidates/{slug}`. The public RPC builds a professional projection containing name, headline, bio, skills and the three professional-history sections. It never exposes account IDs, contact data, CV paths, applications, notes or scan metadata. Raw profile/history tables remain owner-only even when the professional projection is public. Switching back to private removes public access; suspended accounts are also excluded.

Job search at `/jobs` supports keyword/skills, location, work arrangement and employment type. A signed-in user can save a job from its detail page and manage saved jobs at `/candidate/saved`. Saved titles/company names remain available when a listing closes, while its public details stop appearing. Saved lists are owner-only.

`/jobs/{id}/apply` requires a profile and a clean CV, collects contact email, optional phone, a cover letter and explicit sharing consent. PostgreSQL freezes the professional profile and chosen CV version in an application-specific record. Replacing or editing the candidate's current profile/CV does not rewrite past submissions. Legacy applications are migrated with only the name/headline already shared; no unconsented contact, biography or CV is backfilled.

An active application is any stage other than rejected/withdrawn. A partial unique index prevents two active applications for the same candidate/job. Retrying a valid submission returns the existing active record without overwriting its contents. After rejection or withdrawal, a fresh application is permitted while the job remains open. Eligibility is checked before deduplication: closed, archived, draft, expired, hidden-company and suspended-company jobs reject submissions, including duplicate retries. Organization/job/account/document locks coordinate submission with job closure and profile/CV replacement.

`/candidate/applications/{id}` shows the submission and full status timeline. Candidates can withdraw non-final applications. Withdrawal revokes future hiring-team access to the professional snapshot, contacts, cover letter and CV. Minimal name/headline/status history and internal hiring notes remain retained for authorized business records; a file already downloaded by a recipient cannot be recalled.

## CV storage and scanning

PDF CVs are limited to 10 MiB. The `candidate-cvs` bucket is private. Each upload gets an immutable owner/document path, bounded metadata and a SHA-256 fingerprint. Users can insert only their own pending upload path, cannot overwrite or delete CV objects directly, and cannot mark metadata clean. Files fail closed until scanning succeeds. Owners can choose an earlier clean CV as their current version; original application attachments remain unchanged.

The server validates PDF headers/end markers and streams bytes to a private ClamAV daemon using INSTREAM. Only an explicit clean response releases the file. Malware, scanner errors, incomplete responses, network failures and timeouts keep files unavailable. Signature checks and antivirus are not a full PDF parser or a guarantee that a document is benign. Files are never rendered inline by the application.

Configure these **server-only** environment variables in addition to the existing public Supabase configuration:

| Variable | Purpose |
| --- | --- |
| SUPABASE_SERVICE_ROLE_KEY | Exceptional isolated scanner client, used only to call `finish_cv_scan`; never used for ordinary reads or downloads |
| CLAMAV_HOST | Trusted private daemon hostname/IP; do not expose the daemon to public networks |
| CLAMAV_PORT | TCP port, defaults to 3310 |

Run a maintained ClamAV daemon with current signature databases, TCP INSTREAM enabled and StreamMaxLength at least 10 MiB. The app must be able to connect over a private/trusted network; clamd TCP is not authenticated/encrypted. The independent `compose.clamav.yml` and [local configuration record](clamav-local-setup.md) now provide a loopback-bound service, persistent definitions, setup/check commands and real-engine tests. Application startup still never silently pulls an antivirus image or bypasses scanning.

The privileged client is isolated in `src/server/document-scanner.ts`, imports `server-only`, persists no Auth session and accepts no arbitrary client-selected record/path. It only commits a result for the document just reserved/uploaded/scanned by the authenticated server operation. `finish_cv_scan` has EXECUTE granted solely to service_role and checks pending state, fingerprint and stored object metadata. This is a narrow application-code use of a credential that still has broad project authority; restrict and rotate it as a deployment secret.

Scanning is synchronous with a 20-second timeout; the CV page permits 60 seconds of execution. If a process terminates, its pending record stays quarantined. Uploads are limited to ten per user/hour in PostgreSQL. Deployment upload/proxy limits must allow the 12 MB Server Action envelope; the actual CV/image limits remain 10 MiB/3 MiB. Failed and superseded private objects need an operator retention/cleanup policy before production; no automatic deletion of application attachments is performed.

## Employer experience and status history

`/org/{id}/applications` searches candidate names and filters by job/stage with bounded pages. Owners/admins see organization jobs; recruiters see assigned jobs only. `/org/{id}/applications/{applicationId}` shows the submitted snapshot/contact/cover letter/CV, internal notes, status controls and timeline. It does not grant access to the candidate's current private profile, other CVs or other applications. Users cannot review their own application even when also members of the hiring team.

Stages are submitted, screening, assessment, interview, offer, hired, rejected and withdrawn. Employer transitions follow an explicit SQL graph; hired/rejected/withdrawn are final. Candidates alone can withdraw. Version checks reject stale transitions. An AFTER INSERT/UPDATE-status trigger creates history and audit rows in the same transaction, including initial submission and privileged status writes. If history/audit insertion fails, the status change rolls back. Candidate-visible messages are explicitly labelled; internal notes live in a separate table with no candidate policy.

`GET /api/cvs/{documentId}?application={applicationId}` authorizes the current identity and exact application/document link, records download authorization, and retrieves the file with the normal user-scoped Supabase client. Storage RLS independently checks clean state and current sharing permissions. Responses use attachment disposition, fixed binary content type, no-store, sandbox and no-sniff headers. No public/signed CV URLs or privileged download client are used. Revoked membership/assignment, withdrawal and suspended identities deny new access at both layers.

## Validation boundaries

The embedded PostgreSQL suite exercises ownership, safe public projections, saved-job isolation, scanner-only release, Storage policies, profile/CV snapshots, active-application uniqueness, rejection of closed jobs, notes privacy, status history, stale updates, withdrawals and membership revocation. Socket protocol tests cover clean/malware/error and interrupted responses. `npm run test:clamav` additionally tests the real local antivirus engine, while `clamav:check` verifies fixed in-memory files from the running Next.js backend. See the [configuration and results record](clamav-local-setup.md). Live authenticated Storage/upload/download persistence was intentionally not exercised for that setup because changing the existing database was prohibited. PGlite fixtures and mocked persistence are separate from live Supabase data.
