# Build Brief storage mapping / Retention v4 candidate review dossier

Status: pending-independent-agent-review; unimplemented and not promoted.
Base: `4f3d53c3ecd96e7064057afd1587de41b66f13c1`.
Protocol: Governance `docs/reviews/AGENT-REVIEW-PROTOCOL.md`.

Owner provenance: on 2026-09-29, the owner explicitly selected Specifications
retention of the reconstructible handoff while referenced and P5Y after release,
accepting longer conservation and reconciliation across owners. This authoring
decision does not replace specialized acceptance, policy promotion or consumer
admission. The earlier mapping-only mandate already fixed Specifications ownership
with embedded data/rgpd-kit; no new Artifact storage service is selected.

Authorities: Retention Policy v4 and its schema, with the normative adjunct
`contracts/build-brief-storage-v1/SEMANTICS.md`. It inherits v2 locked byte-for-byte
and leaves auth-retention v3 pending in parallel. Numeric latest is not adoption.
Build Brief v2 raw schemas, signature preimages and dedicated policy remain exact.

| Required role | Scope | State |
| --- | --- | --- |
| architecture | Proof objects and trusted source boundaries; owner-local transactions; archive/package reference lifetime; interrupted cross-owner commit; v1 migration; inherited v2 and parallel v3 | pending |
| security | Exact current authorization at effects/replay, organization RLS, producer ownership, source authenticity, fail-closed unknown outcomes, archive cannot grant execution | pending |
| privacy | Minimal historical proof, no global membership history, while-referenced/P5Y/P35D, no tail cascade, active deletion and restore, orphan-reference reconciliation | pending |
| cryptography | Canonical raw archive bytes and whole-handoff digest, original package/receipt preimages, immutable source-evidence binding and registry/revocation seams | pending |

ARCH-BB-01 and ARCH-API-01 found an absent storage mapping on the base revision.
This candidate proposes the missing mapping and the subsequently chosen archive
class. It does not declare either rejection resolved: dedicated immutable review
must determine that. Preserve old verdicts and rerun affected scope after changes.

Recipes: `bun run check:build-brief-storage`, root `bun run check`, SDK projection
checks and Rust fixtures. Synthetic observations do not prove database transactions,
real historical evidence, qualified source adapters, reference-message authenticity,
calendar arithmetic, deletion/restore or browser flows. These remain explicit
consumer gates; no provider, platform, signing key or deployment is provisioned.

## Successor remediation candidate

Decision record: `docs/adr/2026-09-29-specifications-handoff-archive.md`, exact
policy authority identifier. The 028e8b3 architecture/privacy/security rejects are
preserved. This successor separates durable state from unknown observations,
retains monotone confirmation and exact terminal release evidence, and exercises
both independent oracles against one exhaustive matrix. The ADR records owner
choice, alternatives and migration/deletion/restore responsibilities; it does not
claim any role has approved this successor. Every affected role must review its
new immutable commit before promotion.
