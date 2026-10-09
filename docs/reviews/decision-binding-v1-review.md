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

- **inverts outcomes**: the choice identified as `reject` carries `approved`. Routing does not
  catch it, because both codes are valid outcomes of the step. What the approver *reads* is the
  choice's `label`, which the policy does not carry (see Not covered);
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
- a `stepId` that names the request's step and is carried by two steps of the graph (the
  answer would otherwise depend on array order); duplicates elsewhere in the graph are a
  graph-validity matter (`duplicate-step`), not checked here;
- a `human-decision` step without `decisionPolicy`;
- a missing or non-string field;
- an unknown `domain`.

Outcome names and case identifiers follow the locked convention (`*-valid`, ids prefixed by the
domain). `step-not-decision` merges "unknown step" and "wrong kind", and
`decision-policy-mismatch` merges three sub-causes. Both are closed sets on purpose: a caller
needs one refusal, not a diagnosis.

**Preconditions owned by the caller.** The oracle does not check them:

- both documents are schema-valid. For instance, a request offers 2 to 4 choices, `other`
  carries `replan-required`, and unknown keys are refused. The oracle alone accepts two empty
  choice lists as bound and ignores unknown keys; the schema is what excludes them;
- the graph is the authorized one and its digest was recomputed from its content. The
  `graphDigest` preimage is the whole document without `graphDigest` (`excludedFields` of the
  `execution-graph-v1` case in `authorized-execution-v1/digest-vectors.v1.json`), so it covers
  `organizationId` and `steps`, and a matching digest binds them. Without that check the binding
  proves nothing;
- the graph itself is valid (`graph-valid`, `authority-valid`).

This candidate defines the request-side binding as its own domain and does not compose it with
the locked `decision` domain. The order between their outcomes (for example `request-expired`
against `decision-policy-mismatch`) is left to the implementing evaluator, which must run the
binding before applying a decision.

## Evidence

- 16 vectors cover the 4 outcomes. Each defect has its own vector: other graph, other
  organization, unknown step, wrong kind, swapped outcomes, extra / removed / substituted choice,
  other no-response outcome, lowered and raised role. Three double-defect vectors fix the
  precedence: graph before step, graph before policy, and step before policy. The last one
  documents rather than proves, since the policy lives in the step and no other order is
  realizable.
- Like the locked vectors, inputs are projections, not schema-complete documents (`"g"` for a
  digest; `id`, `label`, `missionId` and the like are omitted). Each case still respects the
  schema's structural rules; the pure-removal case uses a three-choice policy against a
  two-choice request.
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

- **The choice `label`.** The approver reads it, the request carries it, and the graph policy
  does not. Effect: a bound request may show "Reject" on the choice whose outcome is
  `approved`. The inversion by identifier is closed; the inversion by label is not. Closing it
  requires the policy to carry or bind the labels, which is a change to the locked
  `execution-graph-v1` (a new major), out of this candidate's reach. Until then the issuer must
  derive labels from the policy and never accept them from a requester.
- **`other` asymmetry.** The request schema forces `other` → `replan-required`; the policy
  schema does not. A policy mapping `other` to anything else can be bound by no valid request
  (always `decision-policy-mismatch`). This is a liveness problem and belongs to graph
  validity.
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
  catalog entry and the hash at lock time is part of the owner's promotion act. So is the
  file's final location, `contracts/fixtures/authorized-execution-v1/` next to the locked
  semantic vectors. That move changes the path a consumer pins, so no consumer pins the
  candidate path.
- **Composition with the locked `decision` domain.** No vector orders the two domains' outcomes
  (for example `request-expired` against `decision-policy-mismatch`). Two conformant evaluators
  may therefore report different combined verdicts; both refuse.
- SDK projections. A vector file is not a schema, so `sdk-ts` and `sdk-rs` have nothing to
  regenerate. Conformance is proved in the implementing repository, against the contract
  authority at a pinned revision, once this candidate is locked.

## Review history

### Round 1 — authoring commit `00ee93ae32d54b984509f3ddd09b60c7fc70f905`

Both passes were review-only, each on its own fresh clone of the immutable commit, on two
distinct models.

| Role | Verdict | Findings and disposition |
| --- | --- | --- |
| architecture | **accept-with-findings**, 0 blocking, 3 major, 6 minor | Major 1: candidacy is prose-only and the file sits in the locked family's directory. The file is moved out; catalog registration is recorded above as a lock-time act. Major 2: no vector fixed the precedence. Three double-defect vectors added. Major 3: no organization binding, preconditions unstated. `organizationId` bound; preconditions written. Minor findings: naming aligned to `*-valid` and domain-prefixed ids; a pure removal vector added; the document checker now checks ids and replays every case; mutation commands published; the claim about running the check twice is replaced by the composition statement. The two merged-cause minors are kept, with the reason stated. |
| security | **accept-with-findings**, 0 blocking, 2 major, 3 minor | Major 1: a duplicated `stepId` resolved by array order. Now refused (throws), tested in both orders. Major 2: `graphDigest` taken as declared. Recomputation stated as a caller precondition. Minors: the schema-validity precondition, role-equality semantics, effects of the uncovered items, a raised-role vector and missing-policy, policy-side repeat and domain tests are all added. |

### Round 2 — remediation commit `ffa8a8e77a32ffed242d1ac80c8ca99aea215eac`

Both passes ran on fresh clones of the immutable commit, on two distinct models.

| Role | Verdict | Round-1 status | New findings and disposition |
| --- | --- | --- | --- |
| architecture | **accept-with-findings**, 0 blocking | 6 resolved, 3 partial: candidacy marker, pure removal outside the schema, composition order | Major N1: the `label` is not bound. Declared Not covered with its effect and the issuer's rule; the defect wording is corrected. Minor N2: vectors are projections; stated, and the removal case is made schema-conformant. Minor N3: the `other` asymmetry is declared. Partials: final location and pinning stated; composition order declared. The four published mutations were replayed identically, plus one precedence mutation of the reviewer's own that turns `case[13]` and `case[14]` red. Locked hashes 13 of 13 intact. |
| security | **accept-with-findings**, 0 blocking | both majors resolved (the digest one as a declared precondition); minors resolved, or declared, or covered by probes | Minor N1: two empty choice lists are bound by the oracle alone; stated as excluded by the schema. Minor N2: the duplicate-step wording was broader than the behavior; reworded. No bypass found among the probes: absent organization, empty steps, `__proto__` and `constructor` ids, kind and step casing, a permuted mapping. |

### Round 3 — documentation and one vector

Round 3 changes the dossier and makes the pure-removal vector schema-conformant (three-choice
policy, two-choice request). The oracle and the other vectors are unchanged. Both roles confirm
on the commit named in the pull request.
