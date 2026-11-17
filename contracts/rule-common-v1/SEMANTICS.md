# Rule Common Forms v1 — candidate semantics

Status: candidate, unimplemented. Owner decision of 2026-11-17: the common forms of the
rule context live in this contract authority, and the rule feedback validator of the
governance authority reads them through its pinned checkout of this repository instead
of copying them. This document and its schema require the role-separated passes listed
in `docs/reviews/rule-common-v1-review.md` before any consumer implementation.

One contract: `rule-common.v1` (`contracts/schemas/rule-common.v1.schema.json`). Rule
identifiers (`R1`…`R7`) are stable.

## Single authority

This schema is the only definition of these forms. The rule-context schemas lot (L011)
and the rule identifier lot (L013) project it from their pin of this repository (R1);
neither defines a second spelling of a form listed here.

## Forms

Each form is one member of `$defs`, addressed by its JSON Pointer:

| Form | Pointer | Value | Source of the form |
| --- | --- | --- | --- |
| Rule identifier | `#/$defs/ruleId` | `<source>:<key>#<locator>`, 5 to 512 code points, ASCII only (R7) | structure and locator encoding: rule identifier lot (L013); source and key alphabets, ASCII locator: decided 2026-11-17 |
| Excerpt digest | `#/$defs/excerptDigest` | exactly 64 lowercase hex characters (`minLength` and `maxLength` 64) | text normalization lot (L012); same pattern as `common.v1.schema.json#/$defs/sha256` |
| Slug | `#/$defs/slug` | 1 to 64 of `a-z`, `0-9`, `-`, no hyphen at either end | decided 2026-11-17 |
| Edition | `#/$defs/edition` | 1 to 3 dot-separated decimal components, each 0 or 1 to 9 digits without leading zero | 10-digit component refused: rule-context schemas lot (L011); component count and transcription: decided 2026-11-17 |
| Overlay reference | `#/$defs/overlayReference` | `<publisher slug>/<overlay slug>@<version>`, version a decimal integer from 1, at most 16 digits | incremented overlay version: rule feedback idea (L028); structure and 16-digit bound (the snapshot version bound of L107): decided 2026-11-17 |
| Level | `#/$defs/level` | one of `MUST`, `MUST_NOT`, `SHOULD`, `SHOULD_NOT`, `MAY` | five levels: L028; `MUST`, `MUST_NOT`, `SHOULD` named by L015 and L019; `SHOULD_NOT`, `MAY` and the spelling: decided 2026-11-17 |
| Trigger type | `#/$defs/triggerType` | one of `glob`, `keyword`, `type` | `glob=`, `mot-clé=`, `type=`: L025 and L028; English `keyword`: decided 2026-11-17 |

### Rule identifier

`<source>` has the slug form. `<key>` is 1 to 128 of `a-z`, `0-9`, `.`, `_`, `-`, starting
and ending with a letter or digit. `<locator>` is one or more of:

- an unreserved character `A-Z a-z 0-9 - . _ ~`, except a `.` in first position;
- a percent-encoded octet `%XY` in uppercase hex whose octet is a printable ASCII
  character (`0x20` to `0x7E`) that is **not** unreserved, not `/` (`%2F`) and not `\`
  (`%5C`); plus `%2E` in first position only, and then not followed by a `.`.

The encoding is therefore unique without any Unicode normalization: `R%41` is refused
(it must be written `RA`), `.hidden` is refused (it must be written `%2Ehidden`), `%2e`
is refused, and `a%2Eb` is refused (it must be written `a.b`). An anchored locator
`a<12 lowercase hex>` with an optional suffix `.<n>` is a member of the same language.

The effective bound of the locator is 512 minus the length of `<source>:<key>#`: at most
508 code points (one-character source and key), 504 after `src:doc#`.

What the pattern does not decide, and stays with the code that builds or reads rule
identifiers (L013, which takes the pattern by projection and does not restate it):
whether the locator is native or anchored, whether an anchor matches the digest of its
text, and whether a `.<n>` suffix is admissible (`.1` and a suffix on a single
occurrence are refused there, not here).

### Edition transcription

An edition is written with decimal components only. A source whose editions are dated
or carry letters is transcribed before it is cited: `2021-03` is written `2021.3` (the
separator becomes a dot and a leading zero is dropped), `v4.0.3` is written `4.0.3`. The
untranscribed spellings are refused.

## Rules

- **R1. Read, never copy.** A consumer reads a form by its pointer in this schema, from
  a revision of this repository it pins (full commit and integrity). It does not restate
  a pattern or a list in its own source. An absent or unreadable schema, or an absent
  pointer, is a named failure for the consumer, never an empty or permissive form.
- **R2. Leaves are self-contained, and match the whole value.** Each `$defs` member is
  either `{ "type": "string", "pattern", "minLength"?, "maxLength"? }` or
  `{ "enum": [strings] }`. It carries no `$ref`, no `format` and no other keyword, so that
  a reader without a JSON Schema engine decides the same verdict: lengths are counted in
  Unicode code points, and the pattern must match the **entire** value — ECMA-262
  `test` with `^`…`$` and no `m` flag, Python `re.fullmatch`, or a translation of the
  anchors to `\A`…`\z`. A search whose `$` may match before a final line break (Python
  `re.match` or `re.search`, PCRE without `D`) is not a conforming reader. No character
  class of any pattern admits a line feed, so a trailing `\n` is refused by every
  conforming reader whatever its engine; the excerpt digest additionally carries
  `minLength` and `maxLength` 64 so that even a non-conforming reader refuses it.
- **R3. Portable patterns.** Every pattern is anchored (`^`…`$`) and uses neither
  lookaround, backreference, negated class nor shorthand class. It compiles under
  ECMA-262 with the `u` flag and under regular expression engines without backtracking.
- **R4. The root is a specimen.** The root object holds one value of each form so that
  the repository's positive and negative fixtures exercise every form. It is not a
  message, a file format or a ticket, and no consumer exchanges it. The generated SDK
  type `LibreAiRuleCommonFormsV1` (`packages/sdk-ts/src/generated/rule-common.v1.d.ts`)
  is the projection of that specimen, emitted because the type generator projects every
  root that has a title; it is not a message type and no consumer sends or receives it.
  The per-form types of the same file (`Ruleid`, `Excerptdigest`, …) are the usable ones.
- **R5. Closed lists are closed.** A value outside `level` or `triggerType` is refused,
  never matched by case folding, trimming or prefix: `MUST NOT` (space) and `may` are
  refused.
- **R6. Ticket forms are elsewhere.** The forms that belong to the rule feedback ticket
  alone — snapshot version, core version, the three natures, the proposal line, the
  overlay list syntax and its `none` — are defined by the ticket validator, not here.
- **R7. The locator is ASCII.** A rule identifier is ASCII from end to end. The
  percent-encoding of the locator admits no control octet (`%00`–`%1F`, `%7F`), no
  `%2F`, no `%5C` and no octet `%80`–`%FF`; encoded UTF-8 (letters, no-break space
  `%C2%A0`, byte order mark `%EF%BB%BF`, bidirectional controls such as `%E2%80%AE`) is
  therefore refused. A locator whose decoding is `.` or `..`, or starts with `..`, is
  refused. The pattern enforces all of this without lookaround: a reader that decodes
  the locator of an admitted identifier obtains printable ASCII that is neither a path
  separator nor a relative path step.

## Decisions of 2026-11-17

The authoring pass left six points open. The architecture and security review passes
answered them, and the owner closed them before merge, as `contracts/COMPATIBILITY.md`
requires of a candidate ("Pre-implementation candidates"):

1. Source, key and slug alphabets and the 512 code point bound of a rule identifier are
   kept; the effective locator bound is written above; L013 takes the pattern by
   projection.
2. Edition stays one to three decimal components; dated sources are transcribed (see
   "Edition transcription").
3. Overlay reference stays `<publisher>/<overlay>@<integer>`; the version bound is 16
   digits, as the snapshot version of the rule feedback ticket (L107).
4. `SHOULD_NOT` and `MAY` are kept, uppercase with underscores.
5. `keyword` is kept for `mot-clé`.
6. Where the rule feedback briefs disagree, the labels of L028 prevail over those of
   L107. The five disagreements: `Rule` → `Rule identifier`; `Excerpt fingerprint` →
   `Excerpt digest`; `Source pack` → `Pack`; `Publisher snapshot` → `Snapshot`; nature
   `rewording` → `rephrasing`. This contract carries none of these labels; it names the
   digest form `excerptDigest`, consistent with L012 and L028.

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
  negative mutations, one defect each; every form is broken at least once, and every
  class refused by R2 and R7 has a mutation.
- `tools/quality/rule-common-v1.test.ts`: holds R2, R3 and R7 on every leaf, the
  equality of the excerpt digest pattern with the common `sha256` pattern, replays the
  verdicts that the rule-context lot definitions and the decisions above fix, through
  the schema engine and through a leaf-only reader, and checks every single escape
  `%00`–`%FF` in four positions against an oracle written from the text of R7. The
  tests of the two closed lists are decision locks: a change there is a contract
  decision, not a test update.
