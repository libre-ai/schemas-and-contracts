# Accepted package proofs and Specifications handoff archive v1

Status: candidate, unimplemented. This mapping accompanies Retention Policy v4;
Decision record: `docs/adr/2026-09-29-specifications-handoff-archive.md`.
No catalog authority is promoted and no consumer, storage deployment, signer or
issuer is admitted. The owner selected Specifications ownership and retained
handoff reconstruction on 2026-09-29: while referenced, then P5Y after release,
with the existing P35D backup ceiling. This session decision authorizes candidate
authoring; the four dedicated review roles and owner control still precede use.

## Version boundary

Retention v4 inherits all seventeen Retention v2 locked rules byte-for-byte and
adds only `spec-handoff-archive`. Retention v3 is a separate, pending auth-storage
candidate: its four additional classes are neither adopted nor rewritten here.
A future convergence requires an explicit reviewed successor; numeric version
order alone is never policy selection. The v4 policy has `status: candidate`, not
an invented approval timestamp. Deployable consumers remain pinned to their
admitted policy until a bounded implementation and promotion package is approved.

This mapping does not modify the locked v1/v2 rules, Build Brief v2 body/receipt/
handoff schemas or preimages, Missions v1/v2, execution authorities, Biscuit roles,
or the existing Specifications API v2 endpoint inventory. Accepted package proofs
are a decomposition of the existing `accepted-spec-package` class, not a new
membership/key history class. Durable handoff bytes require the new candidate
class; the old API's memory/export limitation remains until its separate admission.

## Owners, objects and exact stored bytes

Specifications owns its PostgreSQL tables, migrations, RLS, reference lifecycle,
deletion receipts and restore. It embeds `@libre-ai/data` and `@libre-ai/rgpd-kit`;
those libraries own no product data or centralized rights-request database.
Missions owns its aggregate and binding/reference. Artifact Verification may
verify digests; it is not a storage service. No cross-database transaction,
shared personal-data register or global deletion orchestrator is introduced.

Every primary/foreign/reference identity includes the organization. Indexes or
JSONB projections are disposable: the canonical byte columns are authoritative.
Body and receipt canonicality and cryptography follow Build Brief v2 unchanged.
Each fetched package or handoff remains bounded to 2 MiB and depth 32. Proof
adapters must use finite, explicitly qualified bounds before parsing or resolving
source evidence; an unbounded proof traversal is not an admissible adapter.

| Logical object | Key and binding | Bytes / source observations retained |
| --- | --- | --- |
| accepted body | organization, package id, package version, bodyDigest | Complete original canonical UTF-8 body; SHA-256 recomputed before use; no silent repair from a parsed JSONB value |
| acceptance | organization, package identity, statement id, acceptanceDigest | Whole canonical detached record including wrapper/signature; exact bodyDigest; all supplied records verify, at most 100 per API package |
| historical acceptance proof | organization, acceptanceDigest, component id and source evidence digest | Minimal authenticated membership/role at acceptedAt and exact membershipRevision; independently complete contributor provenance; approved organization/approver/key binding and historical key interval; exact policy bytes matching policyDigest |
| archived handoff | organization, archive id, handoff id, full canonical handoff digest | Entire original canonical AgentHandoff v2, including optional evidenceReports and original array ordering; package id/version/bodyDigest and selected acceptanceDigest independently checked |
| lifecycle reference | organization, reference id, owning consumer identity, mission id, bindingDigest, archive id, handoff digest | Authenticated owner outcome and causal/idempotency evidence sufficient to reconcile registration, confirmation or release; no prompts, free-text findings or duplicated package content |

The handoff archive digest is SHA256(UTF8(RFC8785(the whole handoff v2 object))).
Input bytes must already equal that canonical representation. The digest is an
archive-content identifier defined by this new candidate, not a reinterpretation
of `MissionRecord v1/v2.handoffDigest`. An archive reference reuses the closed
common artifact reference shape: owner-allocated opaque URN, that exact digest,
and `application/json`. A versioned Missions binding identifies AgentHandoff v2
and its package/receipt identities separately; no opaque old digest substitutes.
An id reused with different bytes or a foreign organization is refused.

## Proof source and authority boundary

The historical proof is not a boolean copied from a caller, a current membership
row, or an independently invented issuer. `HistoricalAcceptanceAuthority` must
supply verifiable source observations binding organization/principal/role,
acceptedAt and membership revision. Contributor evidence must include every actual
contributor, including modifying review actions, and bind the body digest. The
key proof binds public key bytes, key id, organization and approver to the approved
source and validity interval; it does not make a key registry the membership
source. The exact policy bytes remain resolvable and match the signed policyDigest.

Persist the minimum source evidence needed to authenticate those observations,
including its verification chain when needed, under the package lifecycle. Do not
copy an entire member directory, browser sessions, signing secrets or an open-ended
history. The consumer must inventory each evidence format and its verification
root against its existing qualified source adapter; absent, ambiguous, unverifiable
or unbounded source evidence refuses the append. This mapping adds no wire format
for those authorities, no private key, no source signing permission and no registry.

`AcceptanceKeyAuthority` still checks current revocation/availability, and
`CurrentSessionAuthority` plus `BriefResourceAuthorizer` check current caller
permission on every sensitive operation and replay. Historical validity never
restores revoked membership. Natural key-interval end and membership revision
changes are not silently substituted for the historical acceptedAt facts; the
Build Brief strict profile and current revocation requirements remain exact.
Restore never treats old source-status observations as current permission.

## Local append transaction and migration

After independent ownership, current authorization, raw-byte verification and
historical-proof verification, one Specifications transaction performs exact CAS,
appends a new receipt plus its proof, and records the idempotency outcome. The
snapshot/currentness adapter must prevent a stale authorization observation at
the point of effect. No receipt without its proof, no proof attached to another
body/organization, and no partial reference write may commit. Every returned
package rechecks all its receipts and proofs; a missing proof is unavailable
state, not implicit acceptance. Repeated identical receipt bytes are a no-op;
statement-id collision with different bytes refuses. Read, retry, export and
receipt append never advance a reference-release timestamp or extend retention.

New owner-scoped tables preserve raw canonical bytes and tenant-inclusive keys,
ENABLE/FORCE RLS and least-privilege append/compaction grants. Retention roles do
not acquire ordinary product authorization. Do not alter historical v1 package
identity or populate missing v2 proof from today's directory. Existing v1 rows
remain v1. Auth v3 candidate tables are not a shortcut to historical proof and
are not part of this policy. Consumers must prove schema migration and rollback
without rewriting locks, accepted deletion or event history.

## Durable handoff, references and reconciliation

Archive creation is an internal part of the new, versioned mission-admission
boundary, not a new public API or implicit extension of a v1 command. It requires
an accepted verified package, current exact planning/resource authorization,
authenticated producer/ownership, and a server-reserved mission/reference identity.
Specifications commits the immutable archive, package dependency and reserved
reference in one local transaction. Independent service adapters, if deployed,
require qualified caller/resource capabilities; a payload claiming to be Missions
is never sufficient. No provider, protocol token format or network service is
selected by this candidate.

A proposal request needs only the handoff identity/digest and its budgets, not an
already persisted archive. A prepare-identity observation may allocate stable
archive/reference/mission identities without retaining handoff bytes or granting
permission. The caller derives the binding using that archive reference, excluding
the lifecycle reference id from its digest. Reserve then rechecks the exact complete
tuple and commits locally. Once reserve may have had an effect, retries recover
those same identities and binding from the authoritative idempotency outcome;
unknown outcomes never justify a fresh allocation. Preparation alone is no grant.

The reference id is allocated independently of the binding digest (no circular
hash). Its exact tuple is organization, owning consumer, mission id, bindingDigest,
archive id and handoff digest. The same tuple/idempotency key is reconciled after
an interrupted effect; a different tuple cannot reuse the outcome. Durable state is reserved, confirmed or released (missing is a pre-creation
observation). Store a monotone `everConfirmed` marker; confirmed requires true,
reserved requires false. Unknown is only an observation and never overwrites the
durable state or history. Released retains `releasedBy` and `releaseEvidenceDigest`
with the original release anchor. Absent/contradictory history refuses. These are
qualified owner observations in fixture tooling, not a new caller-controlled wire.
Permitted transitions:

| State/event | Required observation | Next state / retention effect |
| --- | --- | --- |
| reserve | Exact authorized identity and verified archive/package | reserved; protects both archive and package |
| confirm | Authenticated Missions commit for the exact tuple | confirmed; protects both |
| uncertain commit or unavailable owner | No authoritative terminal answer | Preserve durable state/history; protect both pending reconciliation, no blind emission |
| reconcile committed | Authenticated matching owner outcome | confirmed; no duplicate effect |
| reconcile not committed | Exact operation sealed not-committed-final, with everConfirmed false | released; record reason/evidence digest and anchor exactly once |
| release confirmed | Authenticated removed-final proof of exact detachment and no future reachable use | released; retain everConfirmed, reason/evidence digest and anchor |
| duplicate terminal release | Same tuple, terminal reason and evidence digest | idempotent; timestamp and history unchanged |
| mismatch, stale ownership or payload-only outcome | Missing exact trusted binding | refusal, no lifecycle change |

Confirmation and everConfirmed never regress across uncertainty, release or
restore. The oracle refuses a reserved row with everConfirmed true and any durable
unknown state. A plain absent lookup after reserve protects; it is not a sealed
non-commit. A final non-commit proof must bind the exact idempotent operation and
prevent a later commit. A missing reference may reserve only on independently
proven initial absence before any possible effect. Reconciliation after a final
committed outcome confirms; a final removal resolves uncertainty into release.
A confirmed reference can only be released by authenticated removal evidence;
a contradictory later claim of never-committed is refused. A timeout or an empty
unauthenticated lookup is not proof of non-commit. Consumer
qualification must show that unresolved reservations are durably discoverable,
reconciled against the owning Missions state and cannot silently become orphaned
retention. While an outcome is unknown, deleting the proof is unsafe; fabricating
a release to meet an arbitrary TTL is forbidden. No independent grace period or
unbounded history class is introduced. Current authorization is rechecked before
reference mutation, including retries; no foreign-owner SQL write is permitted.

The same live external reference protects both archive and accepted package. On
last confirmed release, their release anchors coincide unless another legitimate
package reference remains active. The archive's retained historical package
pointer is not a self-renewing business reference: it does not start a second P5Y
period after the archive tail. The invariant is that the package/proof deletion
deadline is never earlier than that of any archive requiring it. A newly acquired
legitimate reference cancels a concurrent purge and removes the old release anchor;
the next last release supplies a new anchor. A retry or append is not an acquisition.

## Retention, active deletion and restore

The accepted package keeps existing while-referenced/P5Y semantics. The new
`spec-handoff-archive` rule has owner Specifications, PostgreSQL, while-referenced,
reference-release and P5Y. No tenant override or longer tail is admitted. P35D
remains the backup ceiling; the inherited execution tombstone-before-record
restore order is unchanged.

Purge requires authoritative current reference state, no active or uncertain
reference, and an independently validated policy deadline anchored to the exact
last confirmed release. Recheck in the same owner compaction transaction. The
fixture oracle consumes a trusted deadline observation; it does not calculate a
calendar or reinterpret P5Y as a new fixed-day rule. The actual policy adapter
must qualify the existing duration semantics, leap boundaries and release races.
The current generic data sweep resolves only defaultRetention and cannot satisfy
postReferenceRetention merely by being called with a new rule id.

Authorized active deletion and legal-hold handling retain their existing owner
policy and permission gates. Logical access is removed with the owner tombstone
and receipt in the accepted transaction; physical compaction is owner-scoped.
No cascade may leave a readable archive whose required package/proof was deleted:
withdraw/archive access coherently before purge, reconcile each owner's reference,
and preserve content-free deletion evidence through the backup ceiling. If the
required authority is unavailable, do not expose data or fabricate completion.
There is no SQL rollback of an external blob enqueue, nor cross-base atomicity.

On restore, replay each owner's accepted deletion evidence before exposing rows,
restore monotone confirmation and terminal-release history without rolling it back,
then verify canonical bytes/digests and historical proof completeness, reconcile
owner references and resolve current authorities before use. Missing source,
unknown reference or mismatched bytes refuses reopening. Old authorization caches
are never restored as grants. No backup may resurrect deleted data after P35D.

## Archive is evidence, never an execution capability

Expiration continues to refuse a new planning admission. A currently authorized
historical audit may reconstruct retained bytes after expiry, under independently
qualified audit access; that read is not the existing expired GetHandoff success
path. This mapping does not add that endpoint or grant an audit role. Without an
existing qualified audit permission, refuse access. Stored bytes may remain while
access is refused. An archive's presence, digest, retention or successful historical
verification never grants plan, start, resume, arbitrary reads or execution.
Missions quorums, human gates, effective harness controls and current capabilities
remain independently mandatory.

## Evidence, review and consumer gate

`contracts/fixtures/build-brief-storage-v1/` carries an independent positive/
negative schema pair and synthetic observation scenarios. `check:build-brief-storage`
validates the exact policy, inherited rules, closed observations and lifecycle
refusals under a blocking 90% function/line coverage threshold. These are authority
fixtures, not real signed source evidence, PostgreSQL atomicity, service capability,
calendar calculation, archival reads or restore tests.

Architecture, security, privacy and cryptography each review the final immutable
candidate. Re-review affected Build Brief/API architecture after incorporating the
mapping; previous rejection records remain intact. Product implementation requires
those role verdicts, owner control, current source-adapter evidence and separate
HTTP/RLS/CAS/reference/deletion/restore/browser qualification. No fixture or type
projection changes catalog status or satisfies a real mission acceptance path.
