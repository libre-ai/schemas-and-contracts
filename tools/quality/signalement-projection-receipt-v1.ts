// Authority-fixture verifier only; no browser, privacy or implementation admission.
// It admits or refuses the structure of a signed projection receipt and of a signing key set,
// builds the signing message, and verifies a signature strictly against a key set.
import { createHash } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519.js";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { canonicalJson } from "./authorized-execution";
import { parseStrictJson } from "./policy-core-raw-inputs";

/** Ceiling of one signed receipt document, in octets. */
export const PROJECTION_RECEIPT_MAX_BYTES = 65536;
/** Ceiling of one signing key set document, in octets. */
export const SIGNING_KEY_SET_MAX_BYTES = 262144;
/** Domain separation string of the signing message (plan DL5). */
export const RECEIPT_SIGNATURE_DOMAIN = "libre-ai.signalement-projection-receipt.v1";

type Via = "body" | "attachment" | "link";

interface ProjectionReceipt {
  issuedAt: string;
  deliveredAt: string;
  transmitted: { path: string; via: Via }[];
  withheld: { path: string }[];
  rendered: { mediaLinks: { path: string }[] };
}

interface SigningKey {
  keyId: string;
  publicKey: string;
  status: "active" | "retired";
  notBefore: string;
  notAfter: string | null;
}

interface SigningKeySet {
  organization: string;
  keys: SigningKey[];
}

interface SignedProjectionReceipt extends ProjectionReceipt {
  organization: string;
  keyId: string;
  signature: { algorithm: "ed25519"; value: string };
}

const RECEIPT_SCHEMA_URL = new URL(
  "../../contracts/schemas/signalement-projection-receipt.v1.schema.json",
  import.meta.url,
);
const receiptSchema = (await Bun.file(RECEIPT_SCHEMA_URL).json()) as { $id: string };
const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
const validateReceipt = ajv.compile<ProjectionReceipt>(receiptSchema);
// The key set has no schema file of its own: it is `$defs/signingKeySet` of the receipt schema.
const validateKeySet = ajv.compile<SigningKeySet>({
  $ref: `${receiptSchema.$id}#/$defs/signingKeySet`,
});

const encoder = new TextEncoder();

/**
 * The authority canonicalizer writes only safe integers: every JSON number, read as an
 * IEEE-754 binary64 value (round half to even), must be integral with a magnitude of at most
 * 2^53 - 1 (-0 included). A document holding any other number cannot satisfy the schema (its
 * only number is the integer `revision`), so it is left to the schema check instead of being
 * called non-canonical.
 */
function canonicalTextOrNull(value: unknown): string | null {
  try {
    return canonicalJson(value);
  } catch {
    return null;
  }
}

function sameOctets(bytes: Uint8Array, text: string): boolean {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).equals(Buffer.from(text));
}

function hasRepeat(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

/** Each of the three path lists is a set; a path may not appear twice in the same list. */
function hasDuplicatePath(receipt: ProjectionReceipt): boolean {
  return (
    hasRepeat(receipt.transmitted.map((file) => file.path)) ||
    hasRepeat(receipt.withheld.map((file) => file.path)) ||
    hasRepeat(receipt.rendered.mediaLinks.map((link) => link.path))
  );
}

function hasFileOverlap(receipt: ProjectionReceipt): boolean {
  const transmitted = new Set(receipt.transmitted.map((file) => file.path));
  return receipt.withheld.some((file) => transmitted.has(file.path));
}

/** A media link may only name a file transmitted `via: "link"`. */
function hasUntransmittedMediaLink(receipt: ProjectionReceipt): boolean {
  const linked = new Set(
    receipt.transmitted.filter((file) => file.via === "link").map((file) => file.path),
  );
  return receipt.rendered.mediaLinks.some((link) => !linked.has(link.path));
}

/** A file transmitted `via: "link"` without its media link could not be recomputed offline. */
function hasLinkedFileWithoutMediaLink(receipt: ProjectionReceipt): boolean {
  const linkPaths = new Set(receipt.rendered.mediaLinks.map((link) => link.path));
  return receipt.transmitted.some((file) => file.via === "link" && !linkPaths.has(file.path));
}

/**
 * Failure codes carry no receipt data. The size is checked on octets before any parsing, so an
 * oversized input is never decoded. Exactly one code is returned, the first in the documented
 * order. Timestamps have one fixed-width form, so lexical order is chronological order.
 */
export function rawProjectionReceiptFailures(bytes: Uint8Array): string[] {
  if (bytes.byteLength > PROJECTION_RECEIPT_MAX_BYTES) return ["receipt.size_limit"];
  let parsed: unknown;
  try {
    parsed = parseStrictJson(bytes, 8);
  } catch {
    return ["receipt.raw_json"];
  }
  const canonical = canonicalTextOrNull(parsed);
  if (canonical !== null && !sameOctets(bytes, canonical)) return ["receipt.non_canonical"];
  if (!validateReceipt(parsed)) return ["receipt.schema"];
  if (hasDuplicatePath(parsed)) return ["receipt.duplicate_path"];
  if (hasFileOverlap(parsed)) return ["receipt.file_overlap"];
  if (hasUntransmittedMediaLink(parsed)) return ["receipt.media_link_untransmitted"];
  if (hasLinkedFileWithoutMediaLink(parsed)) return ["receipt.media_link_missing"];
  if (parsed.deliveredAt > parsed.issuedAt) return ["receipt.timestamp_order"];
  return [];
}

/** 43 base64url characters carry 258 bits for 32 octets; the 2 unused bits must be zero. */
function isCanonicalPublicKey(publicKey: string): boolean {
  return Buffer.from(publicKey, "base64url").toString("base64url") === publicKey;
}

/**
 * Same discipline as the receipt: octet cap first, one code, the first in the documented order.
 * A key set is not signed, so it need not be in JCS form. Whether a public key is an admissible
 * curve point is decided by signature verification, not here.
 */
export function rawSigningKeySetFailures(bytes: Uint8Array): string[] {
  if (bytes.byteLength > SIGNING_KEY_SET_MAX_BYTES) return ["keys.size_limit"];
  let parsed: unknown;
  try {
    parsed = parseStrictJson(bytes, 8);
  } catch {
    return ["keys.raw_json"];
  }
  if (!validateKeySet(parsed)) return ["keys.schema"];
  const { keys } = parsed;
  if (hasRepeat(keys.map((key) => key.keyId))) return ["keys.duplicate_key_id"];
  if (keys.some((key) => key.status === "retired" && key.notAfter === null))
    return ["keys.retired_without_end"];
  if (keys.some((key) => key.notAfter !== null && key.notAfter <= key.notBefore))
    return ["keys.window_order"];
  if (keys.some((key) => !isCanonicalPublicKey(key.publicKey))) return ["keys.encoding"];
  return [];
}

/**
 * The octets signed by Ed25519: the UTF-8 domain, one zero octet, then the 32 raw octets of
 * SHA-256 over the JCS form of the receipt without its `signature` member. An object that still
 * carries `signature` is refused with a TypeError: hashing it would yield a message that no
 * verifier rebuilds, so the mistake would surface only as a signature that never verifies.
 */
export function receiptSigningMessage(unsigned: unknown): Uint8Array {
  if (typeof unsigned === "object" && unsigned !== null && Object.hasOwn(unsigned, "signature"))
    throw new TypeError("receiptSigningMessage takes the unsigned receipt, without signature");
  const domain = encoder.encode(RECEIPT_SIGNATURE_DOMAIN);
  const digest = createHash("sha256").update(canonicalJson(unsigned)).digest();
  const message = new Uint8Array(domain.byteLength + 1 + digest.byteLength);
  message.set(domain, 0);
  message[domain.byteLength] = 0;
  message.set(digest, domain.byteLength + 1);
  return message;
}

export type ReceiptSignatureOutcome =
  | {
      kind: "verdict";
      signature: "valid" | "invalid" | "unknown-key" | "unreadable";
      keyId: string | null;
      keyStatus: "active" | "retired" | null;
      reason: string | null;
    }
  | { kind: "refused"; code: string };

/**
 * Admissible Ed25519 point: canonical encoding (y < p, no negative zero, re-encodes to the same
 * octets), not the identity, and in the prime-order subgroup. Same rule as `isBuildBriefPoint`
 * of build-brief-v2, duplicated so that the vendored verifier does not import that file.
 */
function isAdmissiblePoint(bytes: Uint8Array): boolean {
  try {
    const point = ed25519.Point.fromBytes(bytes, false);
    return !point.is0() && point.isTorsionFree() && sameBytes(point.toBytes(), bytes);
  } catch {
    return false;
  }
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return Buffer.from(left).equals(Buffer.from(right));
}

function littleEndian(bytes: Uint8Array): bigint {
  return BigInt(`0x${Buffer.from(bytes).reverse().toString("hex")}`);
}

function verdict(
  signature: "valid" | "invalid" | "unknown-key" | "unreadable",
  keyId: string | null,
  keyStatus: "active" | "retired" | null,
  reason: string | null,
): ReceiptSignatureOutcome {
  return { kind: "verdict", signature, keyId, keyStatus, reason };
}

/**
 * Strict verification of a signed receipt against an organization's key set, in the normative
 * order of SEMANTICS "Signature verification". Every step before the last is a check that a
 * cofactored Ed25519 verifier does not make: noble's strict mode rejects a small-order key but
 * accepts a mixed-order key and a small-order R (measured by the corpus tests), so admissibility
 * of A and R is decided here, before the equation. Reasons carry no document data.
 */
export function verifyProjectionReceiptSignature(
  signed: Uint8Array,
  publicKeys: Uint8Array,
): ReceiptSignatureOutcome {
  // 1. The receipt must be readable: structure, then the canonical encoding of its signature.
  const [receiptFailure] = rawProjectionReceiptFailures(signed);
  if (receiptFailure !== undefined) return verdict("unreadable", null, null, receiptFailure);
  const receipt = parseStrictJson(signed, 8) as SignedProjectionReceipt;
  const signature = new Uint8Array(Buffer.from(receipt.signature.value, "base64url"));
  if (Buffer.from(signature).toString("base64url") !== receipt.signature.value)
    return verdict("unreadable", null, null, "signature.encoding");
  // 2. An unreadable key set verifies nothing: refused, no verdict.
  const [keySetFailure] = rawSigningKeySetFailures(publicKeys);
  if (keySetFailure !== undefined) return { kind: "refused", code: keySetFailure };
  const keySet = parseStrictJson(publicKeys, 8) as SigningKeySet;
  const { keyId } = receipt;
  // 3. A key set of another organization verifies nothing, whatever keys it holds.
  if (receipt.organization !== keySet.organization)
    return verdict("invalid", keyId, null, "key.organization_mismatch");
  const key = keySet.keys.find((candidate) => candidate.keyId === keyId);
  if (key === undefined) return verdict("unknown-key", keyId, null, "key.unknown");
  // 4. Window [notBefore, notAfter): timestamps have one fixed width, lexical is chronological.
  if (
    receipt.issuedAt < key.notBefore ||
    (key.notAfter !== null && receipt.issuedAt >= key.notAfter)
  )
    return verdict("invalid", keyId, key.status, "key.outside_validity");
  // 5. and 6. Admissible A, then admissible R.
  const publicKey = new Uint8Array(Buffer.from(key.publicKey, "base64url"));
  if (!isAdmissiblePoint(publicKey))
    return verdict("invalid", keyId, key.status, "key.not_admissible");
  if (!isAdmissiblePoint(signature.subarray(0, 32)))
    return verdict("invalid", keyId, key.status, "signature.r_not_admissible");
  // 7. S < L: S + L verifies the same equation, and a second encoding is malleability.
  if (littleEndian(signature.subarray(32)) >= ed25519.Point.Fn.ORDER)
    return verdict("invalid", keyId, key.status, "signature.s_non_canonical");
  // 8. The equation over the signing message of the unsigned receipt.
  const { signature: _signature, ...unsigned } = receipt;
  const message = receiptSigningMessage(unsigned);
  if (!ed25519.verify(signature, message, publicKey, { zip215: false }))
    return verdict("invalid", keyId, key.status, "signature.mismatch");
  return verdict("valid", keyId, key.status, null);
}
