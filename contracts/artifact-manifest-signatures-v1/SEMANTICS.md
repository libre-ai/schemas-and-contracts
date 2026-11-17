# Artifact Manifest Signatures v1 and Signing Keys v1 — candidate semantics

Status: candidate, unimplemented. Owner decision of 2026-11-17 (option (a) of the
first owner question of the artifact signature work package). This document, its two
schemas and its vectors require the role-separated passes listed in
`docs/reviews/artifact-manifest-signatures-v1-review.md` before any consumer
implementation. `artifact-manifest.v1` is locked and does not change: it carries no
signature member, and nothing here adds one.

Two contracts, one family:

- `artifact-manifest-signatures.v1` (`contracts/schemas/artifact-manifest-signatures.v1.schema.json`):
  a detached record of 1 to 16 Ed25519 signatures over one `artifact-manifest.v1`
  document;
- `signing-keys.v1` (`contracts/schemas/signing-keys.v1.schema.json`): the public key
  registry `config/signing-keys.v1.json` described by the key ceremony runbook of the
  governance authority (`docs/security/KEY-CEREMONY-RUNBOOK.md`, step 7, rotation and
  revocation protocols).

Rule identifiers (`K1`…`K5`, `S1`…`S10`) are stable: the vectors name the rule each
invalid case breaks.

## Signing key registry (`signing-keys.v1`)

The document is `{ "schemaVersion": "libre-ai.signing-keys.v1", "keys": [...] }`. Each
key entry has exactly these members:

| Member | Form | Source |
| --- | --- | --- |
| `signingKeyId` | 64 lowercase hex characters (K3) | runbook `id`, renamed |
| `algorithm` | `"Ed25519"` | runbook |
| `publicKey` | PEM SPKI Ed25519, exact form below (K1) | runbook |
| `purpose` | free text, 1 to 256 characters | runbook |
| `artifactTypes` | set of `artifact-manifest.v1` `artifactType` values, 0 to 5 | added (owner decision (a)) |
| `activatedAt` | instant, fixed form below | runbook |
| `revokedAt` | instant or `null` | runbook |
| `witness` | `{ signatory, attestedAt, comment }` | runbook |
| `revocationReason` | free text, only when `revokedAt` is not `null` | runbook, revocation protocol |
| `revocationWitness` | `{ signatory, discoveredAt }`, only when `revokedAt` is not `null` | runbook, revocation protocol |

Instants have one fixed form, the one the runbook writes:
`YYYY-MM-DDTHH:MM:SS.sssZ` (UTC, three fractional digits, `Z`), and must be a real
calendar instant (no `24:00:00`, no `2024-02-30`, no second `60`). Fixed width makes
lexical order chronological order.

`publicKey` is exactly

```text
-----BEGIN PUBLIC KEY-----\n<60 base64 characters>\n-----END PUBLIC KEY-----
```

with no trailing newline, where the 60 characters are the standard padded Base64 of
the 44-octet DER `302a300506032b6570032100 || A` (OID 1.3.101.112, Ed25519), `A` being
the 32-octet public key. The body therefore starts with `MCowBQYDK2VwAyEA` and ends
with one canonical character (unused bits zero) and `=`. Any other PEM — another
OID such as X25519 (1.3.101.110), another DER length, line breaks inside the body,
a trailing newline — is refused.

- **K1 — Shape.** The document validates the closed schema: 1 to 64 keys, every
  member in the form above, `artifactTypes` without repetition, revocation members
  only on a revoked key. Unknown members are refused at every level.
- **K2 — Admissible public key.** `A` is canonical (re-encodes to the same octets,
  `y < p`, no negative zero), on the curve, not the identity and in the prime-order
  subgroup: the strict profile of `contracts/build-brief-v2/SEMANTICS.md`, applied at
  registry admission. Its 24 point vectors
  (`contracts/fixtures/build-brief-v2/strict-ed25519-vectors.json`) are the reference.
- **K3 — Derived identifier.** `signingKeyId = lowercase_hex(SHA-256(A))` over the 32
  raw octets of the key, never over the PEM text or a date. Any verifier recomputes it
  from the key.
- **K4 — Unique identifier.** No two entries share a `signingKeyId`. With K3 this also
  forbids the same public key under two entries.
- **K5 — Validity window order.** When `revokedAt` is not `null`, it is strictly later
  than `activatedAt`.

A registry that breaks any K rule is refused as a whole (`key-set-invalid`) and
verifies nothing. An entry whose `artifactTypes` is empty is admitted but authorizes
no manifest (S7): the runbook registers keys for other signed objects too, and such a
key must not sign an artifact manifest.

The registry is not signed and is not a JCS preimage. Its authenticity is the
consumer's concern (the runbook makes the reviewed commit of
`config/signing-keys.v1.json` the single source of truth); this contract fixes its
bytes' meaning, not its distribution.

## Detached signature record (`artifact-manifest-signatures.v1`)

The record is
`{ "schemaVersion": "libre-ai.artifact-manifest-signatures.v1", "signatures": [{ "signingKeyId", "signature" }, ...] }`.
It names no manifest and carries no digest: it is paired with its manifest by the
transport, and the pairing is proved only by verification. It carries no public key:
keys come from the verifier's registry.

Verification takes the manifest document, the record, an admitted registry and an
instant `now` supplied by the caller (never read from a clock by the verifier). It
either accepts, returning the sorted list of verified `signingKeyId` values and the
number of ignored unknown signatures, or refuses with exactly one code.

- **S1 — Record shape.** The record validates its closed schema: 1 to 16 signatures,
  `signingKeyId` of K3 form, `signature` the canonical unpadded Base64url of exactly
  64 octets (86 characters, the last one in `A Q g w` so that the unused bits are
  zero). An empty list is refused `signature-required`; every other shape defect is
  refused `signature-malformed`.
- **S2 — Distinct identifiers.** No two signatures share a `signingKeyId`
  (`signature-malformed`). One key signs a manifest at most once.
- **S3 — Manifest first.** The manifest must validate `artifact-manifest.v1` before
  any signature is considered (`manifest-schema-invalid`).
- **S4 — Signed message.** Each signature is an ordinary Ed25519 signature (not
  Ed25519ph) over

  ```text
  UTF8(manifest.schemaVersion) || 0x00 || raw_32_bytes(SHA-256(UTF8(RFC8785(manifest))))
  ```

  i.e. the fleet convention of `contracts/agent-orchestration/SEMANTICS.md`, with the
  domain `libre-ai.artifact-manifest.v1`. The digest covers the whole manifest
  document. A signature over the bare JCS, the bare digest, another domain or another
  manifest does not verify (`signature-invalid`).
- **S5 — Key selection.** A signature selects its key by `signingKeyId` in the
  registry, and only there. Signatures naming an identifier absent from the registry
  are ignored and counted, never verified. If no signature names a registry key, the
  record is refused `signature-key-unknown`. Ignoring unknown identifiers is what lets
  a producer sign with an old and a new key during a rotation.
- **S6 — Activity.** Every signature naming a registry key requires that key to be
  active at `now`: `activatedAt <= now < revokedAt` (half-open, `revokedAt = null`
  meaning no end, as `contracts/build-brief-v2/SEMANTICS.md` states for validity
  intervals). A `now` that is not an instant of the fixed form above establishes no
  instant, and is refused like an inactive key (fail closed). Refusal:
  `signature-key-not-active`.
- **S7 — Authorization.** Every signature naming a registry key requires the
  manifest's `artifactType` to be in that key's `artifactTypes`
  (`signature-key-not-authorized`).
- **S8 — Strict Ed25519 profile.** For every signature naming a registry key: `A`
  satisfies K2, `R` (first 32 octets) satisfies the same conditions, `S` (last 32
  octets, little-endian) is below the group order `L`, and the cofactorless equation
  holds with ZIP215 disabled. Same profile and same reasons as
  `contracts/build-brief-v2/SEMANTICS.md` "Detached acceptance and trust": both points
  are prime-order, so no torsion alias or second encoding verifies. Refusal:
  `signature-invalid`.
- **S9 — No silent invalid signature.** Every signature that names a registry key
  must pass S6, S7 and S8; one failing signature refuses the record even when another
  one verifies. Only unknown identifiers (S5) are ignored.
- **S10 — Order.** The order of `signatures`, and of `keys` in the registry, carries
  no meaning: any permutation yields the same outcome, and the accepted outcome lists
  verified identifiers in ascending order. When a record has several defects, the
  refusal reported is the first in this precedence: S3, S1, S2, S5, S6 (over all
  registry-key signatures), S7 (same), then S8/S9 (same). Each invalid vector carries
  one defect, so it does not depend on this precedence.

Accepting a record says that the named keys signed these manifest octets. It does not
check the manifest's files, sizes or digests against content: that is
`artifact-manifest.v1` verification, which a consumer runs after signature acceptance.
It authorizes no execution, installation or publication.

## Refusal codes

| Code | Rules |
| --- | --- |
| `key-set-invalid` | K1 to K5 |
| `manifest-schema-invalid` | S3 |
| `signature-required` | S1 (empty list) |
| `signature-malformed` | S1, S2 |
| `signature-key-unknown` | S5 |
| `signature-key-not-active` | S6, S9 |
| `signature-key-not-authorized` | S7, S9 |
| `signature-invalid` | S4, S8, S9 |

A refusal never carries signature, key or manifest octets.

## Vectors

`contracts/fixtures/artifact-manifest-signatures-v1/vectors.json` is written by
`tools/quality/artifact-manifest-signatures-vectors.ts` (`--write`, `--check`) from
fixed public test labels: test key `n` has seed
`SHA-256(UTF8("libre-ai.artifact-manifest-signatures-test-key.<n>"))`. The seeds are
published, so these keys must never be trusted outside tests. Expected outcomes are
written from the rules above, never by running a verifier. Each invalid vector breaks
exactly one rule and names it. `tools/quality/artifact-manifest-signatures-v1.test.ts`
replays every vector against an independent fixture verifier
(`tools/quality/artifact-manifest-signatures-v1.ts`), checks that the file is
byte-identical to the generator output, and checks that the strict point profile
reproduces the 24 point verdicts of the build-brief-v2 strict vectors. Schema-level
negatives are also listed in each contract's `schema-fixtures.json`.

## Deviations from the runbook

- `id` is renamed `signingKeyId`, the name signature records use to select a key, and
  its value is the K3 digest instead of `prod_key_<date>_<8 hex of the PEM text>`
  (owner decision on the identifier form: 64 hex characters of SHA-256 of the raw key).
  No key is registered yet, so nothing migrates.
- `artifactTypes` is added: the runbook's `purpose` is free text, which no verifier
  can read as an authorization.
- The runbook writes `"revokedAt": null` for a key in force; this contract keeps that
  form (member required, `null` for no end) rather than allowing it to be omitted, so
  that one meaning has one encoding.
- Bounds (64 keys, string lengths) are added; the runbook states none.
- `witness.signatory` and `revocationWitness.signatory` are free text. The runbook's
  example is an e-mail address, which is personal data in a versioned file: the
  privacy pass decides whether this member stays.

No other member of the runbook is changed, and none is added.
