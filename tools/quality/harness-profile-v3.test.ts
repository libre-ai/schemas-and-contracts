import { describe, expect, test } from "bun:test";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import fixtures from "../../contracts/fixtures/harness-profile-v3/schema-fixtures.json";
import vectors from "../../contracts/fixtures/harness-profile-v3/vectors.json";
import common from "../../contracts/schemas/common.v1.schema.json";
import schema from "../../contracts/schemas/harness-profile.v3.schema.json";
import { sha256Canonical } from "./authorized-execution";
import { harnessProfileV3ResolutionFailures, resolveHarnessProfileV3 } from "./harness-profile-v3";

interface Mutation {
  name: string;
  path: string;
  value?: unknown;
  remove?: boolean;
}

interface SemanticVector {
  name: string;
  profile: Parameters<typeof resolveHarnessProfileV3>[0];
  expected: string;
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(common);
const validate = ajv.compile(schema);

function mutate(document: unknown, mutation: Mutation): unknown {
  const copy = structuredClone(document) as Record<string, unknown>;
  const segments = mutation.path.split("/").slice(1);
  const last = segments.pop();
  if (last === undefined) throw new Error(`${mutation.name}: empty pointer`);
  let parent: Record<string, unknown> = copy;
  for (const segment of segments) parent = parent[segment] as Record<string, unknown>;
  if (mutation.remove) delete parent[last];
  else parent[last] = mutation.value;
  return copy;
}

const [fixture] = fixtures.cases;
if (!fixture) throw new Error("missing harness-profile.v3 fixture case");

describe("harness-profile.v3 candidate", () => {
  test("declares k and w with the bounds of tool-invocation-observation-v1", () => {
    const guard = schema.properties.noProgressGuard;
    expect(schema.required).toContain("noProgressGuard");
    expect(guard.required).toEqual(["repeatThreshold", "windowSize", "reaction"]);
    for (const bound of [guard.properties.repeatThreshold, guard.properties.windowSize]) {
      expect(bound).toEqual({ type: "integer", minimum: 2, maximum: 1024 });
    }
  });

  test("accepts the canonical fixture", () => {
    expect(validate(fixture.valid)).toBe(true);
  });

  test.each(
    (fixture.invalidMutations as Mutation[]).map((mutation) => [mutation.name, mutation]),
  )("refuses %s", (_name, mutation) => {
    expect(validate(mutate(fixture.valid, mutation))).toBe(false);
  });

  test("the digest vector reproduces over the RFC 8785 preimage", async () => {
    for (const vector of vectors.digests) {
      expect("profileDigest" in vector.unsignedPayload, vector.name).toBe(false);
      expect(await sha256Canonical(vector.unsignedPayload), vector.name).toBe(
        vector.expectedDigest,
      );
    }
    expect(fixture.valid.profileDigest).toBe(vectors.digests[0]?.expectedDigest as string);
  });

  test("semantic vectors are schema-valid, so their verdict is a resolution rule", () => {
    for (const vector of vectors.semantic as SemanticVector[]) {
      expect(validate(vector.profile), vector.name).toBe(true);
    }
  });

  test.each(
    (vectors.semantic as SemanticVector[]).map((vector) => [vector.name, vector]),
  )("resolves %s to its expected verdict", async (_name, vector) => {
    expect(await resolveHarnessProfileV3(vector.profile)).toBe(vector.expected as never);
  });

  test("k above w is refused for that reason alone", async () => {
    const vector = (vectors.semantic as SemanticVector[]).find(
      (candidate) => candidate.name === "k above w is refused at resolution",
    );
    if (!vector) throw new Error("missing k above w vector");
    expect(await harnessProfileV3ResolutionFailures(vector.profile)).toEqual([
      "repeatThreshold exceeds windowSize",
    ]);
  });

  test("vector and mutation names are unique", () => {
    const names = [
      ...fixture.invalidMutations.map((mutation) => mutation.name),
      ...vectors.digests.map((vector) => vector.name),
      ...vectors.semantic.map((vector) => vector.name),
    ];
    expect(new Set(names).size).toBe(names.length);
  });
});
