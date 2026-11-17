# Rule common forms v1

Decision identifier: `urn:libre-ai:decision:2026-11-17-rule-common-v1`.
Status: proposed. The entry is `candidate`, not `locked`. Arbitration reference:
2026-11-17, the owner's answer (a) to the first question of the rule feedback validator
work package of `libre-ai/project-governance`: the common forms the validator reads live
in this contract authority and are read through the governance repository's pinned
checkout, never copied. Contract, member and form names were chosen by the authoring
agent; the architecture and security review passes then ran, and the choices they left
to the owner were closed on 2026-11-17 (see "Decisions closed before merge").

## Context

The rule feedback validator of `project-governance` must check a filled ticket whose
fields cite a rule identifier, an excerpt digest, a pack (`<slug>@<edition>`), a
snapshot (`<slug>@<version>`), overlay references, a level and a trigger type. Its brief
requires these forms to be read from schemas, not restated. None of the schemas of
either repository carries them, and the governance agent rules forbid creating a
contract authority there.

## Alternatives

| Alternative | Consequence |
| --- | --- |
| Forms written in the validator | Abandons "read, never copied"; the feedback command and the rule-context code would each restate them |
| Schemas in the repository that produces rule packs | That repository does not exist yet; the validator would leave `project-governance` |
| One `$defs`-only schema like `common.v1` | The fixture gate exempts only `common.v1` from the positive/negative pair; a new exemption would be a gate change, and the forms would carry no negative fixture |
| `rule-common.v1` with a specimen root | Every form is exercised by the existing fixture gate; consumers read `$defs` by pointer |

## Decision

Add `rule-common-v1` as a `candidate` entry, appended after the registered additions in
`contracts/catalog-post-lock-additions.v1.json` (pinned digest in
`tools/quality/specification-lock.ts`), with dossier
`docs/reviews/rule-common-v1-review.md`:

| Contract | Schema | Classification | Required independent reviews |
| --- | --- | --- | --- |
| `rule-common-v1` | `contracts/schemas/rule-common.v1.schema.json` | public | architecture, security |

Semantics: `contracts/rule-common-v1/SEMANTICS.md` (rules R1 to R7). Schema fixtures:
`contracts/fixtures/rule-common-v1/schema-fixtures.json`. Tests:
`tools/quality/rule-common-v1.test.ts`.

### Single authority

This schema is the only definition of the rule-context common forms. The rule-context
schemas work package (L011, deferred until after B′) projects this schema from its pin
of this repository and defines no other; the rule identifier work package (L013) takes
the rule identifier pattern by the same projection. The current text of the L011
definition in the governance plan still describes schemas of its own: correcting it is
outside this change and remains open with the owner of that plan.

### Decisions closed before merge

Taken by the owner on 2026-11-17 after the architecture and security passes, and written
in the semantics; none is provisional.

| Point | Decision |
| --- | --- |
| A. Locator alphabet (security) | ASCII only (R7): percent-encoding admits printable reserved ASCII octets only, never `%00`–`%1F`, `%7F`, `%2F`, `%5C` or `%80`–`%FF`; a locator decoding to `.`, `..` or starting with `..` is refused, in the pattern, without lookaround. Uniqueness of the encoding holds without Unicode normalization |
| B. Matching (R2, R3) | The pattern matches the whole value (`fullmatch`, `\A`…`\z`); no class admits `\n`; the excerpt digest carries `minLength`/`maxLength` 64, so its leaf now differs from `common.v1#/$defs/sha256` by those two bounds while keeping the same pattern |
| D1. Alphabets and 512 bound | Kept; effective locator bound written (at most 508); L013 projects the pattern |
| D2. Edition | One to three decimal components kept; dated sources transcribed (`2021-03` → `2021.3`) |
| D3. Overlay reference | `<publisher>/<overlay>@<integer>` kept; version bound 16 digits, as the L107 snapshot version |
| D4. Fifth level | `SHOULD_NOT` and `MAY` kept, uppercase with underscores |
| D5. Trigger type | `keyword` kept |
| D6. Labels | L028 prevails over L107 on the five disagreements: `Rule identifier`, `Excerpt digest`, `Pack`, `Snapshot`, nature `rephrasing` |
| E. SDK type | `LibreAiRuleCommonFormsV1` is the projection of the specimen root, not a message; the generator has no exclusion, so R4 documents it |

## Consequences

- This record admits a catalog entry. It grants no runtime admission and is not a role
  verdict; no implementation may start before every required role has run
  (`contracts/COMPATIBILITY.md`, "Pre-implementation candidates").
- The vendored schema copies and generated declarations of `packages/sdk-ts` and
  `crates/sdk-rs` are regenerated because the repository's drift gates require every
  cataloged schema to be projected.
- `project-governance` reads the schema only after its contracts authority pin is
  advanced past the merge of this change, in a change of its own.
- The choices no source fixed are closed before merge (table above), as
  `contracts/COMPATIBILITY.md` ("Pre-implementation candidates") requires: once a
  consumer reads these forms, changing them changes an accepted payload and needs a new
  major.
