import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  decodeStrictJson,
  decodeStrictJsonGrammarFirst,
  type RawDefect,
  StrictJsonError,
  verifyPolicyCoreRawInputVectors,
} from "./policy-core-raw-inputs";
import {
  POLICY_CORE_V2_BUDGETS_PATH,
  POLICY_CORE_V2_GOLDEN_PATH,
  POLICY_CORE_V3_ENGINE_VERSION,
  POLICY_CORE_V3_GOLDEN_PATH,
  POLICY_CORE_V3_MEMORY_QUALIFICATION_PATH,
  POLICY_CORE_V3_RAW_INPUT_ROOT,
  policyEvaluationDigest,
  verifyPolicyCoreV3MemoryQualification,
  verifyPolicyCoreV3RawInputVectors,
} from "./policy-core-v3";

// policy-core-v3 differs from the locked policy-core-v2 by its decoder precedence and its
// engine version (contracts/wit/policy-core-v3/SEMANTICS.md, changes C1 and C2). The expected
// classes below are written from RFC 8259 and that semantics, never from a reader's output.

type JsonRecord = Record<string, unknown>;

const encoder = new TextEncoder();

function defectOf(decode: (bytes: Uint8Array) => unknown, bytes: Uint8Array): RawDefect | "ok" {
  try {
    decode(bytes);
    return "ok";
  } catch (error) {
    if (error instanceof StrictJsonError) return error.defect;
    throw error;
  }
}

function bytesOf(text: string): Uint8Array {
  return encoder.encode(text);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function without(record: JsonRecord, names: readonly string[]): JsonRecord {
  return Object.fromEntries(Object.entries(record).filter(([name]) => !names.includes(name)));
}

describe("policy-core-v3 decoder precedence (change C2)", () => {
  // [input, class under v3]. Rows marked RFC 8259 are not JSON texts; the others are.
  const cases: [string, Uint8Array, RawDefect | "ok"][] = [
    ["RFC 8259: letter after a number", bytesOf("[1x]"), "invalid-json"],
    ["RFC 8259: \\u escape without hex digits", bytesOf('"\\ud800\\uZZZZ"'), "invalid-json"],
    ["RFC 8259: content after a lone surrogate", bytesOf('{"value":"\\uD800"}x'), "invalid-json"],
    ["RFC 8259: trailing comma after a duplicate", bytesOf('{"key":1,"key":2,}'), "invalid-json"],
    ["RFC 8259: leading zero", bytesOf('{"value":01}'), "invalid-json"],
    ["RFC 8259: plus sign", bytesOf('{"value":+1}'), "invalid-json"],
    ["RFC 8259: NaN", bytesOf('{"value":NaN}'), "invalid-json"],
    ["RFC 8259: fraction without digits", bytesOf('{"value":1.}'), "invalid-json"],
    ["grammatical lone high surrogate", bytesOf('{"value":"\\uD800"}'), "unpaired-surrogate"],
    ["grammatical lone low surrogate", bytesOf('{"value":"\\uDC00"}'), "unpaired-surrogate"],
    ["grammatical duplicate member", bytesOf('{"key":1,"\\u006bey":2}'), "duplicate-member"],
    ["grammatical non-finite number", bytesOf('{"value":1e400}'), "invalid-number"],
    ["first semantic defect in order", bytesOf('{"a":"\\uD800","a":1}'), "unpaired-surrogate"],
    ["byte order mark before a syntax error", Uint8Array.of(0xef, 0xbb, 0xbf, 0x5b), "bom"],
    ["invalid UTF-8 before a syntax error", Uint8Array.of(0x5b, 0xff), "invalid-utf8"],
    ["grammatical fraction", bytesOf('{"value":1.5,"pair":"\\uD834\\uDD1E"}'), "ok"],
  ];

  for (const [label, bytes, expected] of cases) {
    test(`${label} gives ${expected}`, () => {
      expect(defectOf(decodeStrictJsonGrammarFirst, bytes)).toBe(expected);
    });
  }

  test("the policy-core-v2 decoder keeps its own classes", () => {
    // v2 stays locked: its non-JSON numbers remain invalid-number, its first defect wins.
    expect(defectOf(decodeStrictJson, bytesOf('{"value":01}'))).toBe("invalid-number");
    expect(defectOf(decodeStrictJson, bytesOf("[1x]"))).toBe("invalid-number");
    expect(defectOf(decodeStrictJson, bytesOf('{"value":"\\uD800"}x'))).toBe("unpaired-surrogate");
  });

  test("the policy-core-v2 raw-input vectors still verify against the v2 decoder", async () => {
    const failures: string[] = [];
    const inspected = await verifyPolicyCoreRawInputVectors(failures, "policy-core-v2");
    console.log(`policy-core-v2 raw inputs: ${inspected} case(s) inspected`);
    expect(failures).toEqual([]);
    expect(inspected).toBe(9);
  });
});

describe("policy-core-v3 nesting depth (section 2, depth paragraph)", () => {
  // The top-level value has depth 0; a value inside an array or an object has the depth of
  // that container plus 1, scalars included; a value deeper than 64 is max-depth.
  const nest = (open: string, inner: string, close: string, count: number, after = "") =>
    bytesOf(`${open.repeat(count)}${inner}${close.repeat(count)}${after}`);
  const cases: [string, Uint8Array, RawDefect | "ok"][] = [
    ["a scalar at depth 64", nest("[", "0", "]", 64), "ok"],
    ["a scalar at depth 65", nest("[", "0", "]", 65), "max-depth"],
    ["an empty array at depth 64", nest("[", "", "]", 65), "ok"],
    ["an empty array at depth 65", nest("[", "", "]", 66), "max-depth"],
    ["a member value at depth 64", nest('{"a":', "0", "}", 64), "ok"],
    ["a member value at depth 65", nest('{"a":', "0", "}", 65), "max-depth"],
    ["a grammar defect after a value at depth 65", nest("[", "0", "]", 65, "x"), "invalid-json"],
    ["depth 65 before a lone surrogate", nest("[", '"\\uD800"', "]", 65), "max-depth"],
    ["depth 65 on a non-finite number: same octet", nest("[", "1e400", "]", 65), "max-depth"],
    ["a non-finite number at depth 64", nest("[", "1e400", "]", 64), "invalid-number"],
  ];

  for (const [label, bytes, expected] of cases) {
    test(`${label} gives ${expected}`, async () => {
      const depth = await maximumJsonDepth();
      expect(defectOf((input) => decodeStrictJsonGrammarFirst(input, depth), bytes)).toBe(expected);
    });
  }
});

async function maximumJsonDepth(): Promise<number> {
  const budgets = (await Bun.file(POLICY_CORE_V2_BUDGETS_PATH).json()) as JsonRecord;
  const qualification = budgets.decoderQualification as JsonRecord;
  return qualification.maximumJsonDepth as number;
}

describe("policy-core-v3 raw-input vectors", () => {
  test("every case is refused with its declared class, every v2 case is carried", async () => {
    const result = await verifyPolicyCoreV3RawInputVectors(POLICY_CORE_V3_RAW_INPUT_ROOT);
    console.log(
      `policy-core-v3 raw inputs: ${result.inspected} case(s) inspected, ` +
        `${result.carriedFromV2} carried from policy-core-v2, ${result.accepted} accepted`,
    );
    expect(result.failures).toEqual([]);
    expect(result.carriedFromV2).toBe(9);
    expect(result.inspected).toBeGreaterThan(result.carriedFromV2);
    expect(result.accepted).toBe(3);
    expect(result.carriers).toBe(5);
  });

  test("a permissive JSON.parse decoder returns the golden input on carrier vectors", async () => {
    // The decoder of a fetch Response: UTF-8 without fatal errors, byte order mark dropped,
    // JSON.parse, last duplicate member kept. On a carrier it yields the exact golden input,
    // so a component built on it evaluates instead of returning input-invalid.
    const manifest = (await Bun.file(
      join(POLICY_CORE_V3_RAW_INPUT_ROOT, "manifest.json"),
    ).json()) as JsonRecord;
    const { cases: golden } = await goldenCases(POLICY_CORE_V3_GOLDEN_PATH);
    const defeated: string[] = [];
    for (const entry of manifest.cases as JsonRecord[]) {
      if (entry.argument === undefined) continue;
      const bytes = await Bun.file(
        join(POLICY_CORE_V3_RAW_INPUT_ROOT, entry.file as string),
      ).bytes();
      const goldenCase = golden.find((candidate) => candidate.id === entry.goldenCase);
      if (goldenCase === undefined) throw new Error(`${String(entry.id)}: golden case missing`);
      let decoded: unknown;
      try {
        decoded = JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        continue;
      }
      expect(decoded).toEqual(goldenCase[entry.argument as string]);
      defeated.push(entry.defect as string);
    }
    expect(defeated.sort()).toEqual([
      "bom",
      "duplicate-member",
      "invalid-number",
      "unpaired-surrogate",
    ]);
  });

  test("the depth vectors fail an oracle that counts the top-level value as depth 1", async () => {
    const depth = await maximumJsonDepth();
    const shifted = await verifyPolicyCoreV3RawInputVectors(
      POLICY_CORE_V3_RAW_INPUT_ROOT,
      undefined,
      depth - 1,
    );
    expect(shifted.failures.some((failure) => failure.includes("accepted case refused"))).toBe(
      true,
    );
    const unbounded = await verifyPolicyCoreV3RawInputVectors(
      POLICY_CORE_V3_RAW_INPUT_ROOT,
      undefined,
      Number.MAX_SAFE_INTEGER,
    );
    expect(unbounded.failures.some((failure) => failure.includes("accepted forbidden input"))).toBe(
      true,
    );
  });

  test("the memory qualification inputs are generated at the input ceiling", async () => {
    const result = await verifyPolicyCoreV3MemoryQualification(
      POLICY_CORE_V3_MEMORY_QUALIFICATION_PATH,
    );
    console.log(`policy-core-v3 memory qualification: ${result.inspected} input(s) generated`);
    expect(result.failures).toEqual([]);
    expect(result.inspected).toBe(3);
  });

  test("an absent memory qualification file is a failure", async () => {
    const result = await verifyPolicyCoreV3MemoryQualification("contracts/absent.json");
    expect(result.inspected).toBe(0);
    expect(result.failures.length).toBeGreaterThan(0);
  });

  test("an absent manifest is a failure, never an empty set", async () => {
    const scratch = await mkdtemp(join(tmpdir(), "policy-core-v3-"));
    try {
      const result = await verifyPolicyCoreV3RawInputVectors(scratch);
      expect(result.inspected).toBe(0);
      expect(result.failures.length).toBeGreaterThan(0);
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
  });
});

const V2_SEMANTICS_PATH = "contracts/wit/policy-core-v2/SEMANTICS.md";
const V3_SEMANTICS_PATH = "contracts/wit/policy-core-v3/SEMANTICS.md";
const CHANGES_HEADING = "Changes from policy-core-v2 (not normative)";

/** Numbered sections (`## 1. …`) and the blank-line-separated blocks of their bodies. */
function numberedSections(text: string): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  for (const part of text.split(/^## /m).slice(1)) {
    const newline = part.indexOf("\n");
    const heading = part.slice(0, newline).trim();
    if (!/^\d+\. /.test(heading)) continue;
    const blocks = part
      .slice(newline + 1)
      .split(/\n[ \t]*\n/)
      .map((block) => block.trim())
      .filter((block) => block.length > 0);
    sections.set(heading, blocks);
  }
  return sections;
}

interface DeclaredChanges {
  sections: Set<string>;
  replacedFirstLines: string[];
  addedFirstLines: string[];
}

/**
 * The change record: per change, `Sections: 1, 2.`, then under `Replaced policy-core-v2
 * blocks:` the first line of each v2 block it removes and under `Added blocks:` the first
 * line of each block it adds, one `> ` line each. A quote outside those two lists is an error.
 */
function declaredChanges(text: string): DeclaredChanges {
  const start = text.indexOf(`## ${CHANGES_HEADING}`);
  if (start < 0) throw new Error("the semantics has no change record");
  const record = text.slice(start);
  const declared: DeclaredChanges = {
    sections: new Set<string>(),
    replacedFirstLines: [],
    addedFirstLines: [],
  };
  let list: string[] | null = null;
  for (const line of record.split("\n")) {
    const sections = /^Sections: ([0-9, ]+)\.$/.exec(line);
    if (sections !== null)
      for (const number of (sections[1] as string).split(",")) declared.sections.add(number.trim());
    if (/^Replaced policy-core-v2 blocks?:$/.test(line)) list = declared.replacedFirstLines;
    else if (/^Added blocks?:$/.test(line)) list = declared.addedFirstLines;
    else if (line.startsWith("> ")) {
      if (list === null) throw new Error(`quoted line outside a block list: ${line}`);
      list.push(line.slice(2));
    } else if (line.trim() !== "") list = null;
  }
  return declared;
}

describe("policy-core-v3 consolidated semantics", () => {
  test("the change record names the exact bytes of the policy-core-v2 text it derives from", async () => {
    const v3Semantics = await Bun.file(V3_SEMANTICS_PATH).text();
    const v2Bytes = await Bun.file(V2_SEMANTICS_PATH).bytes();
    const pinned = /whose SHA-256 is\s+`([0-9a-f]{64})`/.exec(v3Semantics)?.[1];
    expect(pinned).toBe(new Bun.CryptoHasher("sha256").update(v2Bytes).digest("hex"));
  });

  test("policy-core-v2 plus the declared changes C1 to C4 is the consolidated text", async () => {
    const v2 = numberedSections(await Bun.file(V2_SEMANTICS_PATH).text());
    const v3Text = await Bun.file(V3_SEMANTICS_PATH).text();
    const v3 = numberedSections(v3Text);
    expect([...v3.keys()]).toEqual([...v2.keys()]);
    expect(v2.size).toBe(10);

    const removedFirstLines: string[] = [];
    const addedFirstLines: string[] = [];
    const touched = new Set<string>();
    let unchangedBlocks = 0;
    for (const [heading, v2Blocks] of v2) {
      const v3Blocks = v3.get(heading) ?? [];
      const removed = v2Blocks.filter((block) => !v3Blocks.includes(block));
      const added = v3Blocks.filter((block) => !v2Blocks.includes(block));
      unchangedBlocks += v2Blocks.length - removed.length;
      for (const block of removed) removedFirstLines.push(block.split("\n")[0] as string);
      for (const block of added) addedFirstLines.push(block.split("\n")[0] as string);
      if (removed.length > 0 || added.length > 0) touched.add(heading.split(".")[0] as string);
    }
    const declared = declaredChanges(v3Text);
    console.log(
      `policy-core-v3 semantics: ${unchangedBlocks} v2 block(s) kept verbatim, ` +
        `${removedFirstLines.length} replaced, ${addedFirstLines.length} added, ` +
        `sections touched: ${[...touched].join(", ")}`,
    );
    expect([...declared.replacedFirstLines].sort()).toEqual([...removedFirstLines].sort());
    expect([...declared.addedFirstLines].sort()).toEqual([...addedFirstLines].sort());
    expect([...declared.sections].sort()).toEqual([...touched].sort());
  });

  test("no sentence of the consolidated text binds the policy-core-v2 world", async () => {
    const v3Text = await Bun.file(V3_SEMANTICS_PATH).text();
    const normative = v3Text.slice(0, v3Text.indexOf(`## ${CHANGES_HEADING}`));
    expect(normative).not.toContain("policy-core@2.0.0");
    expect(normative).not.toContain("v2 HTTP boundary");
    expect(normative).not.toContain("conform to policy-core-v2");
    expect(normative).not.toContain("matches exactly");
  });

  test("no normative sentence depends on a test file or carries a dated measurement", async () => {
    const v3Text = await Bun.file(V3_SEMANTICS_PATH).text();
    const normative = v3Text.slice(0, v3Text.indexOf(`## ${CHANGES_HEADING}`));
    expect(normative).not.toMatch(/\.test\.ts|\/tests\/|\btest\b/);
    expect(normative).not.toMatch(/\b\d{4}-\d{2}-\d{2}\b(?!T)/);
    expect(normative).not.toMatch(/\bmeasure/i);
  });
});

async function goldenCases(path: string): Promise<{ golden: JsonRecord; cases: JsonRecord[] }> {
  const golden = (await Bun.file(path).json()) as JsonRecord;
  return { golden, cases: (Array.isArray(golden.cases) ? golden.cases : []) as JsonRecord[] };
}

describe("policy-core-v3 golden vectors (change C1)", () => {
  test("the digest instrument reproduces every policy-core-v2 evaluation digest", async () => {
    const { cases: v2Cases } = await goldenCases(POLICY_CORE_V2_GOLDEN_PATH);
    let evaluations = 0;
    for (const entry of v2Cases) {
      const evaluation = entry.expectedEvaluation;
      if (!isRecord(evaluation)) continue;
      evaluations += 1;
      expect(policyEvaluationDigest(without(evaluation, ["id", "digest"]))).toBe(
        evaluation.digest as string,
      );
    }
    expect(evaluations).toBeGreaterThan(0);
  });

  test("the v3 golden is the v2 golden with engine version 3.0.0 and its own digests", async () => {
    const { golden: v2, cases: v2Cases } = await goldenCases(POLICY_CORE_V2_GOLDEN_PATH);
    const { golden: v3, cases: v3Cases } = await goldenCases(POLICY_CORE_V3_GOLDEN_PATH);
    expect(v3.schemaVersion).toBe("libre-ai.policy-core-golden-vectors.v3");
    expect(v3.engineVersion).toBe(POLICY_CORE_V3_ENGINE_VERSION);
    expect(v3.semantics).toBe("contracts/wit/policy-core-v3/SEMANTICS.md");
    expect(without(v3, ["schemaVersion", "engineVersion", "semantics", "cases"])).toEqual(
      without(v2, ["schemaVersion", "engineVersion", "semantics", "cases"]),
    );
    expect(v3Cases.length).toBe(v2Cases.length);
    expect(v3Cases.length).toBeGreaterThan(0);
    let evaluations = 0;
    v2Cases.forEach((v2Case, index) => {
      const v3Case = v3Cases[index] as JsonRecord;
      expect(without(v3Case, ["expectedEvaluation"])).toEqual(
        without(v2Case, ["expectedEvaluation"]),
      );
      const v2Evaluation = v2Case.expectedEvaluation;
      const v3Evaluation = v3Case.expectedEvaluation;
      if (!isRecord(v2Evaluation)) {
        expect(v3Evaluation).toBeUndefined();
        return;
      }
      if (!isRecord(v3Evaluation)) throw new Error(`${String(v3Case.id)}: evaluation missing`);
      evaluations += 1;
      const changed = ["engineVersion", "id", "digest"];
      expect(without(v3Evaluation, changed)).toEqual(without(v2Evaluation, changed));
      expect(v3Evaluation.engineVersion).toBe(POLICY_CORE_V3_ENGINE_VERSION);
      const digest = policyEvaluationDigest(without(v3Evaluation, ["id", "digest"]));
      expect(v3Evaluation.digest).toBe(digest);
      expect(v3Evaluation.id).toBe(`urn:libre-ai:evaluation:${digest}`);
      expect(v3Evaluation.digest).not.toBe(v2Evaluation.digest);
    });
    console.log(`policy-core-v3 golden: ${v3Cases.length} case(s), ${evaluations} evaluation(s)`);
  });
});
