// Authority-fixture verifier only, not a product SDK or an implementation admission.
// It admits or refuses a signing-keys.v1 registry and verifies an
// artifact-manifest-signatures.v1 record against one, following the K and S rules of
// contracts/artifact-manifest-signatures-v1/SEMANTICS.md. It builds the signed message
// itself; the vector generator builds it separately, so the two cannot share a mistake.
import { createHash } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519.js";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { canonicalJson } from "./authorized-execution";

export const ARTIFACT_MANIFEST_SCHEMA_VERSION = "libre-ai.artifact-manifest.v1";
/** DER prefix of an Ed25519 SubjectPublicKeyInfo (OID 1.3.101.112), 12 octets. */
export const ED25519_SPKI_PREFIX_HEX = "302a300506032b6570032100";

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

function sha256Hex(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** K1 to K5, in that order; one reason, carrying no key octets. */
export function admitSigningKeys(document: unknown): RegistryOutcome {
  const refuse = (reason: string): RegistryOutcome => ({
    outcome: "refused",
    refusal: "key-set-invalid",
    reason,
  });
  if (!validateRegistry(document)) return refuse("K1 shape");
  const keys = document.keys;
  if (keys.some((key) => !isAdmissiblePoint(rawPublicKey(key.publicKey))))
    return refuse("K2 public key not admissible");
  if (keys.some((key) => sha256Hex(rawPublicKey(key.publicKey)) !== key.signingKeyId))
    return refuse("K3 identifier not derived from the key");
  if (new Set(keys.map((key) => key.signingKeyId)).size !== keys.length)
    return refuse("K4 identifier repeated");
  if (keys.some((key) => key.revokedAt !== null && key.revokedAt <= key.activatedAt))
    return refuse("K5 revokedAt not after activatedAt");
  return { outcome: "admitted" };
}

/** S4: UTF8(schemaVersion) || 0x00 || raw SHA-256 of the RFC 8785 form of the manifest. */
export function manifestSigningMessage(manifest: { schemaVersion: string }): Uint8Array {
  const domain = Buffer.from(manifest.schemaVersion, "utf8");
  const digest = createHash("sha256").update(canonicalJson(manifest)).digest();
  return new Uint8Array(Buffer.concat([domain, Uint8Array.of(0), digest]));
}

function littleEndian(bytes: Uint8Array): bigint {
  return BigInt(`0x${Buffer.from(bytes).reverse().toString("hex") || "0"}`);
}

/** S8 for one signature: admissible A and R, S < L, then the cofactorless equation. */
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
 * S1 to S10 against an admitted registry. A registry that is not admitted verifies nothing.
 * Precedence follows S10; every check over the registry-key signatures runs on all of them
 * before the next check starts.
 */
export function verifyManifestSignatures(
  manifest: unknown,
  record: unknown,
  registry: unknown,
  now: string,
): SignatureOutcome {
  const refuse = (refusal: SignatureRefusal, reason: string): SignatureOutcome => ({
    outcome: "refused",
    refusal,
    reason,
  });
  const admission = admitSigningKeys(registry);
  if (admission.outcome === "refused") throw new TypeError("registry is not admitted");
  const keys = (registry as Registry).keys;

  if (!validateManifest(manifest)) return refuse("manifest-schema-invalid", "S3");
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
