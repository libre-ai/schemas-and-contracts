import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";
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

interface Insertion {
  /** Octet offset in the reference where the run is inserted. */
  offset: number;
  run: Uint8Array;
}

/**
 * Every reading of `bytes` as `reference` with one non-empty run of octets inserted and nothing
 * else changed: several when the run borders octets equal to its own; none if there is no such
 * reading.
 */
function insertions(reference: Uint8Array, bytes: Uint8Array): Insertion[] {
  const extra = bytes.length - reference.length;
  if (extra <= 0) return [];
  let prefix = 0;
  while (prefix < reference.length && reference[prefix] === bytes[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < reference.length &&
    reference[reference.length - 1 - suffix] === bytes[bytes.length - 1 - suffix]
  )
    suffix += 1;
  const readings: Insertion[] = [];
  for (let offset = Math.max(0, reference.length - suffix); offset <= prefix; offset += 1)
    readings.push({ offset, run: bytes.subarray(offset, offset + extra) });
  return readings;
}

/** `octets` as one character per octet, without spreading them on the call stack. */
function latin1(octets: Uint8Array): string {
  let text = "";
  for (const octet of octets) text += String.fromCharCode(octet);
  return text;
}

function sameOctets(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((octet, at) => octet === right[at]);
}

const OUTSIDE = 0;
const IN_STRING = 1;
const IN_ESCAPE = 2;

/**
 * One pass over the compact JSON `text`: for each offset from 0 to its length, whether it
 * falls outside every string, between two characters of a string or inside an escape, and the
 * start of the innermost object or array open there (-1 for none). Every reading of a carrier
 * is then checked without walking the reference again.
 */
interface ReferenceIndex {
  text: Uint8Array;
  place: Uint8Array;
  container: Int32Array;
  /** The octets of each member of an object, by the offset of its `{`, computed once. */
  members: Map<number, Uint8Array[]>;
}

function indexReference(text: Uint8Array): ReferenceIndex {
  const place = new Uint8Array(text.length + 1);
  const container = new Int32Array(text.length + 1);
  const open: number[] = [];
  let inString = false;
  let escaped = false;
  let hexLeft = 0;
  for (let index = 0; index <= text.length; index += 1) {
    place[index] = !inString ? OUTSIDE : escaped || hexLeft > 0 ? IN_ESCAPE : IN_STRING;
    container[index] = open.at(-1) ?? -1;
    const octet = text[index];
    if (octet === undefined) break;
    if (inString) {
      if (hexLeft > 0) hexLeft -= 1;
      else if (escaped) {
        escaped = false;
        if (octet === 0x75) hexLeft = 4;
      } else if (octet === 0x5c) escaped = true;
      else if (octet === 0x22) inString = false;
    } else if (octet === 0x22) inString = true;
    else if (octet === 0x7b || octet === 0x5b) open.push(index);
    else if (octet === 0x7d || octet === 0x5d) open.pop();
  }
  return { text, place, container, members: new Map() };
}

/** The octets of each member of the object that opens at `start`, as `"name":value`. */
function membersAt(index: ReferenceIndex, start: number): Uint8Array[] {
  const known = index.members.get(start);
  if (known !== undefined) return known;
  const members: Uint8Array[] = [];
  let depth = 0;
  let memberStart = start + 1;
  for (let at = start + 1; at < index.text.length; at += 1) {
    if (index.place[at] !== OUTSIDE) continue;
    const octet = index.text[at];
    if (octet === 0x7b || octet === 0x5b) depth += 1;
    else if (octet === 0x7d || octet === 0x5d) {
      if (depth === 0) {
        if (at > memberStart) members.push(index.text.subarray(memberStart, at));
        break;
      }
      depth -= 1;
    } else if (octet === 0x2c && depth === 0) {
      members.push(index.text.subarray(memberStart, at));
      memberStart = at + 1;
    }
  }
  index.members.set(start, members);
  return members;
}

/** The `"name"` token that opens `member`, escapes included, or null. */
function nameToken(member: Uint8Array): Uint8Array | null {
  if (member[0] !== 0x22) return null;
  for (let at = 1; at < member.length; at += 1) {
    if (member[at] === 0x5c) at += 1;
    else if (member[at] === 0x22) return member.subarray(0, at + 1);
  }
  return null;
}

/**
 * The member a run inserts at a member boundary of an object: `member,` right after its `{`,
 * or, unless `leadingOnly`, `,member` before a `,` or its `}`. Null anywhere else.
 */
function insertedMember(
  index: ReferenceIndex,
  { offset, run }: Insertion,
  leadingOnly: boolean,
): { container: number; member: Uint8Array } | null {
  const container = index.container[offset] ?? -1;
  if (index.place[offset] !== OUTSIDE || container < 0 || index.text[container] !== 0x7b)
    return null;
  if (container === offset - 1)
    return run.at(-1) === 0x2c ? { container, member: run.subarray(0, -1) } : null;
  if (!leadingOnly && (index.text[offset] === 0x2c || index.text[offset] === 0x7d))
    return run[0] === 0x2c ? { container, member: run.subarray(1) } : null;
  return null;
}

const BOM = Uint8Array.of(0xef, 0xbb, 0xbf);
const RFC_8259_NUMBER = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/;
const SURROGATE_ESCAPE = /^\\u[dD][89a-fA-F][0-9a-fA-F]{2}$/;
const HIGH_ESCAPE = /^\\u[dD][89abAB][0-9a-fA-F]{2}$/;
const LOW_ESCAPE = /^\\u[dD][c-fC-F][0-9a-fA-F]{2}$/;
/** The octets that can start a JSON value, and the insignificant whitespace (RFC 8259). */
const VALUE_START_OR_WHITESPACE = new Set(encoder.encode('"[{-0123456789tfn \t\n\r'));

/**
 * Whether `insertion` adds exactly one defect of `defect` to the reference, in the minimal
 * form of its class, which can hide nothing else: SEMANTICS section 2 for the classes, section
 * 10 for the carriers, never the fixtures. Any octet beyond that form makes it false.
 */
function addsOneDefect(defect: string, index: ReferenceIndex, insertion: Insertion): boolean {
  const { offset, run } = insertion;
  const { text, place } = index;
  switch (defect) {
    case "bom":
      return offset === 0 && sameOctets(run, BOM);
    case "invalid-utf8": {
      // One octet that is never valid after an ASCII octet (a continuation octet, or F5 to FF),
      // between two ASCII octets of a string: dropped, it gives the reference back; replaced,
      // it gives U+FFFD; no reading turns it into a character of the JSON syntax.
      const octet = run[0] ?? 0;
      return (
        run.length === 1 &&
        ((octet >= 0x80 && octet <= 0xbf) || octet >= 0xf5) &&
        place[offset] === IN_STRING &&
        (text[offset - 1] ?? 0x80) < 0x80 &&
        (text[offset] ?? 0x80) < 0x80
      );
    }
    case "unpaired-surrogate": {
      if (run.length !== 6 || place[offset] !== IN_STRING) return false;
      const sequence = latin1(run);
      if (!SURROGATE_ESCAPE.test(sequence)) return false;
      if (HIGH_ESCAPE.test(sequence))
        return !LOW_ESCAPE.test(latin1(text.subarray(offset, offset + 6)));
      return !HIGH_ESCAPE.test(latin1(text.subarray(Math.max(0, offset - 6), offset)));
    }
    case "invalid-json": {
      // Section 2: one JSON text followed by something other than insignificant whitespace.
      // One printable octet that cannot start a value, so the tail holds no second JSON text.
      const octet = run[0] ?? 0;
      return (
        offset === text.length &&
        run.length === 1 &&
        octet >= 0x21 &&
        octet <= 0x7e &&
        !VALUE_START_OR_WHITESPACE.has(octet)
      );
    }
    case "duplicate-member": {
      // A byte-exact copy of a member of the same object: a reader that keeps the first
      // duplicate and one that keeps the last both read the golden argument.
      const inserted = insertedMember(index, insertion, false);
      return (
        inserted !== null &&
        membersAt(index, inserted.container).some((member) => sameOctets(member, inserted.member))
      );
    }
    case "invalid-number": {
      // Section 10: one leading member, under the name token of a member of the same object,
      // whose value is an RFC 8259 number out of the binary64 range.
      const inserted = insertedMember(index, insertion, true);
      if (inserted === null) return false;
      const name = nameToken(inserted.member);
      if (name === null || inserted.member[name.length] !== 0x3a) return false;
      const holdsName = membersAt(index, inserted.container).some((member) => {
        const golden = nameToken(member);
        return golden !== null && sameOctets(golden, name);
      });
      const value = latin1(inserted.member.subarray(name.length + 1));
      return holdsName && RFC_8259_NUMBER.test(value) && !Number.isFinite(Number(value));
    }
    default:
      return false;
  }
}

/** The schema validator of each JSON argument of `evaluate` (SEMANTICS section 2). */
async function argumentValidators(): Promise<
  Record<"policy" | "snapshot" | "need", ValidateFunction>
> {
  const read = async (name: string) =>
    (await Bun.file(join("contracts/schemas", name)).json()) as JsonRecord;
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  ajv.addSchema(await read("common.v1.schema.json"));
  return {
    policy: ajv.compile(await read("policy-definition.v2.schema.json")),
    snapshot: ajv.compile(await read("model-snapshot.v2.schema.json")),
    need: ajv.compile(await read("policy-need.v2.schema.json")),
  };
}

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
    expect(result.carriers).toBe(6);
  });

  test("a permissive JSON.parse decoder reads a schema-valid argument from carrier vectors", async () => {
    // The decoder of a fetch Response: UTF-8 without fatal errors (an invalid octet becomes
    // U+FFFD), byte order mark dropped, lone surrogates kept, JSON.parse, last duplicate member
    // kept. On a carrier it yields a schema-valid argument, so a component built on it does
    // not return input-invalid (SEMANTICS section 10).
    const manifest = (await Bun.file(
      join(POLICY_CORE_V3_RAW_INPUT_ROOT, "manifest.json"),
    ).json()) as JsonRecord;
    const { cases: golden } = await goldenCases(POLICY_CORE_V3_GOLDEN_PATH);
    const validators = await argumentValidators();
    // Which octets each carrier adds to its golden argument is checked by the byte test below;
    // here only the property section 10 states: the permissive reading is schema-valid.
    const defeated: string[] = [];
    for (const entry of manifest.cases as JsonRecord[]) {
      if (entry.argument === undefined) continue;
      const argument = entry.argument as keyof typeof validators;
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
      const defect = entry.defect as string;
      const validate = validators[argument];
      expect({ defect, valid: validate(decoded), errors: validate.errors ?? null }).toEqual({
        defect,
        valid: true,
        errors: null,
      });
      defeated.push(defect);
    }
    expect(defeated.sort()).toEqual([
      "bom",
      "duplicate-member",
      "invalid-number",
      "invalid-utf8",
      "unpaired-surrogate",
    ]);
  });

  test("every carrier is its golden argument plus one defect of its class", async () => {
    // SEMANTICS section 10: a carrier is the golden argument with one decoder defect of its
    // class added (the invalid-number one as a repeated member). Compared as octets, so that a
    // permissive decoder cannot hide a second defect: an added member, an escape, an octet.
    const manifest = (await Bun.file(
      join(POLICY_CORE_V3_RAW_INPUT_ROOT, "manifest.json"),
    ).json()) as JsonRecord;
    const { cases: golden } = await goldenCases(POLICY_CORE_V3_GOLDEN_PATH);
    const findings: string[] = [];
    let carriers = 0;
    for (const entry of manifest.cases as JsonRecord[]) {
      if (entry.argument === undefined) continue;
      carriers += 1;
      const goldenCase = golden.find((candidate) => candidate.id === entry.goldenCase);
      if (goldenCase === undefined) throw new Error(`${String(entry.id)}: golden case missing`);
      // The carriers are built from the compact serialization of the golden argument, in the
      // member order of golden.json.
      const reference = encoder.encode(JSON.stringify(goldenCase[entry.argument as string]));
      const bytes = await Bun.file(
        join(POLICY_CORE_V3_RAW_INPUT_ROOT, entry.file as string),
      ).bytes();
      const readings = insertions(reference, bytes);
      if (readings.length === 0) {
        findings.push(`${String(entry.id)}: not its golden argument plus one inserted run`);
        continue;
      }
      const defect = entry.defect as string;
      const index = indexReference(reference);
      if (!readings.some((reading) => addsOneDefect(defect, index, reading)))
        findings.push(
          `${String(entry.id)}: its inserted run (${bytes.length - reference.length} octets) ` +
            `is not one ${defect} defect at a place where that class can stand`,
        );
    }
    console.log(`policy-core-v3 carriers compared as octets: ${carriers}`);
    expect(carriers).toBe(6);
    expect(findings).toEqual([]);
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

  test("a segment count beyond the ceiling fails by name before any allocation", async () => {
    // Without the length check first, `repeat` is asked for 2^53 - 1 copies and throws a
    // RangeError of the engine, or allocates up to its string limit for a smaller absurd count.
    const scratch = await mkdtemp(join(tmpdir(), "policy-core-v3-memory-"));
    try {
      const path = join(scratch, "memory-qualification.v1.json");
      const segments = (count: number) => [{ text: "[", count }];
      const document = {
        schemaVersion: "libre-ai.policy-core-memory-qualification.v1",
        cases: [
          ["absurd", Number.MAX_SAFE_INTEGER],
          ["one-over", 8_388_609],
        ].map(([id, count]) => ({
          id,
          argument: "policy",
          segments: segments(count as number),
          inputSha256: "0".repeat(64),
          defect: "invalid-json",
          expectedErrors: { "policy-core-v3": { variant: "input-invalid" } },
        })),
      };
      await Bun.write(path, JSON.stringify(document));
      const result = await verifyPolicyCoreV3MemoryQualification(path);
      expect(result.inspected).toBe(2);
      expect(result.failures).toEqual([
        "policy-core-v3 memory:absurd: segments exceed the policyInput ceiling of 8388608 octets",
        "policy-core-v3 memory:one-over: segments exceed the policyInput ceiling of 8388608 octets",
      ]);
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
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

/** An added block, named by its first line, and the SHA-256 of its trimmed UTF-8 text. */
interface AddedBlock {
  firstLine: string;
  sha256: string;
}

interface DeclaredChanges {
  sections: Set<string>;
  replacedFirstLines: string[];
  addedBlocks: AddedBlock[];
}

function blockSha256(block: string): string {
  return new Bun.CryptoHasher("sha256").update(block).digest("hex");
}

/**
 * The change record: per change, `Sections: 1, 2.`, then under `Replaced policy-core-v2
 * blocks:` the first line of each v2 block it removes and under `Added blocks:` the SHA-256
 * and the first line of each block it adds, one `> ` line each. A quote outside those two
 * lists, or an added-block quote without its SHA-256, is an error.
 */
function declaredChanges(text: string): DeclaredChanges {
  const start = text.indexOf(`## ${CHANGES_HEADING}`);
  if (start < 0) throw new Error("the semantics has no change record");
  const record = text.slice(start);
  const declared: DeclaredChanges = {
    sections: new Set<string>(),
    replacedFirstLines: [],
    addedBlocks: [],
  };
  let list: "replaced" | "added" | null = null;
  for (const line of record.split("\n")) {
    const sections = /^Sections: ([0-9, ]+)\.$/.exec(line);
    if (sections !== null)
      for (const number of (sections[1] as string).split(",")) declared.sections.add(number.trim());
    if (/^Replaced policy-core-v2 blocks?:$/.test(line)) list = "replaced";
    else if (/^Added blocks?:$/.test(line)) list = "added";
    else if (line.startsWith("> ")) {
      if (list === null) throw new Error(`quoted line outside a block list: ${line}`);
      if (list === "replaced") declared.replacedFirstLines.push(line.slice(2));
      else {
        const pinned = /^> ([0-9a-f]{64}) (.+)$/.exec(line);
        if (pinned === null) throw new Error(`added block quoted without its SHA-256: ${line}`);
        declared.addedBlocks.push({
          sha256: pinned[1] as string,
          firstLine: pinned[2] as string,
        });
      }
    } else if (line.trim() !== "") list = null;
  }
  return declared;
}

interface Derivation {
  removedFirstLines: string[];
  addedBlocks: (AddedBlock & { section: string })[];
  touched: Set<string>;
  unchangedBlocks: number;
}

/** The blocks of the numbered sections of v3 that v2 does not hold, and the reverse. */
function derivation(v2: Map<string, string[]>, v3: Map<string, string[]>): Derivation {
  const result: Derivation = {
    removedFirstLines: [],
    addedBlocks: [],
    touched: new Set<string>(),
    unchangedBlocks: 0,
  };
  for (const [heading, v2Blocks] of v2) {
    const v3Blocks = v3.get(heading) ?? [];
    const removed = v2Blocks.filter((block) => !v3Blocks.includes(block));
    const added = v3Blocks.filter((block) => !v2Blocks.includes(block));
    result.unchangedBlocks += v2Blocks.length - removed.length;
    const section = heading.split(".")[0] as string;
    for (const block of removed) result.removedFirstLines.push(block.split("\n")[0] as string);
    for (const block of added)
      result.addedBlocks.push({
        section,
        firstLine: block.split("\n")[0] as string,
        sha256: blockSha256(block),
      });
    if (removed.length > 0 || added.length > 0) result.touched.add(section);
  }
  return result;
}

/**
 * One message per added block whose text is not the one the change record pins, and per pin
 * that matches no added block. The first-line comparison alone does not see a change inside
 * the body of an added block.
 */
function addedBlockDigestFailures(derived: Derivation, declared: DeclaredChanges): string[] {
  const failures: string[] = [];
  const unmatched = [...declared.addedBlocks];
  for (const block of derived.addedBlocks) {
    const index = unmatched.findIndex(
      (pin) => pin.firstLine === block.firstLine && pin.sha256 === block.sha256,
    );
    if (index >= 0) {
      unmatched.splice(index, 1);
      continue;
    }
    const pins = declared.addedBlocks
      .filter((pin) => pin.firstLine === block.firstLine)
      .map((pin) => pin.sha256);
    failures.push(
      `section ${block.section}, added block "${block.firstLine}": its text has SHA-256 ` +
        `${block.sha256}, the change record pins ${pins.length > 0 ? pins.join(", ") : "none"}`,
    );
  }
  for (const pin of unmatched)
    if (!derived.addedBlocks.some((block) => block.firstLine === pin.firstLine))
      failures.push(`change record pins an added block absent from the text: "${pin.firstLine}"`);
  return failures;
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

    const derived = derivation(v2, v3);
    const declared = declaredChanges(v3Text);
    const digestFailures = addedBlockDigestFailures(derived, declared);
    console.log(
      `policy-core-v3 semantics: ${derived.unchangedBlocks} v2 block(s) kept verbatim, ` +
        `${derived.removedFirstLines.length} replaced, ${derived.addedBlocks.length} added ` +
        `(${derived.addedBlocks.length - digestFailures.length} with the pinned SHA-256), ` +
        `sections touched: ${[...derived.touched].join(", ")}`,
    );
    expect([...declared.replacedFirstLines].sort()).toEqual([...derived.removedFirstLines].sort());
    expect(declared.addedBlocks.map((pin) => pin.firstLine).sort()).toEqual(
      derived.addedBlocks.map((block) => block.firstLine).sort(),
    );
    expect([...declared.sections].sort()).toEqual([...derived.touched].sort());
    expect(digestFailures).toEqual([]);
  });

  test("a change inside the body of an added block is refused and named", async () => {
    // The mutation of the architecture review on 475c8b4: the memory budget of an added block
    // of section 2 raised from 256 to 512 MiB. Its first line does not change.
    const v2 = numberedSections(await Bun.file(V2_SEMANTICS_PATH).text());
    const v3Text = await Bun.file(V3_SEMANTICS_PATH).text();
    const original = "(`memoryQualification.peakComponentLinearMemoryBytes`, 256 MiB)";
    expect(v3Text.split(original).length).toBe(2);
    const mutated = v3Text.replace(original, original.replace("256 MiB", "512 MiB"));
    const derived = derivation(v2, numberedSections(mutated));
    const declared = declaredChanges(mutated);
    // The first lines still match: only the pinned SHA-256 sees the change.
    expect(declared.addedBlocks.map((pin) => pin.firstLine).sort()).toEqual(
      derived.addedBlocks.map((block) => block.firstLine).sort(),
    );
    const failures = addedBlockDigestFailures(derived, declared);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain(
      'section 2, added block "A component MUST stay within the peak component linear memory budget"',
    );
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
