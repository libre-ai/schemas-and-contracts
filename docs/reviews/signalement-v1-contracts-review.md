# Review dossier — signalement v1 contracts (candidate)

- **Candidate contracts:** `signalement-routing-policy-v1`,
  `signalement-delivery-envelope-v1`, `signalement-projection-receipt-v1`,
  `signalement-connector-profile-v1`, `signalement-policy-receipt-v1` (catalog entries
  after the post-lock baseline, added one at a time).
- **Status:** `pending-independent-agent-review` (catalog `review.state`), for each
  entry. Authored solo; no role pass has run.
- **Required roles (catalog `review.required`):**

  | Contract | Roles |
  | --- | --- |
  | `signalement-routing-policy-v1` | architecture, security, privacy |
  | `signalement-delivery-envelope-v1` | architecture, security, privacy |
  | `signalement-projection-receipt-v1` | architecture, security, cryptography, privacy |
  | `signalement-connector-profile-v1` | architecture, security |
  | `signalement-policy-receipt-v1` | architecture, security, cryptography |

- **Decision:** `docs/adr/2026-10-24-signalement-v1-contracts.md`, status proposed.
- **Semantics:** `contracts/<name>/SEMANTICS.md` for each contract.

## What this dossier is, and is not

It satisfies the catalog's mechanical requirement that a `candidate` entry name a
dossier under `docs/reviews/` bound to the independent agent review protocol
(`contracts/COMPATIBILITY.md` "Evidence"). The protocol lives in the governance
authority, `docs/reviews/AGENT-REVIEW-PROTOCOL.md`, which this repository does not
vendor; the reviewer uses the governance copy
(https://github.com/libre-ai/project-governance/blob/HEAD/docs/reviews/AGENT-REVIEW-PROTOCOL.md).

It is **not** a completed review. Each required role must run as a separate pass
with its own findings, and each finding must be answered before a contract leaves
`candidate`.

## Points for the architecture and security passes

1. DL4: the policy lifecycle (`draft`, `approved`, `retired`) lives beside the policy
   document, not in it. Review that "only an `approved` version is evaluated" is
   enforceable by a caller that holds only the document and its digest, and that the
   organization record cannot name a digest different from the one evaluated.
2. DL5: the signed receipt is the unsigned receipt plus one `signature` member; the
   signed message is a domain string, a `0x00` byte and SHA-256 of the JCS form of the
   receipt without `signature`. Review that the exclusion cannot hide an edit to a
   signed member and that the domain string cannot collide with another family.
3. DL6: `exportSha256` and `exportDigest` are SHA-256 of the exact ZIP bytes. Review
   that a verifier needs no ZIP parser to check them.
4. DL7: the public key set is `$defs/signingKeySet` of the receipt schema, at most 1024
   keys, `status: active | retired`, with a validity window. Review that a retired key
   still verifies a receipt signed inside its window and nothing after it.
5. DL8: evaluation is pure: union of matching rules, refusal dominates, withholding
   dominates, unknown visibility withholds everything, and the evaluation never yields
   `attachment-unsupported` or `user-withheld`. Review that the order of rules cannot
   change the outcome (owner decision of 2026-10-24: union, no ordering).

## Points for the privacy pass

- The envelope carries the observed origin of a person (design D10); the policy and
  receipts name internal systems of a tenant. Review that no field admits content
  beyond what the classification table states.

## Adversarial corpus

Each contract's `vectors.json` carries an invalid set built to break the verifier, not
to illustrate the happy path: non-canonical JSON (key order, whitespace, number
forms), raw non-JSON octets (`raw`, base64url), unknown members at every level,
oversized arrays and strings, duplicate identifiers, digest mismatches, signature
malleability and wrong-domain signatures for the two receipts. The corpus is
synthetic; no real key, token or tenant appears in it.

## GitLab connector fixture

The connector profile fixture for GitLab Issues (admitted with the profile contract)
records the owner decision of 2026-10-24: authentication by personal access token
with the `api` scope. Review that the profile states the scope as a requirement of the
profile, never as a credential value.
