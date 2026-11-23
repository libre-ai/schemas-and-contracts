// The projection of contracts/fixtures/policy-core-v2/golden.json into runner vectors loses no
// case: every count below is taken from the source document itself, independently of the
// projection under test. The runner is driven only by a synthetic command (AGENTS.md: no SDK or
// product is exercised through it here).

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseStrictJson } from "./policy-core-raw-inputs";
import {
  checkDrift,
  driftLine,
  GOLDEN_PATH,
  isClean,
  loadProjection,
  projectGolden,
  VECTOR_DIRECTORY,
  VECTOR_KIND,
  VECTOR_ROOT,
  type Vector,
} from "./policy-core-v2-golden-vectors";

interface SourceCase {
  id: string;
  policy: unknown;
  snapshot: unknown;
  need: unknown;
  evaluatedAt: string;
  expectedEvaluation?: unknown;
  expectedError?: { variant: string };
}

const runner = resolve(import.meta.dir, "conformance-runner.ts");
let scratch = "";
let source: { cases: SourceCase[] } & Record<string, unknown>;

beforeAll(async () => {
  scratch = await mkdtemp(join(tmpdir(), "policy-core-v2-vectors-test-"));
  // A missing or unreadable source rejects here and fails every test: never an empty set.
  source = parseStrictJson(await readFile(GOLDEN_PATH)) as typeof source;
});

afterAll(async () => {
  if (scratch) await rm(scratch, { recursive: true, force: true });
});

async function storedVector(caseId: string): Promise<Vector> {
  return parseStrictJson(await readFile(join(VECTOR_DIRECTORY, `${caseId}.vector.json`))) as Vector;
}

describe("policy-core-v2 golden vectors", () => {
  test("every golden case has exactly one vector, and the counters sum", async () => {
    const ids = source.cases.map((testCase) => testCase.id);
    const errorCases = source.cases.filter((testCase) => "expectedError" in testCase).length;
    const onDisk = (await readdir(VECTOR_DIRECTORY)).sort();
    const report = await checkDrift(await loadProjection());
    console.log(driftLine(report));

    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    expect(onDisk).toEqual(ids.map((id) => `${id}.vector.json`).sort());
    expect(report.cases).toBe(ids.length);
    expect(report.reject).toBe(errorCases);
    expect(report.accept).toBe(ids.length - errorCases);
    expect(report.accept + report.reject).toBe(ids.length);
    expect(report.onDisk).toBe(ids.length);
    expect(report.identical).toBe(ids.length);
    expect(report.missing).toEqual([]);
    expect(report.extra).toEqual([]);
    expect(report.differing).toEqual([]);
    expect(isClean(report)).toBe(true);
  });

  test("each stored vector carries its case's arguments and expectation", async () => {
    let compared = 0;
    for (const testCase of source.cases) {
      const vector = await storedVector(testCase.id);
      expect(vector.id).toBe(`policy-core-v2/golden/${testCase.id}`);
      expect(vector.kind).toBe(VECTOR_KIND);
      expect(vector.criteria).toEqual([source.semantics as string]);
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
        // The canonical text parses back to the same evaluation.
        expect(JSON.parse(vector.expected.canonicalOutput as string)).toEqual(
          testCase.expectedEvaluation,
        );
      }
      compared += 1;
    }
    console.log(`policy-core-v2 golden vectors: ${compared} vector(s) compared to their case`);
    expect(compared).toBe(source.cases.length);
  });

  test("the runner loads every vector as valid", async () => {
    // A synthetic implementation that supports nothing: each valid vector is `unavailable`, and
    // any vector the runner cannot load would be `blocked`.
    const child = Bun.spawn(
      [
        process.execPath,
        runner,
        VECTOR_ROOT,
        "--filter",
        "policy-core-v2",
        "--impl",
        `printf '{"outcome":"unsupported"}'`,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const output = await new Response(child.stdout).text();
    const code = await child.exited;
    const summary = output.trim().split("\n").at(-1);
    console.log(`runner over policy-core-v2: ${summary}`);
    const total = source.cases.length;
    expect(summary).toBe(
      `discovered=${total} total=${total} pass=0 fail=0 unavailable=${total} blocked=0`,
    );
    expect(code).toBe(2);
  }, 60_000);

  test("an unreadable source or vector directory throws, never yields an empty set", async () => {
    await expect(loadProjection(join(scratch, "absent.json"))).rejects.toThrow();
    const projection = await loadProjection();
    await expect(checkDrift(projection, join(scratch, "absent-directory"))).rejects.toThrow();
  });

  test("a projection refuses every doubtful case instead of dropping it", () => {
    const base = () => structuredClone(source) as Record<string, unknown> & { cases: unknown[] };
    const first = (): Record<string, unknown> => ({ ...structuredClone(source.cases[0]) });
    const neither = first();
    delete neither.expectedEvaluation;
    const errorCase = first();
    delete errorCase.expectedEvaluation;
    errorCase.expectedError = { variant: "not-a-code" };
    // Each document differs from the real one by one defect; the message names that defect, so a
    // refusal for another reason does not count.
    const refusals: [Record<string, unknown>, RegExp][] = [
      [{ ...base(), cases: [] }, /has no case/],
      [{ ...base(), extra: true }, /members differ/],
      [{ ...base(), canonicalization: "none" }, /another canonicalization/],
      [{ ...base(), cases: [first(), first()] }, /two cases share/],
      [{ ...base(), cases: [{ ...first(), note: "x" }] }, /unknown member note/],
      [
        { ...base(), cases: [{ ...first(), expectedError: { variant: "input-invalid" } }] },
        /exactly one of/,
      ],
      [{ ...base(), cases: [neither] }, /exactly one of/],
      [{ ...base(), cases: [{ ...first(), id: "../x" }] }, /file-name stem/],
      [{ ...base(), cases: [errorCase] }, /one WIT error-code variant/],
      [{ ...base(), cases: [{ ...first(), expectedEvaluation: { score: 0.5 } }] }, /safe integers/],
    ];
    for (const [document, reason] of refusals)
      expect(() => projectGolden(document)).toThrow(reason);
    console.log(`policy-core-v2 golden vectors: ${refusals.length} refusal(s) exercised`);
  });

  test("drift is named: a missing, an extra and a differing vector", async () => {
    const copy = join(scratch, "drift");
    await cp(VECTOR_DIRECTORY, copy, { recursive: true });
    const [missing, differing] = source.cases.map((testCase) => `${testCase.id}.vector.json`);
    if (missing === undefined || differing === undefined)
      throw new Error("the drift test needs at least two golden cases");
    await rm(join(copy, missing));
    await writeFile(join(copy, "extra.vector.json"), "{}\n");
    const altered = (await storedVector(source.cases[1]?.id ?? "")) as Vector;
    altered.expected = { ...altered.expected, outcome: "reject" };
    await writeFile(join(copy, differing), JSON.stringify(altered));

    const report = await checkDrift(await loadProjection(), copy);
    expect(report.missing).toEqual([missing]);
    expect(report.extra).toEqual(["extra.vector.json"]);
    expect(report.differing).toEqual([differing]);
    expect(isClean(report)).toBe(false);
  });
});
