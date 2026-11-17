# Rule common forms v1

Decision identifier: `urn:libre-ai:decision:2026-11-17-rule-common-v1`.
Status: proposed. The entry is `candidate`, not `locked`. Arbitration reference:
2026-11-17, the owner's answer (a) to the first question of the rule feedback validator
work package of `libre-ai/project-governance`: the common forms the validator reads live
in this contract authority and are read through the governance repository's pinned
checkout, never copied. Contract, member and form names were chosen by the authoring
agent and are open to the review passes.

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

Semantics: `contracts/rule-common-v1/SEMANTICS.md` (rules R1 to R6). Schema fixtures:
`contracts/fixtures/rule-common-v1/schema-fixtures.json`. Tests:
`tools/quality/rule-common-v1.test.ts`.

## Consequences

- This record admits a catalog entry. It grants no runtime admission and is not a role
  verdict; no implementation may start before every required role has run
  (`contracts/COMPATIBILITY.md`, "Pre-implementation candidates").
- The vendored schema copies and generated declarations of `packages/sdk-ts` and
  `crates/sdk-rs` are regenerated because the repository's drift gates require every
  cataloged schema to be projected.
- `project-governance` reads the schema only after its contracts authority pin is
  advanced past the merge of this change, in a change of its own.
- The forms listed under "Open points" in the semantics were not fixed by any source
  and are decided here provisionally.
