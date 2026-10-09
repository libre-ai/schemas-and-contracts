import { describe, expect, test } from "bun:test";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import vectors from "../../contracts/fixtures/p02-job-v1/vectors.json";
import common from "../../contracts/schemas/common.v1.schema.json";
import schema from "../../contracts/schemas/p02-job.v1.schema.json";

interface Vector {
  name: string;
  document: unknown;
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(common);
const validate = ajv.compile(schema);

describe("p02-job.v1 vectors", () => {
  test("the vector inventory is the declared version and is not empty", () => {
    expect(vectors.schemaVersion).toBe("libre-ai.p02-job-vectors.v1");
    expect(vectors.valid.length).toBeGreaterThanOrEqual(6);
    expect(vectors.invalid.length).toBeGreaterThanOrEqual(20);
  });

  test.each(
    (vectors.valid as Vector[]).map((vector) => [vector.name, vector.document]),
  )("accepts %s", (_name, document) => {
    expect(validate(document)).toBe(true);
  });

  test.each(
    (vectors.invalid as Vector[]).map((vector) => [vector.name, vector.document]),
  )("refuses %s", (_name, document) => {
    expect(validate(document)).toBe(false);
  });

  test("vector names are unique", () => {
    const names = [...vectors.valid, ...vectors.invalid].map((vector) => vector.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
