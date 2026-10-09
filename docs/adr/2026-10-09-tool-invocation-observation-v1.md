# Tool invocation observation, candidate contract

Decision identifier: `urn:libre-ai:decision:2026-10-09-tool-invocation-observation-v1`.
Status: proposed — owner signature required.
Owner-arbitration: 2026-10-09 (option "SC observation contract" arbitrated in chat; acceptance at signature)

## Context

No observed contract carries an individual tool invocation. `step-invocation.v1`
binds a step to a worker invocation, `orchestrator-event.v3` carries only the
total `budgetCounters.toolCalls`, `argumentPolicyDigest` in
`execution-plan-body.v3` is the digest of a per-tool policy, and
`effect-attestation.v1` covers single-emission external effects. The cause is
structural: `libre-ai/project-governance` ADR-0032 D3 keeps the worker loop
opaque. N identical calls below `maxToolCalls` therefore pass.

The doctrine change — what the orchestrator may now observe of the loop, and
what stays opaque — is `libre-ai/project-governance` ADR-0046 (proposed). This
record only admits the contract that ADR proposes.

## Alternatives

ADR-0046 weighs them on the four decision axes: one document per call, one
harness-attested aggregate per window, or harness-local detection with only the
verdict reported. It proposes the window aggregate.

## Decision

`tool-invocation-observation-v1` is registered as a post-lock catalog addition
with status **candidate** (`contracts/catalog-post-lock-additions.v1.json`,
digest re-pinned in `tools/quality/specification-lock.ts`), classified
`tenant-private`, major-versioned. Semantics:
`contracts/tool-invocation-observation-v1/SEMANTICS.md`. Review dossier:
`docs/reviews/tool-invocation-observation-v1-review.md`.

`execution-plan-body.v3` and every locked authority stay byte-identical.

This record admits a candidate entry. It is not a role verdict, it grants no
runtime admission, and it takes effect only when the owner merges it, after
ADR-0046.
