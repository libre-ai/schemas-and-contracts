import { describe, expect, test } from "bun:test";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import curatedFixtures from "../../contracts/fixtures/curated-item-export-v3/schema-fixtures.json";
import curatedVectors from "../../contracts/fixtures/curated-item-export-v3/vectors.json";
import practiceFixtures from "../../contracts/fixtures/practice-progress-export-v2/schema-fixtures.json";
import practiceVectors from "../../contracts/fixtures/practice-progress-export-v2/vectors.json";
import activityOutcome from "../../contracts/schemas/activity-outcome.v1.schema.json";
import common from "../../contracts/schemas/common.v1.schema.json";
import curatedV2 from "../../contracts/schemas/curated-item-export.v2.schema.json";
import curatedV3 from "../../contracts/schemas/curated-item-export.v3.schema.json";
import practiceV1 from "../../contracts/schemas/practice-progress-export.v1.schema.json";
import practiceV2 from "../../contracts/schemas/practice-progress-export.v2.schema.json";
import { exportDigest, exportImportFailures, importExport } from "./export-digest";

interface Mutation {
  name: string;
  path: string;
  value?: unknown;
  remove?: boolean;
}

interface FixtureCase {
  schema: string;
  valid: Record<string, unknown>;
  invalidMutations: Mutation[];
}

interface Vectors {
  digests: { name: string; unsignedExport: Record<string, unknown>; expectedDigest: string }[];
  imports: { name: string; raw: string; expected: string; failures: string[] }[];
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(common);
ajv.addSchema(activityOutcome);

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

const majors = [
  {
    label: "curated-item-export.v3",
    schema: curatedV3,
    previous: curatedV2,
    fixtures: curatedFixtures.cases as FixtureCase[],
    vectors: curatedVectors as Vectors,
  },
  {
    label: "practice-progress-export.v2",
    schema: practiceV2,
    previous: practiceV1,
    fixtures: practiceFixtures.cases as FixtureCase[],
    vectors: practiceVectors as Vectors,
  },
];

for (const major of majors) {
  const validate = ajv.compile(major.schema);
  const [fixture] = major.fixtures;
  if (!fixture || major.fixtures.length !== 1) throw new Error(`${major.label}: one fixture case`);
  const encoder = new TextEncoder();

  describe(`${major.label} candidate`, () => {
    test("differs from the previous major only by its identity and a required digest", () => {
      const { $id: _id, title: _title, required, properties } = major.schema;
      const previous = major.previous;
      expect(required).toEqual([...previous.required, "digest"]);
      expect(properties.digest).toEqual({ $ref: "common.v1.schema.json#/$defs/sha256" });
      const { digest: _digest, schemaVersion, ...rest } = properties as Record<string, unknown>;
      const { schemaVersion: previousVersion, ...previousRest } = previous.properties as Record<
        string,
        unknown
      >;
      expect(rest).toEqual(previousRest);
      expect(schemaVersion).not.toEqual(previousVersion);
    });

    test("accepts the canonical fixture, whose digest is the export digest", async () => {
      expect(validate(fixture.valid)).toBe(true);
      expect(await exportDigest(fixture.valid)).toBe(fixture.valid.digest as string);
    });

    test.each(
      fixture.invalidMutations.map((mutation) => [mutation.name, mutation]),
    )("refuses %s", (_name, mutation) => {
      expect(validate(mutate(fixture.valid, mutation))).toBe(false);
    });

    test("digest vectors reproduce over the RFC 8785 form without digest", async () => {
      expect(major.vectors.digests.length).toBe(2);
      for (const vector of major.vectors.digests) {
        expect("digest" in vector.unsignedExport, vector.name).toBe(false);
        expect(await exportDigest(vector.unsignedExport), vector.name).toBe(vector.expectedDigest);
      }
    });

    test.each(
      major.vectors.imports.map((vector) => [vector.name, vector]),
    )("import: %s", async (_name, vector) => {
      const bytes = encoder.encode(vector.raw);
      expect(await exportImportFailures(bytes, validate)).toEqual(vector.failures);
      expect(await importExport(bytes, validate)).toBe(vector.expected as never);
    });

    test("refused import vectors are refused for their stated reason alone", () => {
      const refused = major.vectors.imports.filter(
        (vector) => vector.expected === "export-refused",
      );
      expect(refused.length).toBeGreaterThanOrEqual(6);
      for (const vector of refused) expect(vector.failures.length, vector.name).toBe(1);
      const reasons = new Set(refused.flatMap((vector) => vector.failures));
      expect([...reasons].sort()).toEqual([
        "export.digest_mismatch",
        "export.json_not_strict",
        "export.schema_invalid",
      ]);
    });

    test("vector and mutation names are unique", () => {
      const names = [
        ...fixture.invalidMutations.map((mutation) => mutation.name),
        ...major.vectors.digests.map((vector) => vector.name),
        ...major.vectors.imports.map((vector) => vector.name),
      ];
      expect(new Set(names).size).toBe(names.length);
    });
  });
}
