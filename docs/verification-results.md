# Local verification record — 2026-10-28

This records commands actually run for the administration/reliability slice. It is not a production certification or a claim that a live Supabase, scanner or email provider was tested.

| Command | Observed result |
| --- | --- |
| `npm run db:types:embedded` | Passed; generated the public contract from all applied migrations |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; optimized Next.js build and route type checking completed |
| `npm test` | 119 passed; 15 skipped in the default run |
| `npm run test:races` | 11 passed using independent native PostgreSQL connections |
| `npm run test:e2e` | 4 Chromium browser smoke tests passed; 1 full live hiring test skipped |
| `npm run test:e2e:hiring` | Unavailable/exit 1 at local-stack precheck; no live hiring success claimed |

The 15 default Vitest skips are the 11 native race tests run separately plus four opt-in live Supabase Auth/HTTP tests. The Playwright skip is the real Supabase/Storage/ClamAV browser hiring journey. A separate migration-backed hiring-journey test passed in `npm test`, using synthetic Auth and scan fixtures; it is not equivalent to the skipped live browser journey.

Coverage includes RLS/tenant denials, current MFA/role checks, moderation/application races, reporter privacy, session revocation/reactivation, scoped analytics/review queues, append-only records, quota races, email lease/retry/opt-out behavior, bounded inputs, PDF prefilters, public job keyset ties and the existing assessment engine/integrity suites. Browser smoke tests exercise public forms, anonymous private-route denial, forged mutation origins, narrow viewport and keyboard focus.

Remaining release gates include full live Supabase Auth/PostgREST/Storage/pgTAP and real ClamAV hiring validation; staging provider acceptance/inbox/bounce handling; full assistive-technology/device testing; representative load and query-plan review; retention/erasure operations; backup restore, incident and deployment rollback drills. Optional email delivery remains disabled until explicitly configured. Follow [administration setup](administration-reliability.md) and the [production checklist](production-deployment-checklist.md).
