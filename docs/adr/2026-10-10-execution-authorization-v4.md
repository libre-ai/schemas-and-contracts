# ExecutionAuthorization v4, candidate contract for v4 plans

Decision identifier: `urn:libre-ai:decision:2026-10-10-execution-authorization-v4`.
Status: accepted — admits the contract as a **candidate**; it is not locked.
Owner-arbitration: 2026-10-10 — autorisation de plan v4 arbitrée en chat

## Context

`execution-plan-body-v4` (decision `docs/adr/2026-10-09-execution-plan-body-v4.md`)
cannot be authorized: `execution-authorization.v3` fixes `planSchemaVersion` to
`libre-ai.execution-plan-body.v3`
(`contracts/schemas/execution-authorization.v3.schema.json:130-132`). That record
named the authorization successor "a separate increment". The owner arbitrated
it in chat on 2026-10-10.

`libre-ai/project-governance` ADR-0045 (accepted 2026-10-09) authorizes the plan
contract and its red vectors, and does not authorize "l'ouverture d'une capacité
runtime" (ADR-0045, header "N'autorise pas"). Decision 4 makes activation
conditional: no runtime that puts a model in front of untrusted content and an
effect tool is activated before it holds INV-a, INV-b and INV-c and passes their
red vectors. This record opens a contract, not a capability, and writes that
condition into it.

## Decision

`execution-authorization-v4` is registered as a post-lock catalog addition with
status **candidate** (`contracts/catalog-post-lock-additions.v1.json`, digest
re-pinned in `tools/quality/specification-lock.ts`), classified
`tenant-private`, major-versioned, with the v3 owner and consumers. Semantics:
`contracts/execution-authorization-v4/SEMANTICS.md`. Review dossier:
`docs/reviews/execution-authorization-v4-review.md`. Vectors:
`contracts/fixtures/execution-authorization-v4/`.

The schema differs from v3 by three changes only: its own `schemaVersion`,
`planSchemaVersion` fixed to `libre-ai.execution-plan-body.v4`, and a required
pair `harnessProfileSchemaVersion` (constant `libre-ai.harness-profile.v3`) and
`harnessProfileDigest`.

`execution-authorization.v3`, `execution-plan-body.v4`, `harness-profile.v3`,
`harness-attestation.v1` and every locked authority stay byte-identical.

### Activation condition

While this contract is a candidate, a v4 authorization activates nothing. No
harness executes a v4 plan until the reference oracle
`tools/quality/execution-plan-body-v4.ts`, or that harness itself, passes the 33
red vectors of `contracts/fixtures/execution-plan-body-v4/red-vectors.json`. The
binding verdict of `tools/quality/execution-authorization-v4.ts` says only that
four documents agree; it is not an execution admission.

## Implementation choices

The arbitration fixed the three differences. Where their form was open, the most
restrictive option was taken. Each is a choice of this record, open to the review
passes.

1. **The harness profile is bound by major and digest**, the pattern v3 already
   uses for the mission record and the plan. A major alone would let a profile be
   swapped under an unchanged authorization until the plan is re-read; the digest
   makes the authorization itself refuse it.
2. **No separate digest for `isolation` or `steps`.** The plan `bodyDigest`, which
   `planDigest` carries, already covers both over RFC 8785. A second digest of a
   subset would add a field that can disagree with the first and protect nothing
   more. Two binding vectors show that a change to either breaks the binding.
3. **The activation condition is text in the contract (schema `description`,
   SEMANTICS) and in this record, not a data field.** A constant field such as
   "not executable" would describe a state, not a shape, and lifting it would need
   a new major even once the condition holds. The condition rests on evidence
   (red vectors passed), which the catalog status and the review dossier carry.
4. **Consumers are those of v3.** `agent-harness` is not added: the harness
   consumes the plan, and nothing here asks it to consume the authorization.
5. **`missionRecordSchemaVersion` stays `libre-ai.mission-record.v3`.** Its `plan`
   reference is an untyped artifact reference, so a v4 plan fits without change.

## Consequences

- `tools/quality/execution-authorization-v4.ts` is a reference oracle for the
  binding vectors, not a runtime. It issues nothing and verifies no quorum.
- The harness-attestation, the orchestrator events and the control document carry
  `authorizationDigest` and `planDigest` without a version; they are unchanged.
- Promotion to `locked` is a separate owner act, after the role passes named in
  the review dossier. Activation is a further act, after the condition above
  holds.

This record admits a candidate entry. It is not a role verdict and grants no
runtime admission.
