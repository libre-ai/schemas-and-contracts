# P02 export v1 — semantics (candidate)

Schema: `contracts/schemas/p02-export.v1.schema.json`. Vectors:
`contracts/fixtures/p02-export-v1/vectors.json`, checked by
`tools/quality/p02-v1-contracts.test.ts`. Owner and only producer: the P02
information watch product (`information-watch`, provisional name). This is the
complete export of one organization (requirement G2 of the P02 product
requirements: an export without lock-in, reimportable in full).

## Scope

One document carries every member of one organization: sources, folders,
items with their provenance and versions, per-item states, annotations, every
version of every curation rule set, the visibility decisions taken on them, and
the preferences. It carries no credential, no session and no secret.

## Provenance (requirement G1)

Each item records, in `provenance`: the source and feed URL at the moment of
fetch, the fetch identifier, the HTTP status, the validators (`etag`,
`lastModified`), the collection instant, the declared publication date with
its state (`present` with a value, `absent`, or `malformed` with no value), the
declared GUID, and the canonical URL with the name of the canonicalisation rule.

Each version of the item carries its own transform chain, because the content
of two versions can come from different origins:

- `contentOrigin` is required, and is `feed` (the content is the feed entry) or
  `extracted` (the content was extracted from the page the entry links to);
- `sanitizerVersion` is required and non-null in both cases;
- `extractorVersion` is **required and non-null** when `contentOrigin` is
  `extracted`, and **absent** when `contentOrigin` is `feed`. The schema encodes
  this with a conditional on the version object. An export therefore always
  says which extractor produced the content it carries, or that none did.

Each version also carries the BLAKE3 digest of its content and the instant it
was recorded.

## Digest (invariant I-10)

`digest` is the lowercase hexadecimal SHA-256 of the RFC 8785 (JCS) form of the
export **without its `digest` and `signature` members**. The reference rule is
`tools/quality/export-digest.ts`. The `signature` is excluded because it signs
the digest: including it would make the digest depend on itself.

Array order is material. Adding, removing or reordering an item, a state, a
rule set version or a decision changes the digest. Member order and whitespace
in the transmitted bytes are immaterial.

The digest detects corruption, truncation and accidental edits. It does not
authenticate: whoever changes the content can recompute it.

## Signature (optional)

`signature` is `{ kid, signature }`. A signed export carries the Ed25519
signature of the 32 raw bytes of `digest` under the key identified by `kid`.
The schema checks only the shape (an 86-character base64url value). A
schema-valid signature is not a verified one: verification is a product
obligation, with the key taken from the trust context, never from the document.

An export leaving its producing organization must be authenticated by the
signature. An unsigned export is a local artefact; an importer that cannot
establish its origin refuses it, whatever its digest.

## Bounds

Sources at most 1 000, folders at most 1 000, items and states at most 500 000,
annotations at most 100 000, embedded rule set versions at most 10 000,
decisions at most 5 000 000. The item bound is the largest default quota in the
product's plans; raising a bound changes the contract and is a compatibility
decision.

## Cross-references

`states`, `annotations`, `decisions` and `items[].sourceId` refer to identifiers
in the same document. JSON Schema cannot check those references; the importer
must, and refuses the whole export when one is dangling.

## Preferences

v1 carries one preference, `theme`. Adding a preference is an additive change
only when it cannot alter the meaning of an existing member; otherwise it is a
new major version.
