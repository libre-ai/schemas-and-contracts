// Authority-fixture verifier only; no browser, privacy or implementation admission.
// It admits or refuses the structure of a signed projection receipt and of a signing key set,
// and builds the signing message. Signature verification and key admissibility are not here.
import { createHash } from "node:crypto";
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
  keys: SigningKey[];
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
 * The authority canonicalizer writes only safe integers. A document holding any other number
 * cannot satisfy the schema (its only number is the integer `revision`), so it is left to the
 * schema check instead of being called non-canonical.
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
 * SHA-256 over the JCS form of the receipt without its `signature` member.
 */
export function receiptSigningMessage(unsigned: unknown): Uint8Array {
  const domain = encoder.encode(RECEIPT_SIGNATURE_DOMAIN);
  const digest = createHash("sha256").update(canonicalJson(unsigned)).digest();
  const message = new Uint8Array(domain.byteLength + 1 + digest.byteLength);
  message.set(domain, 0);
  message[domain.byteLength] = 0;
  message.set(digest, domain.byteLength + 1);
  return message;
}
