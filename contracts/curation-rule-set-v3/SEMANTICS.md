# Curation rule set v3 — semantics (candidate)

Schema: `contracts/schemas/curation-rule-set.v3.schema.json`. Vectors:
`contracts/fixtures/curation-rule-set-v3/vectors.json`, checked by
`tools/quality/p02-v1-contracts.test.ts`. Owner and consumers: the P02 information
watch product (`information-watch`, provisional name). Provisional name until the
LEXICON entry is signed; `curation-rule-set.v2` stays locked and unchanged.

## What changes from v2

v2 holds one condition per rule, two decisions (`retain`, `reject`) and six
fields. v3 holds a condition tree per rule, a closed set of seven actions and
nine fields, so that the rule language can express the requirements of the
information watch (`AND`, `OR`, `NOT`, content, URL, language, categories,
dates, tag, read, follow, to-read, alert).

## Bounds

| Bound | Enforced by |
| --- | --- |
| at most 200 rules, at least 1 | schema (`maxItems` / `minItems`) |
| at most 5 actions per rule, at least 1 | schema |
| a condition has depth at most 4 (a leaf has depth 1; a compound has one more than its deepest child) | schema: the grammar is unrolled over four levels, so depth 5 has no production |
| at most 16 children per `all` / `any` | schema |
| at most 32 leaves per rule | **test oracle, not schema** (see below) |

JSON Schema 2020-12 cannot count the leaves of a recursive grammar. The schema
therefore bounds depth and fan-out, and the leaf budget of 32 is enforced by
the reference check in `p02-v1-contracts.test.ts` (`withinLeafBound`). A
consumer that validates only against the schema accepts a 33-leaf rule; it must
apply the same count before it evaluates the rule.

## Conditions

- A leaf is `{ field, operator, value }`. `field` is one of `title`, `content`,
  `author`, `url`, `sourceHost`, `language`, `categories`, `publishedAt`,
  `collectedAt`.
- Text fields accept `equals`, `contains`, `prefix`, `suffix`. Date fields
  (`publishedAt`, `collectedAt`) accept `after`, `before` only, and their `value`
  is an ISO 8601 UTC instant with a `Z` suffix. Any other pairing is refused.
- `sourceHost` values are host names or bracketed IPv6 literals, lowercase.
- A compound is exactly one of `{ all: [...] }`, `{ any: [...] }`, `{ not: C }`.
  `not` takes one condition.

## Evaluation

- Text comparison runs on the normalised form: NFKC, case folded, diacritics
  removed. `élection` and `election` compare equal.
- Rules are evaluated in array order.
- The first rule whose actions include `hide` or `keep` and whose condition
  matches decides visibility. Later `hide` or `keep` actions do not change it.
- Every other action (`tag`, `markRead`, `follow`, `toRead`, `alert`)
  accumulates over all matching rules.
- An item that no rule decides stays visible.
- An explanation lists every matching rule with its version and the field that
  matched.

## Actions

`hide`, `keep`, `markRead`, `follow`, `toRead`, `alert` are written as
`{ "<action>": true }`. `tag` is written as `{ "tag": "<label>" }` with a label
of 1 to 64 characters. A valueless action carries `true` because the schema
must reject `false` and absence distinctly; this form is a hypothesis to be
confirmed by the review.

## Trust

Rules are data written by the organization's members through the API. Item,
feed and page content never creates, modifies or activates a rule (G7). A rule
set is tenant data: its `organizationId` must equal the organization it is
evaluated for. Cross-document consistency is not expressible in the schema and
is enforced by the API on write.
