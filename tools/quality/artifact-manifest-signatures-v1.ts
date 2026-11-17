// Authority-fixture verifier only, not a product SDK or an implementation admission.
// It admits or refuses a signing-keys.v1 registry and verifies an
// artifact-manifest-signatures.v1 record against one, following the K and S rules of
// contracts/artifact-manifest-signatures-v1/SEMANTICS.md. Every input arrives as received
// octets (K0, S0), never as an object someone else parsed. It builds the signed message with
// its own RFC 8785 serializer (`rfc8785` below); the vector generator uses the repository's
// `canonicalJson`, so a serialization mistake in either one shows as a message mismatch.
import { createHash } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519.js";
import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { parseStrictJson } from "./policy-core-raw-inputs";

export const ARTIFACT_MANIFEST_SCHEMA_VERSION = "libre-ai.artifact-manifest.v1";
/** DER prefix of an Ed25519 SubjectPublicKeyInfo (OID 1.3.101.112), 12 octets. */
export const ED25519_SPKI_PREFIX_HEX = "302a300506032b6570032100";
/** K3: the identifier is this prefix followed by the hex SHA-256 of the raw key. */
export const SIGNING_KEY_ID_PREFIX = "ed25519-";

export type RegistryRefusal = "key-set-invalid";
export type SignatureRefusal =
  | "manifest-schema-invalid"
  | "signature-required"
  | "signature-malformed"
  | "signature-key-unknown"
  | "signature-key-not-active"
  | "signature-key-not-authorized"
  | "signature-invalid";

export type RegistryOutcome =
  | { outcome: "admitted" }
  | { outcome: "refused"; refusal: RegistryRefusal; reason: string };

export type SignatureOutcome =
  | { outcome: "accepted"; verifiedKeyIds: string[]; ignoredUnknownKeyIds: number }
  | { outcome: "refused"; refusal: SignatureRefusal; reason: string };

type ArtifactType = "build" | "dataset" | "export" | "release" | "evidence";

interface RegistryKey {
  signingKeyId: string;
  publicKey: string;
  artifactTypes: ArtifactType[];
  activatedAt: string;
  revokedAt: string | null;
  revocationWitness?: { discoveredAt: string };
}

interface Registry {
  keys: RegistryKey[];
}

interface SignatureEntry {
  signingKeyId: string;
  signature: string;
}

interface SignatureRecord {
  signatures: SignatureEntry[];
}

interface Manifest {
  schemaVersion: string;
  artifactType: ArtifactType;
}

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
for (const name of [
  "common.v1",
  "artifact-manifest.v1",
  "artifact-manifest-signatures.v1",
  "signing-keys.v1",
]) {
  ajv.addSchema(
    await Bun.file(new URL(`../../contracts/schemas/${name}.schema.json`, import.meta.url)).json(),
  );
}

function validator<T>(name: string): ValidateFunction<T> {
  return ajv.compile<T>({ $ref: `https://contracts.libre-ai.fr/schemas/${name}.schema.json` });
}

const validateManifest = validator<Manifest>("artifact-manifest.v1");
const validateRecord = validator<SignatureRecord>("artifact-manifest-signatures.v1");
const validateRegistry = validator<Registry>("signing-keys.v1");

const FIXED_INSTANT = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-5][0-9]\.[0-9]{3}Z$/;

/**
 * An instant of the one fixed form, naming a real calendar instant. The round trip through
 * Date refuses what the pattern lets through: 24:00:00 and 2024-02-30 both roll over to
 * another day, so their re-encoding differs.
 */
export function isFixedInstant(text: string): boolean {
  if (!FIXED_INSTANT.test(text)) return false;
  const time = Date.parse(text);
  return !Number.isNaN(time) && new Date(time).toISOString() === text;
}

/** Strict profile: canonical encoding, on the curve, not the identity, prime-order subgroup. */
export function isAdmissiblePoint(bytes: Uint8Array): boolean {
  if (bytes.byteLength !== 32) return false;
  try {
    const point = ed25519.Point.fromBytes(bytes, false);
    return !point.is0() && point.isTorsionFree() && Buffer.from(point.toBytes()).equals(bytes);
  } catch {
    return false;
  }
}

/** The 32 raw key octets of a PEM already admitted by the schema pattern. */
export function rawPublicKey(pem: string): Uint8Array {
  const body = pem.split("\n")[1] ?? "";
  const der = Buffer.from(body, "base64");
  if (der.byteLength !== 44 || der.subarray(0, 12).toString("hex") !== ED25519_SPKI_PREFIX_HEX)
    throw new TypeError("not an Ed25519 SPKI PEM");
  return new Uint8Array(der.subarray(12));
}

/** K3: `ed25519-` || lowercase hex SHA-256 of the 32 raw key octets. */
export function signingKeyIdOf(raw: Uint8Array): string {
  return `${SIGNING_KEY_ID_PREFIX}${createHash("sha256").update(raw).digest("hex")}`;
}

/** K0 and S0: strict JSON (RFC 8259), UTF-8 without BOM, no duplicate member, I-JSON strings. */
function parseReceived(octets: Uint8Array): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: parseStrictJson(octets) };
  } catch {
    return { ok: false };
  }
}

/**
 * K6 presence is the schema's `else` branch of a revoked key. A shape failure whose every error
 * comes from that branch is reported as K6, any other one as K1.
 */
function isOnlyRevocationEvidenceMissing(errors: ErrorObject[] | null | undefined): boolean {
  if (errors === null || errors === undefined || errors.length === 0) return false;
  const keyEntry = /^\/keys\/[0-9]+$/;
  return errors.every(
    (error) =>
      keyEntry.test(error.instancePath) &&
      ((error.keyword === "required" &&
        error.schemaPath === "#/else/required" &&
        ["revocationReason", "revocationWitness"].includes(String(error.params.missingProperty))) ||
        (error.keyword === "if" && error.params.failingKeyword === "else")),
  );
}

/** K0 to K6, in that order; one reason, carrying no key octets. */
export function admitSigningKeys(octets: Uint8Array): RegistryOutcome {
  const refuse = (reason: string): RegistryOutcome => ({
    outcome: "refused",
    refusal: "key-set-invalid",
    reason,
  });
  const parsed = parseReceived(octets);
  if (!parsed.ok) return refuse("K0 registry octets are not strict JSON");
  const document = parsed.value;
  if (!validateRegistry(document))
    return isOnlyRevocationEvidenceMissing(validateRegistry.errors)
      ? refuse("K6 revocation evidence missing")
      : refuse("K1 shape");
  const keys = document.keys;
  if (keys.some((key) => !isAdmissiblePoint(rawPublicKey(key.publicKey))))
    return refuse("K2 public key not admissible");
  if (keys.some((key) => signingKeyIdOf(rawPublicKey(key.publicKey)) !== key.signingKeyId))
    return refuse("K3 identifier not derived from the key");
  if (new Set(keys.map((key) => key.signingKeyId)).size !== keys.length)
    return refuse("K4 identifier repeated");
  if (keys.some((key) => key.revokedAt !== null && key.revokedAt <= key.activatedAt))
    return refuse("K5 revokedAt not after activatedAt");
  if (
    keys.some(
      (key) =>
        key.revokedAt !== null &&
        key.revocationWitness !== undefined &&
        key.revokedAt > key.revocationWitness.discoveredAt,
    )
  )
    return refuse("K6 revokedAt after discoveredAt");
  return { outcome: "admitted" };
}

/** RFC 8785 section 3.2.2.2: only these characters are escaped, controls as lowercase \u00xx. */
function rfc8785String(text: string): string {
  let out = '"';
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    if (unit === 0x22) out += '\\"';
    else if (unit === 0x5c) out += "\\\\";
    else if (unit === 0x08) out += "\\b";
    else if (unit === 0x09) out += "\\t";
    else if (unit === 0x0a) out += "\\n";
    else if (unit === 0x0c) out += "\\f";
    else if (unit === 0x0d) out += "\\r";
    else if (unit < 0x20) out += `\\u00${unit.toString(16).padStart(2, "0")}`;
    else out += text.charAt(index);
  }
  return `${out}"`;
}

/** RFC 8785 section 3.2.3: member names sorted by their UTF-16 code units. */
function compareCodeUnits(left: string, right: string): number {
  const shared = Math.min(left.length, right.length);
  for (let index = 0; index < shared; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

/**
 * RFC 8785 serialization over the safe-integer profile of this repository: the values reaching
 * it went through S0 and S3, so strings are well-formed and numbers are schema integers.
 */
export function rfc8785(value: unknown): string {
  if (value === null) return "null";
  if (value === true) return "true";
  if (value === false) return "false";
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value))
      throw new TypeError("number outside the safe-integer profile");
    return Object.is(value, -0) ? "0" : String(value);
  }
  if (typeof value === "string") return rfc8785String(value);
  if (Array.isArray(value)) return `[${value.map((element) => rfc8785(element)).join(",")}]`;
  if (typeof value === "object") {
    const members = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      compareCodeUnits(left, right),
    );
    return `{${members.map(([name, member]) => `${rfc8785String(name)}:${rfc8785(member)}`).join(",")}}`;
  }
  throw new TypeError("value outside the JSON data model");
}

/** S4: UTF8(schemaVersion) || 0x00 || raw SHA-256 of the RFC 8785 form of the manifest. */
export function manifestSigningMessage(manifest: { schemaVersion: string }): Uint8Array {
  const domain = Buffer.from(manifest.schemaVersion, "utf8");
  const digest = createHash("sha256")
    .update(Buffer.from(rfc8785(manifest), "utf8"))
    .digest();
  return new Uint8Array(Buffer.concat([domain, Uint8Array.of(0), digest]));
}

function littleEndian(bytes: Uint8Array): bigint {
  return BigInt(`0x${Buffer.from(bytes).reverse().toString("hex") || "0"}`);
}

/** S8 for one signature: admissible A and R, S < L, then noble's cofactored verification. */
function verifiesStrictly(signature: Uint8Array, message: Uint8Array, key: Uint8Array): boolean {
  if (signature.byteLength !== 64) return false;
  if (!isAdmissiblePoint(key) || !isAdmissiblePoint(signature.subarray(0, 32))) return false;
  if (littleEndian(signature.subarray(32)) >= ed25519.Point.Fn.ORDER) return false;
  try {
    return ed25519.verify(signature, message, key, { zip215: false });
  } catch {
    return false;
  }
}

/**
 * S0 to S10 against an admitted registry. A registry that is not admitted verifies nothing.
 * Precedence follows S10; every check over the registry-key signatures runs on all of them
 * before the next check starts. `now` is the caller's trusted verification time (S6).
 */
export function verifyManifestSignatures(
  manifestOctets: Uint8Array,
  recordOctets: Uint8Array,
  registryOctets: Uint8Array,
  now: string,
): SignatureOutcome {
  const refuse = (refusal: SignatureRefusal, reason: string): SignatureOutcome => ({
    outcome: "refused",
    refusal,
    reason,
  });
  const admission = admitSigningKeys(registryOctets);
  if (admission.outcome === "refused") throw new TypeError("registry is not admitted");
  const keys = (parseStrictJson(registryOctets) as Registry).keys;

  const manifestParsed = parseReceived(manifestOctets);
  if (!manifestParsed.ok) return refuse("manifest-schema-invalid", "S0 manifest octets");
  const manifest = manifestParsed.value;
  if (!validateManifest(manifest)) return refuse("manifest-schema-invalid", "S3");
  const recordParsed = parseReceived(recordOctets);
  if (!recordParsed.ok) return refuse("signature-malformed", "S0 record octets");
  const record = recordParsed.value;
  if (!validateRecord(record)) {
    const signatures: unknown =
      typeof record === "object" && record !== null && "signatures" in record
        ? record.signatures
        : undefined;
    return Array.isArray(signatures) && signatures.length === 0
      ? refuse("signature-required", "S1 empty")
      : refuse("signature-malformed", "S1 shape");
  }
  const signatures = record.signatures;
  if (new Set(signatures.map((entry) => entry.signingKeyId)).size !== signatures.length)
    return refuse("signature-malformed", "S2 identifier repeated");

  const byId = new Map(keys.map((key) => [key.signingKeyId, key]));
  const known = signatures.flatMap((entry) => {
    const key = byId.get(entry.signingKeyId);
    return key === undefined ? [] : [{ entry, key }];
  });
  if (known.length === 0) return refuse("signature-key-unknown", "S5");

  const instantIsValid = isFixedInstant(now);
  if (
    known.some(
      ({ key }) =>
        !instantIsValid ||
        now < key.activatedAt ||
        (key.revokedAt !== null && now >= key.revokedAt),
    )
  )
    return refuse("signature-key-not-active", "S6");
  if (known.some(({ key }) => !key.artifactTypes.includes(manifest.artifactType)))
    return refuse("signature-key-not-authorized", "S7");

  const message = manifestSigningMessage(manifest);
  for (const { entry, key } of known) {
    const signature = new Uint8Array(Buffer.from(entry.signature, "base64url"));
    if (!verifiesStrictly(signature, message, rawPublicKey(key.publicKey)))
      return refuse("signature-invalid", "S8");
  }
  return {
    outcome: "accepted",
    verifiedKeyIds: known.map(({ entry }) => entry.signingKeyId).sort(),
    ignoredUnknownKeyIds: signatures.length - known.length,
  };
}
