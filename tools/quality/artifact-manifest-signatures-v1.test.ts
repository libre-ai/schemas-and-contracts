import { describe, expect, test } from "bun:test";
import {
  admitSigningKeys,
  isAdmissiblePoint,
  manifestSigningMessage,
  rfc8785,
  verifyManifestSignatures,
} from "./artifact-manifest-signatures-v1";
import {
  checkArtifactManifestSignatureVectors,
  countVectors,
  VECTORS_PATH,
} from "./artifact-manifest-signatures-vectors";

type JsonObject = Record<string, unknown>;

interface Corpus {
  testKeys: { name: string; signingKeyId: string }[];
  manifests: Record<string, JsonObject & { schemaVersion: string }>;
  manifestOctets: Record<string, string>;
  messages: Record<string, string>;
  registries: Record<string, JsonObject & { keys: { signingKeyId: string }[] }>;
  registryVectors: {
    id: string;
    rule: string | null;
    registry: (JsonObject & { keys?: { signingKeyId?: unknown }[] }) | null;
    registryOctets?: string;
    expected: { outcome: "admitted" } | { outcome: "refused"; refusal: string };
  }[];
  signatureVectors: {
    id: string;
    rule: string | null;
    manifest: string;
    registry: string;
    now: string;
    record:
      | (JsonObject & { signatures?: { signingKeyId?: unknown; signature?: unknown }[] })
      | null;
    recordOctets?: string;
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
const commonSchema = (await Bun.file(
  new URL("../../contracts/schemas/common.v1.schema.json", import.meta.url),
).json()) as { $defs: { identifier: { pattern: string } } };
const signingKeysSchema = (await Bun.file(
  new URL("../../contracts/schemas/signing-keys.v1.schema.json", import.meta.url),
).json()) as { $defs: { key: { properties: { artifactTypes: { items: { $ref: string } } } } } };
const catalog = (await Bun.file(
  new URL("../../contracts/catalog.v1.json", import.meta.url),
).json()) as {
  contracts: { id: string; classification: string }[];
};

const REGISTRY_RULES = ["K0", "K1", "K2", "K3", "K4", "K5", "K6"];
const SIGNATURE_RULES = ["S0", "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9"];

function lookup<T>(map: Record<string, T>, name: string): T {
  const value = map[name];
  if (value === undefined) throw new Error(`corpus names an absent entry ${name}`);
  return value;
}

function fromBase64url(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, "base64url"));
}

/** A vector without published octets is presented as the UTF-8 of its JSON value. */
function octetsOf(value: unknown, published: string | undefined): Uint8Array {
  return published === undefined
    ? new TextEncoder().encode(JSON.stringify(value))
    : fromBase64url(published);
}

/** The outcome without its diagnostic reason: the corpus fixes codes, not wording. */
function comparable(outcome: JsonObject): JsonObject {
  const { reason: _reason, ...rest } = outcome;
  return rest;
}

function verifyVector(vector: Corpus["signatureVectors"][number]) {
  return verifyManifestSignatures(
    fromBase64url(lookup(corpus.manifestOctets, vector.manifest)),
    octetsOf(vector.record, vector.recordOctets),
    octetsOf(lookup(corpus.registries, vector.registry), undefined),
    vector.now,
  );
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

  test("every signingKeyId of the corpus is a common.v1 identifier", () => {
    const identifier = new RegExp(commonSchema.$defs.identifier.pattern, "u");
    const ids = [
      ...corpus.testKeys.map((key) => key.signingKeyId),
      ...Object.values(corpus.registries).flatMap((registry) =>
        registry.keys.map((key) => key.signingKeyId),
      ),
      ...corpus.signatureVectors
        .filter((vector) => vector.expected.outcome === "accepted")
        .flatMap((vector) => (vector.record?.signatures ?? []).map((entry) => entry.signingKeyId)),
    ];
    for (const id of ids) expect(identifier.test(String(id)), String(id)).toBeTrue();
    console.log(`identifiers checked against common.v1 identifier: ${ids.length}`);
    expect(ids.length).toBeGreaterThan(corpus.testKeys.length);
  });

  test("the verifier's RFC 8785 serializer reproduces the RFC 8785 examples", () => {
    // RFC 8785 section 3.2.3, sorting example: names ordered by UTF-16 code units.
    expect(
      rfc8785({
        "\u{20ac}": "Euro Sign",
        "\r": "Carriage Return",
        "\u{fb33}": "Hebrew Letter Dalet With Dagesh",
        "1": "One",
        "\u{1f600}": "Emoji: Grinning Face",
        "\u{80}": "Control",
        "\u{f6}": "Latin Small Letter O With Diaeresis",
      }),
    ).toBe(
      '{"\\r":"Carriage Return","1":"One","\u{80}":"Control","\u{f6}":"Latin Small Letter O With Diaeresis",' +
        '"\u{20ac}":"Euro Sign","\u{1f600}":"Emoji: Grinning Face","\u{fb33}":"Hebrew Letter Dalet With Dagesh"}',
    );
    // RFC 8785 section 3.2.2, the "literals" and "string" members of its input example.
    expect(rfc8785({ string: '\u{20ac}$\u{f}\nA\'B"\\\\"/', literals: [null, true, false] })).toBe(
      '{"literals":[null,true,false],"string":"\u{20ac}$\\u000f\\nA\'B\\"\\\\\\\\\\"/"}',
    );
  });

  test("the verifier builds the published signing messages", () => {
    for (const name of ["release", "dataset", "release-unicode"]) {
      const message = manifestSigningMessage(lookup(corpus.manifests, name));
      expect(Buffer.from(message).toString("base64url"), name).toBe(lookup(corpus.messages, name));
    }
  });

  test("every registry vector yields its expected outcome", () => {
    let executed = 0;
    let failed = 0;
    for (const vector of corpus.registryVectors) {
      const outcome = admitSigningKeys(octetsOf(vector.registry, vector.registryOctets));
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
      const obtained = comparable(verifyVector(vector) as unknown as JsonObject);
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
      const outcome = verifyVector(vector);
      if (outcome.outcome !== "refused") continue;
      const text = JSON.stringify(outcome);
      for (const entry of vector.record?.signatures ?? []) {
        if (typeof entry.signature === "string" && entry.signature.length > 0)
          expect(text.includes(entry.signature.slice(0, 16)), vector.id).toBeFalse();
        if (typeof entry.signingKeyId === "string")
          expect(text.includes(entry.signingKeyId), vector.id).toBeFalse();
      }
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
    // K7 (no personal data) is a rule on authors and logs; the schema enforces its signatory
    // half, so its vector is the K1 one with an e-mail signatory.
    expect(semantics.includes("**K7 — ")).toBeTrue();
    expect(
      corpus.registryVectors.some((vector) => vector.id === "registry-signatory-email"),
    ).toBeTrue();
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

describe("artifact-manifest-signatures-v1 review decisions of 2026-11-17", () => {
  test("artifactTypes reuses the artifact-manifest.v1 enumeration", () => {
    expect(signingKeysSchema.$defs.key.properties.artifactTypes.items.$ref).toBe(
      "artifact-manifest.v1.schema.json#/properties/artifactType",
    );
  });

  test("signing-keys-v1 is classified public", () => {
    expect(catalog.contracts.find((entry) => entry.id === "signing-keys-v1")?.classification).toBe(
      "public",
    );
  });

  test("SEMANTICS states each decision the passes asked for", () => {
    const statements: [string, string][] = [
      ["lifecycle: rotation removes the entry", "## Key lifecycle"],
      ["lifecycle: revokedAt only for compromise", "`revokedAt` is reserved for compromise"],
      [
        "deviations from build-brief-v2 and agent-orchestration",
        "## Deviations from sibling contracts",
      ],
      ["now from a trusted clock", "trusted clock"],
      ["freshness and rollback belong to the consumer", "## Freshness and rollback"],
      ["cofactored verification", "cofactored"],
      ["no personal data", "**K7 — "],
    ];
    for (const [what, needle] of statements) expect(semantics.includes(needle), what).toBeTrue();
    // The pinned verifier evaluates the cofactored equation; the text must not claim otherwise.
    expect(semantics.includes("the cofactorless equation holds")).toBeFalse();
  });
});
