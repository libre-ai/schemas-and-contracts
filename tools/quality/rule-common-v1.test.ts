import { describe, expect, test } from "bun:test";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020";

// The forms of rule-common.v1 are read by consumers from `$defs` (R1-R4 of the semantics).
// These tests hold the properties a reader relies on, and replay the accept/refuse cases
// that the rule-context lot definitions fix, so that a schema edit that drifts from those
// sources turns red here and not in a consumer.

type JsonObject = Record<string, unknown>;

const SCHEMA_URL = new URL("../../contracts/schemas/rule-common.v1.schema.json", import.meta.url);
const COMMON_URL = new URL("../../contracts/schemas/common.v1.schema.json", import.meta.url);
const FIXTURES_URL = new URL(
  "../../contracts/fixtures/rule-common-v1/schema-fixtures.json",
  import.meta.url,
);
const SEMANTICS_URL = new URL("../../contracts/rule-common-v1/SEMANTICS.md", import.meta.url);

const schema = (await Bun.file(SCHEMA_URL).json()) as JsonObject & {
  $id: string;
  required: string[];
  properties: Record<string, JsonObject>;
  $defs: Record<string, JsonObject>;
};
const common = (await Bun.file(COMMON_URL).json()) as { $defs: Record<string, JsonObject> };
const fixtures = (await Bun.file(FIXTURES_URL).json()) as {
  cases: { schema: string; invalidMutations: { name: string; path: string }[] }[];
};
const semantics = await Bun.file(SEMANTICS_URL).text();

const FORM_NAMES = [
  "ruleId",
  "excerptDigest",
  "slug",
  "edition",
  "overlayReference",
  "level",
  "triggerType",
] as const;
type FormName = (typeof FORM_NAMES)[number];

const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addSchema(schema);

function formValidator(name: FormName): ValidateFunction {
  const validate = ajv.getSchema(`${schema.$id}#/$defs/${name}`);
  if (validate === undefined) throw new Error(`rule-common.v1: $defs/${name} does not resolve`);
  return validate;
}

/** What a consumer that reads only the leaf (no JSON Schema engine) would decide. */
function leafAdmits(name: FormName, value: string): boolean {
  const leaf = schema.$defs[name];
  if (leaf === undefined) throw new Error(`rule-common.v1: $defs/${name} is missing`);
  if (Array.isArray(leaf.enum)) return (leaf.enum as unknown[]).includes(value);
  const length = [...value].length;
  if (typeof leaf.minLength === "number" && length < leaf.minLength) return false;
  if (typeof leaf.maxLength === "number" && length > leaf.maxLength) return false;
  return new RegExp(String(leaf.pattern), "u").test(value);
}

describe("rule-common.v1 leaf forms (R1-R3)", () => {
  test("the $defs are exactly the seven forms, each referenced once by the specimen root", () => {
    expect(Object.keys(schema.$defs).sort()).toEqual([...FORM_NAMES].sort());
    expect(Object.keys(schema.properties).sort()).toEqual(["schemaVersion", ...FORM_NAMES].sort());
    expect([...schema.required].sort()).toEqual(Object.keys(schema.properties).sort());
    for (const name of FORM_NAMES) {
      expect(schema.properties[name]).toEqual({ $ref: `#/$defs/${name}` });
    }
  });

  test("every leaf is a self-contained string form or a closed list of strings", () => {
    for (const name of FORM_NAMES) {
      const leaf = schema.$defs[name] as JsonObject;
      if ("enum" in leaf) {
        expect(Object.keys(leaf)).toEqual(["enum"]);
        const values = leaf.enum as unknown[];
        expect(values.length).toBeGreaterThan(0);
        expect(new Set(values).size).toBe(values.length);
        for (const value of values) expect(String(value)).toMatch(/^[A-Za-z_]+$/);
        continue;
      }
      for (const key of Object.keys(leaf)) {
        expect(["type", "minLength", "maxLength", "pattern"]).toContain(key);
      }
      expect(leaf.type).toBe("string");
      const pattern = String(leaf.pattern);
      expect(pattern.startsWith("^")).toBe(true);
      expect(pattern.endsWith("$")).toBe(true);
      // Portable subset (R3): no lookaround and no backreference, so the same text
      // compiles under ECMA-262 `u` and under engines without them.
      expect(pattern).not.toMatch(/\(\?[=!<]|\\[1-9]/);
      expect(() => new RegExp(pattern, "u")).not.toThrow();
    }
  });

  test("the excerpt digest is the common sha256 form, not a second spelling of it", () => {
    expect(schema.$defs.excerptDigest).toEqual({
      type: "string",
      pattern: String(common.$defs.sha256?.pattern),
    });
  });

  test("the semantics document names every form and its pointer", () => {
    for (const name of FORM_NAMES) {
      expect(semantics).toContain(`\`#/$defs/${name}\``);
    }
  });

  test("every form is broken by at least one negative schema fixture", () => {
    const entry = fixtures.cases.find((item) => item.schema === "rule-common.v1.schema.json");
    expect(entry).toBeDefined();
    const broken = new Set(entry?.invalidMutations.map((mutation) => mutation.path.slice(1)));
    for (const name of FORM_NAMES) expect(broken.has(name)).toBe(true);
  });
});

// Expected verdicts come from the plan's rule-context lot definitions, not from the schema:
// L011 (version component of 10 digits refused), L012 (digest = 64 hex), L013 (locator
// percent-encoding unique, R%41 refused, ".hidden" written %2Ehidden, anchor a<12 hex>
// with suffix .n), L019/L025 (trigger forms glob=, keyword=, type=), L028 (five levels).
const VECTORS: readonly { form: FormName; value: string; admitted: boolean; source: string }[] = [
  { form: "ruleId", value: "src:doc#R%41", admitted: false, source: "L013 R%41" },
  { form: "ruleId", value: "src:doc#RA", admitted: true, source: "L013 R%41 spelled plainly" },
  { form: "ruleId", value: "src:doc#.hidden", admitted: false, source: "L013 .hidden" },
  { form: "ruleId", value: "src:doc#%2Ehidden", admitted: true, source: "L013 %2Ehidden" },
  { form: "ruleId", value: "src:doc#%2ehidden", admitted: false, source: "L013 unique encoding" },
  { form: "ruleId", value: "src:doc#a%2Eb", admitted: false, source: "L013 unique encoding" },
  { form: "ruleId", value: "src:doc#R%20x", admitted: true, source: "L013 native encoding" },
  { form: "ruleId", value: "src:doc#a0123456789ab", admitted: true, source: "L013 anchor" },
  { form: "ruleId", value: "src:doc#a0123456789ab.2", admitted: true, source: "L013 .n" },
  { form: "ruleId", value: "src:doc", admitted: false, source: "L013 source:key#locator" },
  { form: "ruleId", value: "src#R1", admitted: false, source: "L013 source:key#locator" },
  { form: "ruleId", value: "src:doc#", admitted: false, source: "L013 source:key#locator" },
  { form: "excerptDigest", value: "a".repeat(64), admitted: true, source: "L012 64 hex" },
  { form: "excerptDigest", value: "a".repeat(65), admitted: false, source: "L012 64 hex" },
  { form: "excerptDigest", value: "A".repeat(64), admitted: false, source: "common sha256" },
  { form: "edition", value: "123456789", admitted: true, source: "L011 nine digits" },
  { form: "edition", value: "1234567890", admitted: false, source: "L011 ten digits" },
  { form: "edition", value: "4.0.123456789", admitted: true, source: "L011 nine digits" },
  { form: "edition", value: "4.0.1234567890", admitted: false, source: "L011 ten digits" },
  { form: "level", value: "MUST", admitted: true, source: "L015/L019" },
  { form: "level", value: "MUST_NOT", admitted: true, source: "L019" },
  { form: "level", value: "SHOULD", admitted: true, source: "L015" },
  { form: "level", value: "should", admitted: false, source: "closed list" },
  { form: "triggerType", value: "glob", admitted: true, source: "L025 glob=" },
  { form: "triggerType", value: "keyword", admitted: true, source: "L025 mot-cle=" },
  { form: "triggerType", value: "type", admitted: true, source: "L025 type=" },
  { form: "triggerType", value: "regex", admitted: false, source: "closed list" },
];

describe("rule-common.v1 verdicts fixed by the rule-context sources", () => {
  for (const vector of VECTORS) {
    test(`${vector.form} ${JSON.stringify(vector.value)} (${vector.source})`, () => {
      expect(formValidator(vector.form)(vector.value)).toBe(vector.admitted);
      // A reader of the leaf alone reaches the same verdict as the schema engine (R2).
      expect(leafAdmits(vector.form, vector.value)).toBe(vector.admitted);
    });
  }

  test("the rule identifier is bounded at 512 code points", () => {
    const prefix = "src:doc#";
    const atBound = prefix + "R".repeat(512 - prefix.length);
    expect(formValidator("ruleId")(atBound)).toBe(true);
    expect(formValidator("ruleId")(`${atBound}R`)).toBe(false);
  });

  test("the level list is the five levels, in their stated order", () => {
    expect(schema.$defs.level).toEqual({
      enum: ["MUST", "MUST_NOT", "SHOULD", "SHOULD_NOT", "MAY"],
    });
  });

  test("the trigger type list is the three trigger kinds", () => {
    expect(schema.$defs.triggerType).toEqual({ enum: ["glob", "keyword", "type"] });
  });
});
