# Review dossier — HarnessProfile v3 (candidate)

- **Candidate contract:** `harness-profile-v3`
  (`contracts/schemas/harness-profile.v3.schema.json`).
- **Status:** `pending-independent-agent-review` (catalog `review.state`), authored solo.
- **Required roles (catalog `review.required`):** architecture, security.
- **Decision:** `libre-ai/project-governance` ADR-0046 (accepted), Q1; decision record
  `docs/adr/2026-10-09-harness-profile-v3.md`. Owner-arbitration: 2026-10-09.
- **Semantics:** `contracts/harness-profile-v3/SEMANTICS.md`.

## What this dossier is, and is not

It satisfies the catalog's mechanical requirement that a `candidate` entry name a
dossier under `docs/reviews/` bound to the independent agent review protocol
(`contracts/COMPATIBILITY.md` "Evidence"). The protocol lives in the governance
authority, `docs/reviews/AGENT-REVIEW-PROTOCOL.md`; the local pointer file is still
missing from this repository, the gap already recorded by
`docs/reviews/harness-profile-v2-review.md`.

It is **not** a completed review. No role pass has run. Each role requires a
review-only pass on an immutable commit before promotion; promotion to `locked` is an
owner act.

## Delta from v2

Exactly three schema hunks: `$id` and `title`; `schemaVersion` constant
`libre-ai.harness-profile.v3`; one required property `noProgressGuard`
(`repeatThreshold`, `windowSize`, `reaction`). The v2 major finding still open
(`workerTransport.kind` × `verifyOsPeer` compatibility lives only in engine
behaviour) is inherited unchanged and is not addressed here.

## Questions for each role

| Role | Questions the pass must answer |
| --- | --- |
| architecture | Is a new major the right vehicle, given ADR-0046 names "une révision du candidat v2" and v2 is pinned by the specification lock evidence? Does placing `k` and `w` in the profile keep one authority per subject (I-03) next to `tool-invocation-observation-v1`, which repeats them per document? |
| security | Can a profile weaken the guard (absent guard, `k` of one, reaction other than the typed stop, `k > w`)? Is the `k ≤ w` refusal at resolution, outside the schema, acceptable, given the Rust projection shares no comparison extension? |

## Evidence available to the passes

- `bun run check:harness-profile-v3`: the canonical fixture accepted, 13 mutations
  refused, the profile digest vector reproduced over RFC 8785, and 6 schema-valid
  semantic vectors resolved to their expected verdict (`profile-resolvable` for
  `k < w`, `k = w`, both bounds; `profile-invalid` for `k > w` and a wrong digest).
- The digest vector was cross-checked by a second instrument at authoring time:
  `jq -S -cj . | shasum -a 256` gives `876e5ff9…5489f09`, the vector's value.
- Schema discrimination and the neutralization of the `k ≤ w` rule are reported in the
  pull request that introduced this candidate.
