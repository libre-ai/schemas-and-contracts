# Catalog entries added after the Build Brief / Missions specification lock

Decision identifier: `urn:libre-ai:decision:2026-10-09-catalog-post-lock-additions`.
Status: accepted.
Owner-arbitration: 2026-10-09

## Context

`tools/quality/specification-lock.ts` admitted exactly one reviewed change: the
fifteen Build Brief / Missions transitions applied to a hash-pinned baseline
catalog. It compared the whole `contracts/catalog.v1.json` for deep equality with
that result, and `authorized-execution-lock.test.ts` restated 114 locked entries.
Any later contract, whatever its review, therefore failed the authority's gates
by construction: the catalog had not changed since the lock.

`signalement-local-export-v1` was locked in the since-deleted `libre-ai/contracts`
(812c7d8b) and is consumed by `libre-ai/signalement`. Republishing it here needs
one catalog entry after the baseline.

## Alternatives

| Alternative | Effect on the lock |
| --- | --- |
| Registry of post-lock additions, its bytes pinned by digest in code | The lock still admits no caller-controlled extension; each addition changes a reviewed digest |
| Require only that baseline rows are preserved | Any appended entry passes; the lock no longer constrains the catalog beyond the baseline |
| A second reviewed specification-lock evidence package | Strongest provenance, but a new evidence format and role verdicts for every addition |

## Decision

The owner selected the registry on 2026-10-09.

- `contracts/catalog-post-lock-additions.v1.json` lists, in order, the exact catalog
  entries appended after the baseline, each with its decision record and owner
  arbitration date.
- `specification-lock.ts` pins the registry's sha256. The target catalog must equal
  the transitioned baseline followed by exactly the registry's entries. A changed,
  removed or reordered baseline row, an unregistered entry, an addition placed
  before the baseline, or a registry whose bytes differ from the pinned digest fail.
- The locked count is derived: baseline locked entries after the transitions (114)
  plus locked registry entries.

This record admits a catalog entry; it is not a role verdict on the contract's
content and grants no runtime admission. The first registered addition is
`signalement-local-export-v1`, republished byte-identical to its earlier lock.
