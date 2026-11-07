# Local CV antivirus configuration — 2026-10-29

## Existing integration and missing settings

The application already used ClamAV TCP `INSTREAM` in `src/modules/documents/server/scan.ts`. Normal CV operations use the authenticated user's Supabase client. A separate `server-only` client in `src/server/document-scanner.ts` can call the existing `finish_cv_scan` procedure to commit an antivirus result. Downloads never use this privileged client.

Inspection found no running ClamAV container, and these settings were missing from `.env.local`: `CLAMAV_HOST`, `CLAMAV_PORT` and `SUPABASE_SERVICE_ROLE_KEY`. The already-running assessment worker had its own process environment; that does not configure the Next.js backend.

No PostgreSQL migrations, SQL functions, RLS policies, grants, bucket definitions or existing data were changed. No Supabase reset/seed command was run. No existing user files or objects were deleted. Test documents were constructed only in memory, never uploaded to live Storage or inserted into the live database. Existing upload/quarantine and application/CV version rules remain in place.

## Configuration change record

| File / resource | Change |
| --- | --- |
| `compose.clamav.yml` | New independent `jobwalay-antivirus` Compose project; does not manage or restart Supabase |
| `jobwalay-clamav` | New official ClamAV container with clamd and FreshClam enabled, restart policy and health check |
| `jobwalay-antivirus_clamav-signatures` | New persistent Docker volume containing antivirus definitions only; no application directories mounted |
| `.env.local` | Appended scanner host/port/timeout, the existing local Supabase server-only service key, and a random development diagnostic token; existing APP_URL and public settings preserved |
| `.env.example` | Documented the bounded scan timeout and optional development diagnostic token; no real credentials included |
| `src/server/document-scanner.ts` | Validates and supplies the scan timeout; existing isolated result-commit client retained |
| `src/modules/documents/server/scan.ts` | Added strict file metadata/extension validation, PING/VERSION support, bounded writes and immediate close/error handling; only exact successful scan replies are accepted |
| `src/modules/documents/server/service.ts` | Runs readiness PING before reserving/uploading, checks actual content size, and preserves scan-gated quarantine behavior |
| `src/app/candidate/cv/page.tsx` | Explicitly selects Node.js runtime for the server upload action; existing UI/features retained |
| `src/app/api/internal/clamav/route.ts` and diagnostic helpers | Added a secret-protected development-only fixed-fixture check in the actual Next.js Node backend; it performs no persistence operations |
| `package.json` and new setup/check/test scripts | Added `clamav:configure`, `clamav:check` and `test:clamav`; normal app commands retained |
| `vitest.config.ts` | Limited concurrent test workers to two to prevent local PostgreSQL WASM suites exhausting this 8-GB host while Supabase, Next.js and ClamAV are running; no tests disabled |
| New scanner/upload security tests | Added mock-persistence upload tests, real-engine memory-fixture tests, protocol/configuration tests and diagnostic access tests |

The official `clamav/clamav:stable` image resolved to this pinned digest:

```text
clamav/clamav@sha256:bda39705e291105049c3936e2803ac90b955172af8030f94f05dce1252df6c6d
```

At verification, the container ran **ClamAV 1.5.4**, loaded signature version **28167**, and reported Docker health `healthy`. FreshClam updated the preloaded definitions from 28164 to 28167. The definition timestamp reported by the engine was 2026-10-28 06:24:17 UTC. Review/refresh the pinned image for future engine/security updates; a pinned digest does not automatically track newer images.

## Network and server environment

The running Next.js server is a Windows-host Node process at `http://localhost:3001`, not a container. Therefore it connects to the Docker-published **127.0.0.1:3310**. Docker inspection confirmed the daemon is published only on loopback, not `0.0.0.0`. Clamd TCP has no authentication/TLS and must remain on a trusted local/private network.

The new local settings are:

```dotenv
CLAMAV_HOST=127.0.0.1
CLAMAV_PORT=3310
CLAMAV_SCAN_TIMEOUT_MS=30000
SUPABASE_SERVICE_ROLE_KEY=<existing local service-role key, server only>
CLAMAV_DIAGNOSTIC_TOKEN=<random 64-character operator token, server only>
```

Secret values are not printed or stored in documentation. `.env.local` is ignored by Git. Neither secret uses a `NEXT_PUBLIC_` prefix or is passed to client components. `scripts/configure-local-clamav.mjs` reads local CLI status in memory, verifies the configured API URL belongs to that loopback project, preserves nonempty values and refuses to overwrite a different service credential. It writes environment settings only, not database state. New variables are read when Next reloads `.env.local`; restart the app if its process manager does not reload changed environment settings.

If the backend is later containerized, `127.0.0.1` would mean the backend container itself. Attach it and ClamAV to a private shared network and set `CLAMAV_HOST` to the service name there. Do not expose clamd publicly to compensate for a networking error.

## Antivirus service limits

The independent Compose service sets a 4-GiB memory ceiling, two CPUs, two scan threads, queue length four, bounded Docker logs, and persistent definition storage. It uses:

- `StreamMaxLength` / `MaxFileSize`: 12 MiB, above the app's strict 10-MiB input cap.
- `MaxScanSize`: 50 MiB, `MaxFiles`: 1000 and `MaxRecursion`: 16 for nested content.
- `MaxScanTime`: 20 seconds; the application socket deadline is 30 seconds locally, validated to 1–45 seconds.
- `AlertEncrypted=yes` and `AlertExceedsMax=yes`, so encrypted/unscannable-limit alerts do not become a clean result.
- `FailIfCvdOlderThan=7`, which refuses daemon startup with definitions older than seven days; operators must still monitor ongoing update failures.
- `ConcurrentDatabaseReload=no` to bound reload memory on this host. Scans can temporarily block/fail closed during signature reload; retry after it finishes.
- FreshClam enabled, checking 12 times daily. Antivirus scanning and definition updates were not disabled.

These effective values were verified using `clamconf -n`, not assumed from the Compose file alone.

## Upload and download safety

1. Require an authenticated/current user and a nonempty PDF `File`, at most 10 MiB.
2. Require MIME `application/pdf`, a `.pdf` extension (case-insensitive), a nonempty base filename and bounded name length. Reject paths, control characters, executable disguises such as `.exe.pdf`, and names ending `.pdf.exe`.
3. Validate PDF header/final EOF and actual byte length. These checks reject simple spoofing/truncation/appended payloads, but are not a full PDF parser or content-disarm system.
4. Require valid scanner/result-commit configuration and successful clamd PING before calling `begin_cv_upload`. A disconnected scanner cannot create a new reservation/object through this path.
5. Reserve the existing immutable owner/document path and upload with `upsert:false` into the private `candidate-cvs` quarantine. Its state remains `pending`; existing RLS denies download and application/current-CV use.
6. Stream the exact bytes in length-prefixed chunks, at most 64 KiB each, followed by a zero terminator. Only `stream: OK` releases a clean result. Infection/heuristic findings return `rejected`; unknown, incomplete, oversized, disconnected and timed-out responses fail closed.
7. Commit the existing hash-bound result through `finish_cv_scan`. Only the service role can call it. A failed commit leaves the document unavailable; the app never reports upload success on a commit error.
8. Rejected/error uploads do not replace the previous clean CV. Existing application attachments retain their original versions. No deletion/overwrite cleanup was introduced.

Readiness is a preflight, not a guarantee the daemon stays available. If scanning fails after quarantine upload, the app records an unavailable/error state; if even that commit fails, the pending state remains blocked. The existing download procedure and Storage RLS require `clean` and current user/application authorization. Existing attachment, no-store, nosniff and sandbox response headers are preserved.

## Commands

From the repository root, with Docker available:

```powershell
docker compose -f compose.clamav.yml up -d
npm.cmd run clamav:configure
npm.cmd run clamav:check
npm.cmd run test:clamav
```

On this Windows machine, the Docker executable is at `C:\Program Files\Docker\Docker\resources\bin\docker.exe` if it is absent from PATH. Startup may take minutes to load/update definitions. Do not mark uploads clean while it initializes. Use `docker compose -f compose.clamav.yml ps` and `docker logs --tail 30 jobwalay-clamav` to inspect readiness. Keep the signature volume. Do not run `down -v`, database reset, deletion or pruning commands as part of scanner setup.

`clamav:check` calls a fixed-fixture diagnostic in the running Next.js process, proving the actual backend runtime/network rather than only a test client inside Docker. It requires the operator token, loopback URL, matching Origin and development mode; it always returns 404 in production. It accepts no arbitrary files, checks clean/EICAR/raw-EICAR responses, exposes no credentials, and never calls `scanner.finish`. The optional diagnostic can be disabled by emptying `CLAMAV_DIAGNOSTIC_TOKEN`; normal scanning does not depend on this token.

EICAR is an intentionally harmless antivirus test marker, not live malware. Test bytes are decoded in memory. The PDF infection fixture embeds that marker as a PDF attachment so PDF validation passes and the real engine must reject the content. Neither fixture is written to disk or the live database/Storage.

## Verification and boundaries

- `npm run test:clamav`: **29 passed** across six suites, including three real-engine tests using the configured local TCP connection.
- Actual backend diagnostic: **HTTP 200**, Node.js runtime, clean PDF `clean`, EICAR PDF `rejected`, raw EICAR `rejected`, no persistence operations.
- During a definition reload, the backend diagnostic returned **HTTP 503**, `uploads: blocked`; after reload it passed again on signature version 28167. This was not treated as a successful scan.
- Full isolated regression suite: **141 passed**, 18 skipped. The skips are 11 optional native database races, four live Supabase/Auth cases and three real ClamAV cases; the latter three ran and passed separately in `test:clamav`.
- Lint, TypeScript checking and the optimized production build passed. All **four browser smoke tests** passed against the existing running application. A client-asset scan found **zero occurrences** of the actual service key and diagnostic token in `.next/static`.
- The first unrestricted full-suite run exhausted host memory with many parallel PostgreSQL WASM workers. Two-worker isolation resolved it. No scanner bypass or test assertion removal was used.

The upload-orchestration tests deliberately mock persistence to respect the instruction not to modify the live database. Existing RLS/quarantine tests use an isolated in-memory migrated database. No new live user, CV object, scan metadata, audit entry or application record was created by this verification. A live authenticated upload/download round trip would create records and was therefore not performed. Antivirus does not guarantee every malicious PDF can be detected; keep signatures and engine current and monitor resource/update failures.

References: [official Docker configuration](https://docs.clamav.net/manual/Installing/Docker.html), [ClamAV image environment configuration](https://github.com/Cisco-Talos/clamav-docker/blob/main/clamav/README-alpine.md), [INSTREAM protocol](https://docs.clamav.net/manual/Usage/ClamdProtocol.html), [daemon settings](https://github.com/Cisco-Talos/clamav/blob/main/etc/clamd.conf.sample).
