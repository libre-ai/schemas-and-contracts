# Specifications owns reconstructible planning handoff evidence

Decision identifier: `urn:libre-ai:decision:2026-09-29-specifications-handoff-archive`.
Status: candidate; owner choice recorded, specialized reviews and promotion pending.
Policy: `contracts/data/retention.v4.json` (its `authority` is this exact identifier).
Normative mapping: `contracts/build-brief-storage-v1/SEMANTICS.md`.

## Context and provenance

On 2026-09-29 the repository owner explicitly selected preservation with
Specifications: reconstruction while referenced, then five years after release,
accepting longer conservation and reconciliation between owners. This authorizes
this candidate design; it is not a privacy/architecture/security/cryptography
approval, catalog lock, implementation admission or permission to process data.
No approval timestamp is invented. The predecessor 028e8b3 architecture/privacy/
security rejects remain immutable evidence; this successor requires fresh review.

Build Brief v2 separates a canonical accepted body, detached acceptance and an
unsigned planning-only handoff. Historical acceptance needs minimal authenticated
membership/role, contributor, key-validity and exact policy evidence; present
membership or possession of a signature cannot reconstruct historical facts.
Missions needs a durable explicit binding to the whole original handoff. A digest
alone cannot reconstruct discarded bytes. Expiration and current permissions
remain independent from preservation.

## Alternatives and decision

| Alternative | Security and privacy | Quality and ownership | Performance and completeness |
| --- | --- | --- | --- |
| Store original handoff with Missions, under its mission lifecycle | Shorter preservation follows mission retention; Missions holds additional planning evidence | Requires an explicit Missions data mapping and joint package-proof references; reconstructible during mission life | Owner-local mission reads, but loses the longer Specifications reconstruction selected by the owner |
| Store with Specifications, Missions holds binding/reference | Longer while-referenced/P5Y preservation; minimal proof only, separately authorized access | One owner for package and original handoff, explicit cross-owner reservation/confirmation/release | Bounded owner lookup and reconciliation required; satisfies the selected reconstruction lifetime |
| Keep hashes only | Minimizes bytes but cannot recover original handoff | Cannot prove the original complete document after eviction | Rejected as not satisfying durable reconstructibility, not an equivalent target |

Select the second alternative. Specifications embeds data/rgpd-kit and owns its
PostgreSQL rows, migrations, RLS, deletion receipts and restore. Missions owns its
aggregate, immutable binding and lifecycle reference. There is no central proof
service, shared personal-data register or foreign-owner SQL. Artifact Verification
can verify digests; no storage port or storage ownership is inferred from it.
Duplication of complete archives across both owners is not selected.

## Classification and version boundaries

Minimal accepted-package proofs belong to the existing accepted-spec-package
class and joint package lifecycle; no general membership/key history is created.
The new accepted-planning-handoff-archive class belongs to Specifications, in
PostgreSQL, while referenced then P5Y after the last authenticated terminal release.
P35D remains the backup ceiling. No tenant override or additional P5Y cascade is
introduced. MissionRecord keeps its separate P1Y default/P6Y maximum rule.

Retention v4 derives from the 17 LOCKED v2 rules unchanged. Auth-retention v3 is a
parallel pending candidate and is not implicitly adopted because its number is
lower. Future convergence requires an explicit reviewed successor. All existing
locked schemas, policies, signatures, digest meanings and protocol pins remain
unchanged. New binding/mission/plan/authorization majors are selected explicitly.

## Reference history and finality

Durable state is missing, reserved, confirmed or released. Unknown is a current
observation and never overwrites that state. The owner retains monotone
`everConfirmed`; confirmation cannot be erased by lost responses, restore or
reconciliation. A released record retains the terminal reason and exact evidence
digest with its original release anchor. Missing or inconsistent history refuses.

A proven initial absence may reserve a new identity only before any possible
effect. After reserve, a mere absent lookup never authorizes release. A qualified
`not-committed-final` proof seals the exact operation against a future commit and
releases only a reservation proved never confirmed. A reference ever confirmed
requires `removed-final`: authenticated detachment/deletion, exact tuple and no
future reachable use. Current owner authorization and exact authenticated source
provenance/fences are prerequisites. Payload flags or a digest alone are not proof.

Reconciliation can confirm a reserved identity from authenticated committed
outcome, or release from a qualified terminal proof. An unknown observation
protects both archive and package without changing history; no fresh identity or
blind re-emission is allowed. Released identities never reactivate. Retries match
the original tuple, terminal reason and evidence digest and never move the anchor.
Both independent authority oracles must agree on the exhaustive decision matrix.

## Preservation, destruction and restore

Store original canonical UTF-8 bytes, not a repair reconstructed from JSONB.
Archive SHA-256 covers the whole JCS handoff; package-body and receipt digests keep
their original preimages. Minimal historical source chains must be bounded and
independently authenticatable. Never store signing secrets, sessions, prompts or
an entire directory as a convenience copy. Existing finite 2 MiB/depth32 limits and
source-adapter bounds apply before parsing/resolving proof.

One live business reference protects archive and package together. On last release
both P5Y anchors coincide unless another real package reference remains. The
retained historical archive pointer is not a fresh business reference. A legitimate
new identity/ref cancels a purge and resets the anchor only after a fresh qualified
admission; retry/read/receipt append never does. Concurrent acquisition and purge
must be serialized by the owning store. The duration adapter must qualify P5Y
calendar semantics; this ADR does not replace them with a fixed number of days.

Authorized active deletion/legal-hold handling keeps existing owner permission
policy. Remove logical access with accepted owner tombstone and receipt before
physical compaction. Do not expose an archive after its required package/proof is
deleted. Reconcile references without claiming cross-database atomicity or SQL
rollback of an external queue. If authoritative state is unavailable, refuse
exposure and do not fabricate completion. Operational/deletion evidence is
content-free and kept only under its existing applicable lifecycle.

Restore applies owner deletion evidence before rows become visible. Restore the
monotone confirmation and terminal-release evidence, reconcile current states
across owners, verify canonical bytes and historical proofs, and resolve current
permissions/revocation before use. A stale backup cannot erase confirmation,
resurrect a released reference or restore an authorization grant. Backups expire
within P35D; no backup resurrection bypasses an accepted deletion decision.

## Migration, reversibility and admission

Add owner-scoped tables and tenant-inclusive keys under ENABLE/FORCE RLS and least
privilege. V1 rows stay v1; no backfill of missing historical evidence from today's
membership, no old digest reinterpretation. Candidate 028 reference observations
have no deployed producer; consumers must not implement its ambiguous unknown
state. A migration importing external legacy lifecycle state must independently
reconstruct confirmation/release history or refuse opening the record.

Rollback before enablement can remove unused candidate tables. After real records
exist, disabling admission stops new references but preserves existing evidence,
owner deletion receipts, terminal history and required retention; dropping live
rows is not rollback. Import/export must preserve canonical bytes, provenance,
organization and lifecycle proof under current permissions. No provider selected.

Fixtures test decisions only. Promotion requires four separate immutable roles,
owner control and a promotion/integration review. Consumers must independently
prove real source adapters, HTTP/CSRF, PostgreSQL CAS/RLS, crash recovery, release
finality/fencing, migration/rollback, calendar/purge races, deletion/restore and
browser flows. The current generic data sweep does not implement
postReferenceRetention. Archive access after expiry needs separately qualified
current audit authority; no audit endpoint/role or execution capability is added.
