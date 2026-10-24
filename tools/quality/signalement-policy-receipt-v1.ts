// Authority-fixture verifier only: it checks the golden document of the
// signalement-policy-receipt-v1 world (form, bound contract files, required cases, and the
// consistency of each case with the verifiers of the contracts it uses). It does not evaluate,
// canonicalize, sign or verify anything: conformance of an implementation is proved in the
// implementing repository. Normative text: contracts/wit/signalement-policy-receipt-v1/SEMANTICS.md.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { canonicalJson } from "./authorized-execution";
import { parseStrictJson } from "./policy-core-raw-inputs";
import { rawProjectionReceiptFailures } from "./signalement-projection-receipt-v1";
import { rawRoutingPolicyFailures, routingPolicyDigest } from "./signalement-routing-policy-v1";
import { loadSignalementV1Vectors } from "./signalement-v1-vector-loader";

/** Ceiling of one golden file, and of the merged document, in octets (8 MiB). */
export const POLICY_RECEIPT_GOLDEN_MAX_BYTES = 8388608;
export const POLICY_RECEIPT_GOLDEN_ENTRY = "golden-vectors.v1.json";
/** Repository path of the entry, as check-contracts names it. */
export const POLICY_RECEIPT_GOLDEN_PATH =
  "contracts/fixtures/signalement-policy-receipt-v1/golden-vectors.v1.json";
// Contract files resolve against the authority root of this file's own location, so the same
// check holds for a vendored copy (vendor/contracts/tools/quality/...).
const AUTHORITY_ROOT = `${import.meta.dir}/../..`;
export const POLICY_RECEIPT_GOLDEN_DIRECTORY = `${AUTHORITY_ROOT}/contracts/fixtures/signalement-policy-receipt-v1`;

const SCHEMA_VERSION = "libre-ai.signalement-policy-receipt-golden-vectors.v1";
const GOLDEN_DEPTH = 63; // parseStrictJson counts the top-level value as 0: 64 levels.

type Operation = "evaluate" | "canonicalize" | "sign-receipt" | "verify-receipt";

/** Error codes a golden case may expect, by operation, in the order of the steps. */
export const OPERATION_ERROR_CODES: Readonly<Record<Operation, readonly string[]>> = {
  evaluate: ["input.too_large", "policy.invalid", "input.invalid", "input.origin_invalid"],
  canonicalize: [
    "canonicalize.too_large",
    "canonicalize.raw_json",
    "canonicalize.lone_surrogate",
    "canonicalize.depth",
    "canonicalize.number",
  ],
  "sign-receipt": ["key.invalid", "receipt.invalid"],
  "verify-receipt": ["keys.invalid"],
};

// Every case of the committed document: none can be dropped without a named failure.
export const REQUIRED_GOLDEN_CASES: readonly string[] = [
  "exact-origin",
  "file-order-irrelevant",
  "host-pattern-subdomain",
  "host-pattern-apex",
  "host-pattern-port",
  "absent-origin-rule",
  "absent-origin-no-rule",
  "no-rule-matched",
  "denied-dominates",
  "override-most-restrictive",
  "selectable-listed-when-allowed",
  "selectable-excludes-routed",
  "default-withhold",
  "withhold-dominates-transmit",
  "visibility-unknown",
  "gitlab-internal-is-public",
  "residency-withhold",
  "attachment-upload-ignored",
  "denied-in-unmatched-rule-not-counted",
  "selectable-visibility-unknown",
  "declared-ignores-discovered",
  "reason-precedence-independent-of-order",
  "origin-with-path",
  "origin-default-port",
  "input-duplicate-path",
  "policy-unknown-destination",
  "policy-non-canonical-origin",
  "canonicalize-sort-ascii",
  "canonicalize-nested",
  "canonicalize-non-ascii-literal",
  "canonicalize-control-escape",
  "canonicalize-utf16-key-order",
  "canonicalize-safe-integer",
  "canonicalize-integral-forms",
  "canonicalize-float",
  "canonicalize-two-pow-53",
  "canonicalize-non-finite",
  "canonicalize-duplicate-member",
  "canonicalize-byte-order-mark",
  "canonicalize-lone-surrogate",
  "canonicalize-depth-65",
  "sign-valid-active",
  "sign-valid-retired",
  "sign-with-signature-member",
  "sign-short-seed",
  "verify-valid",
  "verify-unknown-key",
  "verify-mismatch",
  "verify-unreadable",
  "verify-other-organization",
  "verify-keys-invalid",
];

const ROOT_MEMBERS = [
  "canonicalization",
  "cases",
  "contractFiles",
  "digestAlgorithm",
  "engineVersion",
  "schemaVersion",
  "testMaterialWarning",
  "world",
];
const CASE_MEMBERS = ["args", "expected", "id", "operation", "rationale"];
const VERDICT_MEMBERS = [
  "deniedCount",
  "destinations",
  "matchedRuleIds",
  "override",
  "policyDigest",
  "policyVersion",
];
const DESTINATION_MEMBERS = ["destinationId", "files", "media", "profileId", "routing"];
const FILE_MEMBERS = ["decision", "path", "reason"];

/** Arguments of each operation: JSON values and base64url strings, by member name. */
const ARGUMENTS: Readonly<Record<Operation, { json: string[]; octets: string[] }>> = {
  evaluate: { json: ["input", "policy"], octets: [] },
  canonicalize: { json: ["json"], octets: ["jsonBytes"] },
  "sign-receipt": { json: ["unsigned"], octets: ["secretKey"] },
  "verify-receipt": { json: ["publicKeys"], octets: ["signed"] },
};

type JsonObject = Record<string, unknown>;

interface GoldenCase {
  id: string;
  operation: Operation;
  args: JsonObject;
  expected: { ok: unknown } | { error: { code: string } };
  rationale: string;
}

interface GoldenDocument {
  contractFiles: { path: string; sha256: string }[];
  cases: GoldenCase[];
}

const encoder = new TextEncoder();

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactly(value: unknown, members: readonly string[]): value is JsonObject {
  return isRecord(value) && Object.keys(value).sort().join() === [...members].sort().join();
}

function isString(value: unknown, minimum: number, maximum: number, pattern?: RegExp): boolean {
  return (
    typeof value === "string" &&
    value.length >= minimum &&
    value.length <= maximum &&
    (pattern === undefined || pattern.test(value))
  );
}

function isCanonicalBase64url(value: unknown): boolean {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9_-]*$/.test(value) &&
    Buffer.from(value, "base64url").toString("base64url") === value
  );
}

const CONTRACT_PATH =
  /^contracts\/[A-Za-z0-9_-][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/;

function isContractFile(value: unknown): boolean {
  return (
    hasExactly(value, ["path", "sha256"]) &&
    isString(value.path, 11, 512, CONTRACT_PATH) &&
    !(value.path as string).split("/").includes("..") &&
    isString(value.sha256, 64, 64, /^[a-f0-9]{64}$/)
  );
}

function hasOperationArguments(operation: Operation, args: unknown): boolean {
  if (!isRecord(args)) return false;
  const { json, octets } = ARGUMENTS[operation];
  if (operation === "canonicalize") {
    const keys = Object.keys(args);
    if (keys.length !== 1) return false;
    return keys[0] === "json" || (keys[0] === "jsonBytes" && isCanonicalBase64url(args.jsonBytes));
  }
  return (
    hasExactly(args, [...json, ...octets]) &&
    octets.every((member) => isCanonicalBase64url(args[member]))
  );
}

function hasExpectedForm(operation: Operation, expected: unknown): boolean {
  if (hasExactly(expected, ["ok"])) return true;
  return (
    hasExactly(expected, ["error"]) &&
    hasExactly(expected.error, ["code"]) &&
    typeof expected.error.code === "string" &&
    OPERATION_ERROR_CODES[operation].includes(expected.error.code)
  );
}

function isGoldenCase(value: unknown): value is GoldenCase {
  if (!hasExactly(value, CASE_MEMBERS)) return false;
  const operation = value.operation;
  return (
    isString(value.id, 1, 64, /^[a-z][a-z0-9-]*$/) &&
    (operation === "evaluate" ||
      operation === "canonicalize" ||
      operation === "sign-receipt" ||
      operation === "verify-receipt") &&
    hasOperationArguments(operation, value.args) &&
    hasExpectedForm(operation, value.expected) &&
    isString(value.rationale, 1, 2048)
  );
}

function canonicalizes(value: unknown): boolean {
  try {
    canonicalJson(value);
    return true;
  } catch {
    return false;
  }
}

function hasEnvelope(document: unknown): document is GoldenDocument {
  if (!hasExactly(document, ROOT_MEMBERS)) return false;
  const { contractFiles, cases } = document;
  return (
    document.schemaVersion === SCHEMA_VERSION &&
    document.world === "signalement-policy-receipt-v1" &&
    document.engineVersion === "1.0.0" &&
    document.canonicalization === "RFC 8785" &&
    document.digestAlgorithm === "SHA-256" &&
    isString(document.testMaterialWarning, 1, 1000, /^[\x20-\x7e]*$/) &&
    Array.isArray(contractFiles) &&
    contractFiles.length >= 1 &&
    contractFiles.length <= 128 &&
    contractFiles.every(isContractFile) &&
    new Set(contractFiles.map((file) => file.path)).size === contractFiles.length &&
    Array.isArray(cases) &&
    cases.length >= 1 &&
    cases.length <= 4096 &&
    cases.every(isGoldenCase) &&
    canonicalizes(document)
  );
}

function contractFileMatches(path: string, sha256: string): boolean {
  try {
    const bytes = readFileSync(`${AUTHORITY_ROOT}/${path}`);
    return createHash("sha256").update(bytes).digest("hex") === sha256;
  } catch {
    return false;
  }
}

function expectedErrorCode(golden: GoldenCase): string | null {
  return "error" in golden.expected ? golden.expected.error.code : null;
}

function policyIsAccepted(golden: GoldenCase): boolean {
  return rawRoutingPolicyFailures(encoder.encode(canonicalJson(golden.args.policy))).length === 0;
}

function hasVerdictShape(ok: unknown): ok is { policyVersion: unknown; policyDigest: unknown } {
  return (
    hasExactly(ok, VERDICT_MEMBERS) &&
    Array.isArray(ok.destinations) &&
    ok.destinations.every(
      (destination) =>
        hasExactly(destination, DESTINATION_MEMBERS) &&
        Array.isArray(destination.files) &&
        destination.files.every((file) => hasExactly(file, FILE_MEMBERS)),
    )
  );
}

function successOf(golden: GoldenCase): { ok: unknown } | null {
  return "ok" in golden.expected ? golden.expected : null;
}

/**
 * Failure codes of one merged golden document, in the documented order. The size is checked
 * on octets before any parsing; size, strict JSON and envelope failures stop the check alone.
 * Codes carry only a contract file path or a case id, both constrained by the envelope.
 */
export function rawPolicyReceiptFailures(bytes: Uint8Array): string[] {
  if (bytes.byteLength > POLICY_RECEIPT_GOLDEN_MAX_BYTES) return ["golden.size_limit"];
  let parsed: unknown;
  try {
    parsed = parseStrictJson(bytes, GOLDEN_DEPTH);
  } catch {
    return ["golden.raw_json"];
  }
  if (!hasEnvelope(parsed)) return ["golden.envelope"];
  const failures: string[] = [];
  for (const { path, sha256 } of parsed.contractFiles) {
    if (!contractFileMatches(path, sha256)) failures.push(`golden.contract_file:${path}`);
  }
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const { id } of parsed.cases) {
    if (seen.has(id) && !repeated.has(id)) {
      repeated.add(id);
      failures.push(`golden.case_duplicate:${id}`);
    }
    seen.add(id);
  }
  for (const id of REQUIRED_GOLDEN_CASES) {
    if (!seen.has(id)) failures.push(`golden.case_missing:${id}`);
  }
  const evaluations = parsed.cases.filter((golden) => golden.operation === "evaluate");
  const accepted = new Map(evaluations.map((golden) => [golden, policyIsAccepted(golden)]));
  for (const golden of evaluations) {
    const code = expectedErrorCode(golden);
    const refusedUnexpectedly =
      !accepted.get(golden) && code !== "policy.invalid" && code !== "input.too_large";
    const acceptedUnexpectedly = accepted.get(golden) === true && code === "policy.invalid";
    if (refusedUnexpectedly || acceptedUnexpectedly)
      failures.push(`golden.policy_invalid:${golden.id}`);
  }
  for (const golden of evaluations) {
    const success = successOf(golden);
    if (success !== null && !hasVerdictShape(success.ok))
      failures.push(`golden.verdict_shape:${golden.id}`);
  }
  for (const golden of evaluations) {
    const success = successOf(golden);
    if (success === null || !accepted.get(golden) || !hasVerdictShape(success.ok)) continue;
    const policy = golden.args.policy as { version: unknown };
    if (
      success.ok.policyDigest !== routingPolicyDigest(policy) ||
      success.ok.policyVersion !== policy.version
    )
      failures.push(`golden.verdict_digest:${golden.id}`);
  }
  for (const golden of parsed.cases) {
    const success = successOf(golden);
    if (golden.operation !== "sign-receipt" || success === null) continue;
    if (rawProjectionReceiptFailures(encoder.encode(canonicalJson(success.ok))).length > 0)
      failures.push(`golden.receipt_invalid:${golden.id}`);
  }
  return failures;
}

export interface LoadedPolicyReceiptGolden {
  /** Entry and declared parts merged, `parts` removed; null whenever a failure is named. */
  document: JsonObject | null;
  failures: string[];
}

const GOLDEN_STEM = POLICY_RECEIPT_GOLDEN_ENTRY.slice(0, -".json".length);

/**
 * Reads the entry and its declared parts with the signalement v1 continuation rule. Every
 * `golden-vectors.v1*.json` file is measured before any is read, so an oversized file is
 * never decoded.
 */
export async function loadPolicyReceiptGolden(
  directory: string = POLICY_RECEIPT_GOLDEN_DIRECTORY,
): Promise<LoadedPolicyReceiptGolden> {
  let names: string[];
  try {
    names = (await readdir(directory)).sort();
  } catch {
    return { document: null, failures: ["golden.parts:directory is unreadable"] };
  }
  const failures: string[] = [];
  for (const name of names) {
    if (!name.startsWith(GOLDEN_STEM) || !name.endsWith(".json")) continue;
    const size = await stat(`${directory}/${name}`).then(
      (entry) => entry.size,
      () => 0,
    );
    if (size > POLICY_RECEIPT_GOLDEN_MAX_BYTES) failures.push(`golden.size_limit:${name}`);
  }
  if (failures.length > 0) return { document: null, failures };
  const loaded = await loadSignalementV1Vectors(directory, POLICY_RECEIPT_GOLDEN_ENTRY);
  if (loaded.vectors === null)
    return {
      document: null,
      failures: loaded.failures.map((failure) => `golden.parts:${failure}`),
    };
  return { document: loaded.vectors, failures: [] };
}

/** Failures of the golden files of `directory`: reading failures, else the merged document's. */
export async function policyReceiptGoldenFailures(
  directory: string = POLICY_RECEIPT_GOLDEN_DIRECTORY,
): Promise<string[]> {
  const loaded = await loadPolicyReceiptGolden(directory);
  if (loaded.document === null) return loaded.failures;
  return rawPolicyReceiptFailures(encoder.encode(JSON.stringify(loaded.document)));
}
