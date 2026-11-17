# Rule Common Forms v1 — candidate semantics

Status: candidate, unimplemented. Owner decision of 2026-11-17: the common forms of the
rule context live in this contract authority, and the rule feedback validator of the
governance authority reads them through its pinned checkout of this repository instead
of copying them. This document and its schema require the role-separated passes listed
in `docs/reviews/rule-common-v1-review.md` before any consumer implementation.

One contract: `rule-common.v1` (`contracts/schemas/rule-common.v1.schema.json`). Rule
identifiers (`R1`…`R6`) are stable.

## Forms

Each form is one member of `$defs`, addressed by its JSON Pointer:

| Form | Pointer | Value | Source of the form |
| --- | --- | --- | --- |
| Rule identifier | `#/$defs/ruleId` | `<source>:<key>#<locator>`, 5 to 512 code points | structure and locator encoding: rule identifier lot (L013); source and key alphabets: decided here |
| Excerpt digest | `#/$defs/excerptDigest` | 64 lowercase hex characters | text normalization lot (L012); same pattern as `common.v1.schema.json#/$defs/sha256` |
| Slug | `#/$defs/slug` | 1 to 64 of `a-z`, `0-9`, `-`, no hyphen at either end | decided here |
| Edition | `#/$defs/edition` | 1 to 3 dot-separated decimal components, each 0 or 1 to 9 digits without leading zero | 10-digit component refused: rule-context schemas lot (L011); component count: decided here |
| Overlay reference | `#/$defs/overlayReference` | `<publisher slug>/<overlay slug>@<version>`, version a decimal integer from 1, at most 9 digits | incremented overlay version: rule feedback idea (L028); structure: decided here |
| Level | `#/$defs/level` | one of `MUST`, `MUST_NOT`, `SHOULD`, `SHOULD_NOT`, `MAY` | five levels: L028; `MUST`, `MUST_NOT`, `SHOULD` named by L015 and L019; `SHOULD_NOT`, `MAY` and the spelling: decided here |
| Trigger type | `#/$defs/triggerType` | one of `glob`, `keyword`, `type` | `glob=`, `mot-clé=`, `type=`: L025 and L028; English `keyword`: decided here |

### Rule identifier

`<source>` has the slug form. `<key>` is 1 to 128 of `a-z`, `0-9`, `.`, `_`, `-`, starting
and ending with a letter or digit. `<locator>` is one or more of:

- an unreserved character `A-Z a-z 0-9 - . _ ~`, except a `.` in first position;
- a percent-encoded octet `%XY` in uppercase hex whose octet is **not** an unreserved
  character; plus `%2E` in first position only.

The encoding is therefore unique: `R%41` is refused (it must be written `RA`), `.hidden`
is refused (it must be written `%2Ehidden`), `%2e` is refused, and `a%2Eb` is refused (it
must be written `a.b`). An anchored locator `a<12 lowercase hex>` with an optional
suffix `.<n>` is a member of the same language.

What the pattern does not decide, and stays with the code that builds or reads rule
identifiers (L013): whether the locator is native or anchored, whether an anchor matches
the digest of its text, whether a `.<n>` suffix is admissible (`.1` and a suffix on a
single occurrence are refused there, not here), and the octets the percent-encoding
decodes to.

## Rules

- **R1. Read, never copy.** A consumer reads a form by its pointer in this schema, from
  a revision of this repository it pins (full commit and integrity). It does not restate
  a pattern or a list in its own source. An absent or unreadable schema, or an absent
  pointer, is a named failure for the consumer, never an empty or permissive form.
- **R2. Leaves are self-contained.** Each `$defs` member is either
  `{ "type": "string", "pattern", "minLength"?, "maxLength"? }` or `{ "enum": [strings] }`.
  It carries no `$ref`, no `format` and no other keyword, so that a reader without a
  JSON Schema engine decides the same verdict: lengths are counted in Unicode code
  points, and the pattern is tested on the whole value.
- **R3. Portable patterns.** Every pattern is anchored (`^`…`$`) and uses neither
  lookaround nor backreference. It compiles under ECMA-262 with the `u` flag and under
  regular expression engines without backtracking.
- **R4. The root is a specimen.** The root object holds one value of each form so that
  the repository's positive and negative fixtures exercise every form. It is not a
  message, a file format or a ticket, and no consumer exchanges it.
- **R5. Closed lists are closed.** A value outside `level` or `triggerType` is refused,
  never matched by case folding, trimming or prefix.
- **R6. Ticket forms are elsewhere.** The forms that belong to the rule feedback ticket
  alone — snapshot version, core version, the three natures, the proposal line, the
  overlay list syntax and its `none` — are defined by the ticket validator, not here.

## Reading path for the governance authority

`project-governance` already reads this repository through
`crates/ecosystem-engine/scripts/contracts-authority.ts`: a pin file
(`crates/ecosystem-engine/contracts-authority.pin.json`, full commit and sha512
integrity of the archive), a checkout under `CHECKOUT_DIR` (`.tools/contracts-authority`)
fetched by `bun run fetch:contracts-authority`, and a stamp that makes a missing or stale
checkout a named failure. After this contract merges and that pin is advanced in a
separate change, the schema is at `${CHECKOUT_DIR}/contracts/schemas/rule-common.v1.schema.json`.

## Fixtures and tests

- `contracts/fixtures/rule-common-v1/schema-fixtures.json`: the valid specimen and
  negative mutations, one defect each; every form is broken at least once.
- `tools/quality/rule-common-v1.test.ts`: holds R2 and R3 on every leaf, the equality of
  the excerpt digest with the common `sha256` pattern, and replays the verdicts that the
  rule-context lot definitions fix (L011, L012, L013, L025, L028), both through the
  schema engine and through a leaf-only reader.

## Open points

Each item below was not fixed by the sources and was decided by the authoring pass; each
is open to the review passes and to the owner.

1. Source, key and slug alphabets, and the 512 code point bound of a rule identifier.
2. Edition as one to three decimal components. A source whose editions are dates or
   carry letters (for example `v4.0.3` or `2021-03`) does not fit.
3. Overlay reference structure `<publisher>/<overlay>@<integer>`.
4. The fifth level and its spelling (`SHOULD_NOT`, `MAY`).
5. `keyword` for `mot-clé`.
6. The rule feedback briefs disagree on two names that this contract does not carry:
   the second ticket field (`Excerpt fingerprint` in L107, `Excerpt digest` in L028) and
   the rewording nature (`rewording` in L107, `rephrasing` in L028). This contract names
   the form `excerptDigest`, after L012 and L028.
