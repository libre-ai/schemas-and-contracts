# Knowledge excerpt v1 — semantics (candidate)

Schema: `contracts/schemas/knowledge-excerpt.v1.schema.json`. Vectors:
`contracts/fixtures/knowledge-excerpt-v1/vectors.json`, checked by
`tools/quality/p02-v1-contracts.test.ts`. Producer: the P02 information watch
product (`information-watch`, provisional name). Consumer: the notes product
P04, which receives the excerpt as a Markdown file. Provisional name until the
LEXICON entry is signed.

## Shape

The contract is a JSON object: `frontMatter` (the provenance block) and `body`
(the excerpt as Markdown text). The Markdown file the consumer stores is the
projection of this object: its YAML front matter is `frontMatter`, its text is
`body`. The projection is lossless and deterministic; the JSON form is the
authority.

`frontMatter` carries the item, its source, the item version the excerpt was
taken from, the URL, the declared publication instant (`null` when the
publication date was absent or malformed, never a guessed value), the collection
instant, and `excerptAnchor`, an opaque anchor naming the excerpt inside the
sanitised item.

## Trust

- `body` is a projection of content that the product sanitised before storage
  (allow-list sanitiser, G6). The schema cannot check the sanitisation; the
  producer does, and a consumer must not render `body` as trusted HTML.
- The body is data. No excerpt creates, modifies or activates a rule, a source
  or a preference (G7), and no instruction contained in an excerpt is followed
  by the consumer.
- No excerpt is sent without an explicit user action (F38: no implicit send).
- `url` and `frontMatter` values are untrusted strings. The schema forbids
  userinfo in the URL, but a consumer that opens the link still treats it as
  untrusted.

## Bounds

`body` is at most 20 000 characters. The excerpt is a selection, not a copy of
the item: an excerpt of the whole item is the export contract's job.
