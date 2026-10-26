# Signalement v1.0 contracts: routing policy, delivery envelope, projection receipt, connector profile, policy receipt

Decision identifier: `urn:libre-ai:decision:2026-10-24-signalement-v1-contracts`.
Status: proposed. The five entries are `candidate`, not `locked`; none is locked by
this record.
Arbitration reference: the owner's design decisions D3, D6, D7, D8, D10, D12 and D13
of the `libre-ai/signalement` v1.0 design record
(`docs/superpowers/specs/2026-10-22-v1-policy-routed-ticket-projection-design.md`,
approved 2026-10-23): D3 four target profiles, D6 routing with defaults and a bounded
choice, D7 signed receipt and unchanged export, D8 delivery by the active tab, D10
routing on the observed origin, D12 one self-hosted organization and one signing key
per deployment, D13 projection-only v1.0. Two further owner decisions of 2026-10-24
bear on the contracts: when several policy rules match, their effects combine as a
union (no rule ordering), and the GitLab connector profile authenticates with a
personal access token carrying the `api` scope. The owner's signature on the contract
creation itself is still to be given before merge.

## Context

`signalement` v1.0 projects a Dossier to external ticket systems (GitHub Issues,
GitLab Issues, Jira Cloud, self-hosted Plane), routed by an organization policy. The
control plane, the extension and the CLI exchange four documents that this authority
does not carry, and evaluate and sign them through one component interface:

- the routing and disclosure policy of an organization (D6, D10, D12);
- the delivery envelope the extension hands to the control plane, carrying the
  observed origin of the capture (D8, D10);
- the signed projection receipt (D7), with its signing key set;
- the connector profile that makes a target system's behavior a published, testable
  document (D3);
- the WIT world of the L2 component, `libre-ai:signalement-policy-receipt@1.0.0`
  (`signalement-policy-receipt-v1`): a pure interface of four functions over JSON
  octets, `evaluate` (the routing policy), `canonicalize` (RFC 8785), `sign-receipt`
  and `verify-receipt` (the projection receipt), whose outputs every implementation
  reproduces octet for octet (`signalement` roadmap registry, section 4.1). It is not
  a document and defines no receipt of its own: the receipt it signs and verifies is
  the projection receipt.

Policy and receipt name internal systems of a tenant, and so do the world's golden
vectors, which carry policies and receipts; the envelope carries the observed origin of
a person; the profile is published. The classification and the required reviews below
follow from that.

## Alternatives

| Alternative | Consequence |
| --- | --- |
| DL4: carry the `draft` / `approved` / `retired` state inside the policy document | Approving or retiring would change the document bytes and therefore `policyDigest`: the approved digest, the evaluated digest and the digest cited by receipts would diverge |
| DL4: keep the state beside the document, in an organization record that references `policyId`, `version` and `digest` | The document is immutable by (`policyId`, `version`); `policyDigest` = SHA-256(JCS(document)) is stable over the whole cycle; the semantics fix states and transitions and state that only an `approved` version is evaluated, the refusal being carried by the caller |
| DL5: sign a receipt object that nests the unsigned receipt | A second shape to keep in step; the unsigned form of the registry would no longer be the same content |
| DL5: signed receipt = unsigned receipt plus a `signature: { algorithm: "ed25519", value }` member | One `keyId`, inside the content; the signed message is the UTF-8 domain string `libre-ai.signalement-projection-receipt.v1`, a `0x00` byte, then SHA-256(JCS(receipt without `signature`)); the whole document must itself be in JCS form |
| DL7: define the public key set as a separate contract | A sixth contract for a list of at most 1024 keys |
| DL7: `PublicKeySet` = `$defs/signingKeySet` of the receipt schema, keys `active` or `retired`, with a `notBefore` / `notAfter` window | Retired keys are kept to verify old receipts; no sixth contract |
| DL9: extend `build-brief-crypto-oracle` | It reads only `libre-ai.build-brief-strict-ed25519-vectors.v2`; widening it changes an oracle of a locked family |
| DL9: new Rust oracle `tools/quality/signalement-receipt-crypto-oracle/` | Independent cross-check of the strict Ed25519 verifier, with the exact crate versions of the existing oracle; no new crate version enters the authority |

## Decision

Add five contracts as `candidate` entries, appended after the registered additions in
`contracts/catalog-post-lock-additions.v1.json` (pinned digest in
`tools/quality/specification-lock.ts`), each with the review dossier
`docs/reviews/signalement-v1-contracts-review.md`:

| Contract | Classification | Required independent reviews |
| --- | --- | --- |
| `signalement-routing-policy-v1` | tenant-private | architecture, security, privacy |
| `signalement-delivery-envelope-v1` | personal | architecture, security, privacy |
| `signalement-projection-receipt-v1` | tenant-private | architecture, security, cryptography, privacy |
| `signalement-connector-profile-v1` | public | architecture, security |
| `signalement-policy-receipt-v1` | tenant-private | architecture, security, cryptography |

Semantics: `contracts/<name>/SEMANTICS.md` for the four JSON Schema contracts, and
`contracts/wit/signalement-policy-receipt-v1/SEMANTICS.md` beside its `world.wit` for
the world. Vectors: `contracts/fixtures/<name>/`; the four JSON Schema contracts also
carry a schema fixture there, the world carries golden vectors and no schema fixture.
The schema-fixture inventory of the family is
`tools/quality/signalement-v1-fixture-inventory.ts`: it lists the directory of each
admitted JSON Schema contract, and a missing or malformed fixture document is a named
failure of the contracts gate, never an exception. The same file holds every fixture
file of those directories, of the world's golden vectors and of the locked local
export, and the catalog itself, to the 65,536-code-point budget of signalement's
public-boundary scanner, since signalement vendors them.

Digests: the envelope `exportSha256` and the receipt `exportDigest` are SHA-256 of the
exact bytes of the ZIP (DL6), verifiable without parsing it.

## Consequences

- This record admits catalog entries. It grants no runtime admission and is not a role
  verdict on any content; conformance is proved in the `signalement` repository,
  against this authority at a pinned revision.
- The entries stay `candidate` until each required role has produced its pass.
  Nothing here is locked; locking is a second change.
- Merge waits for the owner: the contract creation and the names carry the owner's
  signature.
