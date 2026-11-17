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

/**
 * A reader R2 forbids: lengths on the whole value, but `$` also matching before one
 * final LF (Python `re.match`, PCRE without `D`). Used to show which forms stay safe
 * without the whole-value rule.
 */
function dollarBeforeFinalNewlineReaderAdmits(name: FormName, value: string): boolean {
  const leaf = schema.$defs[name];
  if (leaf === undefined) throw new Error(`rule-common.v1: $defs/${name} is missing`);
  const length = [...value].length;
  if (typeof leaf.minLength === "number" && length < leaf.minLength) return false;
  if (typeof leaf.maxLength === "number" && length > leaf.maxLength) return false;
  const body = value.endsWith("\n") ? value.slice(0, -1) : value;
  return new RegExp(String(leaf.pattern), "u").test(body);
}

const VALID_SAMPLES: Readonly<Record<Exclude<FormName, "level" | "triggerType">, string>> = {
  ruleId: "src:doc#R1",
  excerptDigest: "a".repeat(64),
  slug: "src",
  edition: "4.0.3",
  overlayReference: "pub/notes@3",
};

// Decision A of the 2026-11-17 review round, written from its text and not from the
// pattern: a locator is a sequence of unreserved ASCII characters and `%XY` escapes
// (uppercase hex); an escape may encode only a printable ASCII octet (0x20-0x7E) that
// is not unreserved, `/` (0x2F) or `\` (0x5C), except `%2E` in first position; a
// literal `.` may not open the locator; and the decoded locator is neither `.` nor `..`
// and does not start with `..`.
const UNRESERVED = /^[A-Za-z0-9._~-]$/;
function locatorRuleAdmits(locator: string): boolean {
  const octets: number[] = [];
  let index = 0;
  while (index < locator.length) {
    const character = locator.charAt(index);
    if (character === "%") {
      const hex = locator.slice(index + 1, index + 3);
      if (!/^[0-9A-F]{2}$/.test(hex)) return false;
      const octet = Number.parseInt(hex, 16);
      const printable = octet >= 0x20 && octet <= 0x7e;
      const unreserved = UNRESERVED.test(String.fromCharCode(octet));
      const leadingDot = octet === 0x2e && index === 0;
      if (!printable || octet === 0x2f || octet === 0x5c) return false;
      if (unreserved && !leadingDot) return false;
      octets.push(octet);
      index += 3;
      continue;
    }
    if (!UNRESERVED.test(character)) return false;
    if (character === "." && index === 0) return false;
    octets.push(character.charCodeAt(0));
    index += 1;
  }
  if (octets.length === 0) return false;
  const decoded = String.fromCharCode(...octets);
  return decoded !== "." && decoded !== ".." && !decoded.startsWith("..");
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

  test("the excerpt digest is the common sha256 pattern, bounded to exactly 64 code points", () => {
    // Same pattern as common.v1 sha256 (one spelling), plus 64/64 bounds that common.v1
    // does not carry: they refuse a trailing LF even under a reader whose `$` matches
    // before a final line break (R2).
    expect(schema.$defs.excerptDigest).toEqual({
      type: "string",
      minLength: 64,
      maxLength: 64,
      pattern: String(common.$defs.sha256?.pattern),
    });
  });

  test("no pattern can match a line feed: no negated class, no shorthand, no bare dot", () => {
    for (const name of FORM_NAMES) {
      const leaf = schema.$defs[name] as JsonObject;
      if (!("pattern" in leaf)) continue;
      const pattern = String(leaf.pattern);
      expect(pattern).not.toMatch(/\[\^|\\[sSwWdDnRN]|\\u|\\x|\\p/);
      // Outside character classes and escapes, a `.` would match any code point.
      const outsideClasses = pattern.replace(/\\./g, "").replace(/\[[^\]]*\]/g, "");
      expect(outsideClasses).not.toContain(".");
    }
  });

  test("every string form refuses a trailing LF under a whole-value reader (R2)", () => {
    for (const [name, value] of Object.entries(VALID_SAMPLES) as [FormName, string][]) {
      expect(formValidator(name)(value)).toBe(true);
      expect(leafAdmits(name, value)).toBe(true);
      expect(formValidator(name)(`${value}\n`)).toBe(false);
      expect(leafAdmits(name, `${value}\n`)).toBe(false);
    }
  });

  test("the excerpt digest refuses a trailing LF even where `$` matches before it", () => {
    const value = `${"a".repeat(64)}\n`;
    expect(dollarBeforeFinalNewlineReaderAdmits("excerptDigest", value)).toBe(false);
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
  { form: "ruleId", value: "src:doc#R%00x", admitted: false, source: "A control octet" },
  { form: "ruleId", value: "src:doc#R%1F", admitted: false, source: "A control octet" },
  { form: "ruleId", value: "src:doc#a%0A", admitted: false, source: "A encoded LF" },
  { form: "ruleId", value: "src:doc#a%0D", admitted: false, source: "A encoded CR" },
  { form: "ruleId", value: "src:doc#R%7F", admitted: false, source: "A DEL" },
  { form: "ruleId", value: "src:doc#a%2Fb", admitted: false, source: "A encoded slash" },
  { form: "ruleId", value: "src:doc#%2F", admitted: false, source: "A encoded slash" },
  { form: "ruleId", value: "src:doc#a%5Cb", admitted: false, source: "A encoded backslash" },
  { form: "ruleId", value: "src:doc#%2E", admitted: false, source: "A decodes to ." },
  { form: "ruleId", value: "src:doc#%2E.", admitted: false, source: "A decodes to .." },
  { form: "ruleId", value: "src:doc#%2E.x", admitted: false, source: "A starts with .." },
  { form: "ruleId", value: "src:doc#%2E%2Ex", admitted: false, source: "A starts with .." },
  { form: "ruleId", value: "src:doc#a..b", admitted: true, source: "A inner dots" },
  { form: "ruleId", value: "src:doc#%C3%A9", admitted: false, source: "A UTF-8 octet" },
  { form: "ruleId", value: "src:doc#a%80", admitted: false, source: "A high octet" },
  { form: "ruleId", value: "src:doc#a%FF", admitted: false, source: "A high octet" },
  { form: "ruleId", value: "src:doc#a%C2%A0b", admitted: false, source: "A encoded NBSP" },
  { form: "ruleId", value: "src:doc#%EF%BB%BFa", admitted: false, source: "A encoded BOM" },
  { form: "ruleId", value: "src:doc#a%E2%80%AEb", admitted: false, source: "A encoded bidi" },
  { form: "ruleId", value: "src:doc#a\u{a0}b", admitted: false, source: "A raw NBSP" },
  { form: "ruleId", value: "src:doc#R%7Bx", admitted: true, source: "A printable reserved" },
  { form: "ruleId", value: "src:doc#R%25", admitted: true, source: "A printable reserved" },
  { form: "ruleId", value: "src:doc#R1\n", admitted: false, source: "B trailing LF" },
  { form: "slug", value: "src\n", admitted: false, source: "B trailing LF" },
  { form: "edition", value: "2021.3", admitted: true, source: "D2 dated 2021-03" },
  { form: "edition", value: "2021-03", admitted: false, source: "D2 transcription" },
  { form: "edition", value: "2021.03", admitted: false, source: "D2 transcription" },
  { form: "edition", value: "v4.0.3", admitted: false, source: "D2 transcription" },
  {
    form: "overlayReference",
    value: `pub/notes@1${"0".repeat(15)}`,
    admitted: true,
    source: "D3 sixteen digits like the L107 snapshot version",
  },
  {
    form: "overlayReference",
    value: `pub/notes@1${"0".repeat(16)}`,
    admitted: false,
    source: "D3 seventeen digits",
  },
  { form: "overlayReference", value: "pub/notes@03", admitted: false, source: "D3 leading 0" },
  { form: "level", value: "SHOULD_NOT", admitted: true, source: "D4" },
  { form: "level", value: "MAY", admitted: true, source: "D4" },
  { form: "level", value: "MUST NOT", admitted: false, source: "D4 space" },
  { form: "level", value: "may", admitted: false, source: "D4 lowercase" },
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

  test("the locator bound is 512 minus the source:key# prefix, at most 508 (D1)", () => {
    const shortest = "a:b#";
    expect(formValidator("ruleId")(shortest + "R".repeat(508))).toBe(true);
    expect(formValidator("ruleId")(shortest + "R".repeat(509))).toBe(false);
  });

  test("every single escape, in every position, follows decision A", () => {
    // Expected verdicts from locatorRuleAdmits (the text of decision A), never from the
    // pattern; 256 octets x 4 positions.
    for (let octet = 0; octet <= 0xff; octet += 1) {
      const percent = `%${octet.toString(16).toUpperCase().padStart(2, "0")}`;
      for (const locator of [percent, `${percent}a`, `a${percent}`, `${percent}.`]) {
        const value = `src:doc#${locator}`;
        const expected = locatorRuleAdmits(locator);
        expect({ value, admitted: formValidator("ruleId")(value) }).toEqual({
          value,
          admitted: expected,
        });
        expect(leafAdmits("ruleId", value)).toBe(expected);
      }
    }
  });

  test("the oracle of decision A agrees with its own vectors", () => {
    for (const vector of VECTORS) {
      if (vector.form !== "ruleId" || !vector.value.startsWith("src:doc#")) continue;
      expect(locatorRuleAdmits(vector.value.slice("src:doc#".length))).toBe(vector.admitted);
    }
  });

  // Decision locks: these lists were closed by the owner on 2026-11-17 (D4, D5). A change
  // here is a contract decision recorded in the ADR, not a test to update.
  test("decision lock (D4): the level list is the five levels, in their stated order", () => {
    expect(schema.$defs.level).toEqual({
      enum: ["MUST", "MUST_NOT", "SHOULD", "SHOULD_NOT", "MAY"],
    });
  });

  test("decision lock (D5): the trigger type list is the three trigger kinds", () => {
    expect(schema.$defs.triggerType).toEqual({ enum: ["glob", "keyword", "type"] });
  });
});
