# Review dossier — artifact manifest signatures v1 and signing keys v1 (candidate)

- **Candidate contracts:** `artifact-manifest-signatures-v1`, `signing-keys-v1`
  (catalog entries after the post-lock baseline).
- **Status:** `candidate`; catalog `review.state` stays
  `pending-independent-agent-review` until the owner admits the entries. The four
  required role passes ran on 2026-11-17 (below); every finding has an answer.
- **Required roles (catalog `review.required`):** architecture, security and
  cryptography for both; privacy for the registry.
- **Decision:** `docs/adr/2026-11-17-artifact-manifest-signatures-v1.md`, status
  proposed.
- **Semantics:** `contracts/artifact-manifest-signatures-v1/SEMANTICS.md`.

## What this dossier is, and is not

It satisfies the catalog's requirement that a `candidate` entry name a dossier under
`docs/reviews/` bound to the independent agent review protocol
(`contracts/COMPATIBILITY.md` "Evidence"). The protocol lives in the governance
authority, `docs/reviews/AGENT-REVIEW-PROTOCOL.md`, which this repository does not
vendor.

It records the four role-separated, review-only passes of 2026-11-17 on the authoring
commit, their findings, and the correction that answers each. It is not an admission:
the contracts stay `candidate`, and the corrections themselves are subject to the
owner's acceptance.

## Passes of 2026-11-17

Four separate passes, one role each, none of them the author: architecture, security,
cryptography, privacy. Fourteen findings. Status `corrected` means the correction is
in this repository with a vector or a test that failed before it and passes after it;
the test is named.

### Architecture

| # | Severity | Finding | Status | Covered by |
| --- | --- | --- | --- | --- |
| 1 | high | `signingKeyId` (64 hex) does not match `common.v1` `identifier`, which seven other schemas use for `signingKeyId` | corrected: `ed25519-<64 hex>` (72 characters), vectors and projections regenerated | test "every signingKeyId of the corpus is a common.v1 identifier"; vectors `registry-identifier-bare-hex`, `key-identifier-bare-hex` |
| 2 | medium | no signature vector with a key admitted at `artifactTypes: []` | corrected | vectors `key-authorizing-nothing-alone`, `key-authorizing-nothing-cosigns` |
| 3 | medium | key lifecycle undefined: rotation versus revocation, double-signed records after revocation | corrected: SEMANTICS "Key lifecycle" (rotation removes the entry after re-signing, `revokedAt` reserved for compromise) | vectors `rotation-retired-key-ignored`, `rotation-retired-key-only`, `known-valid-and-known-revoked`; test "SEMANTICS states each decision the passes asked for" |
| 4 | medium | undeclared deviations from build-brief-v2 (judged at signed `acceptedAt` there) and agent-orchestration (unknown key refused there) | corrected: SEMANTICS "Deviations from sibling contracts" and the ADR, with motives | test "SEMANTICS states each decision the passes asked for" |
| 5 | low | `artifactTypes` copies the enumeration of `artifact-manifest.v1` | corrected: `$ref` to `artifact-manifest.v1.schema.json#/properties/artifactType` (the TS projection and both schema validators resolve it) | test "artifactTypes reuses the artifact-manifest.v1 enumeration"; vector `registry-artifact-type-unknown` |

### Security

| # | Severity | Finding | Status | Covered by |
| --- | --- | --- | --- | --- |
| 6 | medium | no octet boundary: a manifest with a repeated member or an unpaired surrogate is hashed after lenient parsing, so two consumers can verify two different documents | corrected: rules S0 (manifest and record octets) and K0 (registry octets); the fixture verifier now receives octets | vectors `manifest-duplicate-member`, `manifest-escaped-lone-surrogate`, `manifest-bom`, `manifest-invalid-utf8`, `record-duplicate-member`, `record-trailing-comma`, `registry-duplicate-member`, `registry-escaped-lone-surrogate`, `registry-bom` |
| 7 | medium | the source of `now` is unstated | corrected: S6 states the verification time from a trusted clock, never derived from `createdAt` or any signed or received data | test "SEMANTICS states each decision the passes asked for" |
| 8 | medium | a revoked key may lack its reason and witness, and may be revoked after the discovery of its compromise | corrected: rule K6 | vectors `registry-revoked-without-reason`, `registry-revoked-without-witness`, `registry-revoked-after-discovery`, `registry-revoked-before-discovery`; schema fixture "revoked key without revocation reason or witness" |
| 9 | medium | freshness and anti-rollback are not assigned | corrected: SEMANTICS "Freshness and rollback" assigns both to the consumer | test "SEMANTICS states each decision the passes asked for" |

Finding 8 also concerns the governance runbook, outside this repository:
`docs/security/KEY-CEREMONY-RUNBOOK.md` of `libre-ai/project-governance`, revocation
protocol, step 2, lines 256 to 260 at the commit read on 2026-11-17. Its example has
`"revokedAt": "2026-07-23T14:32:00.000Z"` and `"discoveredAt": "2026-07-23T14:30:00.000Z"`,
a revocation two minutes after discovery, which K6 refuses; the same example's
`signatory` is an e-mail address (K1, K7), and the rotation protocol (step 2 of
"Processus de rotation") sets `revokedAt` on the retired key, which "Key lifecycle"
replaces by removal. The runbook is corrected in a separate governance change.

### Cryptography

| # | Severity | Finding | Status | Covered by |
| --- | --- | --- | --- | --- |
| 10 | medium | the corpus has no manifest exercising RFC 8785 string escapes, and the verifier and the generator share `canonicalJson`, so "the two cannot share a mistake" was false | corrected: manifest `release-unicode` (path with é, U+001F, `"`, U+007F, U+2028) and its published message; the fixture verifier has its own RFC 8785 serializer, checked against RFC 8785 sections 3.2.2 and 3.2.3 | vector `valid-unicode-manifest`; tests "the verifier builds the published signing messages", "the verifier's RFC 8785 serializer reproduces the RFC 8785 examples" |
| 11 | low | S8 called the equation cofactorless; the pinned verifier (`@noble/curves` 2.4.0) evaluates the cofactored one | corrected: S8 states the cofactored equation, its equivalence for admissible A and R, and requires consumers to enforce the R/A torsion, `S < L` and re-encoding checks themselves | test "SEMANTICS states each decision the passes asked for" |

### Privacy

| # | Severity | Finding | Status | Covered by |
| --- | --- | --- | --- | --- |
| 12 | medium | `signatory` is free text; the runbook's example is an e-mail address | corrected: role identifier `^[a-z][a-z0-9-]{0,63}$` | vector `registry-signatory-email`; schema fixture "witness signatory is an e-mail address" |
| 13 | medium | no rule excludes personal data from the registry or from refusals | corrected: rule K7 (actor identity in the commit's `Signed-off-by`; refusals and logs copy no member as free text) | test "a refusal carries no signature or key octets" (now also checks identifiers); test "SEMANTICS states each decision the passes asked for" |
| 14 | low | classification `internal` is stricter than needed once `signatory` is restricted | corrected: `signing-keys-v1` classified `public` in both catalog files; post-lock digest re-pinned | test "signing-keys-v1 is classified public" |

## Points raised by the authoring pass, as decided

1. **Record names no manifest.** Kept: no `manifestDigest` member; pairing is proved by
   verification, and a digest member would be a second identity to keep consistent.
2. **Activity at `now`.** Kept, and declared as a deviation from build-brief-v2 with
   its motive; long-lived manifests survive rotation by re-signing ("Key lifecycle").
3. **Unknown keys ignored, known keys strict.** Kept, and declared as a deviation from
   agent-orchestration with its motive.
4. **Forgery formulas, no Rust oracle for this family.** Unchanged; the build-brief-v2
   Rust oracle covers the primitive. The independence gap the cryptography pass found
   was in serialization (finding 10), now closed.
5. **PEM SPKI kept.** Unchanged: one exact form, as before.
6. **`signatory`.** Restricted to a role identifier (finding 12).
7. **Empty `artifactTypes`.** Kept admitted (no `minItems: 1`), with the cosignature
   vector of finding 2: such a key refuses every record it signs.

## Not changed by these passes

`artifact-manifest.v1` (locked), the signed message, the signature encoding, the strict
point profile and the refusal codes. The governance runbook and its ceremony tool are a
separate change.
