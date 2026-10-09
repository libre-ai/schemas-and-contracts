# HarnessProfile v3, candidate contract declaring k and w

Decision identifier: `urn:libre-ai:decision:2026-10-09-harness-profile-v3`.
Status: accepted — admits the contract as a **candidate**; it is not locked.
Owner-arbitration: 2026-10-09 — ADR-0046 Q1 (k and w in the harness profile) tranché en chat le 2026-10-09 ; réalisation contractuelle arbitrée « go all » le 2026-10-09

## Context

`libre-ai/project-governance` ADR-0046 (accepted 2026-10-09) places the
parameters of the no-progress guard, `k` (`repeatThreshold`) and `w`
(`windowSize`), in the harness profile (Q1), bound to the run by
`harness-attestation.v1` `effectiveProfileDigest`. It authorizes "une révision
du candidat `harness-profile.v2`" that declares them, and adds that a revision
leaving `k` or `w` outside the attested effective profile would make the
evaluator's constancy check unverifiable against its source.

## Why a new major and not an in-place revision

Two facts of this repository decide it, measured on `197d829`:

1. `contracts/COMPATIBILITY.md`, "Pre-implementation candidates": an undefined
   behaviour is not completed in place when doing so changes an accepted payload
   or a digest meaning; a new major candidate is created. A required
   `noProgressGuard` makes every existing v2 payload invalid and changes what
   `profileDigest` covers.
2. `contracts/schemas/harness-profile.v2.schema.json` is a preserved file of the
   Build Brief / Missions specification lock
   (`docs/reviews/build-brief-missions-specification-lock.json`, `preservedFiles`,
   sha256 `effbf2f1…305634`), whose evidence digest is pinned in
   `tools/quality/specification-lock.ts`. Editing v2 would fail that gate, and
   changing the pinned evidence is outside this arbitration.

The ADR's intent — `k` and `w` declared by the profile, inside the attested
effective profile — is carried in full by `harness-profile.v3`. v2 stays
byte-identical and remains a candidate.

## Implementation choices not decided by ADR-0046

The most restrictive option compatible with the ADR was taken each time.

- **The guard is required.** A v3 profile cannot omit `k` and `w`; there is no
  default. A profile without them would leave the observation documents'
  constancy check without a source (ADR-0046, Conséquences).
- **The reaction is a constant**, `signal-at-k-minus-one-then-typed-stop`
  (Q5): a profile cannot declare tool withdrawal or any other reaction.
- **Bounds equal those of `tool-invocation-observation-v1`**: `k` and `w` from 2
  to 1024. `k ≤ w` is a resolution rule, since JSON Schema cannot compare two
  fields (`contracts/harness-profile-v3/SEMANTICS.md`).
- **No overlap field.** The overlap is `k − 1` by ADR-0046 Q2; declaring it
  separately would allow disagreement.

## Decision

`harness-profile-v3` is registered as a post-lock catalog addition with status
**candidate** (`contracts/catalog-post-lock-additions.v1.json`, digest re-pinned
in `tools/quality/specification-lock.ts`), classified `internal`,
major-versioned, owners and consumers unchanged from v2. Semantics:
`contracts/harness-profile-v3/SEMANTICS.md`. Review dossier:
`docs/reviews/harness-profile-v3-review.md`.

`harness-profile.v2`, `harness-attestation.v1`,
`tool-invocation-observation-v1` and every locked authority stay
byte-identical.

This record admits a candidate entry. It is not a role verdict and grants no
runtime admission. Promotion to `locked` is a separate owner act, after the
role passes named in the review dossier.
