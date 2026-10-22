# Usage statement v1 — semantics (candidate)

Schema: `contracts/schemas/usage-statement.v1.schema.json`. Vectors:
`contracts/fixtures/usage-statement-v1/vectors.json`, checked by
`tools/quality/p02-v1-contracts.test.ts`. Producer: the P02 information watch
product (`information-watch`, provisional name). The statement is the signed
usage record of one organization over one period, handed to the organization
and to the operator for billing and quota evidence. Provisional name until the
LEXICON entry is signed.

## Content

The statement holds counters only: sources, retained items, fetches, members.
It carries no item title, URL, content, annotation or identifier of a person.
Every object is closed (`additionalProperties: false`), so a content field
cannot be added without a new major version. This is the statement's privacy
guarantee, and the closed shape is what enforces it.

## Period

`period.from` and `period.to` are ISO 8601 UTC instants. `from` must precede
`to`; the schema does not express that comparison and the producer enforces it.

## Digest and signature

`digest` is the lowercase hexadecimal SHA-256 of the RFC 8785 (JCS) form of the
statement without its `digest` and `signature` members (invariant I-10; the
reference rule is `tools/quality/export-digest.ts`). `signature` is `{ kid,
signature }`: an Ed25519 signature of the 32 raw bytes of `digest` under the key
identified by `kid`. Both are required: a statement is always signed, because it
is always handed outside the producing context.

The schema checks the shape only. A schema-valid signature is not a verified
one. The verifier takes the key from its own trust context, never from the
statement, and refuses a statement whose `kid` it does not hold.

## Keys

Key identifiers are lowercase and rotate by addition then removal. The key
ceremony for production is an open decision of the P02 product (question QO-5);
until it closes, this contract documents the procedure and makes no claim about
where production keys live.
