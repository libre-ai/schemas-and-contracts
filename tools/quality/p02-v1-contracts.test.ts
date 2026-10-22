import { describe, expect, test } from "bun:test";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import ruleSetFixtures from "../../contracts/fixtures/curation-rule-set-v3/schema-fixtures.json";
import ruleSetVectors from "../../contracts/fixtures/curation-rule-set-v3/vectors.json";
import knowledgeExcerptFixtures from "../../contracts/fixtures/knowledge-excerpt-v1/schema-fixtures.json";
import knowledgeExcerptVectors from "../../contracts/fixtures/knowledge-excerpt-v1/vectors.json";
import p02ExportFixtures from "../../contracts/fixtures/p02-export-v1/schema-fixtures.json";
import p02ExportVectors from "../../contracts/fixtures/p02-export-v1/vectors.json";
import usageStatementFixtures from "../../contracts/fixtures/usage-statement-v1/schema-fixtures.json";
import usageStatementVectors from "../../contracts/fixtures/usage-statement-v1/vectors.json";
import common from "../../contracts/schemas/common.v1.schema.json";
import ruleSetSchema from "../../contracts/schemas/curation-rule-set.v3.schema.json";
import knowledgeExcerptSchema from "../../contracts/schemas/knowledge-excerpt.v1.schema.json";
import p02ExportSchema from "../../contracts/schemas/p02-export.v1.schema.json";
import usageStatementSchema from "../../contracts/schemas/usage-statement.v1.schema.json";
import { exportDigest } from "./export-digest";

type JsonObject = Record<string, unknown>;

interface Mutation {
  name: string;
  path: string;
  value?: unknown;
  remove?: boolean;
}

interface FixtureCase {
  schema: string;
  valid: JsonObject;
  invalidMutations: Mutation[];
}

interface Vector {
  name: string;
  document: JsonObject;
}

interface VectorFile {
  schemaVersion: string;
  valid: Vector[];
  invalid: Vector[];
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
for (const schema of [
  common,
  ruleSetSchema,
  p02ExportSchema,
  knowledgeExcerptSchema,
  usageStatementSchema,
]) {
  ajv.addSchema(schema);
}

function validatorFor(id: string): ValidateFunction {
  const validate = ajv.getSchema(id);
  if (!validate) throw new Error(`schema not registered: ${id}`);
  return validate;
}

const validateRuleSet = validatorFor(ruleSetSchema.$id);
const validateP02Export = validatorFor(p02ExportSchema.$id);
const validateKnowledgeExcerpt = validatorFor(knowledgeExcerptSchema.$id);
const validateUsageStatement = validatorFor(usageStatementSchema.$id);

/** Same path semantics as the contracts gate: JSON Pointer, `~1` and `~0` escapes. */
function mutate(input: JsonObject, mutation: Mutation): JsonObject {
  const output = structuredClone(input);
  const segments = mutation.path
    .split("/")
    .slice(1)
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
  const key = segments.at(-1);
  if (key === undefined) throw new Error(`invalid mutation path: ${mutation.path}`);
  let target: unknown = output;
  for (const segment of segments.slice(0, -1)) {
    if (typeof target !== "object" || target === null || !(segment in target)) {
      throw new Error(`mutation path does not exist: ${mutation.path}`);
    }
    target = (target as Record<string, unknown>)[segment];
  }
  if (typeof target !== "object" || target === null) {
    throw new Error(`invalid mutation path: ${mutation.path}`);
  }
  if (mutation.remove) {
    if (Array.isArray(target)) target.splice(Number(key), 1);
    else delete (target as JsonObject)[key];
  } else if (Array.isArray(target)) {
    target[Number(key)] = mutation.value;
  } else {
    (target as JsonObject)[key] = mutation.value;
  }
  return output;
}

/**
 * The export digest is derived, never stored: the vectors carry the body without
 * `digest` and the RFC 8785 oracle computes it, so no literal can go stale when the
 * canonical form changes. A signature covers the digest, so it is excluded from it.
 */
async function withDigest(document: JsonObject): Promise<JsonObject> {
  if ("digest" in document) return document;
  const { signature: _signature, ...unsigned } = document;
  return { ...document, digest: await exportDigest(unsigned) };
}

/** A rule set with `count` copies of the first valid rule, ids kept unique and well-formed. */
function ruleSetWithRules(base: JsonObject, count: number): JsonObject {
  const document = structuredClone(base);
  const template = (document.rules as JsonObject[])[0];
  if (!template) throw new Error("base rule set has no rule");
  document.rules = Array.from({ length: count }, (_, index) => ({
    ...structuredClone(template),
    id: `rule-${String(index).padStart(3, "0")}`,
  }));
  return document;
}

/** A single-rule set whose condition holds `count` leaves, grouped in `any` blocks of 16. */
function ruleSetWithLeaves(base: JsonObject, count: number): JsonObject {
  const document = structuredClone(base);
  const leaves = Array.from({ length: count }, (_, index) => ({
    field: "title",
    operator: "contains",
    value: `term-${index}`,
  }));
  const groups: JsonObject[] = [];
  for (let start = 0; start < leaves.length; start += 16) {
    groups.push({ any: leaves.slice(start, start + 16) });
  }
  const rules = document.rules as JsonObject[];
  if (!rules[0]) throw new Error("base rule set has no rule");
  rules[0].when = { all: groups };
  return document;
}

function countLeaves(condition: unknown): number {
  if (typeof condition !== "object" || condition === null) return 0;
  const node = condition as JsonObject;
  if ("field" in node) return 1;
  if (Array.isArray(node.all)) return node.all.reduce((sum, child) => sum + countLeaves(child), 0);
  if (Array.isArray(node.any)) return node.any.reduce((sum, child) => sum + countLeaves(child), 0);
  if ("not" in node) return countLeaves(node.not);
  return 0;
}

/**
 * The 32-leaf bound of curation-rule-set.v3. JSON Schema 2020-12 cannot count leaves
 * across a recursive grammar, so the schema bounds depth and fan-out and this check
 * enforces the per-rule leaf budget. A consumer must apply it too.
 */
function withinLeafBound(document: JsonObject): boolean {
  const rules = Array.isArray(document.rules) ? (document.rules as JsonObject[]) : [];
  return rules.every((rule) => countLeaves(rule.when) <= 32);
}

const ruleSetBase = (ruleSetVectors as VectorFile).valid[0]?.document as JsonObject;
const p02Base = (p02ExportVectors as VectorFile).valid[0]?.document as JsonObject;

describe("vector files", () => {
  test.each([
    ["curation-rule-set.v3", ruleSetVectors],
    ["p02-export.v1", p02ExportVectors],
    ["knowledge-excerpt.v1", knowledgeExcerptVectors],
    ["usage-statement.v1", usageStatementVectors],
  ] as const)("%s declares a version and both valid and invalid vectors", (_name, vectors) => {
    expect(vectors.schemaVersion).toMatch(/^libre-ai\.[a-z0-9-]+-vectors\.v1$/);
    expect(vectors.valid.length).toBeGreaterThanOrEqual(1);
    expect(vectors.invalid.length).toBeGreaterThanOrEqual(1);
  });

  test.each([
    ["curation-rule-set.v3", ruleSetVectors],
    ["p02-export.v1", p02ExportVectors],
    ["knowledge-excerpt.v1", knowledgeExcerptVectors],
    ["usage-statement.v1", usageStatementVectors],
  ] as const)("%s vector names are unique", (_name, vectors) => {
    const names = [...vectors.valid, ...vectors.invalid].map((vector) => vector.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("curation-rule-set.v3", () => {
  test("accepts every valid fixture and vector", () => {
    const fixture = ruleSetFixtures.cases[0] as FixtureCase;
    expect(validateRuleSet(fixture.valid)).toBe(true);
    for (const vector of (ruleSetVectors as VectorFile).valid) {
      expect(validateRuleSet(vector.document)).toBe(true);
    }
  });

  test("refuses every invalid mutation of the fixture", () => {
    const fixture = ruleSetFixtures.cases[0] as FixtureCase;
    for (const mutation of fixture.invalidMutations) {
      expect(validateRuleSet(mutate(fixture.valid, mutation)), mutation.name).toBe(false);
    }
  });

  test("refuses every invalid vector", () => {
    for (const vector of (ruleSetVectors as VectorFile).invalid) {
      expect(validateRuleSet(vector.document), vector.name).toBe(false);
    }
  });

  test("accepts exactly 200 rules and refuses 201 (maxItems 200)", () => {
    expect(validateRuleSet(ruleSetWithRules(ruleSetBase, 200))).toBe(true);
    expect(validateRuleSet(ruleSetWithRules(ruleSetBase, 201))).toBe(false);
  });

  test("the schema accepts 33 leaves, the leaf budget refuses them (semantic bound)", () => {
    const at32 = ruleSetWithLeaves(ruleSetBase, 32);
    expect(validateRuleSet(at32)).toBe(true);
    expect(withinLeafBound(at32)).toBe(true);

    const at33 = ruleSetWithLeaves(ruleSetBase, 33);
    expect(validateRuleSet(at33)).toBe(true);
    expect(withinLeafBound(at33)).toBe(false);
  });
});

describe("p02-export.v1", () => {
  test("accepts every valid fixture and vector once its digest is derived", async () => {
    const fixture = p02ExportFixtures.cases[0] as FixtureCase;
    expect(validateP02Export(fixture.valid)).toBe(true);
    for (const vector of (p02ExportVectors as VectorFile).valid) {
      expect(validateP02Export(await withDigest(vector.document)), vector.name).toBe(true);
    }
  });

  test("refuses every invalid mutation of the fixture", () => {
    const fixture = p02ExportFixtures.cases[0] as FixtureCase;
    for (const mutation of fixture.invalidMutations) {
      expect(validateP02Export(mutate(fixture.valid, mutation)), mutation.name).toBe(false);
    }
  });

  test("refuses every invalid vector once its digest is derived", async () => {
    for (const vector of (p02ExportVectors as VectorFile).invalid) {
      expect(validateP02Export(await withDigest(vector.document)), vector.name).toBe(false);
    }
  });

  test("refuses an export without digest", () => {
    const fixture = p02ExportFixtures.cases[0] as FixtureCase;
    const { digest: _digest, ...withoutDigest } = fixture.valid;
    expect(validateP02Export(withoutDigest)).toBe(false);
  });

  test("the digest is not covered by a signature and covers every other member", async () => {
    const vector = (p02ExportVectors as VectorFile).valid[2];
    if (!vector) throw new Error("signed vector missing");
    const signed = await withDigest(vector.document);
    const { signature: _signature, ...unsigned } = signed;
    expect(await exportDigest(unsigned)).toBe(signed.digest as string);

    const changed = { ...unsigned, preferences: { theme: "dark" } };
    expect(await exportDigest(changed)).not.toBe(signed.digest as string);
  });

  test("the base vector carries an oracle digest that is 64 lowercase hexadecimal characters", async () => {
    const digested = await withDigest(p02Base);
    expect(digested.digest).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("knowledge-excerpt.v1", () => {
  test("accepts every valid fixture and vector", () => {
    const fixture = knowledgeExcerptFixtures.cases[0] as FixtureCase;
    expect(validateKnowledgeExcerpt(fixture.valid)).toBe(true);
    for (const vector of (knowledgeExcerptVectors as VectorFile).valid) {
      expect(validateKnowledgeExcerpt(vector.document), vector.name).toBe(true);
    }
  });

  test("refuses every invalid mutation and invalid vector", () => {
    const fixture = knowledgeExcerptFixtures.cases[0] as FixtureCase;
    for (const mutation of fixture.invalidMutations) {
      expect(validateKnowledgeExcerpt(mutate(fixture.valid, mutation)), mutation.name).toBe(false);
    }
    for (const vector of (knowledgeExcerptVectors as VectorFile).invalid) {
      expect(validateKnowledgeExcerpt(vector.document), vector.name).toBe(false);
    }
  });
});

describe("usage-statement.v1", () => {
  test("accepts every valid fixture and vector once its digest is derived", async () => {
    const fixture = usageStatementFixtures.cases[0] as FixtureCase;
    expect(validateUsageStatement(fixture.valid)).toBe(true);
    for (const vector of (usageStatementVectors as VectorFile).valid) {
      expect(validateUsageStatement(await withDigest(vector.document)), vector.name).toBe(true);
    }
  });

  test("refuses every invalid mutation and invalid vector", async () => {
    const fixture = usageStatementFixtures.cases[0] as FixtureCase;
    for (const mutation of fixture.invalidMutations) {
      expect(validateUsageStatement(mutate(fixture.valid, mutation)), mutation.name).toBe(false);
    }
    for (const vector of (usageStatementVectors as VectorFile).invalid) {
      expect(validateUsageStatement(await withDigest(vector.document)), vector.name).toBe(false);
    }
  });
});
