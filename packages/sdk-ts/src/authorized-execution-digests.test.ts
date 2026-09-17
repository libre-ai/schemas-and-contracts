import { describe, expect, test } from "bun:test";

interface DigestVector {
  id: string;
  schema: string;
  digestField: string;
  excludedFields: string[];
  unsignedPayload: Record<string, unknown>;
  expectedDigest: string;
}

interface DigestVectorDocument {
  schemaVersion: string;
  cases: DigestVector[];
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
    .join(",")}}`;
}

describe("authorized execution digest projection", () => {
  test("independently reproduces the nine RFC 8785 authority vectors", async () => {
    const document = (await Bun.file(
      "../../contracts/fixtures/authorized-execution-v1/digest-vectors.v1.json",
    ).json()) as DigestVectorDocument;

    expect(document.schemaVersion).toBe("libre-ai.authorized-execution-digest-vectors.v1");
    expect(document.cases).toHaveLength(9);
    expect(new Set(document.cases.map((vector) => vector.id)).size).toBe(9);
    for (const vector of document.cases) {
      expect(vector.excludedFields).toContain(vector.digestField);
      expect(vector.unsignedPayload).not.toHaveProperty(vector.digestField);
      expect(vector.unsignedPayload).not.toHaveProperty("signature");
      const digest = new Bun.CryptoHasher("sha256")
        .update(canonicalJson(vector.unsignedPayload))
        .digest("hex");
      expect(digest, vector.id).toBe(vector.expectedDigest);
    }
  });
});
