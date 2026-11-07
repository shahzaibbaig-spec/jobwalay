# Safe production deployment checklist

This checklist is a release gate, not a claim that production deployment or the checks below have been completed. Assign owners and retain evidence for the target environment. Use separate local, staging and production Supabase projects and credentials.

## Release artifact and migrations

- [ ] Record the reviewed revision, dependency lockfile, Node version and build artifact. Run dependency vulnerability review and secret/bundle scans; keep service keys out of client assets, source, test reports and logs.
- [ ] Run lint, type checking, unit/database suites, native multi-connection races and production build. Save real output. Investigate skips and failures; do not mark a skipped live test as passed.
- [ ] On a freshly migrated staging project, run Supabase Auth/HTTP tests, pgTAP and the real Playwright hiring journey with actual private Storage and ClamAV. Test email confirmation/recovery, MFA, organization review, candidate support/appeals and cross-tenant denials.
- [ ] Test all migrations 001–010 on a representative staging snapshot, including existing closed assessment previews, immutable evidence and existing users. Regenerate and compare database types. Apply additive migrations before the matching web/worker release.
- [ ] Take a restorable pre-migration backup and verify restore time. Document rollback/forward-fix steps; rolling back the web build must not delete audit history or grades. Never use `supabase db reset` on production.

## Identity, isolation and database

- [ ] Configure trusted HTTPS APP_URL, exact Auth redirect allowlists, confirmation enabled, production SMTP, password policy, session limits and Auth abuse/rate controls. Verify PKCE, HttpOnly/Secure/SameSite cookies and recovery behavior.
- [ ] Provision least-privilege platform operators through the trusted process, require verified MFA/AAL2, and verify independent reviewer checks. Test suspension/reactivation and ensure revoked sessions do not revive.
- [ ] Verify grants, RLS and fixed-search-path SECURITY DEFINER functions against ordinary roles, not only database owner/service role. Recheck candidate records, CVs, internal notes, assessment keys, drafts, hidden jobs, reports and revoked assignments.
- [ ] Confirm private schemas are not exposed by the Data API. Restrict database/network/worker credentials, rotate them through a tested procedure and prevent Auth administration keys from entering NEXT_PUBLIC settings.
- [ ] Inspect query plans and indexes with representative tenant sizes. Load test org lock contention, analytics, queues, search pagination, autosave, quotas and worker lag. Set statement/resource limits and connection-pool budgets.

## Documents, monitoring and accessibility

- [ ] Keep CV/verification buckets private with bounded MIME/size and overwrite denial. Use a private updated ClamAV daemon, encrypted/unscannable-file rejection policy, fail-closed timeouts, quarantine retention and bounded scanner resources.
- [ ] Upload malformed, oversized, spoofed, infected and unscannable fixtures; confirm they cannot become a current CV, application attachment or download. Test replacement snapshots and withdrawal/revoked recruiter download access.
- [ ] Verify attachment/no-store/nosniff/sandbox headers and authorized downloads. Avoid permanent signed/public URLs; control caches and backups containing CVs.
- [ ] Review candidate integrity disclosure, support/accommodation process and retention notices. Browser events must not be treated as proof of cheating or trigger automatic rejection. SEB is only an interface boundary unless separately implemented and validated.
- [ ] Complete keyboard, focus, mobile viewport, screen-reader, fullscreen-unavailable and network interruption testing. Confirm accessible loading/error/retry states and that the server timer remains authoritative.

## Scheduling, notifications and operations

- [ ] Configure and supervise assessment expiry (Cron or isolated worker). Test abandoned/expired attempts, duplicate submissions, worker interruption, review holds and retakes. Alert on ungraded/expired backlog and repeated engine errors.
- [ ] Keep transactional email disabled until opt-in preference flows and verified sender/domain are tested in staging. Configure server-only RESEND_API_KEY/EMAIL_FROM and provider SPF/DKIM/DMARC. Auth SMTP remains a separate channel.
- [ ] Run the notification worker under a service manager with restricted secrets. Test permission revocation/opt-out at claim, leases, backoff, provider failures, duplicate requests and 23-hour dead-letter expiry. Keep origin/template/sender stable across retries.
- [ ] Verify actual receipt with synthetic staging recipients. Provider acceptance is not inbox delivery. Define bounce/complaint handling and suppression procedures before relying on email operationally; webhooks are not shipped by this slice.
- [ ] Alert on dead email records, queue age, scan failures, authorization denials and moderation/verification backlog without logging private payloads. Assign independent moderation and appeal reviewers and response targets.
- [ ] Configure upstream WAF/proxy/public search limits and Supabase Auth/Storage quotas. Fixed-minute database quotas do not protect every failed direct RPC or anonymous request. Trust forwarded IPs only from the configured proxy.
- [ ] Define a trusted bounded maintenance schedule for old rate counters, revoked-session tombstones and retained records. Agree retention/erasure/archival policy for PII, documents, observations, reports and immutable audits, including backups. No automated retention worker is claimed.
- [ ] Perform a backup restore drill, establish RPO/RTO and an incident/key-rotation runbook. Verify sanitized logs and access to restricted administration reasons.

## Cutover and post-deployment

- [ ] Deploy to staging and execute the complete workflow with synthetic accounts: verified company → publish job → scan CV → apply → disclosed assessment → objective/manual/integrity review → shortlist → interview → offer → hired → notification.
- [ ] Explicitly review remaining failed/skipped/live/manual gates and obtain release ownership acceptance before enabling production traffic. Keep a canary/rollback window and monitor error rates, lock waits, queue lag and authorization failures.
- [ ] After cutover, verify anonymous discovery/pagination, hidden-job denial, independent admin decisions, current tenant analytics, secure CV downloads, expiry processing and real notifications. Revoke synthetic access and remove test artifacts through the agreed retention procedure.
