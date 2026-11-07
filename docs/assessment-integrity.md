# Disclosed assessment activity monitoring

Migration `202610280008_integrity_monitoring.sql` adds an observational module to the existing execution engine. Apply all migrations before deploying and regenerate types with `npm run db:types` (or `npm run db:types:embedded` without Docker). No new credentials, media permissions, third-party telemetry services or worker processes are required. The assessment expiry scheduler remains required for abandoned attempts.

## Candidate experience and disclosure

The application page shows the complete activity disclosure before starting a new attempt or retake. A required checkbox submits the version `browser-integrity-v1`; the database rejects starts without this version and records a server-timestamped acknowledgment in the same transaction. This is a receipt of the disclosure, not a claim that someone read or understood it. Previously active attempts get an explicit disclosure screen on resume; acknowledgment is recorded when monitoring first reaches the server. The existing timer continues while resuming or reading the screen.

The player starts collection only after the candidate presses “I understand — continue to assessment.” It offers optional fullscreen through a separate button backed by `requestFullscreen()`. There is no automatic fullscreen request, keyboard lock, forced reentry or penalty for unavailable/declined fullscreen. Escape and assistive tools remain available. Focus/fullscreen changes produce a polite, nonblocking warning; events within two seconds share one local warning. Repeated changes request context, never label the candidate a cheater. Warning counts reset on a page reload; raw received observations remain append-only.

Collected observations are:

| Signal | Standard browser observation |
| --- | --- |
| Document visibility | `visibilitychange`, visible/hidden |
| Fullscreen | `fullscreenchange`, entered/exited; unavailable/declined request |
| Window focus | Window `blur` and `focus` |
| Network | Window `offline`/`online`; failed fetch connections and later recovery |
| Navigation | Page `pagehide`/persisted `pageshow`, `popstate`, departures through links, active player unmount |
| Overlapping sessions | Server notices another unreleased document heartbeat within 45 seconds |

Each browser observation contains only a random event UUID, an allowlisted type and browser-reported timestamp. The server derives organization/attempt ownership, adds its own receipt timestamp, sequence and source, and stores a random per-document session UUID. It does not accept client classifications, receipt times, arbitrary metadata or server event types. We collect no other-page URLs, IP/device fingerprints, clipboard, keystrokes, screenshots, webcam, audio or biometric data through this module. Standard hosting/Auth access logs are separate infrastructure controls and should follow their own retention policy.

Candidates can open their own received event timeline from the player or closed results, with filtering and pagination. Internal recruiter review notes remain private. The existing issue form handles support/context during an attempt; closed results also offer a support report. These explicit reports request human integrity review and may pause automatic shortlisting; they do not extend time. Existing versioned appeal windows, one-appeal limits and employer resolution workflows remain in effect. Passing applicants can still provide context through support; browser observations alone never change a passing result.

## Interruption, navigation and session handling

Answers stay in memory until autosave succeeds. Online/recovery signals retry current valid responses with the existing optimistic revisions and server deadline checks. The server does not pause or extend time during disconnections. Device sleep, closing/reloading the tab or a browser crash can lose unsaved answers; only committed responses count at expiry. A revision conflict still requires reloading and resolving the saved state; monitoring does not bypass that protection.

Activity observations queue in memory, with stable UUIDs across retries. Normal delivery uses batches and a 15-second heartbeat. Departures/hidden documents use best-effort same-origin `fetch(..., {keepalive:true})`; an in-flight heartbeat and departure can deliver the same event twice, safely deduplicated by the database. Successful submission suppresses subsequent navigation observations. Persisted page restores request reconnection; released document sessions cannot be revived by late requests. Collection is not guaranteed on unload, mobile process termination, browser suspension or network loss. The buffer is not a durable outbox and does not persist answer content or telemetry to browser storage.

Limits: 20 observations per request, 120 new browser observations per attempt/minute, 4,000 stored observations per attempt, 64 document sessions per attempt and a 200-item local buffer. Overflow has an explicit event where capacity permits. Replayed identical IDs remain accepted at the rate limit; reusing an ID for changed data fails. Session overlap events are generated at most once per document session/minute. Collection stops on cancellation, and the server accepts delayed events for up to 24 hours after closure/deadline. Delayed observations do not regrade or change result history. A rate/authorization rejection is shown as limited activity delivery, not falsely recorded as a network outage. Answer saving remains independent.

The overlap signal means recent document sessions, not proven simultaneous people. Reloads, retained pages, background timer throttling, delayed unloads and reconnects can produce false positives or false negatives. Heartbeat fields are mutable coordination state; event records and disclosure acknowledgments are immutable. A hostile browser can suppress, falsify or replay permitted browser observations and can create extra document identities. A client UUID is not a trusted device/session attestation.

## Recruiter review and authorization

Open an applicant’s “Review browser activity” link at `/org/{org}/assessment-integrity/{attempt}`. The dashboard works during active attempts without exposing responses or answer keys. It shows server versus browser sources/times, disclosure acknowledgment, filters, paginated activity and recent append-only reviews. Current organization/job/application permissions are checked in the server service, SQL procedures and RLS. Revoked and cross-tenant reviewers cannot read or append reviews. Candidates see only their own observations and cannot write recruiter reviews. Direct event/session/review writes are denied; only narrow authenticated procedures derive tenant ownership.

Review outcomes are “no conclusion,” “context explained” and “follow up.” A rationale is required, and each review creates an audit record. No browser event or contextual review automatically creates a confirmed integrity flag, changes a score, pauses shortlisting or rejects an applicant. Formal reports/holds continue through the existing explicit integrity controls, with evidence and candidate context. There is deliberately no “confirmed cheating from visibility” classification.

Tables: `assessment_integrity_acknowledgements`, `assessment_monitor_sessions`, `assessment_integrity_events`, `assessment_monitor_reviews`. Tenant foreign keys protect parent/session relations. All use RLS; events, reviews and acknowledgments also have immutable-row triggers. Access and erasure/archival remain subject to operational retention requirements; automated retention is not implemented. Before production, define the collection/retention notice and authorized archival/erasure procedure for your deployment.

## API and optional exam environment boundary

`POST /api/assessment-attempts` now requires `{applicationId, monitoringDisclosure:"browser-integrity-v1"}`. Direct SQL starts require `p_disclosure` too; the old internal start implementation is private and revoked from ordinary roles.

`POST /api/assessment-attempts/{attempt}/integrity` accepts:

```json
{"sessionId":"DOCUMENT_UUID","disclosure":"browser-integrity-v1","events":[{"id":"EVENT_UUID","kind":"window_blur","observedAt":"2026-10-28T10:00:00.000Z"}],"release":false}
```

The response returns accepted event IDs, overlap indication, closure state and server time. Strict Zod and independent SQL checks reject unknown fields and forged server kinds. Existing session/origin/JSON-size guards apply. The employer `GET /api/org/{org}/assessment-integrity/{attempt}` accepts `before` sequence and `kind` filters. Its PATCH accepts `{outcome,rationale}`. All private responses use no-store caching. No endpoint receives third-party alerts or unauthenticated telemetry.

`src/modules/exam-environments/contracts.ts` defines the server-only `ExamEnvironmentAdapter` for a separate future Safe Exam Browser module. No adapter is registered, SEB is not required and no current request is treated as attested. A future adapter must validate official request/config-key proofs using versioned server-held configuration, canonical request URLs and a reviewed proxy/header trust boundary; neither User-Agent nor a client-supplied boolean is proof. It also needs deployment compatibility testing, an accessible alternative, configuration rotation, privacy disclosure and its own tests. This interface ships no lockdown, webcam or biometric functionality.

## Limitations and verification

Browser monitoring cannot prevent all application switching, identify what another app displays, detect another device or establish whether external AI was used. Visibility may change because of a system prompt, screen lock or assistive software. Blur need not mean hidden content; online status need not mean the server is reachable. Navigation observations cannot reliably distinguish intent. Receipt time is authoritative for receipt, not the original action; browser times are untrusted. Missing activity and session overlap are ambiguous. Reviewers must consider context and published assessment rules, without automatic rejection based solely on browser activity.

`npm test` tests actual-role RLS/grants, disclosure requirements, append-only triggers, timestamps, replay/tampering, bounded ingestion, revoked access, contextual reviews and isolation from grading/shortlisting. Standard `EventTarget` tests exercise visibility/fullscreen/focus/network/lifecycle signals, warning grouping, listener cleanup, bounded buffers and reconnection. `npm run test:races` uses native PostgreSQL and independent transactions to verify simultaneous document registration and duplicate heartbeat/keepalive delivery, alongside engine races. Run lint/typecheck/build too. These tests do not replace manual browser/device/fullscreen/assistive-technology validation, load testing or live Supabase integration; those remain deployment gates.

Primary references: [HTML visibility and focus](https://html.spec.whatwg.org/multipage/interaction.html), [Fullscreen standard](https://fullscreen.spec.whatwg.org/), [HTML network-state signals](https://html.spec.whatwg.org/multipage/system-state.html#navigator.online), [page lifecycle guidance](https://developer.chrome.com/docs/web-platform/page-lifecycle-api), [Safe Exam Browser integration](https://safeexambrowser.org/developer/seb-integration.html).
