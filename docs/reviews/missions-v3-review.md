# Missions v3 and handoff binding candidate review dossier

Status: pending-independent-agent-review; unimplemented and unpublished.
Authoring base: `4f3d53c3ecd96e7064057afd1587de41b66f13c1`.
Protocol: Governance `docs/reviews/AGENT-REVIEW-PROTOCOL.md`.
Authoring never counts as a review. Every role gets a dedicated review-only pass
on an immutable commit with contract/vector/recipe hashes and one attributable
verdict. Existing Build Brief approvals do not approve this new family.

| Role | Required scope | State |
| --- | --- | --- |
| architecture | Binding identity, complete major cascade, ten routes, reference transaction and owner boundaries | pending |
| security | Trusted current/historical ports, two-agent gates, revocation, exact scope, replay/CAS/cancel/generation/effect barriers | pending |
| cryptography | Whole-handoff/binding preimages, source discriminants, detached acceptance linkage and digest chains | pending |
| privacy | Minimal persisted binding/reference, joint archive/package retention, release, deletion, backup/restore and content-free diagnostics | pending |

Authorities: mission-handoff-binding.v1, mission-record.v3,
execution-plan-body.v3, execution-authorization.v3, missions-api.v3 schema and
missions.v3 OpenAPI. Their normative semantics are in
`contracts/missions-v3/SEMANTICS.md`; dependency decisions are recorded in
`missions-v3-dependency-audit.md` alongside this dossier.

The owning product's Missions v3 protocol is still a candidate. The pinned
historical Missions v1/v2 protocol archive remains byte-exact; a candidate note
adds no silent historical provenance. Commands/queries are unchanged in name but
major payload meanings and source resolution are explicit. No runtime consumer
is admitted by root checks or generated types. Specifications archive/retention
mapping is a coordinated candidate dependency and requires its own review.

Evidence recipe: `bun test --config=tools/quality/missions-v3.bunfig.toml
tools/quality/missions-v3.test.ts`, then full repository `bun run check` after
catalog/loaders/projections are integrated by their owner. The pure context and
reference oracle contain synthetic observations, not authenticated production
membership, storage receipts or a distributed transaction implementation.

## Reconciliation successor

The 028e8b3 rejects remain immutable. Current candidate observations separate
unknown availability from durable lifecycle/history. Both independent owner
oracles consume the explicit reference-reconciliation fixture matrix, including
finality, monotone confirmation and exact release-proof replay. The inherited
inventory now binds all 213 base contract files except the augmented catalog;
all 112 original catalog entries are separately compared. An empty/incomplete
inventory or altered source byte fails the gate. These repairs still require
fresh role-separated reviews on the successor commit.


## Subsequent specification-lock package

The original authoring and review states above remain historical records.
The later exact-tree role attestations, proposed fifteen-authority transition
and explicit non-runtime consumer boundary are recorded in
[the specification-lock dossier](build-brief-missions-specification-lock.md).
That dossier does not replace a final promotion review or protected integration.
