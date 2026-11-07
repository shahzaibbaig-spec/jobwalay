# Contributor instructions

## Scope and baseline

This repository contains the authentication/authorization foundation and wider platform design. Read README.md and docs/architecture.md, docs/requirements.md, docs/database-design.md, docs/security.md and docs/implementation-plan.md before implementation. Build the next authorized vertical slice; do not implement all planned modules at once. Folder trees and schemas are proposals except where supported by current migrations and source.

No package manifest, lockfile or runtime existed at initial inspection on 2026-10-28. Never claim tests/builds passed without running available commands. During scaffolding resolve compatible stable packages, commit a single lockfile, and use installed-package APIs plus official documentation. Avoid deprecated Supabase Auth Helpers and legacy Next.js/Tailwind setup patterns.

## Boundaries

- Use Next.js App Router, strict TypeScript, Tailwind/shadcn/ui, Supabase Auth/PostgreSQL/Storage and Zod server validation.
- Keep route handlers and Server Actions thin. Put business authorization and orchestration in module server services, persistence in scoped repositories, UI in module components. Other modules use explicit contracts, not internal repositories.
- Default to Server Components. Mark secret-bearing code `server-only`; return minimal DTOs. Never expose service/secret credentials through NEXT_PUBLIC variables, props, logs or client imports.
- Use request-scoped authenticated Supabase clients for ordinary operations. Privileged clients are exceptional, isolated, justified and audited. Proxy/layout checks do not replace service authorization.

## Required invariants

- Authenticate and authorize every private read/mutation. Derive actor from verified identity and current database state; never trust a submitted role, tenant, score or owner.
- Every tenant-owned record carries organization_id. Use RLS and composite tenant foreign keys, including join tables. Deny by default and protect sensitive columns as well as rows.
- Candidate data is user-owned. Recruiter access requires an application-specific grant and current permitted job membership. Public profiles never include contact details, CV paths, applications or scores.
- Keep CVs and verification evidence in private storage, quarantine uploads, prevent overwrite, and authorize each download. Never store permanent public CV URLs.
- Grade on the server only. Keep keys in a non-exposed schema, publish immutable versions, use database time, freeze submissions and make workers idempotent. Never execute candidate code in application processes.
- Audit important actions transactionally. Avoid sensitive audit payloads. Ordinary users cannot alter grades, verification decisions, platform roles or audit history.
- Validate unknown input with Zod and enforce database invariants independently. Use atomic SQL operations for related writes, transitions and race-sensitive checks.
- Maintain accessible responsive UI with keyboard alternatives, focus visibility, labels and meaningful error states.

## Database and verification workflow

All schema, grants, policies and functions change through reviewed migrations under supabase/migrations. Use synthetic seeds. Regenerate database TypeScript types after schema changes. Review SECURITY DEFINER functions for explicit authorization, fixed search_path, qualified names and revoked default EXECUTE grants.

Use repository-provided install/lint/typecheck/build/test scripts once present; inspect package.json before choosing commands. For security-sensitive changes test actual anon/authenticated database roles, cross-tenant and same-tenant forged relations, revoked memberships, direct API calls and denied privileged-column writes. For assessments test concurrency, deadlines, retries and key leakage. Do not use a database-owner/service-role test as evidence that RLS works.

Report what changed, checks actually run and material limitations. Update design documents when implementation intentionally changes a contract. Keep changes focused; avoid unrelated dependencies, abstractions or speculative infrastructure.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
