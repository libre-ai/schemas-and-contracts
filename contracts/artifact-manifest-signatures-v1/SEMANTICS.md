# Artifact Manifest Signatures v1 and Signing Keys v1 — candidate semantics

Status: candidate, unimplemented. Owner decision of 2026-11-17 (option (a) of the
first owner question of the artifact signature work package). The four role-separated
passes (architecture, security, cryptography, privacy) ran on 2026-11-17; their findings
and the answer to each are in `docs/reviews/artifact-manifest-signatures-v1-review.md`.
The contracts stay `candidate` until the owner admits them. `artifact-manifest.v1` is
locked and does not change: it carries no signature member, and nothing here adds one.

Two contracts, one family:

- `artifact-manifest-signatures.v1` (`contracts/schemas/artifact-manifest-signatures.v1.schema.json`):
  a detached record of 1 to 16 Ed25519 signatures over one `artifact-manifest.v1`
  document;
- `signing-keys.v1` (`contracts/schemas/signing-keys.v1.schema.json`): the public key
  registry `config/signing-keys.v1.json` described by the key ceremony runbook of the
  governance authority (`docs/security/KEY-CEREMONY-RUNBOOK.md`, step 7, rotation and
  revocation protocols).

Rule identifiers (`K0`…`K7`, `S0`…`S10`) are stable: the vectors name the rule each
invalid case breaks.

## Signing key registry (`signing-keys.v1`)

The document is `{ "schemaVersion": "libre-ai.signing-keys.v1", "keys": [...] }`. Each
key entry has exactly these members:

| Member | Form | Source |
| --- | --- | --- |
| `signingKeyId` | `ed25519-` and 64 lowercase hex characters, 72 characters (K3) | runbook `id`, renamed |
| `algorithm` | `"Ed25519"` | runbook |
| `publicKey` | PEM SPKI Ed25519, exact form below (K1) | runbook |
| `purpose` | free text, 1 to 256 characters | runbook |
| `artifactTypes` | set of `artifact-manifest.v1` `artifactType` values, 0 to 5 | added (owner decision (a)) |
| `activatedAt` | instant, fixed form below | runbook |
| `revokedAt` | instant or `null` | runbook |
| `witness` | `{ signatory, attestedAt, comment }` | runbook |
| `revocationReason` | free text, required when and only when `revokedAt` is not `null` (K6) | runbook, revocation protocol |
| `revocationWitness` | `{ signatory, discoveredAt }`, same condition (K6) | runbook, revocation protocol |

`signingKeyId` is a `common.v1` `identifier` (`^[a-z][a-z0-9_-]{2,127}$`), the form every
other `signingKeyId` of this authority uses (agent review, agent review session
attestation, agent contributor lineage, effect attestation, harness attestation, tool
invocation observation); its pattern `^ed25519-[0-9a-f]{64}$` admits only identifiers,
and the vector test checks every corpus identifier against `identifier`. `artifactTypes` items are a
reference to the `artifactType` enumeration of `artifact-manifest.v1`, not a copy of it.
`signatory` (in `witness` and `revocationWitness`) is a role identifier
`^[a-z][a-z0-9-]{0,63}$` such as `key-custodian`, never a name or an address (K7).

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

- **K0 — Received octets.** The registry octets are strict JSON (RFC 8259): UTF-8
  without byte order mark, no member name repeated within one object, and every string
  well-formed Unicode with no unpaired surrogate, escaped or not (I-JSON, RFC 7493
  section 2.1 and 2.3). They are checked before any member is read: a lenient parser
  that keeps the first or the last of two `signingKeyId` members would admit a different
  registry from another consumer's.
- **K1 — Shape.** The document validates the closed schema: 1 to 64 keys, every
  member in the form above, `artifactTypes` without repetition, revocation members
  only on a revoked key. Unknown members are refused at every level.
- **K2 — Admissible public key.** `A` is canonical (re-encodes to the same octets,
  `y < p`, no negative zero), on the curve, not the identity and in the prime-order
  subgroup: the strict profile of `contracts/build-brief-v2/SEMANTICS.md`, applied at
  registry admission. Its 24 point vectors
  (`contracts/fixtures/build-brief-v2/strict-ed25519-vectors.json`) are the reference.
- **K3 — Derived identifier.** `signingKeyId = "ed25519-" || lowercase_hex(SHA-256(A))`
  over the 32 raw octets of the key, never over the PEM text, the identifier text or a
  date. Any verifier recomputes it from the key.
- **K4 — Unique identifier.** No two entries share a `signingKeyId`. With K3 this also
  forbids the same public key under two entries.
- **K5 — Validity window order.** When `revokedAt` is not `null`, it is strictly later
  than `activatedAt`.
- **K6 — Revocation evidence.** When `revokedAt` is not `null`, `revocationReason` and
  `revocationWitness` are present (the schema enforces the presence), and
  `revokedAt <= revocationWitness.discoveredAt`: a revocation is dated at or before the
  moment the compromise was discovered, never after it, so no signature made between
  discovery and a later revocation instant stays valid.
- **K7 — No personal data.** No member of the registry carries personal data. The
  identity of the person who admitted, attested or revoked a key lives in the
  `Signed-off-by` trailer of the reviewed commit that changes
  `config/signing-keys.v1.json`, not in the file; `signatory` names a role. `purpose`,
  `comment` and `revocationReason` describe the key, never a person. Refusals and logs
  of a verifier never copy any registry member as free text: they carry a refusal code
  and a rule identifier only.

A registry that breaks any K rule is refused as a whole (`key-set-invalid`) and
verifies nothing. An entry whose `artifactTypes` is empty is admitted but authorizes
no manifest (S7): the runbook registers keys for other signed objects too, and such a
key must not sign an artifact manifest. A record that such a key cosigns is refused
(vector `key-authorizing-nothing-cosigns`).

The registry is not signed and is not a JCS preimage. Its authenticity is the
consumer's concern (the runbook makes the reviewed commit of
`config/signing-keys.v1.json` the single source of truth); this contract fixes its
bytes' meaning, not its distribution.

## Key lifecycle

- **Rotation removes the entry.** A key retired in the ordinary course (scheduled
  rotation, change of custodian, end of purpose) is removed from the registry; it is
  not revoked. From then on, a signature naming it is an unknown signature (S5):
  ignored and counted, never verified. A manifest that must keep verifying after the
  rotation is therefore re-signed by the new key **before** the old entry is removed;
  the record then carries both signatures during the overlap, and the old one is
  ignored once the entry is gone (vectors `rotation-retired-key-ignored` and
  `rotation-retired-key-only`).
- **`revokedAt` is reserved for compromise.** It is set to the earliest instant from
  which the key must be distrusted, at or before `discoveredAt` (K6). Because activity
  is judged at verification time (S6), every record the key signed stops verifying at
  `now >= revokedAt`, whatever its manifest says about its own date.
- **A double-signed record is refused after one of its keys is revoked.** The revoked
  key is still in the registry, so its signature is not ignored but fails S6, and S9
  refuses the record even though the other signature verifies (vector
  `known-valid-and-known-revoked`). The producer re-issues the record without the
  compromised signature.

## Detached signature record (`artifact-manifest-signatures.v1`)

The record is
`{ "schemaVersion": "libre-ai.artifact-manifest-signatures.v1", "signatures": [{ "signingKeyId", "signature" }, ...] }`.
It names no manifest and carries no digest: it is paired with its manifest by the
transport, and the pairing is proved only by verification. It carries no public key:
keys come from the verifier's registry.

Verification takes the received manifest octets, the received record octets, an
admitted registry and an instant `now`. It either accepts, returning the sorted list of
verified `signingKeyId` values and the number of ignored unknown signatures, or refuses
with exactly one code.

- **S0 — Received octets.** The manifest octets and the record octets each satisfy the
  octet rule of K0 (strict JSON, UTF-8 without byte order mark, no repeated member
  name, no unpaired surrogate), checked on the octets as received, before parsing into
  any object, before hashing and before schema validation. A manifest that fails is
  refused `manifest-schema-invalid`, a record `signature-malformed`. Whitespace and
  member order are free: the digest covers the RFC 8785 form of the parsed value, and
  S0 is what makes that value unique. A verifier that hashes a document someone else
  parsed has no S0 and does not conform.
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
  a producer sign with an old and a new key during a rotation ("Key lifecycle").
- **S6 — Activity.** Every signature naming a registry key requires that key to be
  active at `now`: `activatedAt <= now < revokedAt` (half-open, `revokedAt = null`
  meaning no end, as `contracts/build-brief-v2/SEMANTICS.md` states for validity
  intervals). `now` is the verification time, read by the caller from a trusted clock
  of the verifying host and passed in; the verifier reads no clock itself. It is never
  derived from the manifest's `createdAt`, from the record, from the transport, or from
  any other signed or received data. A `now` that is not an instant of the fixed form
  above establishes no instant, and is refused like an inactive key (fail closed).
  Refusal: `signature-key-not-active`.
- **S7 — Authorization.** Every signature naming a registry key requires the
  manifest's `artifactType` to be in that key's `artifactTypes`
  (`signature-key-not-authorized`).
- **S8 — Strict Ed25519 profile.** For every signature naming a registry key: `A`
  satisfies K2, `R` (first 32 octets) satisfies the same conditions (canonical encoding
  that re-encodes to the supplied octets, on the curve, not the identity, in the
  prime-order subgroup), `S` (last 32 octets, little-endian) is below the group order
  `L`, and the verification equation holds with ZIP215 disabled. The pinned fixture
  verifier (`@noble/curves` 2.4.0) evaluates the cofactored equation
  `[8][S]B = [8]R + [8][k]A`; for `A` and `R` in the prime-order subgroup the cofactored
  and cofactorless equations accept exactly the same signatures, so the choice is not
  observable on admitted inputs. Consumers must therefore enforce the `R` and `A`
  checks (no torsion component, canonical re-encoding, not the identity) and `S < L`
  themselves, before the equation, whatever their library does by default: without
  them, the two equations diverge on torsion inputs and implementations disagree. Same
  profile and reasons as `contracts/build-brief-v2/SEMANTICS.md` "Detached acceptance
  and trust". Refusal: `signature-invalid`.
- **S9 — No silent invalid signature.** Every signature that names a registry key
  must pass S6, S7 and S8; one failing signature refuses the record even when another
  one verifies. Only unknown identifiers (S5) are ignored.
- **S10 — Order.** The order of `signatures`, and of `keys` in the registry, carries
  no meaning: any permutation yields the same outcome, and the accepted outcome lists
  verified identifiers in ascending order. When a record has several defects, the
  refusal reported is the first in this precedence: S0 (manifest octets), S3, S0
  (record octets), S1, S2, S5, S6 (over all registry-key signatures), S7 (same), then
  S8/S9 (same). Each invalid vector carries one defect, so it does not depend on this
  precedence.

Accepting a record says that the named keys signed these manifest octets. It does not
check the manifest's files, sizes or digests against content: that is
`artifact-manifest.v1` verification, which a consumer runs after signature acceptance.
It authorizes no execution, installation or publication.

## Freshness and rollback

Acceptance proves who signed a manifest, not that it is the one the consumer should
install now. Both properties stay with the consumer:

- **Freshness.** A consumer that needs the current manifest obtains the expected
  manifest `id`, or the expected SHA-256 of its RFC 8785 form, over an authenticated
  channel independent of the one that carried the manifest and record, and refuses any
  other accepted manifest.
- **Anti-rollback.** A consumer that must not go back keeps, per product, the
  `createdAt` of the last manifest it accepted and refuses an accepted manifest whose
  `createdAt` is lower. `createdAt` is signed, so it can order manifests of one
  product; it never establishes `now` (S6).

This contract defines neither channel nor state.

## Refusal codes

| Code | Rules |
| --- | --- |
| `key-set-invalid` | K0 to K6 |
| `manifest-schema-invalid` | S0 (manifest octets), S3 |
| `signature-required` | S1 (empty list) |
| `signature-malformed` | S0 (record octets), S1, S2 |
| `signature-key-unknown` | S5 |
| `signature-key-not-active` | S6, S9 |
| `signature-key-not-authorized` | S7, S9 |
| `signature-invalid` | S4, S8, S9 |

A refusal never carries signature, key or manifest octets, nor any registry member
(K7).

## Vectors

`contracts/fixtures/artifact-manifest-signatures-v1/vectors.json` is written by
`tools/quality/artifact-manifest-signatures-vectors.ts` (`--write`, `--check`) from
fixed public test labels: test key `n` has seed
`SHA-256(UTF8("libre-ai.artifact-manifest-signatures-test-key.<n>"))`. The seeds are
published, so these keys must never be trusted outside tests. Expected outcomes are
written from the rules above, never by running a verifier. Each invalid vector breaks
exactly one rule and names it.

Inputs are octets. `manifestOctets` gives, in Base64url, the octets of every manifest a
vector names (indented JSON for the well-formed ones, whose parsed value is also listed
under `manifests`). A vector whose defect lives in the octets carries them in
`registryOctets` or `recordOctets` and has `registry` or `record` set to `null`; any
other vector is presented as the UTF-8 of its `registry` or `record` value serialized as
JSON. `messages` publishes the signed message of three manifests, one of them
(`release-unicode`) with a file path holding every escape class of RFC 8785: a
non-ASCII letter, U+001F, a quotation mark, U+007F and U+2028.

`tools/quality/artifact-manifest-signatures-v1.test.ts` replays every vector against
an independent fixture verifier (`tools/quality/artifact-manifest-signatures-v1.ts`)
that receives octets, checks that the file is byte-identical to the generator output,
checks that the strict point profile reproduces the 24 point verdicts of the
build-brief-v2 strict vectors, and checks the published messages against the
verifier's own RFC 8785 serializer, itself checked against the examples of RFC 8785
sections 3.2.2 and 3.2.3. The generator builds messages with the repository's
`canonicalJson`; the two serializers share no code. Schema-level negatives are also
listed in each contract's `schema-fixtures.json`.

## Deviations from sibling contracts

- **build-brief-v2, time of judgment.** build-brief-v2 judges a key at the signed
  `acceptedAt` of its statement: the statement is historical evidence of an approval,
  and the key record binds a membership revision at acceptance. Here a key is judged at
  `now` (S6). A manifest's only date is its producer-asserted `createdAt`; judging at it
  would let a holder of a compromised key date a new manifest before the revocation and
  have it verify. Long-lived signed manifests survive rotation by re-signing ("Key
  lifecycle"), not by historical judgment.
- **build-brief-v2, wire form.** build-brief-v2 also requires the received octets to
  be already canonical (RFC 8785). Here S0 requires strict JSON only: manifests are
  `artifact-manifest.v1` files, a locked contract whose producers do not write RFC 8785,
  and the digest only needs the parsed value to be unique, which S0 ensures. No size or
  depth bound is fixed here; a consumer bounds its input before parsing.
- **agent-orchestration, unknown keys.** `contracts/agent-orchestration/SEMANTICS.md`
  refuses a signature whose key is unknown (fail closed). Here an unknown key is ignored
  and counted (S5), because a rotation overlap needs a record signed by an old and a new
  key to verify against registries that know either. Fail-closed is kept where it
  matters: at least one registry key must verify, every registry key named must pass
  S6 to S8 (S9), and an ignored signature contributes nothing to acceptance.

## Deviations from the runbook

- `id` is renamed `signingKeyId`, the name signature records use to select a key, and
  its value is the K3 identifier `ed25519-<hex>` instead of
  `prod_key_<date>_<8 hex of the PEM text>` (owner decision on the identifier form,
  aligned on `common.v1` `identifier` by the architecture pass). No key is registered
  yet, so nothing migrates.
- `artifactTypes` is added: the runbook's `purpose` is free text, which no verifier
  can read as an authorization.
- The runbook writes `"revokedAt": null` for a key in force; this contract keeps that
  form (member required, `null` for no end) rather than allowing it to be omitted, so
  that one meaning has one encoding.
- The runbook's rotation protocol marks the old key with `revokedAt`; this contract
  removes it instead and reserves `revokedAt` for compromise ("Key lifecycle").
- `revocationReason` and `revocationWitness` are required on a revoked key, and
  `revokedAt` may not follow `discoveredAt` (K6). The runbook's revocation example
  (revocation two minutes after discovery) breaks K6.
- `signatory` is a role identifier; the runbook's example is an e-mail address, which
  K7 forbids.
- Bounds (64 keys, string lengths) are added; the runbook states none.

No other member of the runbook is changed, and none is added. Aligning the runbook is a
change of the governance authority, outside this contract.
