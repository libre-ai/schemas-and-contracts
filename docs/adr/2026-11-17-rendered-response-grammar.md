# Rendered-response grammar: candidate vectors outside the catalog

Decision identifier: `urn:libre-ai:decision:2026-11-17-rendered-response-grammar`.
Status: proposed — would admit a **candidate** vector set; it is not a catalog contract
and it is not locked.
Owner-arbitration: pending — the owner has not yet arbitrated the questions listed under
"Open questions"; this line takes the date of that arbitration before merge.

## Context

A render verifier that is independent of the renderer has to rebuild the structure of a
rendered response from its text alone: where the preamble is, which line opens or closes a
block, which nonce binds them, which header field carries which value, what the final line
counts. Nothing in this authority wrote that grammar down. The served-text preparation set
(`docs/adr/2026-11-17-served-text-preparation-vectors.md`) fixes how a content is prepared,
and states that rendering a response, its nonce and its verifier are outside it.

## Decision

1. **Location.** The grammar lives here as a candidate semantic set outside the catalog,
   on the model of the served-text preparation set:
   `contracts/fixtures/rendered-response-grammar-candidate/vectors.v1.json`, with its
   semantics in `contracts/rendered-response-grammar-candidate/SEMANTICS.md` and its
   reference renderer and checker in `tools/quality/rendered-response-grammar.ts`.
2. **Line grammar.** LF-terminated lines; `[` and `]` are the only delimiter characters;
   a preamble line, blocks of five kinds in a fixed order, a final line of four counters;
   one 16-character lowercase hexadecimal nonce on every structural line and nowhere else.
3. **Content goes through preparation.** A renderer serves a content as the output of
   `prepare(text, bound)`, so no content line can carry `[` or `]`; the forbidden code
   points are the preparation set's removed ranges, referenced, not copied.
4. **Header values match `$defs` patterns** of `contracts/schemas/common.v1.schema.json`,
   read from the schema. The existing `identifier` and `sha256` entries cover every field:
   the locked common schema is not changed.
5. **No catalog entry, no schema, no package export**, for the reasons of the served-text
   preparation decision.

## Consequences

- A render verifier (`packages/envelope`, lot L003) and any production renderer replay the
  vectors: a renderer reproduces every conforming vector, a verifier finds no defect in a
  conforming vector and exactly the named code in each defect vector.
- The production renderer, its nonce source and its selection of items live where
  responses are built, not here.
- Promotion to a cataloged contract needs role-separated review (security at least) and an
  entry in the post-lock additions register, by a distinct decision.

## Open questions

1. Is a candidate vector set outside the catalog admitted for the rendered-response
   grammar, on the model of the served-text preparation set?
2. Is the reference renderer under `tools/quality` the right place for the "renderer"
   that conforming vectors are replayed against, given that the served-text preparation
   decision leaves the production renderer to the repository that builds responses?
3. List A of the render verifier has no code for a repeated item kind within an item
   (two `excerpt` blocks with the same `item`), for item blocks of one item split by
   another item, or for item blocks of one item naming two different sources. The grammar
   forbids all three; which code does a verifier report?
4. List A counts only non-empty lines outside a block as `text_outside_block`. The grammar
   writes no line outside a block; is an empty one tolerated by a verifier?
