import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "./authorized-execution";
import {
  decodeStrictJsonGrammarFirst,
  parseStrictJson,
  type RawDefect,
  StrictJsonError,
} from "./policy-core-raw-inputs";

// Machine checks of the policy-core-v3 candidate (contracts/wit/policy-core-v3/SEMANTICS.md):
// its raw-input vectors under the grammar-first decoder (change C2), and its golden vectors,
// the policy-core-v2 ones under engine version 3.0.0 (change C1).

type JsonRecord = Record<string, unknown>;

export const POLICY_CORE_V3_ENGINE_VERSION = "3.0.0";
export const POLICY_CORE_V2_GOLDEN_PATH = "contracts/fixtures/policy-core-v2/golden.json";
export const POLICY_CORE_V3_GOLDEN_PATH = "contracts/fixtures/policy-core-v3/golden.json";
export const POLICY_CORE_V2_RAW_INPUT_ROOT = "contracts/fixtures/policy-core-invalid-json";
export const POLICY_CORE_V3_RAW_INPUT_ROOT = "contracts/fixtures/policy-core-v3/raw-inputs";
// policy-core-v3 keeps the policy-core-v2 qualification ceilings (SEMANTICS section 10).
export const POLICY_CORE_V2_BUDGETS_PATH =
  "contracts/fixtures/policy-core-v2/resource-budgets.v1.json";

const RAW_INPUT_SCHEMA_VERSION = "libre-ai.policy-core-raw-input-vectors.v2";
// The classes of SEMANTICS section 2, in the precedence order of the reference oracle.
const V3_DEFECTS: readonly RawDefect[] = [
  "bom",
  "invalid-utf8",
  "invalid-json",
  "duplicate-member",
  "unpaired-surrogate",
  "max-depth",
  "invalid-number",
];
// The evaluation payload stays policy-evaluation.v2: the digest label of SEMANTICS section 9
// names the payload schema, not the world (change C1 leaves it unchanged).
const EVALUATION_DIGEST_LABEL = "libre-ai.policy-evaluation.v2";

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sha256Hex(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** `H(label, x)` of SEMANTICS section 9 for an unsigned evaluation (no unordered array). */
export function policyEvaluationDigest(unsignedEvaluation: JsonRecord): string {
  return createHash("sha256")
    .update(EVALUATION_DIGEST_LABEL)
    .update(Uint8Array.of(0))
    .update(canonicalJson(unsignedEvaluation))
    .digest("hex");
}

async function readManifestCases(root: string, failures: string[], label: string) {
  let manifest: unknown;
  try {
    manifest = parseStrictJson(new Uint8Array(await readFile(join(root, "manifest.json"))));
  } catch {
    failures.push(`${label}: manifest is absent or unreadable`);
    return null;
  }
  if (!isRecord(manifest) || !Array.isArray(manifest.cases) || manifest.cases.length === 0) {
    failures.push(`${label}: manifest has no case`);
    return null;
  }
  return manifest;
}

export interface V3RawInputResult {
  failures: string[];
  /** Refused cases read and checked. */
  inspected: number;
  carriedFromV2: number;
  /** Accepted cases read and checked. */
  accepted: number;
}

/** `decoderQualification.maximumJsonDepth` of the resource budgets, or a failure. */
async function readMaximumJsonDepth(path: string, failures: string[]): Promise<number | null> {
  try {
    const budgets = parseStrictJson(new Uint8Array(await readFile(path)));
    const qualification = isRecord(budgets) ? budgets.decoderQualification : undefined;
    const depth = isRecord(qualification) ? qualification.maximumJsonDepth : undefined;
    if (typeof depth === "number" && Number.isSafeInteger(depth) && depth > 0) return depth;
  } catch {
    // reported below
  }
  failures.push(`${path}: no positive decoderQualification.maximumJsonDepth`);
  return null;
}

/** The fixture bytes of one manifest entry, after its name, SHA-256 and length checks. */
async function readCaseBytes(
  root: string,
  entry: JsonRecord & { id: string },
  label: string,
  failures: string[],
): Promise<Uint8Array | null> {
  if (typeof entry.file !== "string" || !/^[a-z0-9-]+\.bin$/.test(entry.file)) {
    failures.push(`${label}: unsafe fixture file name`);
    return null;
  }
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await readFile(join(root, entry.file)));
  } catch {
    failures.push(`${label}: fixture file is absent or unreadable`);
    return null;
  }
  if (sha256Hex(bytes) !== entry.inputSha256) failures.push(`${label}: input SHA-256 mismatch`);
  if (bytes.length !== entry.byteLength) failures.push(`${label}: byte length mismatch`);
  return bytes;
}

/**
 * Every refused case is refused by the reference oracle with its declared class and maps to
 * the single WIT variant `input-invalid`; every accepted case is accepted; every
 * policy-core-v2 case is carried once, byte-identical. The oracle runs at the maximum depth of
 * the resource budgets unless `maxDepth` is given (a test passes it to prove the depth vectors
 * discriminate). An absent or empty manifest is a failure, never an empty set.
 */
export async function verifyPolicyCoreV3RawInputVectors(
  root: string,
  v2Root: string = POLICY_CORE_V2_RAW_INPUT_ROOT,
  maxDepth?: number,
): Promise<V3RawInputResult> {
  const failures: string[] = [];
  const result: V3RawInputResult = { failures, inspected: 0, carriedFromV2: 0, accepted: 0 };
  const manifest = await readManifestCases(root, failures, "policy-core-v3 raw inputs");
  const v2Manifest = await readManifestCases(v2Root, failures, "policy-core-v2 raw inputs");
  const depth = maxDepth ?? (await readMaximumJsonDepth(POLICY_CORE_V2_BUDGETS_PATH, failures));
  if (manifest === null || v2Manifest === null || depth === null) return result;
  if (manifest.schemaVersion !== RAW_INPUT_SCHEMA_VERSION)
    failures.push("policy-core-v3 raw inputs: invalid schemaVersion");

  const v2Digests = new Map<string, unknown>();
  for (const entry of v2Manifest.cases as unknown[])
    if (isRecord(entry) && typeof entry.id === "string") v2Digests.set(entry.id, entry.inputSha256);
  const carried = new Set<string>();
  const ids = new Set<string>();
  const classes = new Set<RawDefect>();

  if (!Array.isArray(manifest.acceptedCases) || manifest.acceptedCases.length === 0)
    failures.push("policy-core-v3 raw inputs: no accepted case");
  else
    for (const entry of manifest.acceptedCases as unknown[]) {
      if (!isRecord(entry) || typeof entry.id !== "string") {
        failures.push("policy-core-v3 raw inputs: accepted case without id");
        continue;
      }
      const label = `policy-core-v3 raw:${entry.id}`;
      if (ids.has(entry.id)) failures.push(`${label}: duplicate case id`);
      ids.add(entry.id);
      if ("defect" in entry || "expectedErrors" in entry)
        failures.push(`${label}: an accepted case carries no defect and no error`);
      const bytes = await readCaseBytes(root, { ...entry, id: entry.id }, label, failures);
      if (bytes === null) continue;
      result.accepted += 1;
      try {
        decodeStrictJsonGrammarFirst(bytes, depth);
      } catch (error) {
        failures.push(`${label}: accepted case refused: ${String(error)}`);
      }
    }

  for (const entry of manifest.cases as unknown[]) {
    if (!isRecord(entry) || typeof entry.id !== "string") {
      failures.push("policy-core-v3 raw inputs: case without id");
      continue;
    }
    const label = `policy-core-v3 raw:${entry.id}`;
    if (ids.has(entry.id)) failures.push(`${label}: duplicate case id`);
    ids.add(entry.id);
    const bytes = await readCaseBytes(root, { ...entry, id: entry.id }, label, failures);
    if (bytes === null) continue;
    result.inspected += 1;

    const defect = entry.defect as RawDefect;
    if (!V3_DEFECTS.includes(defect)) {
      failures.push(`${label}: unknown defect`);
      continue;
    }
    classes.add(defect);
    try {
      decodeStrictJsonGrammarFirst(bytes, depth);
      failures.push(`${label}: grammar-first decoder accepted forbidden input`);
    } catch (error) {
      if (!(error instanceof StrictJsonError) || error.defect !== defect)
        failures.push(`${label}: expected ${defect}, got ${String(error)}`);
    }

    const errors = entry.expectedErrors;
    const v3 = isRecord(errors) ? errors["policy-core-v3"] : undefined;
    if (
      !isRecord(errors) ||
      Object.keys(errors).join() !== "policy-core-v3" ||
      !isRecord(v3) ||
      Object.keys(v3).join() !== "variant" ||
      v3.variant !== "input-invalid"
    )
      failures.push(`${label}: invalid policy-core-v3 component refusal`);

    if (entry.carriedFrom !== undefined) {
      const source = entry.carriedFrom;
      if (typeof source !== "string" || !v2Digests.has(source))
        failures.push(`${label}: carriedFrom names no policy-core-v2 case`);
      else if (carried.has(source)) failures.push(`${label}: ${source} is carried twice`);
      else if (v2Digests.get(source) !== entry.inputSha256)
        failures.push(`${label}: bytes differ from policy-core-v2 case ${source}`);
      else carried.add(source);
    }
  }

  result.carriedFromV2 = carried.size;
  for (const id of v2Digests.keys())
    if (!carried.has(id)) failures.push(`policy-core-v3 raw inputs: v2 case ${id} is not carried`);
  for (const defect of V3_DEFECTS)
    if (!classes.has(defect)) failures.push(`policy-core-v3 raw inputs: no ${defect} case`);
  return result;
}

/** The v3 golden: the v2 cases unchanged, each evaluation under engine 3.0.0 and re-digested. */
export function deriveV3Golden(v2: JsonRecord): JsonRecord {
  if (!Array.isArray(v2.cases)) throw new Error("policy-core-v2 golden has no cases");
  const cases = v2.cases.map((entry: unknown) => {
    if (!isRecord(entry)) throw new Error("policy-core-v2 golden case is not an object");
    const evaluation = entry.expectedEvaluation;
    if (!isRecord(evaluation)) return entry;
    const { id: _id, digest: _digest, ...unsigned } = evaluation;
    const rebased = { ...unsigned, engineVersion: POLICY_CORE_V3_ENGINE_VERSION };
    const digest = policyEvaluationDigest(rebased);
    // Keep the v2 member order so that a reviewer can diff the two files case by case.
    const expectedEvaluation = Object.fromEntries(
      Object.keys(evaluation).map((name) => {
        if (name === "id") return [name, `urn:libre-ai:evaluation:${digest}`];
        if (name === "digest") return [name, digest];
        return [name, (rebased as JsonRecord)[name]];
      }),
    );
    return { ...entry, expectedEvaluation };
  });
  return {
    ...v2,
    schemaVersion: "libre-ai.policy-core-golden-vectors.v3",
    engineVersion: POLICY_CORE_V3_ENGINE_VERSION,
    semantics: "contracts/wit/policy-core-v3/SEMANTICS.md",
    cases,
  };
}

if (import.meta.main && process.argv.includes("--write-golden")) {
  const v2 = parseStrictJson(new Uint8Array(await readFile(POLICY_CORE_V2_GOLDEN_PATH)));
  if (!isRecord(v2)) throw new Error("policy-core-v2 golden is not an object");
  await writeFile(POLICY_CORE_V3_GOLDEN_PATH, `${JSON.stringify(deriveV3Golden(v2), null, 2)}\n`);
  console.log(`wrote ${POLICY_CORE_V3_GOLDEN_PATH}`);
}
