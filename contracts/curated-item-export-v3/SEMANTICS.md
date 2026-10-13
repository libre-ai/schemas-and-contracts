# Curated item export v3 — semantics (candidate)

`curated-item-export.v3` is `curated-item-export.v2` plus one required member,
`digest`. Every other member, constant and bound is unchanged, byte for byte in
the schema. Its decision is `libre-ai/project-governance` invariant I-10 as
widened by ADR-0049 (accepted 2026-10-10); decision record
`docs/adr/2026-10-10-export-digests-i10.md`.

## The export digest

`digest` is the lowercase hexadecimal SHA-256 of the UTF-8 RFC 8785 (JCS)
form of the whole export **without its `digest` member**: `schemaVersion`,
`tenantId`, `exportedAt` and every item. This is the convention of this
authority for a digest carried inside the object it covers
(`harness-profile.v3` `profileDigest`); the digest has no self-reference.
Member order and insignificant whitespace in the transmitted bytes are
immaterial; array order is material, so reordering, dropping or adding an
item changes the digest. The per-item `normalizedDigest` keeps its v2 meaning
and is covered by the export digest like any other member.

## Import: refuse closed

An importer accepts an export only if, in this order:

1. the raw bytes are strict JSON: UTF-8 without BOM, no duplicate member name,
   no lone surrogate, depth at most 16. A duplicate member would let two parsers
   disagree on the value that was digested;
2. the schema accepts the document, which requires `digest`;
3. the recomputed digest equals `digest`.

Any other outcome is a refusal of the whole export. Nothing is repaired,
partially imported or re-digested by the importer. The reference rule is
`tools/quality/export-digest.ts`; it is a test oracle for the vectors in
`contracts/fixtures/curated-item-export-v3/vectors.json`, not a runtime.

## What the digest proves, and what it does not

The digest detects corruption, truncation and accidental edits. It does not
authenticate: whoever changes the content can recompute it. A falsification by
the export's own holder is an accepted risk (I-10, project-governance risk
register R9).

## Leaving the trust context

The trust context of a curated export is the Radar service instance and tenant
that produced it. Radar's purpose includes a portable export downloaded by the
person (`docs/protocols/feed-radar/radar.md`, user journey 4 and the one-use
export download token): that download already delivers the export to another
device, which is outside the producing context in the sense of I-10.

Outside its producing context an export must be authenticated by AEAD; the
decision record states why AEAD and not a signature. **This candidate defines
no sealed form.** Until a sealed-export contract is qualified:

- a producer does not hand the bare `curated-item-export.v3` document across the
  boundary of its producing context;
- an importer that cannot establish that the bytes were produced in its own
  context treats them as foreign and refuses them, whatever their digest.

The portable-download journey is therefore not admitted by this candidate on
its own.
