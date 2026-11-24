// The projection of the policy-core-v3 fixtures into runner vectors loses no case: every count
// and every expectation below is taken from the source documents themselves (golden.json, the
// raw-input manifest and its .bin files), independently of the projection under test. The runner
// is driven only by synthetic commands (AGENTS.md: no SDK or product is exercised through it
// here); the replay command answers from the fixtures, never from the vectors.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseStrictJson } from "./policy-core-raw-inputs";
import {
  checkV3Drift,
  driftLine,
  GOLDEN_PATH,
  isClean,
  loadV3Projection,
  projectionLine,
  projectV3,
  RAW_INPUT_ROOT,
  type V3Vector,
  VECTOR_DIRECTORY,
  VECTOR_KIND,
  VECTOR_ROOT,
} from "./policy-core-v3-vectors";

interface GoldenCase {
  id: string;
  policy: unknown;
  snapshot: unknown;
  need: unknown;
  evaluatedAt: string;
  expectedEvaluation?: unknown;
  expectedError?: { variant: string };
}

interface RawCase {
  id: string;
  file: string;
  inputSha256: string;
  byteLength: number;
  defect?: string;
  argument?: "policy" | "snapshot" | "need";
  goldenCase?: string;
  expectedErrors: Record<string, { variant: string }>;
}

const ARGUMENT_NAMES = ["policy", "snapshot", "need"] as const;
const runner = resolve(import.meta.dir, "conformance-runner.ts");
const canonical = resolve(import.meta.dir, "authorized-execution.ts");
let scratch = "";
let golden: { semantics: string; cases: GoldenCase[] } & Record<string, unknown>;
let manifest: { cases: RawCase[]; acceptedCases: unknown[] } & Record<string, unknown>;

beforeAll(async () => {
  scratch = await mkdtemp(join(tmpdir(), "policy-core-v3-vectors-test-"));
  // A missing or unreadable source rejects here and fails every test: never an empty set.
  golden = parseStrictJson(await readFile(GOLDEN_PATH)) as typeof golden;
  manifest = parseStrictJson(
    await readFile(join(RAW_INPUT_ROOT, "manifest.json")),
  ) as typeof manifest;
});

afterAll(async () => {
  if (scratch) await rm(scratch, { recursive: true, force: true });
});

/** SEMANTICS section 10: the golden case whose other arguments a raw input travels with. */
function hostCase(raw: RawCase): GoldenCase {
  const id =
    raw.goldenCase ?? golden.cases.find((testCase) => "expectedEvaluation" in testCase)?.id;
  const found = golden.cases.find((testCase) => testCase.id === id);
  if (found === undefined) throw new Error(`${raw.id}: no host golden case`);
  return found;
}

/** The arguments a raw input is passed as: the one it names, or each of the three. */
function argumentsOf(raw: RawCase): readonly ("policy" | "snapshot" | "need")[] {
  return raw.argument === undefined ? ARGUMENT_NAMES : [raw.argument];
}

/** Vector file paths, relative to the v3 vector directory, as section 10 implies them. */
function expectedPaths(): string[] {
  const paths = golden.cases.map((testCase) => `golden/${testCase.id}.vector.json`);
  for (const raw of manifest.cases)
    for (const argument of argumentsOf(raw))
      paths.push(`raw-inputs/${argument}/${raw.id}.vector.json`);
  return paths.sort();
}

async function filesUnder(directory: string, prefix = ""): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory())
      found.push(...(await filesUnder(join(directory, entry.name), `${prefix}${entry.name}/`)));
    else found.push(`${prefix}${entry.name}`);
  }
  return found.sort();
}

async function storedVector(path: string): Promise<V3Vector> {
  return parseStrictJson(await readFile(join(VECTOR_DIRECTORY, path))) as V3Vector;
}

async function runRunner(implementation: string) {
  const child = Bun.spawn(
    [process.execPath, runner, VECTOR_ROOT, "--filter", "policy-core-v3", "--impl", implementation],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [output, errors] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  const code = await child.exited;
  const lines = output.trim().split("\n");
  return { code, lines, summary: lines.at(-1) ?? "", errors };
}

describe("policy-core-v3 vectors", () => {
  test("every golden case and every refused raw input has its vectors, and the counters sum", async () => {
    const paths = expectedPaths();
    const carriers = manifest.cases.filter((raw) => raw.argument !== undefined).length;
    const spread = manifest.cases.length - carriers;
    const projection = await loadV3Projection();
    const report = await checkV3Drift(projection);
    console.log(projectionLine(projection));
    console.log(driftLine(report));

    expect(golden.cases.length).toBeGreaterThan(0);
    expect(manifest.cases.length).toBeGreaterThan(0);
    expect(new Set(paths).size).toBe(paths.length);
    expect(await filesUnder(VECTOR_DIRECTORY)).toEqual(paths);
    expect(projection.goldenCases).toBe(golden.cases.length);
    expect(projection.rawCases).toBe(manifest.cases.length);
    expect(projection.carriers).toBe(carriers);
    expect(projection.spread).toBe(spread);
    expect(projection.rawVectors).toBe(carriers + 3 * spread);
    expect(projection.oracleOnly).toBe(manifest.acceptedCases.length);
    expect(report.expected).toBe(paths.length);
    expect(report.onDisk).toBe(paths.length);
    expect(report.identical).toBe(paths.length);
    expect(report.missing).toEqual([]);
    expect(report.extra).toEqual([]);
    expect(report.differing).toEqual([]);
    expect(isClean(projection, report)).toBe(true);
  });

  test("each raw vector carries the fixture octets, its host's arguments and the WIT variant only", async () => {
    let compared = 0;
    for (const raw of manifest.cases) {
      const octets = new Uint8Array(await readFile(join(RAW_INPUT_ROOT, raw.file)));
      const host = hostCase(raw);
      for (const argument of argumentsOf(raw)) {
        const vector = await storedVector(`raw-inputs/${argument}/${raw.id}.vector.json`);
        expect(vector.id).toBe(`policy-core-v3/raw-inputs/${argument}/${raw.id}`);
        expect(vector.kind).toBe(VECTOR_KIND);
        expect(vector.criteria).toEqual([golden.semantics]);
        expect(vector.dependsOn).toEqual([`policy-core-v3/golden/${host.id}`]);
        expect(Object.keys(vector.inputBytes ?? {})).toEqual([argument]);
        const decoded = new Uint8Array(Buffer.from(vector.inputBytes?.[argument] ?? "", "base64"));
        expect(decoded).toEqual(octets);
        expect(createHash("sha256").update(decoded).digest("hex")).toBe(raw.inputSha256);
        const others: Record<string, unknown> = {};
        for (const name of ARGUMENT_NAMES) if (name !== argument) others[name] = host[name];
        expect(vector.input).toEqual({ ...others, evaluatedAt: host.evaluatedAt });
        // The component is judged on the WIT variant; the oracle class never reaches a vector.
        expect(vector.expected).toEqual({
          outcome: "reject",
          code: raw.expectedErrors["policy-core-v3"]?.variant,
        });
        expect(Object.keys(vector).sort()).toEqual([
          "criteria",
          "data",
          "dependsOn",
          "description",
          "expected",
          "id",
          "input",
          "inputBytes",
          "kind",
        ]);
        compared += 1;
      }
    }
    console.log(`policy-core-v3 vectors: ${compared} raw vector(s) compared to their fixture`);
    expect(compared).toBe(expectedPaths().length - golden.cases.length);
  });

  test("each golden vector carries its case's arguments and expectation", async () => {
    let compared = 0;
    for (const testCase of golden.cases) {
      const vector = await storedVector(`golden/${testCase.id}.vector.json`);
      expect(vector.id).toBe(`policy-core-v3/golden/${testCase.id}`);
      expect(vector.kind).toBe(VECTOR_KIND);
      expect(vector.criteria).toEqual([golden.semantics]);
      expect("inputBytes" in vector).toBe(false);
      expect(vector.input).toEqual({
        policy: testCase.policy,
        snapshot: testCase.snapshot,
        need: testCase.need,
        evaluatedAt: testCase.evaluatedAt,
      });
      if (testCase.expectedError !== undefined)
        expect(vector.expected).toEqual({
          outcome: "reject",
          code: testCase.expectedError.variant,
        });
      else {
        expect(vector.expected.outcome).toBe("accept");
        expect(vector.expected.evaluation).toEqual(testCase.expectedEvaluation);
        expect(JSON.parse(vector.expected.canonicalOutput as string)).toEqual(
          testCase.expectedEvaluation,
        );
      }
      compared += 1;
    }
    console.log(`policy-core-v3 vectors: ${compared} golden vector(s) compared to their case`);
    expect(compared).toBe(golden.cases.length);
  });

  test("the runner passes every vector to an implementation that answers from the fixtures", async () => {
    // The replay reads the octets it receives, finds them in the manifest by SHA-256 and answers
    // the case's WIT variant; for JSON arguments it finds the golden case and answers its
    // expectation. A vector whose octets or arguments were altered in transit or in projection
    // fails, and a vector the runner cannot load is blocked.
    const replay = join(scratch, "replay.ts");
    await writeFile(
      replay,
      `import { createHash } from "node:crypto";
import { canonicalJson } from ${JSON.stringify(canonical)};
const [goldenPath, rawRoot] = process.argv.slice(2);
const request = JSON.parse(await Bun.stdin.text());
const golden = JSON.parse(await Bun.file(goldenPath).text());
const manifest = JSON.parse(await Bun.file(rawRoot + "/manifest.json").text());
let reply = { outcome: "accept" };
if (request.inputBytes !== undefined) {
  const [[, encoded]] = Object.entries(request.inputBytes);
  const sha = createHash("sha256").update(Buffer.from(encoded, "base64")).digest("hex");
  const raw = manifest.cases.find((entry) => entry.inputSha256 === sha);
  if (raw !== undefined) reply = { outcome: "reject", code: raw.expectedErrors["policy-core-v3"].variant };
} else {
  const found = golden.cases.find((entry) => Bun.deepEquals(request.input,
    { policy: entry.policy, snapshot: entry.snapshot, need: entry.need, evaluatedAt: entry.evaluatedAt }, true));
  if (found?.expectedError !== undefined) reply = { outcome: "reject", code: found.expectedError.variant };
  else if (found !== undefined)
    reply = { outcome: "accept", evaluation: found.expectedEvaluation, canonicalOutput: canonicalJson(found.expectedEvaluation) };
}
process.stdout.write(JSON.stringify(reply));
`,
    );
    const quote = (path: string) => `'${path.replaceAll("'", `'\\''`)}'`;
    const outcome = await runRunner(
      [process.execPath, replay, GOLDEN_PATH, RAW_INPUT_ROOT].map(quote).join(" "),
    );
    console.log(`runner over policy-core-v3, replay from fixtures: ${outcome.summary}`);
    if (outcome.code !== 0)
      console.log(`runner exit code ${outcome.code}, stderr:\n${outcome.errors}`);
    const total = expectedPaths().length;
    expect(outcome.summary).toBe(
      `discovered=${total} total=${total} pass=${total} fail=0 unavailable=0 blocked=0`,
    );
    expect(outcome.code).toBe(0);
  }, 180_000);

  test("an implementation that refuses everything passes no raw vector", async () => {
    // Each raw vector depends on the golden case lending its other arguments, and those all
    // expect an evaluation: refusing them fails the golden vector and blocks the raw ones.
    const outcome = await runRunner(`printf '{"outcome":"reject","code":"input-invalid"}'`);
    console.log(`runner over policy-core-v3, refuse everything: ${outcome.summary}`);
    const total = expectedPaths().length;
    const inputInvalid = golden.cases.filter(
      (testCase) => testCase.expectedError?.variant === "input-invalid",
    ).length;
    const raw = total - golden.cases.length;
    expect(outcome.summary).toBe(
      `discovered=${total} total=${total} pass=${inputInvalid} ` +
        `fail=${golden.cases.length - inputInvalid} unavailable=0 blocked=${raw}`,
    );
    for (const line of outcome.lines.filter((text) => text.startsWith("blocked\t")))
      expect(line).toMatch(/\tdependency policy-core-v3\/golden\/[a-z0-9-]+ is fail$/);
    expect(outcome.code).toBe(1);
  }, 60_000);

  test("an unreadable source or vector directory throws, never yields an empty set", async () => {
    await expect(loadV3Projection(join(scratch, "absent.json"))).rejects.toThrow();
    await expect(loadV3Projection(GOLDEN_PATH, join(scratch, "absent"))).rejects.toThrow();
    const projection = await loadV3Projection();
    await expect(checkV3Drift(projection, join(scratch, "absent-directory"))).rejects.toThrow();
  });

  test("a projection refuses every doubtful raw input instead of dropping it", async () => {
    const files = new Map<string, Uint8Array>();
    for (const raw of manifest.cases)
      files.set(raw.file, new Uint8Array(await readFile(join(RAW_INPUT_ROOT, raw.file))));
    const carrier = manifest.cases.find((raw) => raw.argument !== undefined);
    const plain = manifest.cases.find((raw) => raw.argument === undefined);
    if (carrier === undefined || plain === undefined)
      throw new Error("the refusal test needs a carrier and a plain raw input");
    const errorCase = golden.cases.find((testCase) => testCase.expectedError !== undefined);
    if (errorCase === undefined) throw new Error("the refusal test needs a golden error case");
    const base = () => structuredClone(manifest) as Record<string, unknown> & { cases: unknown[] };
    const one = (changes: Record<string, unknown>, source: RawCase = plain) => ({
      ...base(),
      cases: [{ ...structuredClone(source), ...changes }],
    });
    const { argument: _argument, ...carrierWithoutArgument } = structuredClone(carrier);
    // Each manifest differs from the real one by one defect; the message names that defect, so a
    // refusal for another reason does not count.
    const refusals: [unknown, RegExp][] = [
      [{ ...base(), cases: [] }, /has no refused case/],
      [{ ...base(), extra: true }, /members differ/],
      [{ ...base(), schemaVersion: "other" }, /another schemaVersion/],
      [{ ...base(), cases: [plain, plain] }, /two raw cases share/],
      [one({ comment: "x" }), /unknown member comment/],
      [one({ id: "../x" }), /file-name stem/],
      [one({ file: "../x.bin" }), /safe \.bin name/],
      [one({ inputSha256: "0".repeat(64) }), /differs from inputSha256/],
      [one({ byteLength: plain.byteLength + 1 }), /differs from byteLength/],
      [one({ expectedErrors: { "policy-core-v3": { variant: "x" } } }), /one policy-core-v3 WIT/],
      [one({ expectedErrors: { "policy-core-v2": { variant: "input-invalid" } } }), /one policy/],
      [{ ...base(), cases: [carrierWithoutArgument] }, /go together/],
      [one({ argument: "evaluatedAt" }, carrier), /not policy, snapshot or need/],
      [one({ goldenCase: "absent" }, carrier), /no golden case that evaluates/],
      [one({ goldenCase: errorCase.id }, carrier), /no golden case that evaluates/],
    ];
    for (const [document, reason] of refusals)
      expect(() => projectV3(golden, document, files)).toThrow(reason);
    const unread = new Map(files);
    unread.delete(plain.file);
    expect(() => projectV3(golden, manifest, unread)).toThrow(/is not read/);
    console.log(`policy-core-v3 vectors: ${refusals.length + 1} refusal(s) exercised`);
  });

  test("drift is named: a missing, an extra and a differing vector, an extra directory", async () => {
    const copy = join(scratch, "drift");
    await cp(VECTOR_DIRECTORY, copy, { recursive: true });
    const raw = manifest.cases[0];
    const second = manifest.cases[1];
    if (raw === undefined || second === undefined)
      throw new Error("the drift test needs at least two raw inputs");
    const missing = `raw-inputs/${argumentsOf(raw)[0]}/${raw.id}.vector.json`;
    const differing = `raw-inputs/${argumentsOf(second)[0]}/${second.id}.vector.json`;
    await rm(join(copy, missing));
    await writeFile(join(copy, "raw-inputs/policy/extra.vector.json"), "{}\n");
    await mkdir(join(copy, "raw-inputs/stray"));
    const altered = await storedVector(differing);
    altered.expected = { ...altered.expected, outcome: "accept" };
    await writeFile(join(copy, differing), JSON.stringify(altered));

    const projection = await loadV3Projection();
    const report = await checkV3Drift(projection, copy);
    expect(report.missing).toEqual([missing]);
    expect(report.extra).toEqual(["raw-inputs/policy/extra.vector.json", "raw-inputs/stray/"]);
    expect(report.differing).toEqual([differing]);
    expect(isClean(projection, report)).toBe(false);
  });
});
