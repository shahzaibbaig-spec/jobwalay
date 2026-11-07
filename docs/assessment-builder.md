# Assessment builder and question bank

## Authoring workflow

Open `/org/{organizationId}/assessments` to create a reusable assessment or link one to a managed job. Owners/admins manage all organization assessments. Recruiters manage assessments for assigned jobs, or reusable assessments they created. Revoked membership/job assignment removes access. Candidate profile capability does not confer any authoring permission.

The builder at `/org/{id}/assessments/{assessmentId}` supports duration (1–240 minutes), passing percentage (0–100), maximum attempts (1–10), an optional deadline and candidate instructions. Choose fixed bank questions with individual point weights/positions or configure draws from approved pools with a weight per drawn question. Deadlines are entered/displayed in Pakistan time and stored as timestamptz. Publication permits 1–200 total questions and requires sufficient pool capacity. Selected pools/fixed questions must be disjoint, preventing duplicate or unsatisfiable draws.

`/org/{id}/questions` manages the bank, with category and difficulty filters. Supported question types:

| Type | Private answer structure | Versioned grading contract |
| --- | --- | --- |
| single_choice | One stable correct option ID | exact-set-v1 |
| multiple_select | A nonempty unique set of correct option IDs | exact-set-v1; all-or-nothing |
| numerical | Finite value and nonnegative absolute tolerance | absolute-tolerance-v1 |
| written | Manual-review rubric | manual-review-v1; no automatic pass |

Options have stable IDs independent of display order. Numeric values/tolerances and option/key consistency are validated in both Zod and PostgreSQL. Scores are positive fixed-decimal points; weights belong to each assessment version rather than mutating the shared bank question.

Saving a question revision creates a new immutable bank row linked to its source. Owners/admins approve bank questions and question pools; recruiters may assemble draft pools from approved question revisions. Approved pools are sealed. Changing a pool means creating and approving another pool, then selecting it in a draft assessment. Bank key/content updates and approved pool changes are protected against accidental privileged writes as well as ordinary clients.

## Preview and versioning

The candidate-facing preview route shows instructions, settings, weighted fixed prompts/options and random-draw rules without correct answers or written rubrics. Pool selection is resolved when an attempt starts, not in the preview. Published content is immutable. “Create new draft version” copies settings, question references/weights and pool rules into the next version. Only one draft exists per assessment. The previous published version remains intact.

Publishing a job-linked assessment attaches that exact version to its managed job and increments the job version. It cannot modify an archived job. An application's assigned version is bound at submission; later job/assessment edits do not change that assignment. Existing catalog seed entries predate the builder and are not attempt-ready until revised with real questions and published through the builder.

Correct answers live in non-exposed `private.bank_answer_keys`, never in bank-question option JSON, author previews, candidate question DTOs or public/client fixtures. Only the question's creator or organization owners/admins can retrieve an answer through a checked author RPC on the private employer page. Other recruiters may reuse bank questions without receiving their keys. Ordinary users have no SELECT/INSERT/UPDATE grants on either key table. Candidate and author endpoints return explicit, separate DTOs; cookie-authenticated responses are private/no-store.

## Frozen attempt contract

`start_assessment_attempt` verifies candidate ownership of the application, current account/session, active organization, bound published/builder-ready version, assessment deadline and per-candidate/version attempt limit. It serializes through the organization/application and returns the same active attempt on retry. The server fixes duration/deadline, passing threshold, attempt number and grading contract, randomly chooses pool questions and independently shuffles option ordering.

The safe question payload is copied to `assessment_attempt_questions`. Corresponding keys/grader versions are copied to `private.attempt_answer_keys`. Both copies and attempt settings are immutable. Candidates can only read their own in-progress questions before the database deadline; withdrawal cancels active attempts and revokes question access. Expired/cancelled attempts still count against the configured attempt limit, preventing reapplication from resetting it.

The candidate route now supports timed delivery, autosave and transactional submission. Server grading, review, shortlisting, configurable retake/appeal policies and expiry scheduling are described in [Assessment execution](assessment-execution.md). Published policy edits require a new version; new drafts copy all policies. Keys are never included in candidate payloads.

## HTTP API

All routes require the same verified, onboarded cookie session and server/database permissions as the UI. Mutation requests require an Origin equal to APP_URL's origin and Content-Type application/json; JSON bodies are bounded to 128 KiB. Server Actions call the same services. No service credential is needed for assessment authoring/delivery.

| Method/path | Operation |
| --- | --- |
| POST /api/org/{org}/assessments | `{title, jobId?}` → assessment ID and initial draft |
| GET /api/org/{org}/assessments/{id}?version={uuid} | Authorized settings/questions/pool rules preview; no answer keys |
| PATCH /api/org/{org}/assessments/{id} | Draft settings, question/pool change, publish or revise |
| POST /api/org/{org}/questions | Validated bank question plus private answer input → question ID |
| PATCH /api/org/{org}/questions/{id} | `{operation:"approve"}`; owner/admin only |
| POST /api/org/{org}/question-pools | `{name, questions:[uuid,...]}` → draft pool ID |
| PATCH /api/org/{org}/question-pools/{id} | `{operation:"approve"}`; owner/admin only |
| POST /api/assessment-attempts | `{applicationId, monitoringDisclosure:"browser-integrity-v1"}` → frozen own attempt ID |
| GET /api/assessment-attempts/{id} | Own safe attempt metadata and selected questions; never keys |

Example settings PATCH body (organization comes from the URL, not submitted authority):

```json
{"operation":"settings","versionId":"VERSION_UUID","revision":1,"duration_minutes":30,"passing_percentage":70,"max_attempts":2,"deadline":"","summary":"Read every question carefully."}
```

Other PATCH operations are `publish` (versionId/revision), `revise` (versionId), `question` (versionId/questionId/points/position/remove) and `pool` (versionId/poolId/count/points/remove). The form/API remove flag currently uses strings `"true"` / `"false"`. Revised drafts return versionId. Example bank question:

```json
{"kind":"single_choice","prompt":"Which value is even?","category":"Numeracy","difficulty":"easy","options":[{"id":"a","text":"3"},{"id":"b","text":"4"}],"answer":{"correct_ids":["b"]}}
```

For numerical questions send an empty options array and `{value:42,tolerance:0.5}`; for written questions use `{rubric:"Evaluate reasoning and evidence."}`. To create a revision, add sourceId. Do not log author request bodies, as they contain private answers.

## Tests and live gates

Tests apply real migrations under anon/authenticated roles and cover candidate/unassigned recruiter denial, key-table grants, author RPC permission, validation, pool approval/capacity/overlap, weighted publication, immutable versions, job binding, stable attempt selection/option permutations, frozen grading keys/settings, max attempts and withdrawal. Execution tests cover actual graders and review, while `npm run test:races` tests independent native PostgreSQL connections. Live Supabase/HTTP/browser validation remains a separate environment gate.
