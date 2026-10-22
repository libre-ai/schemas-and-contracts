# Review dossier — P02 v1 contracts (candidate)

- **Candidate contracts:** `curation-rule-set-v3`, `p02-export-v1`,
  `knowledge-excerpt-v1`, `usage-statement-v1` (catalog entries after the
  post-lock baseline).
- **Status:** `pending-independent-agent-review` (catalog `review.state`), for each
  entry. Authored solo; no role pass has run.
- **Required roles (catalog `review.required`):** architecture and security for the
  rule set; architecture, security and privacy for the excerpt; plus cryptography
  for the export and the usage statement.
- **Decision:** `docs/adr/2026-10-22-p02-v1-contracts.md`, status proposed.
- **Semantics:** `contracts/<name>/SEMANTICS.md` for each contract.

## What this dossier is, and is not

It satisfies the catalog's mechanical requirement that a `candidate` entry name a
dossier under `docs/reviews/` bound to the independent agent review protocol
(`contracts/COMPATIBILITY.md` "Evidence"). The protocol lives in the governance
authority, `docs/reviews/AGENT-REVIEW-PROTOCOL.md`, which this repository does not
vendor; the reviewer uses the governance copy.

It is **not** a completed review. Each required role must run as a separate pass
with its own findings, and each finding must be answered before a contract leaves
`candidate`.

## Points for the architecture and security passes

1. The 32-leaf budget of `curation-rule-set-v3` is enforced by the test oracle, not
   by the schema (JSON Schema cannot count leaves of a recursive grammar). Review
   whether a consumer that validates by schema alone is an acceptable state.
2. The valueless actions (`hide`, `keep`, `markRead`, `follow`, `toRead`, `alert`)
   are written as `{ "<action>": true }`. Review the form.
3. The export digest excludes `signature`, because the signature covers the digest.
   Review that the exclusion cannot hide an edit to the signed member.
4. `knowledge-excerpt-v1` is a JSON object whose Markdown projection is the file the
   consumer stores. Review that the projection is lossless.
5. The usage statement is closed by `additionalProperties: false`, so no content
   field can be added without a major version. Review the privacy claim against the
   counters.
