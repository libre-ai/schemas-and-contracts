# Review dossier — decision-binding vectors v1 (a request restates its step's policy)

- **Candidate:** semantic vector set
  `contracts/fixtures/decision-binding-candidate/decision-binding-vectors.v1.json`
  (`libre-ai.authorized-execution-decision-binding-vectors.v1`) and its reference oracle
  `tools/quality/decision-binding.ts`.
- **Status:** candidate, authored solo; not locked. It sits outside the locked family's
  directory on purpose. The locked authorized-execution family
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
- changes the no-response outcome, or adds, drops or substitutes a choice.

Observed in the Rust implementation `libre-ai/execution-continuity-evaluator`
(`evaluate_human_decision` returns the request's `consequenceCode` without consulting the
graph) while studying an external control plane whose approval was likewise not bound to what
it authorized. No runtime consumes that evaluator yet, so the defect is latent.

`agent-orchestration/SEMANTICS.md` already states that a human decision binds one
organization, run, step and closed choice set. This candidate vectorizes that intent for the
request side; it reinterprets no locked outcome.

## Semantics (reference oracle)

`evaluateDecisionBinding({ domain: "decision-binding", graph, request })`, in this order:

1. `graph-binding-mismatch` — `request.graphDigest` is not `graph.graphDigest`, or
   `request.organizationId` is not `graph.organizationId`;
2. `step-not-decision` — `request.stepId` names no step, or a step whose `kind` is not
   `human-decision`;
3. `decision-policy-mismatch` — the request's `choiceId` → `consequenceCode` map is not exactly
   the policy's `choiceId` → `outcomeCode` map (order irrelevant), or its
   `noResponseOutcomeCode` or `requiredRole` differs from the policy's (exact string equality;
   no role hierarchy);
4. otherwise `decision-binding-valid`.

Malformed input throws and is never resolved to an outcome:

- a repeated `choiceId` on either side;
- a `stepId` carried by two steps of the graph (the answer would otherwise depend on array
  order);
- a `human-decision` step without `decisionPolicy`;
- a missing or non-string field;
- an unknown `domain`.

Outcome names and case identifiers follow the locked convention (`*-valid`, ids prefixed by the
domain). `step-not-decision` merges "unknown step" and "wrong kind", and
`decision-policy-mismatch` merges three sub-causes. Both are closed sets on purpose: a caller
needs one refusal, not a diagnosis.

**Preconditions owned by the caller.** The oracle does not check them:

- both documents are schema-valid. For instance, a request offers 2 to 4 choices, `other`
  carries `replan-required`, and unknown keys are refused;
- the graph is the authorized one and its digest was recomputed from its content. The
  `graphDigest` preimage covers `organizationId` and `steps`, so a matching digest binds them;
  without that check the binding proves nothing;
- the graph itself is valid (`graph-valid`, `authority-valid`).

This candidate defines the request-side binding as its own domain and does not compose it with
the locked `decision` domain. The order between their outcomes (for example `request-expired`
against `decision-policy-mismatch`) is left to the implementing evaluator, which must run the
binding before applying a decision.

## Evidence

- 16 vectors cover the 4 outcomes. Each defect has its own vector: other graph, other
  organization, unknown step, wrong kind, swapped outcomes, extra / removed / substituted choice,
  other no-response outcome, lowered and raised role. Three double-defect vectors fix the
  precedence: graph before step, graph before policy, step before policy.
- `tools/quality/decision-binding.test.ts`, 4 tests: replay of every case; inversion; document
  checker; malformed input. The document checker refuses an uncovered outcome, unknown
  properties, a domain mismatch, an invalid or repeated id, and a case that does not replay.
  Malformed input covers repeated choices on both sides, a duplicated step in both orders, a
  missing policy and an unknown domain.
- Discrimination, measured in a disposable worktree on the remediation commit. Each line
  replaces the guard by an exact `perl -0pe` substitution in `tools/quality/decision-binding.ts`,
  then runs `bun test tools/quality/decision-binding.test.ts`:

| Neutralized guard | Substitution | Red |
| --- | --- | --- |
| choice mapping | `!sameMapping(offered, allowed)` → `offered.size !== allowed.size` | 3 of 4 |
| role equality | the `requiredRole` comparison → `false` | 1 of 4 (replay) |
| organization equality | the `organizationId` comparison → `false` | 1 of 4 (replay) |
| duplicated-step refusal | `if (named.length > 1) throw` → `if (false) throw` | 1 of 4 (malformed input) |

## Not covered

- `request.expiresAt` against `policy.expiresAfterSeconds`. The request carries no issue
  instant, so the bound cannot be checked from the request alone. Effect: an issuer may grant an
  arbitrarily long approval window and the binding still holds. The issuer must bound it.
- The policy's `requestSchemaRef` and `responseSchemaRef` digests. Effect: a response could be
  judged under another schema version than the policy names.
- `request.missionId`, `runId` and `planDigest` against the authorized plan. The graph carries
  neither its plan nor its run, so these bindings belong to the plan and run layers, not to this
  check.
- Consistency of the policy's `outcomeCode`s with the step's `outcomeCodes`. This is a
  graph-validity property (`authority-valid`), not a request binding.
- **Catalog registration.** The catalog has no kind for semantic-vector files, and the locked
  `semantic-vectors.v1` is not catalogued either: it is guarded by its reviewed hash in
  `authorized-execution-lock.test.ts`. Until a kind exists, the candidate status is carried by
  this dossier and by the file's location outside the locked family. Adding the kind, the
  catalog entry and the hash at lock time is part of the owner's promotion act.
- SDK projections. A vector file is not a schema, so `sdk-ts` and `sdk-rs` have nothing to
  regenerate. Conformance is proved in the implementing repository, against this authority at
  a pinned revision.

## Review history

### Round 1 — authoring commit `00ee93ae32d54b984509f3ddd09b60c7fc70f905`

Both passes were review-only, each on its own fresh clone of the immutable commit, on two
distinct models.

| Role | Verdict | Findings and disposition |
| --- | --- | --- |
| architecture | **accept-with-findings**, 0 blocking, 3 major, 6 minor | Major 1: candidacy is prose-only and the file sits in the locked family's directory. The file is moved out; catalog registration is recorded above as a lock-time act. Major 2: no vector fixed the precedence. Three double-defect vectors added. Major 3: no organization binding, preconditions unstated. `organizationId` bound; preconditions written. Minor findings: naming aligned to `*-valid` and domain-prefixed ids; a pure removal vector added; the document checker now checks ids and replays every case; mutation commands published; the claim about running the check twice is replaced by the composition statement. The two merged-cause minors are kept, with the reason stated. |
| security | **accept-with-findings**, 0 blocking, 2 major, 3 minor | Major 1: a duplicated `stepId` resolved by array order. Now refused (throws), tested in both orders. Major 2: `graphDigest` taken as declared. Recomputation stated as a caller precondition. Minors: the schema-validity precondition, role-equality semantics, effects of the uncovered items, a raised-role vector and missing-policy, policy-side repeat and domain tests are all added. |

### Round 2 — remediation commit

Pending: architecture and security re-review the remediation commit named in the pull request.
