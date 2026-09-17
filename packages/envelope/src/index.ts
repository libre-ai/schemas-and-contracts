import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Loop-security kernel K3 — integrity-signed untrusted-content envelope.
 *
 * External content (web, email, memory recall, tool output, MCP tool
 * descriptions) is data, never instructions. This brick wraps it so a
 * model-facing surface can only present it as guarded, trusted:false data,
 * and so a stripped or altered envelope is detectable offline:
 *
 * - `wrapUntrusted` tags the content trusted:false with its source and signs a
 *   canonical serialization with HMAC-SHA256 (symmetric — no key ceremony,
 *   consistent with the deferred Ed25519 signing of WP-G2-Z01);
 * - `verifyEnvelope` recomputes the MAC in constant time and fails closed on
 *   any alteration (content, flag, source, label, timestamp) or wrong key;
 * - `renderGuarded` verifies first, then escapes the guard delimiters so the
 *   payload cannot forge the closing marker, and wraps it for the model.
 *
 * The canonical serialization is length-prefixed per field, so field
 * boundaries cannot be shifted by content — closing the canonicalization
 * ambiguity that would otherwise let two different envelopes share a MAC.
 */

export const ENVELOPE_SCHEMA_VERSION = "libre-ai.envelope.v1" as const;

const UNTRUSTED_SOURCES = [
  "web",
  "email",
  "memory",
  "tool-output",
  "tool-description",
  "mcp-description",
] as const;
export type UntrustedSource = (typeof UNTRUSTED_SOURCES)[number];

const GUARD_OPEN_PREFIX = "⟦LAI-UNTRUSTED";
const GUARD_OPEN_SUFFIX = "⟧";
const GUARD_CLOSE = "⟦/LAI-UNTRUSTED⟧";

export interface EnvelopeKey {
  readonly id: string;
  /**
   * HMAC key. Recommended ≥ 32 bytes (NIST SP 800-107); a K3 ephemeral/session
   * key of ≥ 16 bytes is accepted but weaker (crypto review C-03). The key is
   * shared between the producer and the verifier — HMAC proves integrity, not
   * origin authentication; the asymmetric Ed25519 upgrade is deferred
   * (WP-G2-Z01, crypto review C-01/C-04).
   */
  readonly secret: Uint8Array;
}

export interface UntrustedInput {
  readonly source: string;
  readonly label?: string;
  readonly content: string;
  readonly capturedAt: string;
}

export interface EnvelopeIntegrity {
  readonly alg: "HMAC-SHA256";
  readonly keyId: string;
  readonly mac: string;
}

export interface UntrustedEnvelope {
  readonly schemaVersion: typeof ENVELOPE_SCHEMA_VERSION;
  readonly trusted: false;
  readonly source: UntrustedSource;
  readonly label?: string;
  readonly content: string;
  readonly capturedAt: string;
  readonly integrity: EnvelopeIntegrity;
}

export class UntrustedSourceError extends Error {
  constructor(source: string) {
    super(`unknown untrusted source class ${JSON.stringify(source)}`);
    this.name = "UntrustedSourceError";
  }
}

export class EnvelopeIntegrityError extends Error {
  constructor() {
    // No detail: never disclose which field failed or echo content.
    super("envelope integrity verification failed");
    this.name = "EnvelopeIntegrityError";
  }
}

const encoder = new TextEncoder();

function isUntrustedSource(value: string): value is UntrustedSource {
  return (UNTRUSTED_SOURCES as readonly string[]).includes(value);
}

/**
 * Length-prefixed canonical serialization over the signed fields, in a fixed
 * order. Each field contributes its UTF-8 byte length, a separator and its
 * bytes, so no field's content can be read as another field's boundary.
 */
function canonicalBytes(fields: readonly string[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const field of fields) {
    const bytes = encoder.encode(field);
    parts.push(encoder.encode(`${bytes.length}:`));
    parts.push(bytes);
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function computeMac(
  key: EnvelopeKey,
  source: string,
  label: string | undefined,
  content: string,
  capturedAt: string,
): string {
  // A label-presence marker keeps `undefined` (no label) distinct from an
  // empty-string label in the signed bytes, so the two never share a MAC
  // (architecture review A-04).
  const canonical = canonicalBytes([
    ENVELOPE_SCHEMA_VERSION,
    "false",
    source,
    label === undefined ? "0" : "1",
    label ?? "",
    content,
    capturedAt,
  ]);
  return createHmac("sha256", key.secret).update(canonical).digest("base64url");
}

export function wrapUntrusted(input: UntrustedInput, key: EnvelopeKey): UntrustedEnvelope {
  if (!isUntrustedSource(input.source)) {
    throw new UntrustedSourceError(input.source);
  }
  const mac = computeMac(key, input.source, input.label, input.content, input.capturedAt);
  const envelope: UntrustedEnvelope = {
    schemaVersion: ENVELOPE_SCHEMA_VERSION,
    trusted: false,
    source: input.source,
    content: input.content,
    capturedAt: input.capturedAt,
    integrity: { alg: "HMAC-SHA256", keyId: key.id, mac },
    ...(input.label === undefined ? {} : { label: input.label }),
  };
  return envelope;
}

export interface VerifiedEnvelope {
  readonly source: UntrustedSource;
  readonly label?: string;
  readonly content: string;
  readonly capturedAt: string;
}

/**
 * Verify the envelope's integrity and return its fields. Fails closed on any
 * alteration or wrong key.
 *
 * The returned `content` is the RAW untrusted text — it is data, not safe to
 * concatenate into a model prompt directly. Use {@link renderGuarded} for the
 * model-facing path, which escapes the guard delimiters (architecture review
 * A-03). `envelope.integrity.keyId` is informational: the caller selects the
 * key, so keyId is not re-verified here (it becomes binding under the Ed25519
 * upgrade — crypto review C-01). The `mac` shape is assumed schema-validated
 * upstream (`envelope.v1.schema.json`); a malformed mac still fails closed
 * (crypto review C-02).
 */
export function verifyEnvelope(envelope: UntrustedEnvelope, key: EnvelopeKey): VerifiedEnvelope {
  // A forged trusted flag or schema version can never verify: the MAC is
  // computed over the constants, so any deviation changes the expected MAC.
  if (envelope.trusted !== false || envelope.schemaVersion !== ENVELOPE_SCHEMA_VERSION) {
    throw new EnvelopeIntegrityError();
  }
  // The source enum is what lets renderGuarded interpolate `source` into the
  // guard header unescaped. wrapUntrusted checks it at construction, but a
  // hand-MAC'd envelope reaches this function without passing through
  // wrapUntrusted: re-check it fail-closed on the verify path too (K4 review
  // of f49fc18 — a delimiter-bearing source rendered a broken guard header,
  // the exact class the label escaping closed).
  if (!isUntrustedSource(envelope.source)) {
    throw new EnvelopeIntegrityError();
  }
  const expected = computeMac(
    key,
    envelope.source,
    envelope.label,
    envelope.content,
    envelope.capturedAt,
  );
  const expectedBytes = Buffer.from(expected, "base64url");
  const actualBytes = Buffer.from(envelope.integrity.mac, "base64url");
  if (expectedBytes.length !== actualBytes.length || !timingSafeEqual(expectedBytes, actualBytes)) {
    throw new EnvelopeIntegrityError();
  }
  return {
    source: envelope.source,
    content: envelope.content,
    capturedAt: envelope.capturedAt,
    ...(envelope.label === undefined ? {} : { label: envelope.label }),
  };
}

/**
 * Escape the guard delimiter code points so the escaped content provably
 * contains no raw delimiter and therefore cannot forge the closing marker.
 * `%` is escaped first to keep the transform unambiguous. The escape sequence
 * (`%u27E6`/`%u27E7`) is a deliberate NON-standard, display-only marker: the
 * rendered guard block is never re-decoded, so an escaped payload cannot be
 * turned back into a raw delimiter downstream (architecture review A-05).
 */
function escapeDelimiters(content: string): string {
  return content.replaceAll("%", "%25").replaceAll("⟦", "%u27E6").replaceAll("⟧", "%u27E7");
}

/**
 * Verify integrity, then render the content as guarded, trusted:false data.
 * Never renders an unverified or tampered envelope.
 */
export function renderGuarded(envelope: UntrustedEnvelope, key: EnvelopeKey): string {
  const verified = verifyEnvelope(envelope, key);
  const escaped = escapeDelimiters(verified.content);
  // The label is caller-supplied and lands INSIDE the opening marker, so it must
  // be escaped like the content. JSON.stringify escapes quotes and control
  // characters but leaves U+27E6/U+27E7 untouched: a label carrying the closing
  // delimiter terminated the guard header early and rendered the remainder of
  // the label outside the guarded block, with a valid MAC. `source` needs no
  // escaping — it is a closed enum (UNTRUSTED_SOURCES), and verifyEnvelope
  // re-checks that enum on this path, so a hand-MAC'd out-of-enum source
  // fails closed before rendering.
  const labelPart =
    verified.label === undefined
      ? ""
      : ` label=${escapeDelimiters(JSON.stringify(verified.label))}`;
  const open = `${GUARD_OPEN_PREFIX} source=${verified.source} trusted=false${labelPart}${GUARD_OPEN_SUFFIX}`;
  return `${open}\n${escaped}\n${GUARD_CLOSE}`;
}
