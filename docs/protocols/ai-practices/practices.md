# Practices

- **Path:** `apps/practices`
- **Owner:** Experiences / Practices
- **Runtime:** Bun.serve, React 19 PWA, local IndexedDB; PostgreSQL only for organization review/publication
- **Tenant model:** personal v1; organization publishing is a separate role boundary

## Purpose and actors

Practices helps a learner exercise responsible judgment in bounded professional AI situations. Learners own private progress; human reviewers approve activity versions; publishers release reviewed content. Organization administrators cannot inspect nominative learner answers in v1.

## Journeys

1. **Practice offline:** learner installs/opens approved content, completes a scenario, receives sourced non-punitive feedback and stores progress locally.
2. **Review evidence:** learner inspects expected reasoning, sources, limitations and content version before retrying.
3. **Export/reset:** learner exports a portable progress bundle or deletes all local progress without account dependency.
4. **Publish activity:** reviewer validates source, licence, accessibility and safety evidence; publisher promotes the immutable reviewed version.

## Non-goals

- certification, employee ranking, discipline or automated HR decision ;
- nominative leaderboard or cross-learner comparison ;
- automatic publication of generated content ;
- general LMS, chat tutor or unrestricted prompt execution ;
- success inferred from completion time or model opinion.

## Domain protocol

**Commands:** `StartPracticeSession`, `SubmitActivityResponse`, `RecordSelfAssessment`, `ExportProgress`, `DeleteProgress`, `SubmitActivityForReview`, `ApproveActivityVersion`, `PublishActivityVersion`, `WithdrawActivityVersion`.

**Queries:** `ListPublishedActivities`, `GetActivityVersion`, `GetLocalProgress`, `GetFeedbackExplanation`, `GetReviewEvidence`.

**Events:** `PracticeSessionStarted`, `ActivityResponseSubmitted`, `FeedbackProduced`, `ProgressExported`, `ProgressDeleted`, `ActivityVersionApproved`, `ActivityVersionPublished`, `ActivityVersionWithdrawn`.

Activity versions are immutable after approval. Learner outcome is `in-progress | completed | stopped`; no universal pass/fail state exists unless an activity contract defines an objective deterministic invariant.

## Refusal matrix

| Code | Refusal |
| --- | --- |
| `practices.activity_unpublished` | requested activity/version is not published |
| `practices.response_schema_invalid` | answer does not satisfy bounded activity schema |
| `practices.feedback_unsourced` | feedback claim lacks approved source/rule |
| `practices.review_missing` | publication lacks attributable human approval |
| `practices.generated_content_unreviewed` | generated material is presented for publication |
| `practices.nominative_aggregate_forbidden` | request could identify an individual learner |
| `practices.version_stale` | mutation targets superseded local session revision |

Feedback failure preserves the learner response locally and offers retry/export; it never fabricates success.

## Data

Activity definitions and reviews are Git/contract authority. Personal sessions, answers and progress remain local by default and are retained until learner deletion/reset. Practices v1 stores no learner aggregate on the server. Raw answers and progress are never uploaded. Migration sources are approved archived activity briefs and public sources; historical learner databases are not imported.

## Authentication and authorization

Reading/installing public activities and local practice require no account. Organization publishing uses opaque browser sessions. Internal publication Biscuit facts include user, organization tenant and `role(user, role)`; resources are `activity/<id>/<version>` with `review` or `publish`. Learner role cannot publish; organization administrators cannot query individual progress. RLS protects review/publishing records.

## Runtime boundaries

TypeScript owns sessions, local persistence, bounded deterministic feedback rules and review workflow. Practices v1 has no Rust scoring implementation: no accepted activity currently demonstrates an invariant that justifies another runtime boundary. Free-text model grading stays advisory and human-reviewed. Model calls use a provider-neutral port and never receive unrelated progress.

## Accessibility and degraded mode

Activities require keyboard-only completion, explicit instructions, labels, error summaries, reduced motion and screen-reader announced feedback. Offline mode supports installed activities, local progress, export and delete. Missing model/provider uses deterministic hints or marks feedback unavailable; it cannot change recorded progress to success.

## Contracts

- Activity Definition v1 — `contracts/schemas/activity-definition.v1.schema.json` ;
- Activity Outcome v1 — `contracts/schemas/activity-outcome.v1.schema.json` ;
- Progress Export v1 — `contracts/schemas/practice-progress-export.v1.schema.json` ;
- publishing API — `contracts/openapi/practices.v1.yaml` ;
- reserved future scoring boundary, not implemented in v1 — `contracts/wit/practice-scoring-v1/world.wit`.

## Evidence

Unit tests cover state/revision, local deletion and feedback rule IDs. Contract fixtures cover malformed activities, unreviewed generated content and identifying aggregates. Browser tests cover install/offline/reload/export/delete, keyboard and screen readers. Security tests prove no raw answer network request, tenant isolation and publisher separation. Content release requires source/licence review evidence.

## Work packages

1. activity/outcome contracts and fixtures — Canonical Core ;
2. local session/progress PWA — Experiences ;
3. review/publish API and RLS — Web Platform + Experiences ;
4. deterministic TypeScript feedback and explanation rules — Experiences ;
5. offline/accessibility/privacy qualification — Infrastructure and Release.

Introducing the reserved Rust scorer requires a new approved work package backed by a real activity invariant and cross-runtime golden vectors.

## Release and rollback

Release requires one fully reviewed real activity, offline/export/delete proof, no nominative network payload, accessibility evidence and immutable version projection. Withdrawal hides a bad version from new sessions but preserves its ID for existing exports. Rollback restores the previous content index and application artifact without rewriting learner-local progress.
