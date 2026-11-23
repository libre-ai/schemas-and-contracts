# policy-core v3: grammar before semantic defect classes

Decision identifier: `urn:libre-ai:decision:2026-11-23-policy-core-v3`.
Status: proposed. The entry is `candidate`, not `locked`. Arbitration reference:
2026-11-23, two answers of the owner in chat: "Adopter la règle" to the question
"JSON non grammatical → invalid-json ; classes sémantiques seulement sur JSON
grammatical", then "Nouvelle majeure policy-core-v3" once told that the rule contradicts
locked policy-core-v2 bytes. The options set aside were a manifest of the strict reader's
own and a change of policy-core-v2 in place.

## Context

The raw-input vectors of the locked `policy-core-v2` world
(`contracts/fixtures/policy-core-invalid-json/manifest.json`) file four documents that are
not RFC 8259 JSON under the number defect: `{"value":01}`, `{"value":+1}`,
`{"value":NaN}` and `{"value":1.}`. The owner's rule files them `invalid-json`.

That manifest and `contracts/wit/policy-core-v2/SEMANTICS.md` cannot change in place:
AGENTS.md states that a locked contract never does, and their SHA-256 are pinned in
`contracts/fixtures/missions-v3/inherited.json`,
`contracts/fixtures/build-brief-api-v2/inherited.json` and
`docs/reviews/build-brief-missions-specification-lock.json`, which role verdicts cite.
Rewriting the four `defect` fields turns the three byte-lock gates red.

## Alternatives

| Alternative | Consequence |
| --- | --- |
| A manifest of the strict reader's own, outside policy-core | No contract change; the policy-core vectors keep the number class on non-grammatical text (set aside by the owner) |
| Change policy-core-v2 in place, re-pin the three inventories | Breaks "a locked contract never changes in place" and invalidates reviewed evidence (set aside by the owner) |
| New major candidate `policy-core-v3` | v2 and its pins stay intact; v3 carries the rule and waits for its role reviews |

## Decision

Add `policy-core-v3` as a `candidate` WIT entry, appended after the registered additions
in `contracts/catalog-post-lock-additions.v1.json` (digest re-pinned in
`tools/quality/specification-lock.ts`), with dossier `docs/reviews/policy-core-v3-review.md`:

| Contract | World | Classification | Required independent reviews |
| --- | --- | --- | --- |
| `policy-core-v3` | `contracts/wit/policy-core-v3/world.wit` | tenant-private | architecture, security, privacy |

The repository has no form of a major whose only change is its profile: every catalog WIT
entry is a `contracts/wit/<name>-v<major>/world.wit` whose package version is that major,
and every such file must be cataloged (`tools/quality/check-contracts.ts`). The v3 world is
therefore the v2 world under package `libre-ai:policy-core@3.0.0`, with the same function,
arguments and error codes.

`contracts/wit/policy-core-v3/SEMANTICS.md` is written as changes to the locked v2 text,
named by its SHA-256 (a test checks the digest):

- C1, version: engine version `3.0.0`; payloads and digest labels unchanged.
- C2, decoder precedence: byte order mark, then UTF-8, then the RFC 8259 grammar
  (`invalid-json`), and only on a grammatical text the first semantic defect in document
  order (`duplicate-member`, `unpaired-surrogate`, `max-depth`, `invalid-number` for a
  non-finite binary64 value). At the WIT boundary every defect is still `input-invalid`.
- C3, vectors: v2 operators and resource budgets reused; a v3 golden file derived from the
  v2 one (same cases, engine `3.0.0`, recomputed `id` and `digest`); a v3 raw-input
  manifest carrying the nine v2 inputs byte-identical plus the precedence cases.
- C4, points left to review: depth counting, unchanged from v2.

The reference oracle is `decodeStrictJsonGrammarFirst` in
`tools/quality/policy-core-raw-inputs.ts`, a check of the vectors like the existing v2
oracle; `decodeStrictJson`, the v2 decoder, is unchanged.

## Consequences

- This record admits a catalog entry. It grants no runtime admission and is not a role
  verdict; no implementation may start before every required role has run
  (`contracts/COMPATIBILITY.md`, "Pre-implementation candidates").
- policy-core-v2 stays locked and byte-identical; its consumers are unaffected until they
  choose to move to v3.
- The candidate `canonicalize` semantics of `signalement-policy-receipt-v1` keeps "the
  first defect met"; the difference is written in the v3 semantics and changes neither.
- The strict reader of `crates/sdk-rs` (`strict_json`) is not a policy-core decoder
  (ADR 2026-11-17 strict JSON reader home) and is not changed by this record.
- Rollback: remove the entry, its registry addition, the v3 directories and the oracle
  function before any consumer pins this repository past the change.
