# Signalement delivery envelope v1 — candidate semantics

Status: candidate, pending architecture, security and privacy review (catalog
`review.state` `pending-independent-agent-review`; reviews follow
`https://github.com/libre-ai/project-governance/blob/HEAD/docs/reviews/AGENT-REVIEW-PROTOCOL.md`).
Schema: `contracts/schemas/signalement-delivery-envelope.v1.schema.json`. Vectors:
`contracts/fixtures/signalement-delivery-envelope-v1/vectors.json`. Authority-fixture
verifier: `tools/quality/signalement-delivery-envelope-v1.ts`. Owner and only producer:
`signalement`. No consumer is qualified by this document.

The key words MUST, MUST NOT, SHOULD and MAY are used as in RFC 2119.

## Scope

The envelope is the small JSON document that accompanies one delivery of a local export
ZIP from the browser to a receiving service. It binds that delivery to the exact ZIP bytes
and to the origin the sender observed. It is sent in the `Signalement-Delivery-Envelope`
header, so it is bounded by the header ceiling below.

It does **not** prove that the sender is who it claims to be, that the person consented,
that the export content is true, or that `observedOrigin` is the real origin of the page:
a client chooses every member. It carries no credential, cookie, session or token, and no
text written by the person. Every member is either a fixed constant, a random identifier,
a digest, a length, or an origin. `observedOrigin` is personal data of the person's
browsing context (catalog classification `personal`) and MUST NOT be logged by a receiver
beyond the purpose of the delivery.

## Members

All five members are required; the document is closed (no other member).

| Member | Form | Rule |
| --- | --- | --- |
| `schemaVersion` | constant | exactly `libre-ai.signalement-delivery-envelope.v1` |
| `deliveryId` | string | UUID **version 4**, lowercase, as produced by `crypto.randomUUID()`: `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` |
| `exportSha256` | string | SHA-256 of the **exact ZIP bytes**, 64 lowercase hexadecimal characters |
| `exportByteLength` | integer | length in octets of those ZIP bytes, from 1 to 269500416 inclusive |
| `observedOrigin` | string or `null` | an origin as serialized by `new URL(x).origin`, or `null` when the sender observed none |

- `exportSha256` is the digest of the ZIP as transmitted, not of any file inside it, so a
  receiver can check it without parsing the archive. A receiver MUST compute the digest and
  the length on the bytes it received and refuse the delivery when either differs from the
  envelope. The digest detects corruption and truncation; it does not authenticate, because
  whoever changes the ZIP can recompute it.
- `deliveryId` is a correlation identifier chosen by the sender. A receiver SHOULD treat a
  second delivery with the same `deliveryId` as a replay of the first, never as a new one.
- `observedOrigin` is `scheme://host[:port]` with scheme `https` or `http` only, a lowercase
  host (a registered name, an IPv4 address or a bracketed IPv6 literal), and a port from 1 to
  65535 written only when it is not the default port of the scheme. No userinfo, path, query
  or fragment. The string `"null"`, an empty string, and any other scheme are refused. The
  schema pattern is
  `^https?://(?:[a-z0-9-]+(?:\.[a-z0-9-]+)*|\[[0-9a-f:.]+\])(?::[1-9][0-9]{0,4})?$` with at most
  262 characters. The pattern alone admits values that the URL serializer rewrites
  (`https://app.example.com:443`, a port above 65535); the verifier therefore also requires
  `new URL(observedOrigin).origin === observedOrigin`, and a value for which `new URL` throws
  fails the same check.

## Bounds

| Bound | Value | Origin |
| --- | --- | --- |
| Envelope, in octets | 4096 | ceiling of the `Signalement-Delivery-Envelope` header |
| Export ZIP, in octets | 269500416 | 268435456 (content, see the export semantics) + 1048576 (manifest) + 16384 (container margin) |
| `observedOrigin`, in characters | 262 | schema `maxLength` |
| JSON nesting depth | 8 | strict parser limit |

The envelope size is measured on the octets received, before any decoding or parsing. An
input above the ceiling is refused without being decoded. Raising a bound changes the
contract and is a compatibility decision.

## Verifier failure codes

`rawDeliveryEnvelopeFailures(bytes)` returns exactly one code for a refused envelope, the first
in this order, and `[]` for an accepted one. Codes contain no data from the envelope.

1. `envelope.size_limit` — more than 4096 octets.
2. `envelope.raw_json` — the octets are not strict JSON: byte order mark, invalid UTF-8, a
   duplicate member name, an unpaired surrogate, an invalid number, a syntax error, or nesting
   deeper than 8.
3. `envelope.schema` — the document does not satisfy the schema (missing, unknown or
   malformed member, bound exceeded, root that is not an object).
4. `envelope.origin_non_canonical` — the schema is satisfied, `observedOrigin` is not `null`,
   and it is not identical to the origin the URL serializer produces for itself.

A receiver MUST refuse the delivery on any code. It MUST NOT repair an envelope (lowercase a
host, drop a default port) and then accept it.

## Test material

Every value in the fixtures is synthetic: the identifiers are arbitrary, the digest is the
SHA-256 of the ASCII string `test`, and the origins use reserved example names, `localhost`,
the IPv4 loopback address and an IPv6 documentation address. No fixture contains credentials or personal data. Test
inputs that need a userinfo component are assembled in the test at run time so that no
credential-shaped literal is stored in the repository.
