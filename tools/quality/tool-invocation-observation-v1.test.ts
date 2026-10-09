import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import vectors from "../../contracts/fixtures/tool-invocation-observation-v1/vectors.json";
import common from "../../contracts/schemas/common.v1.schema.json";
import schema from "../../contracts/schemas/tool-invocation-observation.v1.schema.json";
import { canonicalJson, sha256Canonical } from "./authorized-execution";

interface DocumentVector {
  name: string;
  document: Record<string, unknown>;
}

interface DigestVector {
  name: string;
  kind: "args" | "result";
  toolName: string;
  outcome?: string;
  value: unknown;
  expected: string;
}

interface SemanticVector {
  name: string;
  parameters: { repeatThreshold: number; planToolNames: string[] };
  observations: Record<string, unknown>[];
  expected: string;
}

// Closed verdict set of the future pure evaluator (ADR-0046, SEMANTICS.md).
const semanticCodes = new Set([
  "progress",
  "no-progress",
  "observation-incomplete",
  "observation-chain-broken",
  "observation-replayed",
  "tool-undeclared",
  "attestation-invalid",
]);

const DOMAIN = "libre-ai.tool-invocation-observation.v1";

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(common);
const validate = ajv.compile(schema);

function keyedDigest(vector: DigestVector): string {
  const message =
    vector.kind === "args"
      ? `${DOMAIN}:args\n${vector.toolName}\n${canonicalJson(vector.value)}`
      : `${DOMAIN}:result\n${vector.toolName}\n${vector.outcome}\n${canonicalJson(vector.value)}`;
  return createHmac("sha256", Buffer.from(vectors.digestKeyTestOnlyHex, "hex"))
    .update(message, "utf8")
    .digest("hex");
}

async function preimageDigest(document: Record<string, unknown>): Promise<string> {
  const { preimageDigest: _digest, signature: _signature, ...preimage } = document;
  return sha256Canonical(preimage);
}

describe("tool-invocation-observation.v1 vectors", () => {
  test("the vector inventory is the declared version and is not empty", () => {
    expect(vectors.schemaVersion).toBe("libre-ai.tool-invocation-observation-vectors.v1");
    expect(vectors.valid.length).toBeGreaterThanOrEqual(4);
    expect(vectors.invalid.length).toBeGreaterThanOrEqual(30);
    expect(vectors.digests.length).toBeGreaterThanOrEqual(5);
    expect(vectors.semantic.length).toBe(semanticCodes.size + 2);
  });

  test.each(
    (vectors.valid as DocumentVector[]).map((vector) => [vector.name, vector.document]),
  )("accepts %s", (_name, document) => {
    expect(validate(document)).toBe(true);
  });

  test.each(
    (vectors.invalid as DocumentVector[]).map((vector) => [vector.name, vector.document]),
  )("refuses %s", (_name, document) => {
    expect(validate(document)).toBe(false);
  });

  test("every valid vector carries the digest of its own RFC 8785 preimage", async () => {
    for (const vector of vectors.valid as DocumentVector[]) {
      expect(await preimageDigest(vector.document), vector.name).toBe(
        vector.document.preimageDigest as string,
      );
    }
  });

  test.each(
    (vectors.digests as DigestVector[]).map((vector) => [vector.name, vector]),
  )("reproduces the keyed digest: %s", (_name, vector) => {
    expect(keyedDigest(vector)).toBe(vector.expected);
  });

  test("argument key order does not change the argument digest", () => {
    const [ordered, permuted] = vectors.digests as DigestVector[];
    expect(canonicalJson(ordered?.value)).toBe(canonicalJson(permuted?.value));
    expect(ordered?.expected).toBe(permuted?.expected as string);
  });

  test("semantic vectors are schema-valid, so their red is semantic, not structural", () => {
    for (const vector of vectors.semantic as SemanticVector[]) {
      expect(semanticCodes.has(vector.expected), vector.name).toBe(true);
      for (const observation of vector.observations) {
        expect(validate(observation), `${vector.name}: ${observation.id}`).toBe(true);
      }
    }
  });

  test("every closed verdict is exercised by at least one semantic vector", () => {
    const exercised = new Set((vectors.semantic as SemanticVector[]).map((v) => v.expected));
    expect([...exercised].sort()).toEqual([...semanticCodes].sort());
  });

  test("vector names are unique", () => {
    const names = [
      ...vectors.valid,
      ...vectors.invalid,
      ...vectors.digests,
      ...vectors.semantic,
    ].map((vector) => vector.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
