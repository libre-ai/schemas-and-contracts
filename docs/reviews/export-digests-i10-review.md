# Review dossier — export digests for I-10 (candidates)

- **Candidate contracts:** `curated-item-export-v3`
  (`contracts/schemas/curated-item-export.v3.schema.json`) and
  `practice-progress-export-v2`
  (`contracts/schemas/practice-progress-export.v2.schema.json`).
- **Status:** `pending-independent-agent-review` (catalog `review.state`), authored solo.
- **Required roles (catalog `review.required`):** architecture, security,
  cryptography, privacy.
- **Decision:** `libre-ai/project-governance` ADR-0049 (accepted), I-10 as
  widened; decision record `docs/adr/2026-10-10-export-digests-i10.md`.
  Owner-arbitration: 2026-10-10.
- **Semantics:** `contracts/curated-item-export-v3/SEMANTICS.md`,
  `contracts/practice-progress-export-v2/SEMANTICS.md`.

## What this dossier is, and is not

It satisfies the catalog's mechanical requirement that a `candidate` entry name a
dossier under `docs/reviews/` bound to the independent agent review protocol
(`contracts/COMPATIBILITY.md` "Evidence"). The protocol lives in the governance
authority, `docs/reviews/AGENT-REVIEW-PROTOCOL.md`.

It is **not** a completed review. No role pass has run. Each role requires a
review-only pass on an immutable commit before promotion; promotion to `locked` is
an owner act.

## Delta from the previous majors

For each contract, exactly three schema hunks: `$id` and `title`; the
`schemaVersion` constant; one required property `digest`
(`common.v1.schema.json#/$defs/sha256`). A test asserts that every other property
equals the previous major's.

## Questions for each role

| Role | Questions the pass must answer |
| --- | --- |
| architecture | Is the digest-without-itself preimage the right convention, given `session-export.v1` defines none and `signalement-local-export-v1` separates `payload` from its approval instead? Is "inside the producing context" checkable by a runtime, or does it need a ledger rule in the contract? |
| security | Does the import order (strict JSON, schema, digest) close parser differentials? Is refusing every foreign bare export, which blocks Radar's portable download until a sealed form exists, the right failure mode? |
| cryptography | Is AEAD over signature justified for `personal` exports? Which parameters should the future sealed-export contract take from `notebook-backup-v2`, and must its AAD bind `schemaVersion` and `digest`? |
| privacy | Does the digest itself leak anything about personal content (it is over the whole export, so it is a stable identifier of that export)? Is the per-item `normalizedDigest` still needed alongside the export digest? |

## Evidence available to the passes

- `bun run check:export-digests`: for each contract, the canonical fixture
  accepted with its digest reproduced, the schema mutations refused, 2 digest
  vectors reproduced over RFC 8785, and 8 raw import vectors resolved to their
  verdict (2 importable, 6 refused: flipped digest, content changed, entries
  dropped, duplicate member masking a change, missing digest, uppercase digest).
- The digest vectors were cross-checked by a second instrument at authoring time:
  `jq -S -cj . | shasum -a 256` over each unsigned export gives the vector's value.
- Schema discrimination and the neutralization of the import rule are reported in
  the pull request that introduced these candidates.
