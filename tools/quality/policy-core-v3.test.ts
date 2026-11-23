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
  POLICY_CORE_V2_GOLDEN_PATH,
  POLICY_CORE_V3_ENGINE_VERSION,
  POLICY_CORE_V3_GOLDEN_PATH,
  POLICY_CORE_V3_RAW_INPUT_ROOT,
  policyEvaluationDigest,
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

describe("policy-core-v3 raw-input vectors", () => {
  test("every case is refused with its declared class, every v2 case is carried", async () => {
    const result = await verifyPolicyCoreV3RawInputVectors(POLICY_CORE_V3_RAW_INPUT_ROOT);
    console.log(
      `policy-core-v3 raw inputs: ${result.inspected} case(s) inspected, ` +
        `${result.carriedFromV2} carried from policy-core-v2`,
    );
    expect(result.failures).toEqual([]);
    expect(result.carriedFromV2).toBe(9);
    expect(result.inspected).toBeGreaterThan(result.carriedFromV2);
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

describe("policy-core-v3 base text", () => {
  test("the semantics names the exact bytes of the locked policy-core-v2 text it amends", async () => {
    const v3Semantics = await Bun.file("contracts/wit/policy-core-v3/SEMANTICS.md").text();
    const v2Bytes = await Bun.file("contracts/wit/policy-core-v2/SEMANTICS.md").bytes();
    const pinned = /whose SHA-256 is\s+`([0-9a-f]{64})`/.exec(v3Semantics)?.[1];
    expect(pinned).toBe(new Bun.CryptoHasher("sha256").update(v2Bytes).digest("hex"));
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
