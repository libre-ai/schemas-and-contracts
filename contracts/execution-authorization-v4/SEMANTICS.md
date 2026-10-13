# ExecutionAuthorization v4 — semantics (candidate)

`execution-authorization.v4` lets Missions authorize an `execution-plan-body.v4`
plan. It is `execution-authorization.v3` with three changes and nothing else:

| Change | v3 | v4 |
| --- | --- | --- |
| `schemaVersion` | `libre-ai.execution-authorization.v3` | `libre-ai.execution-authorization.v4` |
| `planSchemaVersion` | `libre-ai.execution-plan-body.v3` | `libre-ai.execution-plan-body.v4` |
| `harnessProfileSchemaVersion`, `harnessProfileDigest` | absent | required: `libre-ai.harness-profile.v3` and its `profileDigest` |

Every other field, constant, bound and conditional is the v3 one. The test
`differs from v3 only by its majors and the harness-profile binding` undoes the
three changes and compares the result with the locked v3 schema.
`execution-authorization.v3` is unchanged, byte for byte (I-17).

## Activation condition

ADR-0045 decision 4: no runtime that puts a model in front of untrusted content
and an effect tool is activated before it holds INV-a, INV-b and INV-c and passes
their red vectors. This contract therefore opens no capability.

- A v4 plan is authorizable only through this contract, and this contract is a
  **candidate**: while it is one, a v4 authorization activates nothing.
- No harness executes a v4 plan until the reference oracle
  `tools/quality/execution-plan-body-v4.ts`, or that harness itself, passes the
  33 red vectors of `contracts/fixtures/execution-plan-body-v4/red-vectors.json`.
- The binding verdict `authorization-bound` below says that four documents agree.
  It is not an execution admission.

The schema `description` states the same condition, and a test ties its vector
count to the red-vector file.

## What the digests bind

- `planDigest` is the plan's `bodyDigest`. The RFC 8785 preimage covers the v4
  `isolation` and `steps`, so a change to either changes the digest and breaks the
  binding. Two binding vectors show it: one changes a step, one replaces the
  isolation realization and its steps.
- `graphDigest`, `missionRecordDigest`, `planQuorum`, `handoffBindingDigest`,
  `generation` and the lineage fields bind as in v3.
- `harnessProfileDigest` is the `profileDigest` of the harness-profile.v3
  document that the plan names in `harnessProfile`. k and w (ADR-0046 Q1) reach
  the run only through that profile, so an authorization cannot pair a v4 plan
  with a v1 or v2 profile, which declare neither.

## Binding rules outside the schema

Four documents bind (`tools/quality/execution-authorization-v4.ts`) only if each
is RFC 8785 canonical and schema-valid, and:

1. the plan resolves under the rules of `contracts/execution-plan-body-v4/SEMANTICS.md`;
2. the profile resolves under the rules of `contracts/harness-profile-v3/SEMANTICS.md`
   (`repeatThreshold ≤ windowSize`, `profileDigest` recomputed);
3. every mission-side and plan-side identity of `execution-authorization.v3` holds;
4. `plan.harnessProfile.id` equals the profile `id`, and `plan.harnessProfile.digest`
   and `authorization.harnessProfileDigest` both equal its `profileDigest`;
5. `authorizationDigest` is the SHA-256 of the RFC 8785 authorization without
   `authorizationDigest`.

The vectors are in `contracts/fixtures/execution-authorization-v4/`. Each refusal
names the exact failures it must produce; two of them reseal the whole chain so
that only the profile rule or only the plan rule refuses.
