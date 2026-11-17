import { describe, expect, test } from "bun:test";
import {
  admitSigningKeys,
  isAdmissiblePoint,
  manifestSigningMessage,
  verifyManifestSignatures,
} from "./artifact-manifest-signatures-v1";
import {
  checkArtifactManifestSignatureVectors,
  countVectors,
  VECTORS_PATH,
} from "./artifact-manifest-signatures-vectors";

type JsonObject = Record<string, unknown>;

interface Corpus {
  manifests: Record<string, JsonObject & { schemaVersion: string }>;
  messages: Record<string, string>;
  registries: Record<string, JsonObject>;
  registryVectors: {
    id: string;
    rule: string | null;
    registry: JsonObject;
    expected: { outcome: "admitted" } | { outcome: "refused"; refusal: string };
  }[];
  signatureVectors: {
    id: string;
    rule: string | null;
    manifest: string;
    registry: string;
    now: string;
    record: JsonObject;
    expected: JsonObject & { outcome: string };
  }[];
}

const corpus = (await Bun.file(VECTORS_PATH).json()) as Corpus;
const semantics = await Bun.file(
  new URL("../../contracts/artifact-manifest-signatures-v1/SEMANTICS.md", import.meta.url),
).text();
const strictPoints = (
  (await Bun.file(
    new URL("../../contracts/fixtures/build-brief-v2/strict-ed25519-vectors.json", import.meta.url),
  ).json()) as { points: { id: string; point: string; admissible: boolean }[] }
).points;

const REGISTRY_RULES = ["K1", "K2", "K3", "K4", "K5"];
const SIGNATURE_RULES = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9"];

function lookup<T>(map: Record<string, T>, name: string): T {
  const value = map[name];
  if (value === undefined) throw new Error(`corpus names an absent entry ${name}`);
  return value;
}

/** The outcome without its diagnostic reason: the corpus fixes codes, not wording. */
function comparable(outcome: JsonObject): JsonObject {
  const { reason: _reason, ...rest } = outcome;
  return rest;
}

describe("artifact-manifest-signatures-v1 corpus", () => {
  test("is octet-identical to its generator output", async () => {
    expect(await checkArtifactManifestSignatureVectors()).toEqual([]);
    const counts = countVectors(corpus);
    console.log(
      `corpus: registry ${counts.registryValid} valid + ${counts.registryInvalid} invalid, ` +
        `signatures ${counts.signatureValid} valid + ${counts.signatureInvalid} invalid`,
    );
    expect(counts.registryValid + counts.registryInvalid).toBe(corpus.registryVectors.length);
    expect(counts.signatureValid + counts.signatureInvalid).toBe(corpus.signatureVectors.length);
  });

  test("the strict point profile reproduces the 24 build-brief-v2 point verdicts", () => {
    let admissible = 0;
    for (const point of strictPoints) {
      const verdict = isAdmissiblePoint(new Uint8Array(Buffer.from(point.point, "base64url")));
      expect(verdict, point.id).toBe(point.admissible);
      if (verdict) admissible += 1;
    }
    expect(strictPoints.length).toBe(24);
    expect(admissible).toBe(3);
  });

  test("the verifier builds the published signing messages", () => {
    for (const name of ["release", "dataset"]) {
      const message = manifestSigningMessage(lookup(corpus.manifests, name));
      expect(Buffer.from(message).toString("base64url")).toBe(lookup(corpus.messages, name));
    }
  });

  test("every registry vector yields its expected outcome", () => {
    let executed = 0;
    let failed = 0;
    for (const vector of corpus.registryVectors) {
      const outcome = admitSigningKeys(vector.registry);
      const obtained = comparable(outcome as unknown as JsonObject);
      // Each registry rule has its own check, so a refusal must come from the rule the vector
      // breaks, not from an earlier check tripped by an unintended second defect.
      const firedRule = outcome.outcome === "refused" ? outcome.reason.split(" ")[0] : null;
      const ok = Bun.deepEquals(obtained, vector.expected) && firedRule === vector.rule;
      console.log(
        `${ok ? "ok" : "not ok"} ${vector.id}: expected ${JSON.stringify(vector.expected)} by ${vector.rule}, obtained ${JSON.stringify(obtained)} by ${firedRule}`,
      );
      executed += 1;
      if (!ok) failed += 1;
    }
    expect(failed).toBe(0);
    expect(executed).toBe(corpus.registryVectors.length);
  });

  test("every signature vector yields its expected outcome", () => {
    let executed = 0;
    let failed = 0;
    for (const vector of corpus.signatureVectors) {
      const outcome = verifyManifestSignatures(
        lookup(corpus.manifests, vector.manifest),
        vector.record,
        lookup(corpus.registries, vector.registry),
        vector.now,
      );
      const obtained = comparable(outcome as unknown as JsonObject);
      const ok = Bun.deepEquals(obtained, vector.expected);
      console.log(
        `${ok ? "ok" : "not ok"} ${vector.id}: expected ${JSON.stringify(vector.expected)}, obtained ${JSON.stringify(obtained)}`,
      );
      executed += 1;
      if (!ok) failed += 1;
    }
    expect(failed).toBe(0);
    expect(executed).toBe(corpus.signatureVectors.length);
  });

  test("a refusal carries no signature or key octets", () => {
    for (const vector of corpus.signatureVectors) {
      const outcome = verifyManifestSignatures(
        lookup(corpus.manifests, vector.manifest),
        vector.record,
        lookup(corpus.registries, vector.registry),
        vector.now,
      );
      if (outcome.outcome !== "refused") continue;
      const text = JSON.stringify(outcome);
      const signatures = (vector.record.signatures ?? []) as { signature?: unknown }[];
      for (const entry of signatures)
        if (typeof entry.signature === "string" && entry.signature.length > 0)
          expect(text.includes(entry.signature.slice(0, 16)), vector.id).toBeFalse();
    }
  });

  test("every rule is stated in SEMANTICS and broken by at least one invalid vector", () => {
    const broken = new Set([
      ...corpus.registryVectors
        .filter((vector) => vector.expected.outcome === "refused")
        .map((vector) => vector.rule),
      ...corpus.signatureVectors
        .filter((vector) => vector.expected.outcome === "refused")
        .map((vector) => vector.rule),
    ]);
    for (const rule of [...REGISTRY_RULES, ...SIGNATURE_RULES]) {
      expect(semantics.includes(`**${rule} — `), `${rule} stated`).toBeTrue();
      expect(broken.has(rule), `${rule} broken by an invalid vector`).toBeTrue();
    }
    // S10 (order) is not a defect: it is exercised by valid permuted vectors.
    expect(semantics.includes("**S10 — ")).toBeTrue();
    expect(
      corpus.signatureVectors.filter(
        (vector) => vector.rule === "S10" && vector.expected.outcome === "accepted",
      ).length,
    ).toBeGreaterThan(0);
    // Every invalid vector names exactly one rule.
    for (const vector of [...corpus.registryVectors, ...corpus.signatureVectors])
      if (vector.expected.outcome === "refused") expect(vector.rule, vector.id).not.toBeNull();
  });
});
