# Requirements

Status: proposed scope and acceptance criteria. Implementation follows the phased plan.

## Actors and permissions

An account can be both a candidate and a member of multiple organizations. Candidate is a capability, not an exclusive global role.

| Actor | Capabilities |
| --- | --- |
| Visitor | Browse published jobs, approved companies, and explicitly public candidate fields |
| Candidate | Manage own profile and CVs, apply, withdraw, complete assigned assessments, inspect released results |
| Organization owner | Manage organization, admins, invitations, jobs, recruiting; transfer ownership atomically |
| Organization admin | Manage team except ownership, jobs, assessments, and recruiting |
| Recruiter | Manage jobs and assigned hiring workflows; view applicants within granted job scope |
| Reviewer | View assigned applications, record reviews; no team administration or answer-key access |
| Platform verifier | Review verification evidence and decisions using a dedicated audited capability |
| Platform administrator | Moderate and suspend within assigned capabilities; no implicit unrestricted CV access |

Roles map to explicit permissions in code and SQL. Job assignments narrow recruiter/reviewer access; owners/admins have organization-wide hiring access. A suspended organization loses publishing and recruiting write privileges; candidates retain their own records and withdrawal rights. Suspension does not publish private information.

## Functional requirements

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| ID-01 | Email authentication, verification, recovery, logout and account status | Expired/invalid sessions denied at server and database boundaries; recovery redirects allowlisted |
| ORG-01 | Create organizations, invite members, switch active organization | Invite binds verified recipient, role and expiry; reuse fails; forged tenant IDs fail |
| ORG-02 | Verify organization evidence before first job publication | Only authorized platform verification can approve; decision and reason audited |
| PROF-01 | Candidate headline, bio, experience, education, skills and visibility | Public projection excludes contact, CV, applications and assessments; profile defaults private |
| CO-01 | Company profile, logo, description and published jobs | Draft/verification documents never appear publicly |
| JOB-01 | Draft, publish, close and archive jobs with location, work mode, employment type and optional salary | Publication requires approved active organization; salary currency and min/max validated |
| JOB-02 | Search, filter, paginate and save published jobs | Closed/private drafts excluded; bounded indexed queries; stable pagination |
| APP-01 | Apply once per job, choosing an approved CV and agreeing to sharing | Duplicate concurrent requests produce one application; CV version and profile snapshot preserved |
| ATS-01 | Assigned hiring team, stages, notes and transition history | Only eligible team members read private notes; candidate sees agreed public status only |
| ATS-02 | Withdraw, reject, shortlist and progress applications | Allowed transition graph enforced atomically; stale updates conflict; every change audited |
| ASM-01 | Author and publish immutable assessments with rubric and time limit | Later edits create a new version and never change active attempts |
| ASM-02 | Invite, start, autosave, resume and submit attempts | Server deadline is authoritative; duplicate submission is safe; concurrent late saves rejected |
| GRD-01 | Automatically grade objective question types on server | No key or score-write ability reaches candidates; deterministic fixture scores match expected values |
| GRD-02 | Versioned automatic shortlisting with recruiter review | Evaluation requires all configured assessments; stores rule version, inputs, result and reason; retries do not duplicate transitions |
| DOC-01 | Private CV upload, scanning, authorized download and deletion | Quarantined files unavailable; unrelated recruiters cannot access CVs even with object paths |
| ADM-01 | Verification queue, moderation and scoped administration | Role cannot be self-assigned; privileged actions require reason and audit event |
| AUD-01 | Durable audit for important mutations and sensitive downloads | Mutation and audit commit together; normal users cannot edit/delete audit rows |
| NTF-01 | Reliable invitation and workflow notifications | Transactional enqueue, retry/backoff, delivery deduplication; no private content in message body |

## Workflow decisions

Jobs: `draft -> published -> closed -> archived`; reopening requires valid organization and a recorded action. Applications start `submitted`; organization-defined stages have semantic types `submitted`, `screening`, `assessment`, `interview`, `offer`, `hired`, `rejected`. Withdrawal is candidate-controlled and terminal. Rejection and hiring are terminal unless an authorized, reasoned reopen event occurs. Stage configuration cannot invalidate existing applications.

Implemented attempt states: `in_progress -> submitted | expired | cancelled`. A separate result records `passed`, `failed`, `manual_review`, `integrity_review` or `appeal_review`, with immutable revision history. Closure and grading commit together; transient worker failures roll back and remain retryable. Database-clock deadlines finalize saved responses; missing responses earn zero. Nonempty written answers require review before a final score. Candidates receive aggregate results after closure, never answer keys. Current authorized employers can inspect detailed closed results. See [Assessment execution](assessment-execution.md) for frozen retake/appeal policies, notifications and scheduling.

Shortlisting initially uses a published minimum score and required-completion rule, not inferred personal attributes. A passing evaluation may move an eligible application into a shortlist stage. It never automatically rejects or hires. Recruiters may override with a recorded reason; later retries cannot overwrite that override.

## Quality requirements and launch gates

- Aim for WCAG 2.2 AA: semantic HTML, keyboard access, visible focus, labelled fields/errors, screen-reader status updates and sufficient contrast. Assessments support approved extra-time accommodations captured before start. Verify at 320px and desktop widths; provide a list alternative to drag-only pipelines.
- All inputs have Zod schemas, length/range limits and safe output rendering; SQL constraints protect invariants independently.
- Cross-organization isolation must pass adversarial database and HTTP tests, including guessed IDs and revoked memberships.
- Proposed performance targets, to validate on representative staging data: p95 public listing response under 1 second, authenticated mutation under 2 seconds excluding asynchronous work; 95% of ordinary objective grading completes within 60 seconds. Set load/concurrency envelope before treating these as production SLOs.
- Recovery, retention periods, geographic hosting, hiring-review policy, peak assessment concurrency, email provider and worker hosting need product/operational decisions before launch. Record owners and decisions; do not claim regulatory compliance from this architecture alone.
- Initial boundaries exclude a social feed, connections, chat, billing, AI ranking, remote code execution, webcam proctoring and external ATS synchronization. Extension contracts should permit later additions.
