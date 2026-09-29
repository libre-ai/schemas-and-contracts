# Missions v3 verified handoff binding candidate

## Scope and authority

Authoring base: `4f3d53c3ecd96e7064057afd1587de41b66f13c1`.
Owner-authorized design: Specifications owns canonical handoff v2 bytes and their
while-referenced, then P5Y after reference release, P35D backup lifecycle. Missions
persists the derived binding and lifecycle reference only. This is candidate
contract authoring; no promotion, production capability, issuer, storage service,
consumer, migration or release is authorized by these files.

Repository AGENTS and COMPATIBILITY require immutable locked contracts, major
versions for changed payload/digest meaning, actual positive/refusal fixtures,
generated projections and dedicated immutable role reviews. Existing Build Brief
v2 authorities stay byte-identical. New retention/archive mapping is authored in
parallel by its separate owner and integrated only through explicit references.

Technical decision: include ExecutionPlanBody v3 and ExecutionAuthorization v3
because the new binding and MissionRecord change their input identities. Reusing
locked v1/v2 digest fields would silently redefine them. Digest-opaque review,
control, event, graph, generation-transfer and effect authorities need no schema
change if their exact identity and semantic checks remain mandatory; audit each
reference and make the selected source-version resolver explicit.

## Intended document and ports

`mission-handoff-binding.v1` is closed and contains tenantId, handoff v2 identity,
whole-document JCS SHA256, Specifications-owned archiveReference, exact package v2
identity/version/bodyDigest, selected full acceptanceDigest and criteria in the
accepted body order. Neither reference ID nor its digest is a capability.
`bindingDigest` is SHA256 of JCS of the entire binding, including schemaVersion,
and is stored outside that preimage. An independently allocated lifecycle
reference ID lives beside the binding in MissionRecord v3, preventing a digest
cycle. The server derives the binding only from raw canonical, cryptographically
and semantically verified source bytes and current trusted observations.

PlanningAdmission resolves current principal/membership/resource permission,
Specifications ownership/producer, canonical archive+package+historical proof,
current key revocation, planning interval and exact criteria before any mission
write. It provides observations, never a client `accepted` boolean. Reserve,
confirm, reconcile and release reference operations use one immutable identity
(organization, missionId, bindingDigest, archiveId, handoffDocumentDigest,
referenceId). Unknown outcomes preserve the reference and fail closed; retries
reconcile this same identity. No cross-owner SQL or invented proof service.

## Task 1 — RED evidence and dependency inventory

Files: `tools/quality/missions-v3.test.ts`,
`contracts/fixtures/missions-v3/inherited.json`, dependency audit review document.
Write tests first for absent new schemas, schema-bound canonical positive/negative
fixtures, unchanged inherited fields/gates and exact locked source/catalog hashes.
Observe the missing-authority failures. Audit plan/authorization schema versions
and digest inputs, review/quorum, runtime control, events and effect barriers.

## Task 2 — binding, mission and execution successors

Files: `mission-handoff-binding.v1`, `mission-record.v3`,
`execution-plan-body.v3`, `execution-authorization.v3` schemas; family fixtures;
`contracts/missions-v3/SEMANTICS.md`; candidate review dossier.
Add closed schemas and byte-exact canonical fixture strings with independent
SHA256 expectations. Preserve every MissionRecord v2 state prerequisite and all
ExecutionPlanBody v2 budgets/capabilities/filesystem/network/model/harness/graph/
generation restrictions. Replace old ambiguous handoff fields with explicit
binding references only in new major versions. All candidate reviews pending.
Expected: strict AJV schema cases pass, all tampering/refusal cases fail.

## Task 3 — bounded authority verifier, HTTP and protocol

Files: `tools/quality/missions-v3.ts`, its tests/config; `missions.v3.yaml` and
`missions-api.v3.schema.json`; candidate protocol note, compatibility note.
Before verifier implementation, test actual raw handoff/package validation,
whole-document digest, archive and tenant mismatch, missing/currentness evidence,
criteria order, expired planning, incomplete historical proof, reference identity,
unknown commit/duplicate reconciliation and release safety. Pure authority
fixtures cannot prove ports, HTTP, DB or distributed atomicity.
API keeps v2 domain operations, replaces caller-declared acceptance with an exact
archive locator, and requires server-derived binding before success. Closed
command payloads carry exact control/run/plan/authorization identifiers. Preserve
cookie/CSRF, idempotency/revision, anti-replay, two-agent blind quorum, revocation,
monotone authorized cancel and zero-write refusals. Bind all response schemas.
Expected: route-specific schema/refusal checks and pure semantic tests pass.

## Task 4 — registration, projections and verification

Provide candidate catalog entries to the mapping owner outside catalog. A declared
local-only catalog overlay enables gates; it is not committed. Add separate
fixture inventory integration without changing old fixture bytes. Generate new
TS/Rust projections with repository generators; final combined generation belongs
to the integration owner. Stage intended files before tree-walking checks.
Run focused coverage, root `bun run check`, inherited-byte checks and diff check.
Record exits, hashes, red/green evidence and limits. Fix reproduced defects only.
No claim of consumer E2E, concurrency, restoration or live authorization success.
Parent coordinates fresh immutable review and Git integration. No push/promotion.

## Acceptance and review gates

All old locked sources/catalog entries remain equal to the base. New candidates
are registered with architecture/security/cryptography/privacy reviews pending.
All tests include positive and explicit refusal assertions; coverage threshold is
90% functions/lines for the new authority verifier. No mutable assertion is
mistaken for historical/current authority. Runtime implementation waits for role
verdicts, privacy mapping and a separate owner admission, then HTTP/DB/RLS/races,
reference reconciliation, deletion/restore and browser qualification.
