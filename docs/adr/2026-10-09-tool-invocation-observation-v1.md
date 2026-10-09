# Tool invocation observation, candidate contract

Decision identifier: `urn:libre-ai:decision:2026-10-09-tool-invocation-observation-v1`.
Status: accepted — admits the contract as a **candidate**; it is not locked.
Owner-arbitration: 2026-10-09 — décisions Q1–Q6 d'ADR-0046 tranchées en chat le 2026-10-09 ; acceptation

## Context

No observed contract carries an individual tool invocation. `step-invocation.v1`
binds a step to a worker invocation, `orchestrator-event.v3` carries only the
total `budgetCounters.toolCalls`, `argumentPolicyDigest` in
`execution-plan-body.v3` is the digest of a per-tool policy, and
`effect-attestation.v1` covers single-emission external effects. The cause is
structural: `libre-ai/project-governance` ADR-0032 D3 keeps the worker loop
opaque. N identical calls below `maxToolCalls` therefore pass.

The doctrine change — what the orchestrator may now observe of the loop, and
what stays opaque — is `libre-ai/project-governance` ADR-0046, accepted on
2026-10-09. This record only admits the contract that ADR decides.

## Alternatives

ADR-0046 weighs them on the four decision axes: one document per call, one
harness-attested aggregate per window, or harness-local detection with only the
verdict reported. The owner confirmed the window aggregate (Q3).

## Owner decisions carried by the contract

- **Q1**: `k` and `w` are declared by the harness profile, not by the plan.
  Every window carries `windowSize` (`w`) and `repeatThreshold` (`k`). These
  are bound to the run through `harnessAttestationDigest`, and so to the
  attestation's effective profile digest. Nothing in the contract reads them
  from `execution-plan-body`.
- **Q2**: consecutive windows overlap by `k − 1` calls, so
  `firstCallSequence(n + 1) = lastCallSequence(n) − (k − 2)`. The first window
  starts at call 1, which the schema enforces. `k` is carried instead of a
  separate overlap field, so that the two cannot disagree.
- **Q4**: the digest key is scoped per run. `digestKey.scope` is the constant
  `run`, unchanged.
- **Q5**: the reaction is a typed stop only. It is not carried by this contract
  (SEMANTICS.md, last section).

## Decision

`tool-invocation-observation-v1` is registered as a post-lock catalog addition
with status **candidate** (`contracts/catalog-post-lock-additions.v1.json`,
digest re-pinned in `tools/quality/specification-lock.ts`), classified
`tenant-private`, major-versioned. Semantics:
`contracts/tool-invocation-observation-v1/SEMANTICS.md`. Review dossier:
`docs/reviews/tool-invocation-observation-v1-review.md`.

`execution-plan-body.v3` and every locked authority stay byte-identical.

This record admits a candidate entry. It is not a role verdict and grants no
runtime admission. Promotion to `locked` is a separate owner act, after the
role passes named in the review dossier.
