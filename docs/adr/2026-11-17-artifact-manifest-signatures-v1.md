# Artifact manifest signatures v1 and signing keys v1

Decision identifier: `urn:libre-ai:decision:2026-11-17-artifact-manifest-signatures-v1`.
Status: proposed. Both entries are `candidate`, not `locked`. Arbitration reference:
2026-11-17, the owner's answer (a) to the first question of the artifact signature work
package of `libre-ai/artifact-verification`: create, in this authority, a candidate
contract for detached signatures over an `artifact-manifest.v1` and the
`signing-keys.v1` registry schema described by the key ceremony runbook, with a
structured field for the authorized artifact types. Contract and member names were
chosen by the authoring agent and are open to the review passes.

## Context

`artifact-verification` must verify a signed `artifact-manifest.v1` against keys its
caller chose, with the strict Ed25519 profile already fixed by
`contracts/build-brief-v2/SEMANTICS.md`. Its agent rules forbid it to define a
contract type. Two formats are missing:

- `artifact-manifest.v1` is locked and has no signature member; no contract fixes the
  signed message or a detached record;
- the key registry `config/signing-keys.v1.json` exists only as prose in
  `docs/security/KEY-CEREMONY-RUNBOOK.md` of `libre-ai/project-governance`; no file and
  no cataloged schema carry it.

## Alternatives

| Alternative | Consequence |
| --- | --- |
| Add a signature member to `artifact-manifest.v1` | Forbidden: a locked contract never changes in place |
| New `artifact-manifest.v2` with embedded signatures | Every manifest consumer moves major for a concern most of them do not have; the digest preimage would have to exclude its own signatures |
| Detached `artifact-manifest-signatures.v1` over the unchanged v1 | v1 stays as is; adding a signature never changes the manifest bytes or digest |
| Key registry as a `$defs` of the signature schema | The registry is a governance file with its own consumers (provenance, proof); it gets its own authority |
| Wait for a first real consumer (option (b)) | The artifact work package stays suspended; nothing is written |

## Decision

Add the two contracts as `candidate` entries, appended after the registered additions
in `contracts/catalog-post-lock-additions.v1.json` (pinned digest in
`tools/quality/specification-lock.ts`), with one review dossier
`docs/reviews/artifact-manifest-signatures-v1-review.md`:

| Contract | Schema | Classification | Required independent reviews |
| --- | --- | --- | --- |
| `artifact-manifest-signatures-v1` | `contracts/schemas/artifact-manifest-signatures.v1.schema.json` | internal | architecture, security, cryptography |
| `signing-keys-v1` | `contracts/schemas/signing-keys.v1.schema.json` | internal | architecture, security, cryptography, privacy |

Semantics: `contracts/artifact-manifest-signatures-v1/SEMANTICS.md` (rules K1 to K5
for the registry, S1 to S10 for verification). Vectors:
`contracts/fixtures/artifact-manifest-signatures-v1/vectors.json`, written by
`tools/quality/artifact-manifest-signatures-vectors.ts` and replayed by
`tools/quality/artifact-manifest-signatures-v1.test.ts`. Schema fixtures:
`contracts/fixtures/<name>/schema-fixtures.json`.

The signed message reuses the fleet convention
(`UTF8(schemaVersion) || 0x00 || raw SHA-256 of the RFC 8785 form`), the strict profile
and signature encoding of build-brief-v2, and the key identifier rule
`lowercase_hex(SHA-256(raw public key))`. Deviations from the runbook are listed in the
semantics, section "Deviations from the runbook".

## Consequences

- This record admits catalog entries. It grants no runtime admission and is not a role
  verdict; no implementation may start before every required role has run
  (`contracts/COMPATIBILITY.md`, "Pre-implementation candidates").
- No SDK release, no Rust verifier and no registry file are delivered. The vendored
  schema copies and generated declarations of `packages/sdk-ts` and `crates/sdk-rs`
  are regenerated because the repository's drift gates require every cataloged schema
  to be projected.
- The runbook in `libre-ai/project-governance` still describes the old identifier and
  member names; aligning it is that repository's change, after review.
