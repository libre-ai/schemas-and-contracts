// Projection of the policy-core-v3 candidate fixtures into the vector format of the conformance
// runner (`conformance-runner.ts`), so that an implementing repository can replay them through
// `--impl`.
//
//   bun tools/quality/policy-core-v3-vectors.ts --write | --check
//
// Direction. The fixtures stay the only source: `contracts/fixtures/policy-core-v3/golden.json`
// and `contracts/fixtures/policy-core-v3/raw-inputs/` (manifest and `.bin` files). The vectors
// under `contracts/vectors/policy-core-v3/` are derived from them and never edited by hand.
// `--write` regenerates them (content here, layout by Biome); `--check` and the test refuse a
// missing, extra or diverging vector.
//
// Kind `policy-core-v3.evaluate`, runner root `contracts/vectors`:
//
// - `golden/<case id>`: one vector per golden case, in the form of the policy-core-v2 golden
//   vectors (`policy-core-v2-golden-vectors.ts`): the four arguments of `evaluate` as JSON values
//   in `input`; `{outcome: "accept", evaluation, canonicalOutput}` or `{outcome: "reject", code}`.
//
// - `raw-inputs/<argument>/<case id>`: one vector per refused raw input and argument it is
//   passed as (SEMANTICS section 10). A carrier, which names an `argument` and a `goldenCase`,
//   gives one vector, under that argument, with the other arguments and `evaluatedAt` of that
//   golden case. A refused input that names no argument gives three, one per JSON argument, with
//   the other arguments of the first golden case that expects an evaluation (document order).
//   The raw octets travel in `inputBytes`, under the argument's name, in canonical base64; the
//   other arguments stay JSON values in `input`. The expectation is the WIT variant of
//   `expectedErrors`, `{outcome: "reject", code}`; the `defect` class binds the reference oracle
//   only and is never projected. Each raw vector depends on the golden vector of the case that
//   lends its other arguments: a refusal counts only from an implementation that evaluates the
//   same arguments when they are all well formed, so an implementation that refuses everything
//   cannot pass them.
//
// Not projected: `acceptedCases` of the raw-input manifest (they bind the reference oracle only,
// SEMANTICS section 10; their count is printed), and `memory-qualification.v1.json`, whose
// inputs sit at the 8 MiB input ceiling, above the runner's 1 MiB vector cap, and qualify a peak
// memory the runner does not measure: they belong to the implementation's memory gate.
//
// Every doubt is a refusal, never a smaller set: an unreadable document or fixture file, an
// unknown member, a digest or length that differs from the manifest, a carrier that names no
// golden case that evaluates, an expectation other than one WIT variant, or two cases sharing an
// id.

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseStrictJson } from "./policy-core-raw-inputs";
import {
  CASE_ID,
  ERROR_CODES,
  type GoldenProfile,
  type Projection,
  projectGolden,
  type Vector,
} from "./policy-core-v2-golden-vectors";

const REPOSITORY = resolve(import.meta.dir, "../..");
export const GOLDEN_PATH = join(REPOSITORY, "contracts/fixtures/policy-core-v3/golden.json");
export const RAW_INPUT_ROOT = join(REPOSITORY, "contracts/fixtures/policy-core-v3/raw-inputs");
/** Root to give the runner; vector ids are relative to it. */
export const VECTOR_ROOT = join(REPOSITORY, "contracts/vectors");
const VECTOR_PREFIX = "policy-core-v3";
export const VECTOR_DIRECTORY = join(VECTOR_ROOT, VECTOR_PREFIX);
const VECTOR_SUFFIX = ".vector.json";

export const VECTOR_KIND = "policy-core-v3.evaluate";
export const WORLD = "policy-core-v3";
export const ARGUMENTS = ["policy", "snapshot", "need"] as const;
type Argument = (typeof ARGUMENTS)[number];

export const POLICY_CORE_V3_GOLDEN: GoldenProfile = {
  schemaVersion: "libre-ai.policy-core-golden-vectors.v3",
  vectorPrefix: `${VECTOR_PREFIX}/golden`,
  kind: VECTOR_KIND,
  world: WORLD,
  source: "contracts/fixtures/policy-core-v3/golden.json",
};
const RAW_SCHEMA_VERSION = "libre-ai.policy-core-raw-input-vectors.v2";
const RAW_SOURCE = "contracts/fixtures/policy-core-v3/raw-inputs";
const MANIFEST_MEMBERS = ["acceptedCases", "cases", "description", "schemaVersion"];
const RAW_REQUIRED = ["byteLength", "expectedErrors", "file", "id", "inputSha256"];
// `defect`, `carriedFrom` and `note` are read by the oracle checks, never projected here.
const RAW_OPTIONAL = new Set(["argument", "carriedFrom", "defect", "goldenCase", "note"]);
const FILE_NAME = /^[a-z0-9-]+\.bin$/;

export interface V3Vector extends Vector {
  inputBytes?: Record<string, string>;
}

export interface V3Projection {
  /** Path relative to VECTOR_DIRECTORY, `/`-separated, to vector. */
  vectors: Map<string, V3Vector>;
  goldenCases: number;
  goldenAccept: number;
  goldenReject: number;
  /** Refused raw inputs read. */
  rawCases: number;
  carriers: number;
  /** Refused raw inputs that name no argument, each projected once per argument. */
  spread: number;
  rawVectors: number;
  /** Accepted raw inputs, which bind the oracle only and give no vector. */
  oracleOnly: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** The golden case records by id, and the id of the first one that expects an evaluation. */
function goldenCases(document: Record<string, unknown>): {
  byId: Map<string, Record<string, unknown>>;
  firstEvaluating: string;
} {
  const byId = new Map<string, Record<string, unknown>>();
  let firstEvaluating: string | null = null;
  for (const testCase of document.cases as Record<string, unknown>[]) {
    const id = testCase.id as string;
    byId.set(id, testCase);
    if (firstEvaluating === null && "expectedEvaluation" in testCase) firstEvaluating = id;
  }
  if (firstEvaluating === null) throw new Error("golden document has no case that evaluates");
  return { byId, firstEvaluating };
}

function rawVector(
  entry: Record<string, unknown>,
  argument: Argument,
  host: Record<string, unknown>,
  bytes: Uint8Array,
  code: string,
  semantics: string,
): V3Vector {
  const input: Record<string, unknown> = {};
  for (const other of ARGUMENTS) if (other !== argument) input[other] = host[other];
  input.evaluatedAt = host.evaluatedAt;
  return {
    id: `${VECTOR_PREFIX}/raw-inputs/${argument}/${String(entry.id)}`,
    criteria: [semantics],
    kind: VECTOR_KIND,
    description:
      `${WORLD} raw input ${String(entry.id)} (${RAW_SOURCE}/${String(entry.file)}) as ` +
      `${argument}, with the other arguments of golden case ${String(host.id)}`,
    dependsOn: [`${POLICY_CORE_V3_GOLDEN.vectorPrefix}/${String(host.id)}`],
    data: [],
    input,
    inputBytes: { [argument]: Buffer.from(bytes).toString("base64") },
    expected: { outcome: "reject", code },
  };
}

/**
 * The vectors of the golden document and of the raw-input manifest, whose `.bin` files are given
 * by name in `files`; an Error names the first refusal.
 */
export function projectV3(
  golden: unknown,
  manifest: unknown,
  files: ReadonlyMap<string, Uint8Array>,
): V3Projection {
  const goldenProjection: Projection = projectGolden(golden, POLICY_CORE_V3_GOLDEN);
  const document = golden as Record<string, unknown>;
  const semantics = document.semantics as string;
  const { byId, firstEvaluating } = goldenCases(document);

  const projection: V3Projection = {
    vectors: new Map(),
    goldenCases: goldenProjection.caseIds.length,
    goldenAccept: goldenProjection.accept,
    goldenReject: goldenProjection.reject,
    rawCases: 0,
    carriers: 0,
    spread: 0,
    rawVectors: 0,
    oracleOnly: 0,
  };
  for (const [name, vector] of goldenProjection.vectors)
    projection.vectors.set(`golden/${name}`, vector);

  if (!isRecord(manifest)) throw new Error("raw-input manifest is not an object");
  const members = Object.keys(manifest).sort();
  if (members.join(",") !== MANIFEST_MEMBERS.join(","))
    throw new Error(`raw-input manifest members differ: ${members.join(",")}`);
  if (manifest.schemaVersion !== RAW_SCHEMA_VERSION)
    throw new Error("raw-input manifest has another schemaVersion");
  const { cases, acceptedCases } = manifest;
  if (!Array.isArray(cases) || cases.length === 0)
    throw new Error("raw-input manifest has no refused case");
  if (!Array.isArray(acceptedCases)) throw new Error("raw-input acceptedCases is not a list");
  projection.oracleOnly = acceptedCases.length;

  const ids = new Set<string>();
  for (const [index, entry] of cases.entries()) {
    const label = `raw case ${index}`;
    if (!isRecord(entry)) throw new Error(`${label}: not an object`);
    const { id } = entry;
    if (typeof id !== "string" || !CASE_ID.test(id))
      throw new Error(`${label}: id is not a lowercase file-name stem`);
    if (ids.has(id)) throw new Error(`${id}: two raw cases share this id`);
    ids.add(id);
    for (const member of Object.keys(entry))
      if (!RAW_REQUIRED.includes(member) && !RAW_OPTIONAL.has(member))
        throw new Error(`${id}: unknown member ${member}`);
    for (const member of RAW_REQUIRED)
      if (!(member in entry)) throw new Error(`${id}: missing member ${member}`);

    if (typeof entry.file !== "string" || !FILE_NAME.test(entry.file))
      throw new Error(`${id}: file is not a safe .bin name`);
    const bytes = files.get(entry.file);
    if (bytes === undefined) throw new Error(`${id}: fixture file ${entry.file} is not read`);
    if (sha256Hex(bytes) !== entry.inputSha256)
      throw new Error(`${id}: fixture file differs from inputSha256`);
    if (bytes.byteLength !== entry.byteLength)
      throw new Error(`${id}: fixture file differs from byteLength`);

    const errors = entry.expectedErrors;
    const component = isRecord(errors) ? errors[WORLD] : undefined;
    if (
      !isRecord(errors) ||
      Object.keys(errors).join(",") !== WORLD ||
      !isRecord(component) ||
      Object.keys(component).join(",") !== "variant" ||
      typeof component.variant !== "string" ||
      !ERROR_CODES.has(component.variant)
    )
      throw new Error(`${id}: expectedErrors is not one ${WORLD} WIT error-code variant`);
    const code = component.variant;

    const hasArgument = "argument" in entry;
    if (hasArgument !== "goldenCase" in entry)
      throw new Error(`${id}: argument and goldenCase go together`);
    let targets: { argument: Argument; host: string }[];
    if (hasArgument) {
      const argument = ARGUMENTS.find((name) => name === entry.argument);
      if (argument === undefined)
        throw new Error(`${id}: argument is not policy, snapshot or need`);
      const host = byId.get(String(entry.goldenCase));
      if (host === undefined || !("expectedEvaluation" in host))
        throw new Error(`${id}: goldenCase names no golden case that evaluates`);
      targets = [{ argument, host: String(entry.goldenCase) }];
      projection.carriers += 1;
    } else {
      targets = ARGUMENTS.map((argument) => ({ argument, host: firstEvaluating }));
      projection.spread += 1;
    }
    projection.rawCases += 1;
    for (const { argument, host } of targets) {
      const record = byId.get(host) as Record<string, unknown>;
      projection.vectors.set(
        `raw-inputs/${argument}/${id}${VECTOR_SUFFIX}`,
        rawVector(entry, argument, record, bytes, code, semantics),
      );
      projection.rawVectors += 1;
    }
  }
  return projection;
}

/** Reads and projects the fixtures; an unreadable or invalid file throws. */
export async function loadV3Projection(
  goldenPath: string = GOLDEN_PATH,
  rawRoot: string = RAW_INPUT_ROOT,
): Promise<V3Projection> {
  // The strict reader the runner uses: a duplicate member is a refusal, not a silent overwrite.
  const golden = parseStrictJson(await readFile(goldenPath));
  const manifest = parseStrictJson(await readFile(join(rawRoot, "manifest.json")));
  const files = new Map<string, Uint8Array>();
  if (isRecord(manifest) && Array.isArray(manifest.cases))
    for (const entry of manifest.cases)
      if (isRecord(entry) && typeof entry.file === "string" && FILE_NAME.test(entry.file))
        files.set(entry.file, new Uint8Array(await readFile(join(rawRoot, entry.file))));
  return projectV3(golden, manifest, files);
}

export interface V3DriftReport {
  expected: number;
  onDisk: number;
  identical: number;
  missing: string[];
  extra: string[];
  differing: string[];
}

/** Every entry under `directory`, `/`-separated; a directory that cannot be listed throws. */
async function walk(
  directory: string,
  prefix: string,
  files: string[],
  directories: string[],
  others: string[],
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      directories.push(path);
      await walk(join(directory, entry.name), `${path}/`, files, directories, others);
    } else if (entry.isFile()) files.push(path);
    else others.push(path);
  }
}

/**
 * Compares the projection with the vector tree. Content is compared as parsed JSON: the layout
 * belongs to Biome, which `bun run lint` enforces on the same files. A directory that cannot be
 * listed, or a vector that cannot be read or parsed, throws.
 */
export async function checkV3Drift(
  projection: V3Projection,
  directory: string = VECTOR_DIRECTORY,
): Promise<V3DriftReport> {
  const files: string[] = [];
  const directories: string[] = [];
  const others: string[] = [];
  await walk(directory, "", files, directories, others);
  const expectedDirectories = new Set<string>();
  for (const path of projection.vectors.keys())
    for (let parent = dirname(path); parent !== "."; parent = dirname(parent))
      expectedDirectories.add(parent);
  const report: V3DriftReport = {
    expected: projection.vectors.size,
    onDisk: files.length,
    identical: 0,
    missing: [],
    extra: [...others],
    differing: [],
  };
  for (const path of directories) if (!expectedDirectories.has(path)) report.extra.push(`${path}/`);
  for (const path of files) if (!projection.vectors.has(path)) report.extra.push(path);
  for (const [path, vector] of projection.vectors) {
    if (!files.includes(path)) {
      report.missing.push(path);
      continue;
    }
    const stored: unknown = parseStrictJson(await readFile(join(directory, path)));
    if (Bun.deepEquals(stored, vector, true)) report.identical += 1;
    else report.differing.push(path);
  }
  report.extra.sort();
  return report;
}

export function projectionLine(projection: V3Projection): string {
  return (
    `policy-core-v3 vectors: ${projection.goldenCases} golden case(s) ` +
    `(${projection.goldenAccept} accept, ${projection.goldenReject} reject), ` +
    `${projection.rawCases} refused raw input(s) (${projection.carriers} carrier(s), ` +
    `${projection.spread} passed as each of ${ARGUMENTS.length} arguments) giving ` +
    `${projection.rawVectors} raw vector(s), ${projection.oracleOnly} accepted raw input(s) ` +
    `binding the oracle only`
  );
}

export function driftLine(report: V3DriftReport): string {
  return (
    `policy-core-v3 vectors: ${report.expected} expected, ${report.onDisk} file(s) on disk, ` +
    `${report.identical} identical, ${report.missing.length} missing, ` +
    `${report.extra.length} extra, ${report.differing.length} differing`
  );
}

export function isClean(projection: V3Projection, report: V3DriftReport): boolean {
  return (
    projection.goldenCases === projection.goldenAccept + projection.goldenReject &&
    projection.rawCases === projection.carriers + projection.spread &&
    projection.rawVectors === projection.carriers + ARGUMENTS.length * projection.spread &&
    report.expected === projection.goldenCases + projection.rawVectors &&
    report.identical === report.expected &&
    report.onDisk === report.expected &&
    report.missing.length === 0 &&
    report.extra.length === 0 &&
    report.differing.length === 0
  );
}

async function write(projection: V3Projection): Promise<void> {
  await rm(VECTOR_DIRECTORY, { recursive: true, force: true });
  for (const [path, vector] of projection.vectors) {
    const file = join(VECTOR_DIRECTORY, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(vector, null, 2)}\n`);
  }
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
    console.error("usage: bun tools/quality/policy-core-v3-vectors.ts --write | --check");
    return 2;
  }
  const projection = await loadV3Projection();
  if (mode === "--write") await write(projection);
  const report = await checkV3Drift(projection);
  console.log(projectionLine(projection));
  console.log(driftLine(report));
  for (const path of report.missing) console.error(`missing: ${path}`);
  for (const path of report.extra) console.error(`extra: ${path}`);
  for (const path of report.differing) console.error(`differing: ${path}`);
  return isClean(projection, report) ? 0 : 1;
}

if (import.meta.main) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    // An unreadable source or directory is a failure, never an empty set.
    console.error(`policy-core-v3 vectors: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}
