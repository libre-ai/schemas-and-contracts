# ExecutionPlanBody v4 — semantics (candidate)

`execution-plan-body.v4` realizes, at plan level, the isolation that
`libre-ai/project-governance` ADR-0045 (accepted 2026-10-09) requires: INV-a (no
untrusted string before a model that holds an effect tool), INV-b (provenance per
value, policy per argument) and INV-c (closed-vocabulary quarantine output). The
default realization is Plan-Then-Execute on the authorized graph of ADR-0034.

v4 keeps every v3 field, constant and bound byte for byte in meaning, except the
plan-wide `tools` list (v3 `minItems: 1`), which is replaced by `isolation` and
`steps`. `execution-plan-body.v3` is unchanged. k and w of ADR-0046 are not plan
fields: the harness profile declares them (ADR-0046 Q1, `harness-profile-v3`).

## `isolation` — decisions a plan cannot weaken

| Field | Value | Source |
| --- | --- | --- |
| `realization` | `plan-then-execute` or `action-selector`, chosen per plan | ADR-0045 decision 2 |
| `toolResultDelivery` | constant `opaque-reference`: no tool result enters any model context | decision 2 (outputs only select an authorized branch) |
| `argumentPolicyAuthority` | constant `agent-harness` | decision 5 (Q3) |
| `argumentPolicyEvaluation` | constant `per-argument-with-implicit-dependencies` | INV-b |
| `argumentPolicyRefusal` | constant `fail-closed-terminal`: no human decision follows a refusal | decision 6 (Q5) |

Code-Then-Execute (option D) is not a value: it opens through its own contract
increment (decision 2).

`action-selector` additionally requires every step to be `privileged` and every
input to be `trusted`: nothing untrusted is read and no output returns.

## `steps` — one binding per worker step of the authorized graph

Each entry binds a `stepId` of the graph referenced by `executionGraph` to a role,
its tools and its inputs. Exactly the graph steps of kind `calculation` and
`external-effect` carry a binding; a `human-decision` or `terminal` step carries
none. This cross-document rule is checked when the plan is resolved against its
graph, not by the schema.

- **`privileged`** — may hold tools. An input of `untrusted` provenance is
  delivered only as an `opaque-reference`, resolved by a deterministic component
  outside the model (INV-a). It carries no `quarantineOutput`.
- **`quarantine`** — holds **no tool** (`tools` is empty, the constraint v3 could
  not express). It may read untrusted content `in-context`. Its output is declared
  by `quarantineOutput` (INV-c).

### Tools

Every tool declares `access`, an `effectClass` and its `argumentPolicyDigest`.
`effectClass` is `none` for `read` and `effect` for `write`, `execute` and
`network` (a network read can exfiltrate through a URL, ADR-0045 INV-a). The two
cannot disagree: the schema derives one from the other.

`untrustedArgumentAdmissions` is required, possibly empty. It is the only way a
value of untrusted provenance may reach a parameter: the named `parameter`
admits the named `sourceField` of an earlier `quarantine` step `sourceStepId`.
Anything else that depends on untrusted content — directly, through any derived
value, or through a condition (implicit dependency) — is refused, fail-closed and
terminal for the call. The harness evaluates this with the policy that
`argumentPolicyDigest` pins.

### Inputs

`source` is `trusted-request`, `untrusted-content` (with its `contentRef`) or
`step-output` (with the producing `stepId`). `provenance` is `trusted` for a
trusted request and `untrusted` for everything else, a step output included; the
schema refuses any other pairing, so the mark cannot be lost.

### Quarantine output

`fields` are closed by construction: `enum` (identifier values), `identifier`
(validated against the pinned `referential`), `boolean`, or `integer` with both
bounds. There is no free-text kind. A failure or a lack of information is one of
`failureCodes`, never text. At run time a quarantine result is either
`{ "status": "ok", "values": { <every declared field> } }` or
`{ "status": "failed", "failureCode": <declared code> }`; anything else is
rejected and produces no call.

## Resolution rules outside the schema

A schema-valid plan is resolvable only if, in addition:

1. step identifiers are unique, and tool names, input identifiers and output
   field names are unique within a step;
2. a `step-output` input names an earlier step of the list;
3. every admission names an earlier `quarantine` step and one of its fields of
   kind `enum` or `identifier`. A `boolean` or `integer` extracted from untrusted
   content is closed but still attacker-chosen (a switch, an amount), so it is
   never admitted as an argument; a branch on it belongs to the graph;
4. integer bounds are ordered;
5. the bindings cover exactly the worker steps of the referenced graph.

## Verdicts of a future evaluator or harness

The ADR-0045 vectors (`contracts/fixtures/execution-plan-body-v4/red-vectors.json`)
declare one closed verdict each:

| Verdict | Meaning |
| --- | --- |
| `plan-resolvable` / `plan-invalid` | the resolution rules above |
| `call-admitted` / `call-refused-by-argument-policy` | INV-b on a proposed call |
| `privileged-context-clean` / `untrusted-bytes-in-privileged-context` | INV-a on a captured privileged prompt, compaction included |
| `quarantine-output-accepted` / `quarantine-output-rejected` | INV-c on a quarantine result |

`tools/quality/execution-plan-body-v4.ts` is the reference oracle that executes
these verdicts for the vectors. It is not a runtime. Its byte-level check of a
captured prompt flags any shared window of 8 bytes with the untrusted document,
because "no byte of the document" cannot be checked literally on natural
language; provenance labels remain the primary control.

ADR-0045's fourth vector (an adaptive attack suite reporting utility and attack
success together) measures a runtime, not a contract, and is not represented here.

## Not covered

`execution-authorization.v3` fixes `planSchemaVersion` to v3. Only the candidate
`execution-authorization.v4` accepts a v4 plan
(`contracts/execution-authorization-v4/SEMANTICS.md`), and it activates nothing:
no harness executes a v4 plan before this oracle, or that harness, passes the
ADR-0045 red vectors. No runtime capability opens, which matches ADR-0045.
