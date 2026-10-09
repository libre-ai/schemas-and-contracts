# HarnessProfile v3 — semantics (candidate)

`harness-profile.v3` is `harness-profile.v2` plus one required object,
`noProgressGuard`. Every other field, constant and bound is unchanged, byte for
byte in the schema. Its decision is `libre-ai/project-governance` ADR-0046
(accepted 2026-10-09), Q1: the parameters `k` and `w` of the no-progress guard
are declared by the harness profile, never by the plan and never as fleet
constants.

## The guard

| Field | Meaning | Bound |
| --- | --- | --- |
| `noProgressGuard.repeatThreshold` | `k`: occurrences of one `(tool, argument digest, result digest, outcome)` couple that stop the invocation | integer, 2..1024 |
| `noProgressGuard.windowSize` | `w`: the number of consecutive calls of the sliding window the harness applies | integer, 2..1024 |
| `noProgressGuard.reaction` | the only reaction ADR-0046 admits (Q5): a factual signal at `k − 1`, a typed `no-progress` stop at `k`, no tool withdrawn | constant `signal-at-k-minus-one-then-typed-stop` |

The bounds are those of `tool-invocation-observation-v1` (`window.repeatThreshold`
and `window.windowSize`), so every value a v3 profile declares is a value an
observation document can carry.

## Resolution rules outside the schema

A profile is resolved only if the schema accepts it **and**:

1. `repeatThreshold ≤ windowSize`. Draft 2020-12 cannot compare two fields
   without a non-standard extension the Rust projection does not share, so this
   rule is a resolution refusal, exercised by the semantic vector
   `k above w is refused at resolution`.
2. `profileDigest` equals the SHA-256 of the RFC 8785 canonical profile without
   `profileDigest`, as for v1 and v2.

A refused profile is `profile-invalid`; nothing falls back to a default `k` or
`w`. The reference rule is `tools/quality/harness-profile-v3.ts`; it is a test
oracle for the vectors, not a runtime.

## Binding to the run

`k` and `w` reach a run only through the effective profile digest that
`harness-attestation.v1` carries (`effectiveProfileDigest`), which every
`tool-invocation-observation-v1` document binds through
`harnessAttestationDigest`. An observation stream whose `repeatThreshold` or
`windowSize` differs from the attested profile's guard is therefore an
attestation mismatch, not a new parameter value. `harness-attestation.v1` and
`tool-invocation-observation-v1` are not modified by this candidate.
