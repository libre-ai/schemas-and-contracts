# Practice progress export v2 — semantics (candidate)

`practice-progress-export.v2` is `practice-progress-export.v1` plus one
required member, `digest`. Every other member, constant and bound is unchanged,
byte for byte in the schema; outcomes remain `activity-outcome.v1` documents.
Its decision is `libre-ai/project-governance` invariant I-10 as widened by
ADR-0049 (accepted 2026-10-10); decision record
`docs/adr/2026-10-10-export-digests-i10.md`.

## The export digest

`digest` is the lowercase hexadecimal SHA-256 of the UTF-8 RFC 8785 (JCS)
form of the whole export **without its `digest` member**: `schemaVersion`,
`exportedAt` and every outcome. This is the convention of this authority for a
digest carried inside the object it covers (`harness-profile.v3`
`profileDigest`); the digest has no self-reference. Member order and
insignificant whitespace in the transmitted bytes are immaterial; array order
is material. Each outcome's `responseDigest` keeps its meaning and is covered
by the export digest like any other member.

## Import: refuse closed

An importer accepts an export only if, in this order:

1. the raw bytes are strict JSON: UTF-8 without BOM, no duplicate member name,
   no lone surrogate, depth at most 16;
2. the schema accepts the document, which requires `digest`;
3. the recomputed digest equals `digest`.

Any other outcome is a refusal of the whole export. Nothing is repaired,
partially imported or re-digested by the importer. The reference rule is
`tools/quality/export-digest.ts`; it is a test oracle for the vectors in
`contracts/fixtures/practice-progress-export-v2/vectors.json`, not a runtime.

## What the digest proves, and what it does not

The digest detects corruption, truncation and accidental edits. It does not
authenticate: whoever changes the content can recompute it. A falsification by
the learner who holds the export is an accepted risk (I-10, project-governance
risk register R9).

## Leaving the trust context

The trust context of a progress export is the learner's local store on the
device that produced it; the export carries no tenant and no account
(`docs/protocols/ai-practices/practices.md`, user journey 3). A file written and
read back on that device stays inside it. Moving the "portable progress
bundle" to another device, to a third party or to a service leaves it.

Outside its producing context an export must be authenticated by AEAD; the
decision record states why AEAD and not a signature. **This candidate defines
no sealed form.** Until a sealed-export contract is qualified:

- a producer does not hand the bare `practice-progress-export.v2` document
  across the boundary of its producing context;
- an importer that cannot establish that the bytes were produced in its own
  context treats them as foreign and refuses them, whatever their digest.
