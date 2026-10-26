# signalement-policy-receipt-v1 — candidate semantics

Status: candidate, pending architecture, security and cryptography review (catalog
`review.state` `pending-independent-agent-review`; reviews follow
`https://github.com/libre-ai/project-governance/blob/HEAD/docs/reviews/AGENT-REVIEW-PROTOCOL.md`).
World: `contracts/wit/signalement-policy-receipt-v1/world.wit`, interface
`libre-ai:signalement-policy-receipt/api@1.0.0`. Golden vectors:
`contracts/fixtures/signalement-policy-receipt-v1/golden-vectors.v1.json` and its declared
parts. Authority-fixture verifier of the golden document:
`tools/quality/signalement-policy-receipt-v1.ts`. Owner and only producer: `signalement`. No
implementation is qualified by this document; conformance is proved in the implementing
repository against these vectors.

This document is normative for every implementation of the world. The key words MUST, MUST
NOT, SHOULD and MAY are used as in RFC 2119.

## Scope and purity

The world exports one interface, `api`, with four functions over JSON octets: `evaluate`
(routing-policy evaluation), `canonicalize` (RFC 8785), `sign-receipt` and `verify-receipt`
(Ed25519 projection receipts). It MUST have zero imports: no clock, network, storage,
randomness or other host capability. Each function is a pure function of its arguments: the
same octets give the same result, octet for octet, on every implementation.

Every result is either the success octets or a `contract-error { code, message }`, never both
and never a partial output. `code` is one of the codes below. `message` is a fixed text chosen
by the implementation for the code; it MUST NOT contain any octet of any argument, nor any value
decoded from one. Conformance compares `code` only.

An implementation MUST NOT trap, abort or panic on any input. A failure that none of the steps
below names, which a conforming implementation never meets (an internal serialization fault),
returns `internal.error`. No golden case expects `internal.error`, and a golden document MUST
NOT.

This contract does **not** prove that a policy version is approved (the caller checks it,
below), that an origin is the real origin of a page, that a destination's declared attributes
are true, that a seed is kept secret, or that a key set is authentic: the caller obtains the
key set from its organization's control plane.

## Bounds

| Argument or result | Ceiling | Refusal |
| --- | --- | --- |
| `evaluate` `policy` | 1048576 octets | `input.too_large` |
| `evaluate` `input` | 1048576 octets | `input.too_large` |
| `canonicalize` `json` | 1048576 octets | `canonicalize.too_large` |
| `sign-receipt` `unsigned` | 65536 octets | `receipt.invalid` |
| `sign-receipt` `secret-key` | exactly 32 octets | `key.invalid` |
| `verify-receipt` `signed` | 65536 octets | verdict `unreadable` (receipt rule, not an error) |
| `verify-receipt` `public-keys` | 262144 octets | `keys.invalid` |
| JSON nesting depth of `input` and `json` | 64 | `input.invalid`, `canonicalize.depth` |
| Any success output | 2097152 octets (2 MiB) | the function's size code |

A size is measured on the octets received, before any decoding, and an argument above its
ceiling is never decoded. Exactly the ceiling passes. Depth: the top-level value has depth 1,
and a value inside an array or an object has the depth of that container plus 1. The policy
and the receipts keep their own, smaller depth bound (8), checked by their verifiers. The
output ceiling is checked after the success octets are produced and before they are returned;
for `evaluate` and `sign-receipt` it cannot be reached within the input bounds (64 destinations
of 33 files; a schema-valid signed receipt is at most 57177 octets), for `canonicalize` it can
(`1e15` is 4 octets in and 16 out).

## evaluate

`evaluate(policy, input)` evaluates one `signalement-routing-policy-v1` document for one
`EvaluationInput` and returns the JCS octets of the `PolicyVerdict`. The verdict, its members
and every step of its computation are those of the routing-policy semantics, section
"Evaluation" (DL8): union of the matching rules, refusal dominating, the most restrictive
`override`, withholding dominating, unknown visibility withholding every file, the fixed reason
precedence, sorted destinations and files. The verdict has no top-level `selectable` member:
selectable destinations appear in `destinations`, with `routing: "selectable"`, only when
`override` is `allowed`. `evaluate` never yields `attachment-unsupported` nor `user-withheld`.

The function sees the document, not its lifecycle state (DL4): the caller MUST evaluate only a
version recorded `approved`, and MUST check that the digest the record names is the
`policyDigest` the verdict reports.

Steps, in this order; the first that fails gives the error:

1. `input.too_large` — `policy` or `input` is above 1048576 octets.
2. `policy.invalid` — the routing-policy verifier refuses `policy`
   (`rawRoutingPolicyFailures(policy)` is not empty, whatever its code). A refused policy is
   never repaired.
3. `input.invalid` — `input` is not strict JSON (byte order mark, invalid UTF-8, duplicate
   member name, unpaired surrogate, invalid or non-finite number, syntax error, depth above 64)
   or is not an `EvaluationInput`:
   - an object with exactly the members `observedOrigin`, `files`, `discovered`;
   - `observedOrigin` is a string or `null`;
   - `files` is an array of 1 to 33 objects, each with exactly `path` (the path pattern of the
     local export v1: `README.md` or `media/<name>.png|webm|mp4`, at most 80 characters),
     `role` (`document`, `screenshot` or `video`) and `sha256` (64 lowercase hexadecimal
     characters); no two files share a `path`;
   - `discovered` is an object of at most 64 members, each name an identifier
     `^[a-z][a-z0-9-]*$` of 1 to 64 characters, each value an object with exactly `visibility`
     (`public`, `internal`, `private` or `unknown`) and `attachmentUpload` (a boolean).
4. `input.origin_invalid` — `observedOrigin` is a string that is not a serialized origin: it
   does not match the origin pattern of the delivery envelope
   (`^https?://(?:[a-z0-9-]+(?:\.[a-z0-9-]+)*|\[[0-9a-f:.]+\])(?::[1-9][0-9]{0,4})?$`, at most
   267 characters), or the URL serializer rewrites it (`new URL(o).origin !== o`, a value for
   which `new URL` throws included). Refused, never normalized: `https://Example.test`,
   `https://example.test:443`, `https://example.test.`, `https://example.test/`,
   `https://example.test/path`.
5. Otherwise the verdict. Its JCS octets are the output.

The role of a file is taken as given: `evaluate` does not check it against the path.

## canonicalize

`canonicalize(json)` returns the RFC 8785 (JCS) form of one JSON value, restricted to values
whose numbers are safe integers. Steps, in this order:

1. `canonicalize.too_large` — `json` is above 1048576 octets.
2. `canonicalize.raw_json` — a byte order mark, or octets that are not UTF-8.
3. The octets are read left to right as one JSON text (RFC 8259) followed only by whitespace;
   the first defect met gives the code:
   - `canonicalize.raw_json` — a syntax error (trailing octets included), a member name that
     repeats an earlier name of the same object, or a number literal whose IEEE-754 binary64
     value (rounded half to even) is not finite (`1e400`);
   - `canonicalize.lone_surrogate` — an escape `\uD800` to `\uDFFF` that is not a high
     surrogate immediately followed by an escaped low surrogate;
   - `canonicalize.depth` — a value of depth 65 or more (the defect is met at its first
     character).
4. `canonicalize.number` — a number whose binary64 value is not integral, or whose magnitude is
   above 2^53 − 1 (9007199254740991). The literal itself does not matter: `1.0`, `1e2`, `10E-1`
   and `-0` are the integers 1, 100, 1 and 0; `1.5` and `9007199254740992` are refused.
5. The output is the JCS form of the value: no whitespace; object members sorted by their names
   compared as sequences of UTF-16 code units (so U+1F600, written D83D DE00, sorts before
   U+FF21); array order kept; each number written as a decimal integer without sign for zero,
   exponent or fraction; strings with only the escapes JCS requires: `\"`, `\\`, `\b`, `\t`,
   `\n`, `\f`, `\r`, and `\u00xx` in lowercase hexadecimal for the other code points below
   U+0020; every other character, non-ASCII included, written as its UTF-8 octets. Output above
   2097152 octets: `canonicalize.too_large`.

## sign-receipt

`sign-receipt(unsigned, secret-key)` signs one `UnsignedReceipt` of
`signalement-projection-receipt-v1` (the receipt without its `signature` member, `keyId`
included) and returns the JCS octets of the signed receipt (DL5). Steps, in this order:

1. `key.invalid` — `secret-key` is not exactly 32 octets. The 32 octets are an Ed25519 seed
   (RFC 8032 section 5.1.5), never an expanded key.
2. `receipt.invalid` — `unsigned` is above 65536 octets.
3. `receipt.invalid` — `unsigned` is not strict JSON with depth at most 8, is not an object, or
   carries a member `signature`.
4. The signature is the RFC 8032 Ed25519 signature (deterministic) by that seed of
   `receiptSigningMessage(unsigned)`: the UTF-8 domain `libre-ai.signalement-projection-receipt.v1`,
   one octet `0x00`, then the 32 raw octets of SHA-256 over the JCS form of `unsigned`. The
   signed receipt is `unsigned` plus the member `signature: { "algorithm": "ed25519", "value":
   <base64url of the 64 octets, no padding> }`; its JCS form is the candidate output.
5. `receipt.invalid` — the projection-receipt verifier refuses the candidate output
   (`rawProjectionReceiptFailures` is not empty: schema, paths, media links, timestamps, a
   number that is not a safe integer). Nothing is returned but the error.

The `keyId` of the output is the one read in `unsigned.keyId`. `sign-receipt` does not check
that the seed is the key `keyId` names: it holds no key set. A key set that does not hold the
seed's public key under that `keyId` makes the receipt fail verification later.

## verify-receipt

`verify-receipt(signed, public-keys)` applies the receipt semantics, section "Signature
verification", in its order and with its outcomes, and returns the JCS octets of the
`ReceiptVerification`:

```ts
{ signature: "valid" | "invalid" | "unknown-key" | "unreadable";
  keyId: string | null; keyStatus: "active" | "retired" | null; receipt: SignedReceipt | null }
```

- `signature`, `keyId` and `keyStatus` are those of the verdict of that section; its `reason`
  is not part of the output.
- `receipt` is the signed receipt as read from `signed` (`signature` member included) when
  `signature` is `valid`, and `null` otherwise.
- `keys.invalid` — the outcome is `refused` (step 2: the key set verifier
  `rawSigningKeySetFailures` refuses `public-keys`, its own 262144-octet ceiling included). It
  is an error, not a verdict. An unreadable receipt is a verdict, `unreadable`, and step 1 runs
  first: an unreadable receipt with an unreadable key set gives `unreadable`.

## Error codes, by function

| Function | Codes, in the order of the steps |
| --- | --- |
| `evaluate` | `input.too_large`, `policy.invalid`, `input.invalid`, `input.origin_invalid` |
| `canonicalize` | `canonicalize.too_large`, `canonicalize.raw_json`, `canonicalize.lone_surrogate`, `canonicalize.depth`, `canonicalize.number` |
| `sign-receipt` | `key.invalid`, `receipt.invalid` |
| `verify-receipt` | `keys.invalid` |
| every function | `internal.error` (never expected) |

## Golden vectors

The golden document is one JSON object, read from the entry file `golden-vectors.v1.json` and
the parts it declares (below):

| Member | Value |
| --- | --- |
| `schemaVersion` | `libre-ai.signalement-policy-receipt-golden-vectors.v1` |
| `world` | `signalement-policy-receipt-v1` |
| `engineVersion` | `1.0.0` |
| `canonicalization` | `RFC 8785` |
| `digestAlgorithm` | `SHA-256` |
| `contractFiles` | 1 to 128 distinct `{ path, sha256 }`: the files the cases depend on (the routing-policy and receipt schemas, both files of the receipt signature corpus), each path relative to the authority root |
| `testMaterialWarning` | a printable ASCII string of 1 to 1000 characters |
| `cases` | 1 to 4096 cases |

A case is `{ id, operation, args, expected, rationale }` and nothing else:

- `id` is `^[a-z][a-z0-9-]*$`, at most 64 characters, unique in the document;
- `operation` is `evaluate`, `canonicalize`, `sign-receipt` or `verify-receipt`;
- `args` holds exactly the arguments of the operation. A JSON argument is a JSON value whose
  octets are its serialization: `policy` and `input` (`evaluate`), `json` (`canonicalize`),
  `unsigned` (`sign-receipt`), `publicKeys` (`verify-receipt`). An argument whose octets matter
  as written is base64url without padding, in canonical form: `jsonBytes` (`canonicalize`,
  instead of `json`), `secretKey` (`sign-receipt`), `signed` (`verify-receipt`). `canonicalize`
  takes exactly one of `json` and `jsonBytes`;
- `expected` is `{ "ok": <JSON value> }` or `{ "error": { "code": <code> } }`, the code one of
  its operation's codes (never `internal.error`). The expected success octets are the JCS form
  of `ok`. A conformance harness MUST compute that form with a canonicalizer other than the
  implementation under test (for `canonicalize` cases above all, where using the implementation
  would compare it with itself); its output MUST equal those octets exactly;
- `rationale` (1 to 2048 characters) cites the clause the expected value is derived from. Every
  expected value is derived by hand from the semantics; none is the recorded output of an
  implementation.

Every number of the document is a safe integer, so that a harness can serialize a JSON
argument and canonicalize `ok` without loss. A case whose octets cannot be stored that way (an
argument above 1 MiB, a JSON value deeper than the document allows) is not a golden case: the
implementing repository tests it at run time.

### Continuation files

Every file of `contracts/fixtures/signalement-policy-receipt-v1/` MUST hold at most 65,536
Unicode code points (the consumer that vendors these fixtures refuses larger files as
unscannable), and at most 8 MiB. The entry file `golden-vectors.v1.json` carries `parts`, a
non-empty list of distinct bare file names in the same directory, each beginning with
`golden-vectors.v1` and ending with `.json`, none equal to the entry; it declares
`golden-vectors.v1.part-2.json` then `golden-vectors.v1.part-3.json`. Each part is an object
with exactly two members: the entry's `schemaVersion` and a `cases` array. The golden document
is the entry without `parts`, each part's `cases` appended in declaration order. Each of the
following is an error that refuses the whole document: a declared part that is absent or
unreadable; a file `golden-vectors.v1*.json` that the entry does not declare (orphan); a part
whose `schemaVersion` differs from the entry's or that declares `parts`; a part with any other
member, or without `cases`, or whose `cases` is not an array (so a part never adds metadata,
such as a second `contractFiles`, to the document). This is the reading rule of the
signalement v1 vector files (routing-policy semantics, "Vector files"), with the entry named
`golden-vectors.v1.json` and the members of a part restricted as above.

The authority checks the merged document twice: `tools/quality/check-contracts.ts` validates it
against the shared envelope `engine-golden-vectors.v1` (so every case of every part meets the
same `$defs/vectorList` bounds as in one file), and the verifier below checks its contract.
`check-contracts.ts` first inspects each file on its own for the shared size, depth and
public-content bounds, so a finding names the file it is in; on the merged document only the
aggregate bounds (number of cases, number of nodes) remain, and a finding there names the entry
followed by the parts it was merged with.

### Verifier failure codes

`policyReceiptGoldenFailures(directory)` reads the directory: a file `golden-vectors.v1*.json`
above 8 MiB is `golden.size_limit:<file>`, a reading error of the continuation rule is
`golden.parts:<description>` (file names only), and a declared part with other members than
`schemaVersion` and a `cases` array is `golden.part_members:<file>`; otherwise it returns
`rawPolicyReceiptFailures` of the merged document. `rawPolicyReceiptFailures(bytes)` reads one
merged golden document; it does not import the `engine-golden-vectors.v1` schema. Codes, in
this order:

1. `golden.size_limit` — more than 8 MiB; alone, nothing is decoded.
2. `golden.raw_json` — not strict JSON (depth at most 64); alone.
3. `golden.envelope` — a member, case, argument or expected value outside the form above (a
   `parts` member included: the function reads a merged document); alone.
4. `golden.contract_file:<path>` — for each contract file in document order whose SHA-256,
   recomputed from the file at `<path>` resolved against the authority root of the verifier's
   own location (so the check holds under a vendored copy), differs or that cannot be read.
5. `golden.case_duplicate:<id>` — for each id carried by more than one case, once.
6. `golden.case_missing:<id>` — for each id of `REQUIRED_GOLDEN_CASES` absent, in that list's
   order.
7. `golden.policy_invalid:<id>` — an `evaluate` case whose policy the routing-policy verifier
   refuses (its JCS octets) while the case expects neither `policy.invalid` nor
   `input.too_large`, or accepts while the case expects `policy.invalid`.
8. `golden.verdict_shape:<id>` — an `evaluate` success whose `ok` does not have exactly the
   members of `PolicyVerdict`, each destination exactly those of a verdict destination, each
   file exactly `path`, `decision`, `reason`.
9. `golden.verdict_digest:<id>` — an `evaluate` success of an accepted policy, with the shape
   of code 8, whose `policyDigest` is not the SHA-256 of the policy's JCS form or whose
   `policyVersion` is not its `version` (a policy edited without its verdict).
10. `golden.receipt_invalid:<id>` — a `sign-receipt` success whose `ok`, in JCS form, the
    projection-receipt verifier refuses.

Codes 4 to 10 each pass over the whole document and accumulate. The only document data a code
carries is a contract file path or a case id, both constrained by the envelope.

### Required cases

`REQUIRED_GOLDEN_CASES` lists the ids every golden document MUST carry: every case of the
committed document, so that none can be dropped without a named failure.

- `evaluate`, successes: `exact-origin`, `file-order-irrelevant`, `host-pattern-subdomain`,
  `host-pattern-apex`, `host-pattern-port`, `absent-origin-rule`, `absent-origin-no-rule`,
  `no-rule-matched`, `denied-dominates`, `override-most-restrictive`,
  `selectable-listed-when-allowed`, `selectable-excludes-routed`, `default-withhold`,
  `withhold-dominates-transmit`, `visibility-unknown`, `gitlab-internal-is-public`,
  `residency-withhold`, `attachment-upload-ignored`, `denied-in-unmatched-rule-not-counted`,
  `selectable-visibility-unknown`, `declared-ignores-discovered`,
  `reason-precedence-independent-of-order`; errors: `origin-with-path`, `origin-default-port`,
  `input-duplicate-path`, `policy-unknown-destination`, `policy-non-canonical-origin`.
- `canonicalize`, successes: `canonicalize-sort-ascii`, `canonicalize-nested`,
  `canonicalize-non-ascii-literal`, `canonicalize-control-escape`,
  `canonicalize-utf16-key-order`, `canonicalize-safe-integer`, `canonicalize-integral-forms`;
  errors: `canonicalize-float`, `canonicalize-two-pow-53`, `canonicalize-non-finite`,
  `canonicalize-duplicate-member`, `canonicalize-byte-order-mark`,
  `canonicalize-lone-surrogate`, `canonicalize-depth-65`.
- `sign-receipt`, successes: `sign-valid-active`, `sign-valid-retired`; errors:
  `sign-with-signature-member`, `sign-short-seed`.
- `verify-receipt`, successes: `verify-valid`, `verify-unknown-key`, `verify-mismatch`,
  `verify-unreadable`, `verify-other-organization`; error: `verify-keys-invalid`.

`file-order-irrelevant` carries the policy and attributes of `exact-origin` with its files
permuted, and expects the same verdict.

`sign-valid-active` and `sign-valid-retired` expect, octet for octet, the `signed` octets of the
sign cases with the same names in the receipt signature corpus: same seeds, same unsigned
receipts, and Ed25519 signing is deterministic. The `verify-receipt` cases take their `signed`
octets and key sets from the corpus vectors named in their rationale.

## Test material

Every value is synthetic: the policies use the organization `example-org`, reserved example
names (`example.com`, `example.org`, `example.atlassian.net`) and digests made of one repeated
hexadecimal digit; the receipts, seeds and key sets are those of the receipt signature corpus,
derived from public labels. No case contains a credential, a token or personal data. The seeds
are test material: they MUST NOT sign anything outside tests.
