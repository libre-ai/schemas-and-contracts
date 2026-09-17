import { describe, expect, test } from "bun:test";
import { createHash, createPublicKey, verify } from "node:crypto";

type SignatureVector = {
  id: string;
  digestField: string;
  unsignedPayload: Record<string, unknown>;
  expectedDigest: string;
  publicKey: string;
  signature: string;
};

type SignatureVectors = {
  schemaVersion: string;
  algorithm: "Ed25519";
  canonicalization: "RFC8785";
  vectors: SignatureVector[];
};

const vectors = (await Bun.file(
  new URL(
    "../../../contracts/fixtures/agent-orchestration-v1/signature-vectors.v1.json",
    import.meta.url,
  ),
).json()) as SignatureVectors;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("non-finite JSON number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new TypeError(`unsupported JSON value: ${typeof value}`);
}

function publicKey(raw: Uint8Array) {
  const ed25519SpkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
  return createPublicKey({
    key: Buffer.concat([ed25519SpkiPrefix, raw]),
    format: "der",
    type: "spki",
  });
}

describe("agent attestation signature vectors", () => {
  for (const vector of vectors.vectors) {
    test(vector.id, () => {
      expect(Object.hasOwn(vector.unsignedPayload, vector.digestField)).toBeFalse();
      expect(Object.hasOwn(vector.unsignedPayload, "signature")).toBeFalse();

      const canonical = Buffer.from(canonicalJson(vector.unsignedPayload), "utf8");
      const digest = createHash("sha256").update(canonical).digest();
      expect(digest.toString("hex")).toBe(vector.expectedDigest);

      const rawPublicKey = Buffer.from(vector.publicKey, "base64url");
      const signature = Buffer.from(vector.signature, "base64url");
      const message = Buffer.concat([
        Buffer.from(String(vector.unsignedPayload.schemaVersion), "utf8"),
        Buffer.from([0]),
        digest,
      ]);
      expect(rawPublicKey.byteLength).toBe(32);
      expect(signature.byteLength).toBe(64);
      expect(verify(null, message, publicKey(rawPublicKey), signature)).toBeTrue();

      const altered = Buffer.from(signature);
      altered[0] = (altered[0] ?? 0) ^ 1;
      expect(verify(null, message, publicKey(rawPublicKey), altered)).toBeFalse();
      const staleMessage = Buffer.from(message);
      const lastIndex = staleMessage.length - 1;
      staleMessage[lastIndex] = (staleMessage[lastIndex] ?? 0) ^ 1;
      expect(verify(null, staleMessage, publicKey(rawPublicKey), signature)).toBeFalse();
    });
  }
});
