# ExecutionPlanBody v4 and the ADR-0045 red vectors, candidate contract

Decision identifier: `urn:libre-ai:decision:2026-10-09-execution-plan-body-v4`.
Status: accepted — admits the contract as a **candidate**; it is not locked.
Owner-arbitration: 2026-10-09 — ADR-0045 Q1–Q5 tranchées en chat le 2026-10-09 ; réalisation contractuelle arbitrée « go all » le 2026-10-09

## Context

`libre-ai/project-governance` ADR-0045 (accepted 2026-10-09) authorizes "la
conception, dans `libre-ai/schemas-and-contracts`, d'un contrat candidat de
version majeure `execution-plan-body.v4` et de ses vecteurs rouges". In v3 the
`tools` list belongs to the whole plan with `minItems: 1`, and no step restricts
it: a plan can declare neither a step without tools nor a component that reads
untrusted content without holding a tool. Each tool carries an
`argumentPolicyDigest`, but nothing gives that policy the provenance of an
argument.

## Decision

`execution-plan-body-v4` is registered as a post-lock catalog addition with
status **candidate** (`contracts/catalog-post-lock-additions.v1.json`, digest
re-pinned in `tools/quality/specification-lock.ts`), classified
`tenant-private`, major-versioned. It keeps the v3 owners and consumers and adds
`agent-harness`, which ADR-0045 decision 5 makes the sole authority of the
argument policy. Semantics: `contracts/execution-plan-body-v4/SEMANTICS.md`.
Review dossier: `docs/reviews/execution-plan-body-v4-review.md`. Vectors:
`contracts/fixtures/execution-plan-body-v4/`.

`execution-plan-body.v3`, `execution-authorization.v3`, `harness-profile.v2`,
`tool-invocation-observation-v1` and every locked authority stay byte-identical.

## Implementation choices not decided by ADR-0045

Where the ADR leaves the form open, the most restrictive option compatible with
it was taken. Each is a choice of this record, open to the review passes.

1. **Tools are attached to steps; the plan-wide list is removed.** The ADR allows
   either "une étape sans outil" or "rattacher les outils à l'étape". Attaching
   them declares, per step, exactly which tools a model holds. `maxCalls` becomes
   per step; the plan-wide `budgets.maxToolCalls` stays the hard bound.
2. **Two roles only.** A `quarantine` step holds no tool at all, not even a read
   tool, which is option C's quarantine. A `privileged` step never receives an
   untrusted input in context.
3. **No tool result enters a model context** (`toolResultDelivery` constant
   `opaque-reference`), in both realizations. Plan-Then-Execute lets outputs only
   select an authorized branch, and Action-Selector returns nothing to the model.
   Reading content therefore goes through a quarantine step.
4. **Every step output is untrusted provenance**, a privileged step's included.
   Only the trusted request is `trusted`.
5. **Explicit, required admission list per tool.** An empty list admits no
   untrusted value. An admission names one parameter, one earlier quarantine
   step and one field.
6. **Only `enum` and `identifier` fields may be admitted as arguments.** `boolean`
   and `integer` are closed but attacker-chosen (a switch, an amount), so they
   steer branches of the graph, never arguments.
7. **Implicit dependencies are always counted** (`argumentPolicyEvaluation`
   constant). A condition on an untrusted value taints every argument of the
   call, which is CaMeL's strict mode.
8. **The ADR's decisions are constants:** the harness as authority (Q3), refusal
   fail-closed and terminal with no human decision (Q5), and only
   `plan-then-execute` / `action-selector` as realizations (Q2; option D needs its
   own increment).
9. **The effect class is derived from the access in the schema**, so a `network`
   tool cannot be declared without effect.

## Consequences

- A v4 plan cannot be authorized: `execution-authorization.v3` fixes
  `planSchemaVersion` to v3, and no successor is created here. ADR-0045 opens no
  runtime capability, and an authorization successor is a separate increment.
- ADR-0045 places its red vectors "dans le dépôt qui portera le runtime". Those
  written here are contract vectors: each declares the verdict a future evaluator
  or harness must return. The runtime repository will replay them. The fourth
  vector, an adaptive attack suite, measures a runtime and is not represented.
- `tools/quality/execution-plan-body-v4.ts` is a reference oracle for the
  vectors, not a runtime.

This record admits a candidate entry. It is not a role verdict and grants no
runtime admission. Promotion to `locked` is a separate owner act, after the role
passes named in the review dossier.
