# Signalement projection receipt v1 — candidate semantics

Status: candidate, pending architecture, security, cryptography and privacy review (catalog
`review.state` `pending-independent-agent-review`; reviews follow
`https://github.com/libre-ai/project-governance/blob/HEAD/docs/reviews/AGENT-REVIEW-PROTOCOL.md`).
Schema: `contracts/schemas/signalement-projection-receipt.v1.schema.json` (the receipt at the
root, the signing key set at `$defs/signingKeySet`). Vectors:
`contracts/fixtures/signalement-projection-receipt-v1/vectors.json`. Authority-fixture
verifier: `tools/quality/signalement-projection-receipt-v1.ts`. Owner and only producer:
`signalement`. No consumer is qualified by this document.

The key words MUST, MUST NOT, SHOULD and MAY are used as in RFC 2119.

This document fixes the structure of a signed receipt, the signing message and the structure
of a signing key set. The verification of a signature against a key set (verdicts, key
admissibility, signature encoding) and its corpus are added to this contract separately; until
then, no section here claims that a signature is checked.

## Scope

A projection receipt is produced by the control plane of an organization after each
successful delivery of one export to one destination (design section 5.5). It is
canonicalized (RFC 8785, JCS) and signed with Ed25519 by a key of that deployment.

**What a receipt proves**, once its signature is verified against a key set of the same
organization: that this control plane sent these octets to this remote identifier under this
policy version, after this approval. Concretely, it binds the digest of the exact export ZIP,
the destination and its exact connector profile, the remote item, the digest of every file
transmitted, the path and reason of every file withheld, the rendering (renderer version,
digest of the rendered body, media links), the digest of every HTTP request body actually
sent, and the version and digest of the policy.

**What a receipt does not prove**: the identity or the intention of the person who reported,
the truth of the export content, that the observed origin was the real origin of the page,
or what the provider did with the item afterwards (edited, moved, deleted, disclosed it). It
does not prove that the policy version was the one approved for the organization at that
time; that is the organization record of the policy lifecycle (routing policy semantics,
"Lifecycle"). A receipt whose signature is not verified proves nothing.

The receipt names internal systems of a tenant (destination, remote identifier and URL,
policy version): catalog classification `tenant-private`. It MUST NOT be published, and a
consumer MUST NOT copy its members into a log beyond the identifiers and digests. It carries
no credential, no text written by the person, and no file content.

The identifier under which an API serves a receipt is outside this contract.

## Shape (DL5)

A **signed receipt** is one flat JSON object: the **unsigned receipt** plus one member
`signature: { "algorithm": "ed25519", "value": <base64url> }`. The unsigned receipt is the
same object without `signature`, `keyId` included: `keyId` appears once, inside the signed
content, so the key identifier is itself covered by the signature. The document is closed at
every level (no other member).

| Member | Form | Rule |
| --- | --- | --- |
| `schemaVersion` | constant | exactly `libre-ai.signalement-projection-receipt.v1` |
| `organization` | string | the organization, `^[a-z][a-z0-9-]{0,63}$` (routing policy form) |
| `keyId` | string | identifier of the signing key in the organization's key set, `^[a-z0-9][a-z0-9-]{0,63}$` |
| `issuedAt` | timestamp | when the receipt was issued and signed |
| `deliveredAt` | timestamp | when the delivery succeeded at the remote; MUST NOT be later than `issuedAt` |
| `exportDigest` | digest | SHA-256 of the exact export ZIP octets (DL6) |
| `projectionId` | digest | identifier of the projection (organization, Dossier, destination) |
| `mappingVersion` | string | version of the mapping, `^[0-9]+\.[0-9]+\.[0-9]+$`, at most 32 characters |
| `operation` | enum | `create` (first delivery of the projection) or `comment` (a later revision) |
| `revision` | integer | revision of the Dossier delivered, 1 to 2147483647 (same bounds as `dossierRevision` of the export v1) |
| `destinationId` | id | destination of the routing policy |
| `profileId` | string | exact connector profile, `^[a-z0-9-]+/[a-z0-9.-]+/[a-z0-9.-]+$`, 5 to 106 characters |
| `remote.id` | string | identifier of the remote item, 1 to 256 printable ASCII characters without space (`^[\x21-\x7e]{1,256}$`) |
| `remote.url` | https URL | URL of the remote item, `^https://[\x21-\x7e]{1,2040}$` |
| `transmitted[]` | 0 to 33 | `{ path, sha256, via }`, one entry per file sent to the destination |
| `withheld[]` | 0 to 33 | `{ path, reason }`, one entry per file of the export not sent |
| `rendered` | object | `{ rendererVersion, bodyDigest, mediaLinks }`, see "Rendering" |
| `requestBodyDigests` | 1 to 64 digests | SHA-256 of each HTTP request body actually sent, in sending order |
| `policy` | object | `{ version, digest }`: version (`^[1-9][0-9]{0,9}$`) and `routingPolicyDigest` of the evaluated policy |
| `approval.reference` | id | reference of the approval that released the delivery |
| `signature` | object | `algorithm` exactly `ed25519`; `value` 86 base64url characters (64 octets) |

Shared forms, taken from the local export v1 (plan DL3): **timestamp**
`^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$` and a valid RFC 3339 date-time, UTC,
without fractional seconds, so lexical order is chronological order; **digest** 64 lowercase
hexadecimal characters; **id** `^[a-z][a-z0-9-]*$`, 1 to 64 characters; **path** a file path of
the export v1 (`README.md` or `media/<name>.(png|webm|mp4)`, no reserved device name).

- `via` is `body` (the file is rendered into the request body, the case of `README.md`),
  `attachment` (the file is uploaded to the tracker as an attachment) or `link` (the file is
  made reachable at the URL of its media link and referenced from the body).
- `reason` is one of the six withhold reasons of the routing policy semantics:
  `default-withhold`, `public-destination`, `residency`, `attachment-unsupported`,
  `visibility-unknown`, `user-withheld`. The policy evaluation produces the first four, with
  its fixed precedence `visibility-unknown` > `public-destination` > `residency` >
  `default-withhold`; `attachment-unsupported` and `user-withheld` are set by the delivery
  plan. A receipt records the reason that was final for the delivery.
- A path appears at most once in `transmitted`, at most once in `withheld`, at most once in
  `rendered.mediaLinks`, and never in both `transmitted` and `withheld`.
- `revision` is the receipt's only JSON number. Without it a `comment` receipt could not be
  recomputed offline.
- The document is ASCII: every string member is constrained to printable ASCII by its pattern,
  and member names are fixed.

## Canonical form and signing message (DL5)

A signed receipt MUST be transmitted and stored as the exact octets of its JCS form (RFC 8785):
members sorted, no whitespace, no escape other than those JCS requires, `revision` written as
a plain integer. A receiver MUST refuse other octets (`receipt.non_canonical`), never
re-canonicalize and accept them. This contract uses the authority canonicalizer, which writes
only safe integers: a document holding any other JSON number (`1.5`, `1e400`) cannot satisfy
the schema, whose only number is the integer `revision`, so it is refused as
`receipt.schema`; the canonical comparison applies to documents whose numbers are all safe
integers.

The signed message is the concatenation of:

1. the UTF-8 octets of the domain `libre-ai.signalement-projection-receipt.v1`;
2. one octet `0x00`;
3. the 32 raw octets of SHA-256 over the JCS form of the **unsigned** receipt (the signed
   receipt without its `signature` member).

`receiptSigningMessage(unsigned)` returns these octets. The domain separates these signatures
from any other family signed by the same key. The signature is Ed25519 over that message,
encoded base64url without padding in `signature.value`.

## Rendering

`rendered` lets a verifier recompute what was sent:

- `rendererVersion` is the semantic version (`MAJOR.MINOR.PATCH`, no leading zero, no
  pre-release, at most 32 characters) of the renderer of `profileId`; the pair (profile,
  version) identifies the renderer.
- `bodyDigest` is the SHA-256, lowercase hexadecimal, of the **JCS** of `RenderedBody.body`.
- `mediaLinks[]` (0 to 33) are the media links the renderer wrote into the body, `{ path, url }`,
  with `url` of the same form as `remote.url`. A media link MUST name a file of `transmitted`
  whose `via` is `link` (`receipt.media_link_untransmitted` otherwise).

`bodyDigest` covers the rendered content, before any HTTP framing; `requestBodyDigests` covers
the HTTP request bodies actually sent. They are distinct values and neither replaces the
other. With the export document, `projectionId`, `revision` and `mediaLinks`, `rendered` is
enough to recompute the rendered body offline, for a creation as for a comment.

## Offline verification against the export

A verifier holding a signed receipt, the organization's key set and the export ZIP:

1. MUST verify the signature (separate section of this contract, to come) and stop on any
   verdict other than valid.
2. MUST check that the SHA-256 of the exact ZIP octets equals `exportDigest`, without parsing
   the archive.
3. MUST check that every `transmitted[].path` and every `withheld[].path` is a file of the
   export manifest, and that each `transmitted[].sha256` equals the digest of that file in the
   manifest.
4. SHOULD recompute the rendered body and compare its digest with `rendered.bodyDigest`, but
   only with a renderer of exactly `rendererVersion` for `profileId`. When that version is not
   available, it MUST say so explicitly, and MUST NOT report the rendering as verified.

## Signing key set (DL7)

`$defs/signingKeySet` is the organization's public key set, the `PublicKeySet` of the
registry, exactly the `data` of the control plane endpoint that exports public keys:

```json
{ "organization": "<organization>",
  "keys": [{ "keyId": "<keyId>", "algorithm": "ed25519", "publicKey": "<43 base64url>",
             "status": "active | retired", "notBefore": "<timestamp>",
             "notAfter": "<timestamp> | null" }] }
```

- 1 to 1024 keys; `keyId` unique within the set.
- `publicKey` is the 32 raw octets of the Ed25519 public key in base64url without padding: 43
  characters whose 2 unused trailing bits are zero (the canonical encoding). Whether those 32
  octets are an admissible point is decided by signature verification, not by the structure.
- The validity window of a key is `[notBefore, notAfter)`, `notAfter` excluded; `notAfter:
  null` means no end. A `retired` key MUST carry a `notAfter`; `notAfter`, when present, MUST
  be later than `notBefore`. A retired key stays in the set so that receipts it signed inside
  its window remain verifiable; it verifies nothing issued at or after its `notAfter`.
- A receipt is checked against the key set of its own organization. Signature verification
  compares `receipt.organization` with the key set's `organization` before looking up any key;
  if they differ, the verdict is `invalid` with reason `key.organization_mismatch`. That rule
  belongs to the signature verification section and is stated here so that the key set is
  never read as valid for another organization.
- A key set is not signed and need not be in JCS form.

## Bounds

| Bound | Value |
| --- | --- |
| Signed receipt, in octets | 65536 |
| Signing key set, in octets | 262144 |
| `transmitted`, `withheld`, `rendered.mediaLinks` | 0 to 33 each (the export holds at most 33 files) |
| `requestBodyDigests` | 1 to 64 |
| `keys` | 1 to 1024 |
| `revision` | 1 to 2147483647 |
| `remote.url`, media link `url`, in characters | 2048 |
| JSON nesting depth | 8 |

Sizes are measured on the octets received, before any decoding or parsing; an input above its
ceiling is refused without being decoded. The schema bounds alone admit receipts larger than
65536 octets (33 media links of 2048 characters); the octet ceiling is binding, and a producer
MUST NOT sign a receipt whose JCS form exceeds it. Raising a bound changes the contract and is
a compatibility decision.

## Verifier failure codes

`rawProjectionReceiptFailures(bytes)` reads a **signed** receipt and returns exactly one code
for a refused document, the first in this order, and `[]` for an accepted one. Codes contain no
data from the document.

1. `receipt.size_limit` — more than 65536 octets.
2. `receipt.raw_json` — the octets are not strict JSON: byte order mark, invalid UTF-8, a
   duplicate member name, an unpaired surrogate, an invalid number, a syntax error, or nesting
   deeper than 8.
3. `receipt.non_canonical` — every number is a safe integer and the octets differ from the JCS
   form of the parsed document (whitespace, member order, a trailing newline, an escaped
   solidus or letter, `1.0` for `1`).
4. `receipt.schema` — the document does not satisfy the schema (missing, unknown or malformed
   member, a non-integer or out-of-range `revision`, a timestamp with a fraction or an offset,
   an `http` URL, an unknown withhold reason, a missing `signature`, bound exceeded, root that
   is not an object).
5. `receipt.duplicate_path` — a path appears twice in `transmitted`, in `withheld` or in
   `rendered.mediaLinks`.
6. `receipt.file_overlap` — a path appears in both `transmitted` and `withheld`.
7. `receipt.media_link_untransmitted` — a media link names a path that is not in
   `transmitted` with `via: "link"`.
8. `receipt.timestamp_order` — `deliveredAt` is later than `issuedAt`.

`rawSigningKeySetFailures(bytes)` reads a key set, with the same discipline:

1. `keys.size_limit` — more than 262144 octets.
2. `keys.raw_json` — the octets are not strict JSON (same causes, depth 8).
3. `keys.schema` — the document does not satisfy `$defs/signingKeySet` (no key or more than
   1024, unknown member, algorithm other than `ed25519`, a public key not of 43 base64url
   characters, a status other than `active` or `retired`, a malformed timestamp).
4. `keys.duplicate_key_id` — two keys share a `keyId`.
5. `keys.retired_without_end` — a `retired` key has `notAfter: null`.
6. `keys.window_order` — a key has a `notAfter` earlier than or equal to its `notBefore`.
7. `keys.encoding` — a public key is not the canonical base64url encoding of its 32 octets.

A receiver MUST refuse on any code, and MUST NOT repair a document and then accept it.
Neither function verifies a signature, checks a point, or reads the export.

## Test material

Every value in the fixtures is synthetic. Digests are SHA-256 of ASCII labels (`export`,
`projection`, `README.md`, `request-1`, …). Public keys are those of test seeds
n = SHA-256(UTF-8 `libre-ai.signalement-receipt-test-key.<n>`), n = 1 and 2; these seeds are
public and MUST NOT be used outside tests. The `signature.value` of the structural vectors is
a placeholder (SHA-512 of a public label, base64url), not a signature over the receipt;
signatures that verify belong to the signature corpus. Organizations, destinations and URLs use example
names. No fixture contains a credential or personal data.
