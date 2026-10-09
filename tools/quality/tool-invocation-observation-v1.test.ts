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
  // k and w are not parameters: the harness profile declares them and every
  // document carries them (ADR-0046 decision 3).
  parameters: { planToolNames: string[] };
  observations: ObservationDocument[];
  expected: string;
}

interface ObservationWindow {
  sequence: number;
  windowSize: number;
  repeatThreshold: number;
  firstCallSequence: number;
  lastCallSequence: number;
  final: boolean;
}

interface ObservationDocument extends Record<string, unknown> {
  id: string;
  window: ObservationWindow;
  entries: { count: number }[];
}

// The k - 1 overlap rule of ADR-0046 decision 1, checked structurally: window
// n + 1 starts at lastCallSequence(n) - (k - 2), k and w are constant over the
// stream, and k never exceeds w.
function overlapViolations(stream: ObservationDocument[]): string[] {
  const violations: string[] = [];
  const [head] = stream;
  if (!head) return ["empty stream"];
  for (const [index, document] of stream.entries()) {
    const { window } = document;
    if (window.repeatThreshold !== head.window.repeatThreshold) violations.push("k changes");
    if (window.windowSize !== head.window.windowSize) violations.push("w changes");
    if (window.repeatThreshold > window.windowSize) violations.push("k above w");
    const previous = stream[index - 1];
    if (previous === undefined) continue;
    const expectedFirst = previous.window.lastCallSequence - (window.repeatThreshold - 2);
    if (window.firstCallSequence !== expectedFirst) violations.push(`window ${index + 1} start`);
  }
  return violations;
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
    expect(vectors.semantic.length).toBe(semanticCodes.size + 7);
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

  test("streams expected to reach a progress verdict obey the k - 1 overlap rule", () => {
    const verdictStreams = (vectors.semantic as SemanticVector[]).filter(
      (vector) => vector.expected === "progress" || vector.expected === "no-progress",
    );
    expect(verdictStreams.length).toBeGreaterThanOrEqual(4);
    for (const vector of verdictStreams) {
      expect(overlapViolations(vector.observations), vector.name).toEqual([]);
      const last = vector.observations.at(-1);
      expect(last?.window.final, vector.name).toBe(true);
      for (const document of vector.observations) {
        const span = document.window.lastCallSequence - document.window.firstCallSequence + 1;
        const counted = document.entries.reduce((sum, entry) => sum + entry.count, 0);
        expect(counted, `${vector.name}: ${document.id}`).toBe(span);
        if (!document.window.final) expect(span, document.id).toBe(document.window.windowSize);
      }
    }
  });

  test("the overlap lets the evaluator see k consecutive calls straddling a disjoint boundary", () => {
    const byName = new Map((vectors.semantic as SemanticVector[]).map((v) => [v.name, v]));
    const overlapped = byName.get(
      "k identical consecutive calls across a disjoint window boundary are seen in the k - 1 overlap",
    );
    const disjoint = byName.get("disjoint windows without the k - 1 overlap are incomplete");
    if (!overlapped || !disjoint) throw new Error("missing straddle vectors");
    const k = overlapped.observations[0]?.window.repeatThreshold ?? 0;
    const maxCount = (stream: ObservationDocument[]) =>
      Math.max(...stream.flatMap((document) => document.entries.map((entry) => entry.count)));
    // Same calls, two window layouts: only the overlapping one reaches k inside one window.
    expect(maxCount(overlapped.observations)).toBeGreaterThanOrEqual(k);
    expect(maxCount(disjoint.observations)).toBeLessThan(k);
    expect(overlapViolations(disjoint.observations)).not.toEqual([]);
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
