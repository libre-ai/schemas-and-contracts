// Projection of the policy-core-v2 golden cases into the vector format of the conformance runner
// (`conformance-runner.ts`), so that an implementing repository can replay them through `--impl`.
//
//   bun tools/quality/policy-core-v2-golden-vectors.ts --write | --check
//
// Direction. `contracts/fixtures/policy-core-v2/golden.json` stays the only source: the contract
// is locked, the file is hashed by the specification lock, and implementing repositories already
// read it. The vectors under `contracts/vectors/policy-core-v2/golden/` are derived from it and
// never edited by hand. `--write` regenerates them (content here, layout by Biome); `--check` and
// the test refuse a missing, extra or diverging vector. Deriving the fixture from the vectors
// instead would turn a locked file into a generated one.
//
// One golden case gives exactly one vector, `<case id>.vector.json`, under the runner root
// `contracts/vectors`:
//   id          `policy-core-v2/golden/<case id>`
//   criteria    the document's `semantics` reference
//   kind        `policy-core-v2.evaluate`
//   input       `{policy, snapshot, need, evaluatedAt}`, the four arguments of `evaluate` in the
//               world; the implementation serializes the first three to bytes itself
//   expected    a success case: `{outcome: "accept", evaluation, canonicalOutput}`, where
//               `canonicalOutput` is the expected evaluation in the document's declared
//               canonicalization (RFC 8785), so the output bytes are judged and not only their
//               value; an error case: `{outcome: "reject", code: <WIT error-code>}`
//
// Every doubt is a refusal, never a smaller set: an unreadable or empty document, an unknown
// member, a case with both or neither expectation, an id unusable as a file name, or two cases
// sharing an id.

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson } from "./authorized-execution";
import { parseStrictJson } from "./policy-core-raw-inputs";

const REPOSITORY = resolve(import.meta.dir, "../..");
export const GOLDEN_PATH = join(REPOSITORY, "contracts/fixtures/policy-core-v2/golden.json");
/** Root to give the runner; vector ids are relative to it. */
export const VECTOR_ROOT = join(REPOSITORY, "contracts/vectors");
const VECTOR_PREFIX = "policy-core-v2/golden";
export const VECTOR_DIRECTORY = join(VECTOR_ROOT, VECTOR_PREFIX);
const VECTOR_SUFFIX = ".vector.json";

export const VECTOR_KIND = "policy-core-v2.evaluate";
const SCHEMA_VERSION = "libre-ai.policy-core-golden-vectors.v2";
const CANONICALIZATION = "RFC 8785";
const DOCUMENT_MEMBERS = [
  "canonicalization",
  "cases",
  "digestAlgorithm",
  "engineVersion",
  "schemaVersion",
  "semantics",
];
const CASE_MEMBERS = new Set(["id", "policy", "snapshot", "need", "evaluatedAt"]);
const EXPECTATION_MEMBERS = new Set(["expectedEvaluation", "expectedError"]);
const ERROR_CODES = new Set([
  "input-invalid",
  "evaluated-at-invalid",
  "rule-id-duplicate",
  "approval-invalid",
  "digest-mismatch",
  "tenant-mismatch",
]);
const CASE_ID = /^[a-z0-9][a-z0-9-]*$/;

export interface Vector {
  id: string;
  criteria: string[];
  kind: string;
  description: string;
  dependsOn: string[];
  data: string[];
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
}

export interface Projection {
  /** Case ids in document order. */
  caseIds: string[];
  /** Vector file name (relative to VECTOR_DIRECTORY) to vector. */
  vectors: Map<string, Vector>;
  accept: number;
  reject: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The vectors of one golden document, or an Error naming the first refusal. */
export function projectGolden(document: unknown): Projection {
  if (!isRecord(document)) throw new Error("golden document is not an object");
  const members = Object.keys(document).sort();
  if (members.join(",") !== DOCUMENT_MEMBERS.join(","))
    throw new Error(`golden document members differ: ${members.join(",")}`);
  if (document.schemaVersion !== SCHEMA_VERSION)
    throw new Error("golden document has another schemaVersion");
  if (document.canonicalization !== CANONICALIZATION)
    throw new Error("golden document declares another canonicalization");
  if (typeof document.semantics !== "string" || document.semantics === "")
    throw new Error("golden document has no semantics reference");
  const { cases, semantics } = document;
  if (!Array.isArray(cases) || cases.length === 0) throw new Error("golden document has no case");

  const projection: Projection = { caseIds: [], vectors: new Map(), accept: 0, reject: 0 };
  for (const [index, testCase] of cases.entries()) {
    const label = `case ${index}`;
    if (!isRecord(testCase)) throw new Error(`${label}: not an object`);
    const { id } = testCase;
    if (typeof id !== "string" || !CASE_ID.test(id))
      throw new Error(`${label}: id is not a lowercase file-name stem`);
    const hasEvaluation = "expectedEvaluation" in testCase;
    const hasError = "expectedError" in testCase;
    if (hasEvaluation === hasError)
      throw new Error(`${id}: needs exactly one of expectedEvaluation and expectedError`);
    for (const member of Object.keys(testCase))
      if (!CASE_MEMBERS.has(member) && !EXPECTATION_MEMBERS.has(member))
        throw new Error(`${id}: unknown member ${member}`);
    for (const member of CASE_MEMBERS)
      if (!(member in testCase)) throw new Error(`${id}: missing member ${member}`);
    if (typeof testCase.evaluatedAt !== "string")
      throw new Error(`${id}: evaluatedAt is not a string`);

    let expected: Record<string, unknown>;
    if (hasEvaluation) {
      if (!isRecord(testCase.expectedEvaluation))
        throw new Error(`${id}: expectedEvaluation is not an object`);
      // Throws on a number outside the safe integers, where this serializer and RFC 8785 could
      // differ: a refusal, never an approximate expectation.
      const canonicalOutput = canonicalJson(testCase.expectedEvaluation);
      expected = {
        outcome: "accept",
        evaluation: testCase.expectedEvaluation,
        canonicalOutput,
      };
      projection.accept += 1;
    } else {
      const error = testCase.expectedError;
      if (
        !isRecord(error) ||
        Object.keys(error).join(",") !== "variant" ||
        typeof error.variant !== "string" ||
        !ERROR_CODES.has(error.variant)
      )
        throw new Error(`${id}: expectedError is not one WIT error-code variant`);
      expected = { outcome: "reject", code: error.variant };
      projection.reject += 1;
    }

    const name = `${id}${VECTOR_SUFFIX}`;
    if (projection.vectors.has(name)) throw new Error(`${id}: two cases share this id`);
    projection.caseIds.push(id);
    projection.vectors.set(name, {
      id: `${VECTOR_PREFIX}/${id}`,
      criteria: [semantics],
      kind: VECTOR_KIND,
      description: `policy-core-v2 golden case ${id} (contracts/fixtures/policy-core-v2/golden.json)`,
      dependsOn: [],
      data: [],
      input: {
        policy: testCase.policy,
        snapshot: testCase.snapshot,
        need: testCase.need,
        evaluatedAt: testCase.evaluatedAt,
      },
      expected,
    });
  }
  return projection;
}

/** Reads and projects the golden document; an unreadable or invalid file throws. */
export async function loadProjection(path: string = GOLDEN_PATH): Promise<Projection> {
  // The strict reader the runner uses: a duplicate member is a refusal, not a silent overwrite.
  return projectGolden(parseStrictJson(await readFile(path)));
}

export interface DriftReport {
  cases: number;
  accept: number;
  reject: number;
  onDisk: number;
  identical: number;
  missing: string[];
  extra: string[];
  differing: string[];
}

/**
 * Compares the projection with the vector directory. Content is compared as parsed JSON: the
 * layout belongs to Biome, which `bun run lint` enforces on the same files. A directory that
 * cannot be listed, or a vector that cannot be read or parsed, throws.
 */
export async function checkDrift(
  projection: Projection,
  directory: string = VECTOR_DIRECTORY,
): Promise<DriftReport> {
  const entries = await readdir(directory, { withFileTypes: true });
  const onDisk = entries.map((entry) => entry.name).sort();
  const report: DriftReport = {
    cases: projection.caseIds.length,
    accept: projection.accept,
    reject: projection.reject,
    onDisk: onDisk.length,
    identical: 0,
    missing: [],
    extra: [],
    differing: [],
  };
  for (const entry of entries)
    if (!entry.isFile() || !projection.vectors.has(entry.name)) report.extra.push(entry.name);
  for (const [name, vector] of projection.vectors) {
    if (!onDisk.includes(name)) {
      report.missing.push(name);
      continue;
    }
    const stored: unknown = parseStrictJson(await readFile(join(directory, name)));
    if (Bun.deepEquals(stored, vector, true)) report.identical += 1;
    else report.differing.push(name);
  }
  return report;
}

export function driftLine(report: DriftReport): string {
  return (
    `policy-core-v2 golden vectors: ${report.cases} case(s) (${report.accept} accept, ` +
    `${report.reject} reject), ${report.onDisk} file(s) on disk, ${report.identical} identical, ` +
    `${report.missing.length} missing, ${report.extra.length} extra, ` +
    `${report.differing.length} differing`
  );
}

export function isClean(report: DriftReport): boolean {
  return (
    report.cases === report.accept + report.reject &&
    report.identical === report.cases &&
    report.onDisk === report.cases &&
    report.missing.length === 0 &&
    report.extra.length === 0 &&
    report.differing.length === 0
  );
}

async function write(projection: Projection): Promise<void> {
  await rm(VECTOR_DIRECTORY, { recursive: true, force: true });
  await mkdir(VECTOR_DIRECTORY, { recursive: true });
  for (const [name, vector] of projection.vectors)
    await writeFile(join(VECTOR_DIRECTORY, name), `${JSON.stringify(vector, null, 2)}\n`);
  // Layout of record: the pinned Biome, the same one `bun run lint` runs.
  const biome = Bun.spawnSync(
    [join(REPOSITORY, "node_modules/.bin/biome"), "format", "--write", VECTOR_DIRECTORY],
    { stdout: "ignore", stderr: "inherit" },
  );
  if (biome.exitCode !== 0) throw new Error("biome format failed on the written vectors");
}

async function main(args: readonly string[]): Promise<number> {
  const [mode, ...extra] = args;
  if ((mode !== "--write" && mode !== "--check") || extra.length > 0) {
    console.error("usage: bun tools/quality/policy-core-v2-golden-vectors.ts --write | --check");
    return 2;
  }
  const projection = await loadProjection();
  if (mode === "--write") await write(projection);
  const report = await checkDrift(projection);
  console.log(driftLine(report));
  for (const name of report.missing) console.error(`missing: ${name}`);
  for (const name of report.extra) console.error(`extra: ${name}`);
  for (const name of report.differing) console.error(`differing: ${name}`);
  return isClean(report) ? 0 : 1;
}

if (import.meta.main) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    // An unreadable source or directory is a failure, never an empty set.
    console.error(`policy-core-v2 golden vectors: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}
