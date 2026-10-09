# Review dossier — decision-binding vectors v1 (a request restates its step's policy)

- **Candidate:** semantic vector set
  `contracts/fixtures/authorized-execution-v1/decision-binding-vectors.v1.json`
  (`libre-ai.authorized-execution-decision-binding-vectors.v1`) and its reference oracle
  `tools/quality/decision-binding.ts`.
- **Status:** candidate, authored solo; not locked. The locked authorized-execution family
  (`authorized-execution-contracts-review.md`) is untouched: no locked schema, digest vector or
  semantic vector changes, and their reviewed SHA-256 values still hold.
- **Required roles:** architecture, security.
- **Owner instruction:** 2026-10-09, in session. Prepare the amendment for the defect below.
  Promotion to `locked` remains an owner act.

## Defect this candidate closes

The locked semantic vectors judge a human-decision response against its request only
(`decision` domain, 11 cases). Nothing binds the **request** to the graph it claims to serve.
The request carries its own `choices` (`choiceId` → `consequenceCode`), `noResponseOutcomeCode`
and `requiredRole`, and the graph's `decisionPolicy` carries the authorized ones (`choiceId` →
`outcomeCode`, `noResponseOutcomeCode`, `requiredRole`). A conformant evaluator therefore
accepts a request that:

- **inverts outcomes**: the choice the approver reads as `reject` carries `approved`. Routing
  does not catch it, because both codes are valid outcomes of the step;
- **lowers the role**: the request requires `viewer` where the policy requires `approver`, so the
  role check runs against the request's weaker role;
- changes the no-response outcome, or adds or drops a choice.

Observed in the Rust implementation `libre-ai/execution-continuity-evaluator`
(`evaluate_human_decision` returns the request's `consequenceCode` without consulting the
graph) while studying an external control plane whose approval was likewise not bound to what
it authorized. No runtime consumes that evaluator yet, so the defect is latent.

## Semantics (reference oracle)

`evaluateDecisionBinding({ domain: "decision-binding", graph, request })`, in this order:

1. `graph-binding-mismatch` — `request.graphDigest` is not `graph.graphDigest`;
2. `step-not-decision` — `request.stepId` names no step, or a step whose `kind` is not
   `human-decision`;
3. `decision-policy-mismatch` — the request's `choiceId` → `consequenceCode` map is not exactly
   the policy's `choiceId` → `outcomeCode` map (order irrelevant), or its
   `noResponseOutcomeCode` or `requiredRole` differs from the policy's;
4. otherwise `decision-request-bound`.

A repeated `choiceId` is malformed input (thrown), not an outcome. The check is meant to run
when a request is issued and again when its response is evaluated. It is a separate domain, so
the precedence of the locked `decision` outcomes is unchanged.

## Evidence

- 10 vectors cover the 4 outcomes; the document checker refuses an uncovered outcome, unknown
  properties and a domain mismatch (`tools/quality/decision-binding.test.ts`, 4 tests).
- Discrimination, measured in a disposable worktree:
  - replacing the mapping comparison by a size comparison makes 2 tests red, including
    `binding-swapped-outcomes`;
  - dropping the role comparison makes `binding-lowered-required-role` red.

## Not covered

- `request.expiresAt` against `policy.expiresAfterSeconds`: the request carries no issue
  instant, so the bound cannot be checked from the request alone. It is left to the issuer.
- The `requestSchemaRef` and `responseSchemaRef` digests of the policy.
- `request.planDigest` against an authorized plan: the graph does not carry its plan.
- SDK projections. A vector file is not a schema, so `sdk-ts` and `sdk-rs` have nothing to
  regenerate. Conformance is proved in the implementing repository, against this authority at
  a pinned revision.

## Review passes

Pending: architecture and security, each a review-only pass on the immutable authoring commit
named in the pull request.
