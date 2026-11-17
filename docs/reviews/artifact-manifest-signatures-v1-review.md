# Review dossier — artifact manifest signatures v1 and signing keys v1 (candidate)

- **Candidate contracts:** `artifact-manifest-signatures-v1`, `signing-keys-v1`
  (catalog entries after the post-lock baseline).
- **Status:** `pending-independent-agent-review` (catalog `review.state`), for each
  entry. Authored solo; no role pass has run.
- **Required roles (catalog `review.required`):** architecture, security and
  cryptography for both; privacy for the registry.
- **Decision:** `docs/adr/2026-11-17-artifact-manifest-signatures-v1.md`, status
  proposed.
- **Semantics:** `contracts/artifact-manifest-signatures-v1/SEMANTICS.md`.

## What this dossier is, and is not

It satisfies the catalog's mechanical requirement that a `candidate` entry name a
dossier under `docs/reviews/` bound to the independent agent review protocol
(`contracts/COMPATIBILITY.md` "Evidence"). The protocol lives in the governance
authority, `docs/reviews/AGENT-REVIEW-PROTOCOL.md`, which this repository does not
vendor; the reviewer uses the governance copy.

It is **not** a completed review. Each required role must run as a separate
review-only pass on an immutable commit, with its own findings, and each finding must
be answered before a contract leaves `candidate`. The authoring pass did not simulate
any of them.

## Points for the passes

1. **Architecture.** The record names no manifest and carries no digest; pairing is
   left to transport and proved by verification only. Review whether a
   `manifestDigest` member would help storage without creating a second identity.
2. **Architecture.** Activity is evaluated at a caller-supplied `now`, not at a signing
   time: a manifest signed by a key later revoked stops verifying. Review against the
   release use case (a signed checksum list kept for years).
3. **Security.** Unknown signing key identifiers are ignored and counted (S5) so that
   rotation can double-sign; a known key that fails any check refuses the record (S9).
   Review the asymmetry.
4. **Cryptography.** The strict profile is the build-brief-v2 one; the corpus forges
   small-order and mixed-order R, S + L, wrong domains and a label swap. Review the
   forgery formulas in `tools/quality/artifact-manifest-signatures-vectors.ts`. No Rust
   oracle is run for this family; the build-brief-v2 Rust oracle covers the primitive.
5. **Cryptography.** `publicKey` keeps the runbook's PEM SPKI with one exact form
   (no trailing newline, canonical final character). Review whether raw Base64url
   would be safer, against the cost of diverging from the ceremony output.
6. **Privacy.** `witness.signatory` and `revocationWitness.signatory` are free text;
   the runbook's example is an e-mail address in a versioned file.
7. **Architecture.** An empty `artifactTypes` is admitted and authorizes no manifest;
   the artifact-verification design refuses such an entry when building its key set,
   so its caller must filter. Review whether `minItems: 1` is preferable.
