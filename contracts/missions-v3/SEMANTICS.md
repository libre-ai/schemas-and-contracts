# Missions v3 — verified planning binding candidate

Candidate and unimplemented. No catalog promotion, runtime, issuer, live agent,
provider, database adapter, migration or execution permission is established by
this authority. MissionRecord/API v1/v2 and the locked execution families remain
unchanged. The new binding and plan/authorization majors are mandatory together;
there is no digest reinterpretation or implicit v1/v2 adapter.

## Canonical identity

All inputs obey the inherited Build Brief v2 raw boundary: strict canonical
RFC8785 UTF-8, no BOM, duplicate keys, surrogate, unsafe/noncanonical number or
unknown property; maximum 2 MiB and depth 32. Raw bytes must equal JCS before
verification. Arrays retain order; there is no Unicode normalization. A parsed
and reserialized noncanonical request cannot be rescued into an accepted input.

`mission-handoff-binding.v1` is a server-derived, closed document:

- `tenantId` is the independently resolved organization.
- `handoff.schemaVersion` is exactly `libre-ai.agent-handoff.v2`; `id` identifies
  that document and `documentDigest` is SHA256 of UTF8(JCS(the **entire** handoff)).
  Optional evidenceReports is included when present. Absence and an empty array
  have different preimages. This does not turn evidence references into proof.
- `handoff.archiveReference` is an independently prepared Specifications archive
  locator `{id,digest,mediaType}`. Digest equals documentDigest and mediaType is
  exactly application/json. It is neither a URL nor a bearer capability.
- `specPackage` names exactly `libre-ai.spec-package.v2`, its body id/version and
  `bodyDigest`. The body digest is SHA256 of the entire canonical Build Brief v2
  body, never of the package wrapper or an earlier major.
- `acceptanceDigest` is SHA256 of the entire selected detached receipt, including
  wrapper and signature. Every supplied package receipt must verify, including
  current key revocation, historical membership/role and contributor provenance.
- `acceptanceCriteria` follows the accepted body order, after proving exact set
  equality with the handoff, without duplicates, omissions or invented criteria.

`handoffBindingDigest = SHA256(UTF8(JCS(binding entire)))` includes schemaVersion
and archiveReference. It is stored outside the binding preimage. MissionRecord v3
stores the full binding, this digest, and a separate `handoffReferenceId` allocated
by the owning authority; putting that lifecycle ID inside the digest would create
an identity cycle. No caller-supplied accepted/planningOnly flag or binding is an
input to admission. A digest proves byte identity only, never origin or permission.

## Current and historical ports

The qualified consumer must independently resolve these observations; the pure
fixture context is a synthetic representation and has no network authority:

1. Current session/service principal, organization, membership revision, exact
   mission operation, Build Brief resource plan permission and current revocation.
   Browser cookie alone does not confer a service Biscuit grant. Issuer/authorizer
   boundaries retain the Build Brief reserved-host-fact and attenuation rules.
2. Specifications ownership and authenticated producer of the exact handoff,
   canonical handoff/package bytes and all minimal historical acceptance proofs,
   current approved signing-key registry and revocation/availability.
3. Current archive/reference identity and source revision, including an effect
   boundary recheck or qualified fence against concurrent change/revocation.
4. Mission idempotency reservation, aggregate revision and event cursor, and the
   durable result of a possible prior write. A missing acknowledgment is not absence.

Missing, ambiguous, stale, unavailable or contradictory observations fail closed.
Historical membership at acceptance does not replace current caller membership.
A signed receipt cannot replace complete independently authenticated contributor
provenance. Current source/member versions must still match at commit; comparing
fixture revisions does not implement this atomicity or qualify an adapter.

The handoff must remain plan-only (`["plan"]`), currently unexpired, and satisfy
acceptedAt <= createdAt <= trustedNow < expiresAt with expiresAt > createdAt.
Producer/resource provenance is authenticated outside its unsigned payload. An
archive read, retained proof or unchanged digest never refreshes expiry or grants
plan/start. Historical audit permission is a separate qualified authority; absent
that permission, an expired archive is retained but cannot be exposed through
GetHandoff or a new implicit audit route.

## Reference transaction and uncertain effects

Specifications owns canonical handoff bytes and accepted package/proof storage;
Missions owns only its binding and lifecycle reference. No cross-owner SQL or
central proof service is introduced. Ports may be local adapters or separately
qualified service adapters; neither choice is presumed already available.

The first proposal accepts `{handoff:{id,documentDigest},budgets}`. The resolver
loads the identified handoff from its existing ephemeral source or archive under
current permission; locator/digest supplied by the caller is only an expectation.
Missions prepares one missionId and idempotent operation identity. Specifications
prepares stable archiveId/referenceId identities under that operation; preparing
identity conserves no handoff bytes and grants no retention or permission. The
server derives the complete binding and its digest from the verified bytes and
prepared archiveReference. After revalidation, reserveReference commits archive,
accepted-package proof protection and the reference together in one local
Specifications transaction, bound to this complete immutable tuple:

`(organization, missionId, bindingDigest, archiveId, handoffDocumentDigest, referenceId)`.

The reference protects archive and package jointly. Missions then atomically
commits mission, binding, reference ID, revision/cursor and idempotency outcome.
confirmReference consumes authenticated owner evidence of that exact commit.
No success is returned while the required outcome remains unresolved. A lost
response, crash or ambiguous commit triggers reconcileReference against the same
idempotent identity and complete tuple; it never creates a fresh mission/reference
or blindly re-emits an effect. After a possible reserve, prepared identities are
part of its recoverable outcome and cannot be replaced on retry.

A reservation with an unknown Missions outcome stays protected and unavailable
for purge. A terminal mission state does not by itself release references.
releaseReference requires authenticated terminal detachment/deletion evidence
from Missions for the exact mission/binding/reference, a durable tombstone or
qualified equivalent, and no future reachable use. Mere timeout or absence from
one stale query never proves detachment. Release is idempotent; an already
released reference cannot be rebound or renewed. Reuse needs a separately
qualified new identity and a fresh admission, never resurrection of this one.

The durable reference states are missing (pre-creation), reserved, confirmed and
released. Unknown belongs to the current owner observation; it never overwrites
durable state. Store monotone everConfirmed, plus releasedBy and the exact terminal
releaseEvidenceDigest when released. Confirmed requires everConfirmed true;
reserved requires false. Missing, regressed or inconsistent history refuses. A
restored row cannot erase confirmation or terminal evidence.

The independent Missions and Specifications oracles exercise one closed matrix.
Initial proven absence can reserve only from missing. After reservation, a plain
absent lookup protects and never authorizes release. Authenticated committed
outcome confirms on confirm/reconcile. A sealed not-committed-final proof may
release only a never-confirmed reservation and must prohibit a later commit of
the exact idempotent operation. Any previously confirmed reference instead needs
removed-final proof: exact authenticated detachment with no future reachable use.
Unknown observations protect without state mutation; later final outcomes can
resolve uncertainty. Released identities never reactivate; release/reconcile replay
requires the same tuple, terminal reason and evidence digest, with anchor unchanged.

The proof digests only identify independently verified owner observations; they
are not bearer permission or evidence verification by themselves. The fixtures
implement no transaction log, source signing, retry worker or production saga.
Consumer qualification must prove actual crashes/restarts, confirmation history,
finality fences, races, deduplication and both directions of reconciliation on
real owner stores. Retention ADR:
`docs/adr/2026-09-29-specifications-handoff-archive.md`.

## Retention and restore

The separate Specifications mapping and retention-v4 candidate classify archive
bytes as while-referenced, then P5Y after confirmed reference release, with P35D
backup ceiling. One active Missions reference protects both archive and accepted
package/proof; their post-release anchors advance together, subject to other live
package references. The historical archive-to-package pointer is not a new active
reference and cannot start an additional P5Y cascade. Mere reads, retries, duplicate
receipts or reference reconciliation do not extend the anchor.

MissionRecord keeps its existing owning retention rule (P1Y default/P6Y maximum),
not the archive's P5Y rule. A retained mission's required reference cannot disappear
prematurely. A restored mission/reference/archive must reconcile current owner
state, deletion tombstones and current authorization/revocation before reads,
planning, confirmation or release; a restored receipt is not an active grant.
Backups expire within P35D and restore applies deletion decisions before records.
Retention/schema fixtures cannot prove deletion, restoration, encryption or RLS.

## Plan and authorization successors

ExecutionPlanBody v3 retains every v2 graph, generation, lineage, capability,
filesystem, network, model-egress, budget, worker, harness and evidence restriction.
Its former handoffId/handoffDigest/specPackageDigest fields are replaced by exact
`handoffBindingSchemaVersion = libre-ai.mission-handoff-binding.v1` and
`handoffBindingDigest`. The plan resolver loads the full immutable binding from
MissionRecord v3, verifies the digest and source equality, and never treats a
missing binding as an old-major fallback. Plan criteria equal the binding's ordered
criteria. `bodyDigest` hashes the whole canonical plan excluding only bodyDigest.

ExecutionAuthorization v3 retains every v2 revocation, generation, successor,
quorum, expiry and protected-human-gate rule. It additionally fixes
`missionRecordSchemaVersion = libre-ai.mission-record.v3`,
`planSchemaVersion = libre-ai.execution-plan-body.v3`, and the binding digest.
missionRecordDigest hashes the whole canonical **pre-authorization** MissionRecord
v3 snapshot at missionRevision; that snapshot includes the exact plan/quorum refs
but cannot contain the new authorization that hashes it. The later mission
projection may carry that authorization reference without changing the named
historical snapshot. planId/planDigest, graphDigest, organization, mission,
generation and binding agree across all inputs. authorizationDigest excludes only
itself. Source discriminants and schemaVersion are inside their respective hashes.
Only Missions derives authorization after all current and quorum checks; no HTTP
command accepts a caller-issued authorization.

## All inherited security gates remain mandatory

The closed v2 mission transition relation and every state prerequisite in
`agent-orchestration/SEMANTICS.md` remain applicable. In particular:

- Plan and result each require two eligible favorable **blind** agent reviews,
  distinct reviewer identities, run IDs, nonces and signatures, distinct from every
  complete harness-observed contributor. Exact subject/evidence/lineage, approved
  keys, one-shot durable nonce claims, expiry and policy-required diversity all
  verify. A single receipt, owner approval or retained handoff replaces none of them.
- Any eligible rejection prevents quorum; remediation changes digest and requires
  fresh reviews. result-submitted is not success. Protected human gates remain
  additional prerequisites for protected domains, never quorum substitutes.
- Start requires the exact approved plan, derived authorization, attenuated token,
  current revocation and effective signed harness controls. Missing controls deny.
  Paused/blocked resume rechecks current authority, version, generation, budgets
  and effect continuity; a cached green check never authorizes a fresh effect.
- Start/pause/resume reject stale revisions. Authorized cancel remains monotone
  even with stale expectedRevision only for the exact run, plan and authorization;
  current permission and idempotent identity are still mandatory. Cancel cannot
  mutate another generation or be dropped by a newer non-cancel command.
- Event IDs/sequences replay only with identical verified canonical digests.
  Causal chain, organization/mission/run/plan/authorization, monotone budgets and
  generation are checked before projection; contradictions quarantine, not success.
- D40/D42 graph, transfer, decision and effect barriers remain mandatory.
  A successor consumes its exact transfer once and cannot start while a predecessor
  effect is reserved, started or state-unknown. One emissionId per effect attempt;
  qualified fencing or executor-idempotency proof is required. Only committed,
  rejected-final or not-committed-final close an effect. Unknown is a barrier.

The existing digest-opaque review/control/event formats remain unchanged. New
consumers must resolve every supplied plan/authorization digest to the exact v3
family before applying them. Mission event v2 remains a domain projection; it
cannot bypass the separate authoritative orchestrator-event v3 graph/generation/
effect observations required by D40/D42. The two causal streams have their own
identities/cursors and are never concatenated or interpreted as each other. A
result-submitted projection cannot alone prove graph completion or external effects.

## HTTP, refusal and idempotency

The ten v3 endpoints retain v2 domain operations with closed typed request and
`{data,meta}` response envelopes. Every POST requires Idempotency-Key and If-Match;
cookie authentication additionally requires X-CSRF-Token. Internal Biscuit ingress
requires authenticated issuer, current exact role/resource/operation and handler
context; it never accepts a browser's asserted agent identity. Ambiguous mixed
browser/service identities refuse. No bearer token or issuer endpoint is added.

Create uses If-Match `"0"` and yields revision 1. Other quoted decimals must be
canonical safe integers matching the exact aggregate revision, except the monotone
cancel rule above; that exception never skips permission, target or deduplication.
The header and embedded control/decision expectedRevision/idempotencyKey agree.
Control command name matches control.action; exact mission path and run/plan/
authorization tuple is independently resolved. A body resourceId shortcut cannot
replace the typed control. Decisions retain exact request, generation, closed
choice, expiry and one-shot consumption; comments remain classified artifact refs.

The idempotency key binds organization, authenticated principal, method, normalized
path/query, canonical payload digest and expected revision. Concurrent identical
requests commit once; exact replay returns original status/body/revision only after
current authorization checks. Different binding is 409. CAS compares both revision
and authoritative event cursor to avoid dropping concurrent events. Mutation,
event append, binding and idempotency result commit atomically within Missions.
Unknown external/reference/commit result is reconciled or 503, never a second effect.

List, event and view pages are cursor-based, default/max 100. Cursor is opaque and
authentically binds organization, principal, mission/resource, view, limit,
snapshot revision/cursor and stable last key. Invalid, stale, cross-scope or
unknown cursor is 400; no arbitrary offsets or duplicate/unknown query parameters.
Quorum and exported views retain approved identity redaction and current read
permissions. Reference possession alone never permits archive or proof reads.

Public failures contain only data:null and opaque requestId, exact
`mission.http_STATUS` code and `Request refused` message. POST status set is
400/401/403/404/405/409/412/413/415/422/503; GET is 400/401/403/404/405/503.
Method/transport bounds precede session/CSRF, trusted scope/permission, canonical
schema, idempotency/revision and semantics. Unsupported methods (including HEAD
and OPTIONS) return 405 with exact Allow and no handler effect. Unknown or foreign
resource is 404 without existence disclosure. Missing current authority/history/
reference outcome is 503; malformed input 400; valid-shape invalid source or quorum
422; permission 403; stale CAS 412; conflicting identity/idempotency 409. Body
byte/depth overflow is 413; invalid/oversized stored GET data is 503. Media/encoding
mismatch is 415. All responses no-store; no raw fields, tokens, bytes, paths,
review identities or rejected values enter errors or operational logs.

## Evidence and admission

Schema, canonical digest, policy-context, chain and reference-decision fixtures are
synthetic authority tooling. They exercise no browser/API server, signer service,
Biscuit issuer, database transaction/RLS, physical retention or runtime sandbox.
Before implementation: separate architecture/security/cryptography/privacy passes
on an immutable candidate, compatible Specifications storage/retention mapping,
then promotion and explicit owner implementation admission. Before enablement:
real HTTP/refusal/CSRF, PostgreSQL multi-connection/races/RLS, reference crash and
restore reconciliation, deletion/backup boundaries, browser workflow, reviewer
replay/isolation, harness and executor effect qualification remain required.
