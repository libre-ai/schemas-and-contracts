// Four-state vector runner, with an isolated external implementation.
//
//   bun tools/quality/conformance-runner.ts <root> --impl <command> [--filter <subdirectory>]
//
// A tool of this authority, not a gate of it: an implementing repository consumes it at a pinned
// revision and runs it against its own implementation, in its own CI. This repository only ever
// exercises it against synthetic commands created by its tests (AGENTS.md, "Implementation
// conformance ... is proved in the implementing repository").
//
// Discovery. Every file under <root> whose name ends exactly with `.vector.json` is a vector.
// Every other entry whose name contains "vector" in any case (`a.vectors.json`, `b.Vector.json`,
// `c.vector.JSON`), and every symbolic link bearing such a name, is counted too and reported
// `blocked`, so a misnamed vector is never silently skipped. Symbolic links are never followed.
//
// A vector is one strict JSON object of at most 1 MiB with exactly these members:
//   id          string, equal to the path relative to <root> without the `.vector.json` suffix
//   criteria    string[]
//   kind        string, opaque to the runner
//   description string
//   dependsOn   string[] of vector ids
//   data        string[] of paths relative to the vector's directory (may be empty)
//   input       any JSON value
//   expected    object with `outcome` ("accept" or "reject") and any other member to compare
//
// Each discovered entry gets exactly one state:
//   pass         the response carries the expected outcome and every other expected member
//   fail         it does not, or the invariant registered for the kind names a gap
//   unavailable  the implementation answers `unsupported`, or rejects without `errors` where
//                the expectation carries `errors`
//   blocked      the case could not be judged; the detail names the cause (unreadable file,
//                file above the cap, invalid vector, id differing from the path, near-miss name,
//                id colliding with another discovered entry, unknown dependency, dependency not
//                pass, dependency cycle, data path defect, unreadable data, exit code, non-JSON
//                output, output above the cap, timeout, private directory not created or not
//                removed, implementation not launched)
//
// Dependencies run first. A vector is `blocked` without launching the implementation when one
// of its dependencies is not `pass`, is unknown (which includes: outside the filter), or when it
// sits on a dependency cycle.
//
// Output: one line per entry, `<state>\t<id>\t<detail>`, sorted by id, then
// `discovered=D total=T pass=P fail=F unavailable=U blocked=B`.
// Exit codes: 0 all pass; 1 at least one fail; 2 no fail, at least one unavailable or blocked;
// 3 usage, nothing discovered, or counters that do not add up to the discovered volume.
//
// The child protocol and its isolation are described in conformance-runner-process.ts.

import { readdir, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { canonicalJson } from "./authorized-execution";
import { namesVectorFile, OUTPUT_MAX_OCTETS, runCase } from "./conformance-runner-process";
import { parseStrictJson } from "./policy-core-raw-inputs";

export type ConformanceState = "pass" | "fail" | "unavailable" | "blocked";

export interface VectorResult {
  id: string;
  state: ConformanceState;
  detail: string;
}

/** Pure check of one accepted response; returns the first gap it finds, or null. */
export type KindInvariant = (
  kind: string,
  input: unknown,
  response: Record<string, unknown>,
) => string | null;

export interface RunOptions {
  root: string;
  implementation: string;
  /** Subdirectory of the root to restrict discovery to, or null for the whole root. */
  filter: string | null;
  invariants: ReadonlyMap<string, KindInvariant>;
  timeoutMs: number;
}

export const CASE_TIMEOUT_MS = 30_000;

/** A request the runner cannot serve at all (exit code 3), as opposed to a vector state. */
export class ConformanceUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConformanceUsageError";
  }
}

const VECTOR_SUFFIX = ".vector.json";
const VECTOR_MEMBERS = [
  "criteria",
  "data",
  "dependsOn",
  "description",
  "expected",
  "id",
  "input",
  "kind",
];
const STATES: readonly ConformanceState[] = ["pass", "fail", "unavailable", "blocked"];

interface Vector {
  id: string;
  kind: string;
  dependsOn: string[];
  data: string[];
  input: unknown;
  expected: Record<string, unknown>;
  directory: string;
}

interface Discovered {
  /** Path relative to the root, with `/` separators. */
  path: string;
  kind: "vector" | "near-miss" | "unreadable-directory";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

async function discover(root: string, directory: string, found: Discovered[]): Promise<void> {
  const path = (name: string): string => relative(root, join(directory, name)).split(sep).join("/");
  let entries: Awaited<ReturnType<typeof readdirEntries>>;
  try {
    entries = await readdirEntries(directory);
  } catch {
    // A directory that cannot be listed is a counted failure, never an empty one.
    found.push({ path: path("."), kind: "unreadable-directory" });
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) await discover(root, join(directory, entry.name), found);
    else if (entry.isFile() && entry.name.endsWith(VECTOR_SUFFIX))
      found.push({ path: path(entry.name), kind: "vector" });
    else if (namesVectorFile(entry.name)) found.push({ path: path(entry.name), kind: "near-miss" });
  }
}

async function readdirEntries(directory: string) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries.sort((left, right) => (left.name < right.name ? -1 : 1));
}

/** The loaded vector, or the cause that blocks it. */
async function loadVector(file: string, id: string): Promise<Vector | string> {
  let bytes: Uint8Array;
  try {
    // One octet past the cap at most, so an oversized file is never loaded whole.
    bytes = await Bun.file(file)
      .slice(0, OUTPUT_MAX_OCTETS + 1)
      .bytes();
  } catch {
    return "unreadable file";
  }
  if (bytes.byteLength > OUTPUT_MAX_OCTETS) return `file above ${OUTPUT_MAX_OCTETS} octets`;
  let value: unknown;
  try {
    value = parseStrictJson(bytes);
  } catch {
    return "invalid vector: not strict JSON";
  }
  if (!isRecord(value)) return "invalid vector: not an object";
  const members = Object.keys(value).sort();
  const unknown = members.find((member) => !VECTOR_MEMBERS.includes(member));
  if (unknown !== undefined) return "invalid vector: unknown member";
  const missing = VECTOR_MEMBERS.find((member) => !members.includes(member));
  if (missing !== undefined) return `invalid vector: missing member ${missing}`;
  const { id: declared, criteria, kind, description, dependsOn, data, input, expected } = value;
  if (typeof declared !== "string") return "invalid vector: id is not a string";
  if (!isStringList(criteria)) return "invalid vector: criteria is not a list of strings";
  if (typeof kind !== "string") return "invalid vector: kind is not a string";
  if (typeof description !== "string") return "invalid vector: description is not a string";
  if (!isStringList(dependsOn)) return "invalid vector: dependsOn is not a list of strings";
  if (!isStringList(data)) return "invalid vector: data is not a list of strings";
  if (!isRecord(expected) || (expected.outcome !== "accept" && expected.outcome !== "reject"))
    return "invalid vector: expected is not an object with outcome accept or reject";
  try {
    canonicalJson(expected);
  } catch {
    return "invalid vector: expected has no canonical form";
  }
  if (declared !== id) return "id differs from path";
  return { id, kind, dependsOn, data, input, expected, directory: dirname(file) };
}

/** Ids that can reach themselves through `dependsOn`. */
function cycleMembers(vectors: ReadonlyMap<string, Vector>): Set<string> {
  const members = new Set<string>();
  for (const [id, vector] of vectors) {
    const seen = new Set<string>();
    const pending = [...vector.dependsOn];
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
      if (next === id) {
        members.add(id);
        break;
      }
      if (seen.has(next)) continue;
      seen.add(next);
      pending.push(...(vectors.get(next)?.dependsOn ?? []));
    }
  }
  return members;
}

function sameJson(left: unknown, right: unknown): boolean {
  try {
    return canonicalJson(left) === canonicalJson(right);
  } catch {
    return false;
  }
}

function classify(
  vector: Vector,
  response: Record<string, unknown>,
  invariants: ReadonlyMap<string, KindInvariant>,
): { state: ConformanceState; detail: string } {
  const { expected } = vector;
  if (response.outcome === "unsupported")
    return { state: "unavailable", detail: "implementation answers unsupported" };
  if (
    expected.outcome === "reject" &&
    "errors" in expected &&
    response.outcome === "reject" &&
    !("errors" in response)
  )
    return { state: "unavailable", detail: "implementation rejects without errors" };
  if (response.outcome !== expected.outcome)
    return { state: "fail", detail: `outcome is not ${String(expected.outcome)}` };
  for (const member of Object.keys(expected).sort()) {
    if (member === "outcome") continue;
    if (!(member in response) || !sameJson(expected[member], response[member]))
      return { state: "fail", detail: `member ${member} differs from expected` };
  }
  const invariant = response.outcome === "accept" ? invariants.get(vector.kind) : undefined;
  if (invariant !== undefined) {
    let gap: string | null;
    try {
      gap = invariant(vector.kind, vector.input, response);
    } catch {
      gap = "the invariant threw";
    }
    if (gap !== null) return { state: "fail", detail: `invariant: ${gap}` };
  }
  return { state: "pass", detail: "" };
}

async function startDirectory(root: string, filter: string | null): Promise<[string, string]> {
  let realRoot: string;
  try {
    realRoot = await realpath(root);
    if (!(await stat(realRoot)).isDirectory()) throw new Error("not a directory");
  } catch {
    throw new ConformanceUsageError("the root is not a readable directory");
  }
  if (filter === null) return [realRoot, realRoot];
  let start: string;
  try {
    start = await realpath(join(realRoot, filter));
    if (!(await stat(start)).isDirectory()) throw new Error("not a directory");
  } catch {
    throw new ConformanceUsageError("the filter is not a readable directory");
  }
  const fromRoot = relative(realRoot, start);
  if (isAbsolute(filter) || isAbsolute(fromRoot) || fromRoot.split(sep).includes(".."))
    throw new ConformanceUsageError("the filter is outside the root");
  return [realRoot, start];
}

export async function runConformance(
  options: RunOptions,
): Promise<{ results: VectorResult[]; discovered: number }> {
  const [root, start] = await startDirectory(options.root, options.filter);
  const found: Discovered[] = [];
  await discover(root, start, found);

  const results: VectorResult[] = [];
  const settled = new Map<string, VectorResult>();
  const vectors = new Map<string, Vector>();
  const settle = (id: string, state: ConformanceState, detail: string): VectorResult => {
    const result = { id, state, detail };
    settled.set(id, result);
    results.push(result);
    return result;
  };

  // `a.vector.vector.json` has the id `a.vector`, which is also the path of an entry named
  // `a.vector`: such a vector is blocked, so no id is ever resolved to one of two entries.
  const otherPaths = new Set(
    found.filter((entry) => entry.kind !== "vector").map((entry) => entry.path),
  );
  for (const entry of found) {
    if (entry.kind === "vector" && otherPaths.has(entry.path.slice(0, -VECTOR_SUFFIX.length)))
      settle(
        entry.path.slice(0, -VECTOR_SUFFIX.length),
        "blocked",
        "id collides with another discovered entry",
      );
    else if (entry.kind === "near-miss")
      results.push({ id: entry.path, state: "blocked", detail: "near-miss vector file name" });
    else if (entry.kind === "unreadable-directory")
      results.push({ id: entry.path, state: "blocked", detail: "unreadable directory" });
    else {
      const id = entry.path.slice(0, -VECTOR_SUFFIX.length);
      const loaded = await loadVector(join(root, entry.path), id);
      if (typeof loaded === "string") settle(id, "blocked", loaded);
      else vectors.set(id, loaded);
    }
  }

  const cycles = cycleMembers(vectors);
  const evaluate = async (vector: Vector): Promise<VectorResult> => {
    const known = settled.get(vector.id);
    if (known !== undefined) return known;
    if (cycles.has(vector.id)) return settle(vector.id, "blocked", "dependency cycle");
    for (const dependency of vector.dependsOn) {
      const target = vectors.get(dependency);
      const outcome = target === undefined ? settled.get(dependency) : await evaluate(target);
      if (outcome === undefined)
        return settle(vector.id, "blocked", `unknown dependency ${dependency}`);
      if (outcome.state !== "pass")
        return settle(vector.id, "blocked", `dependency ${dependency} is ${outcome.state}`);
    }
    const outcome = await runCase(
      options.implementation,
      vector.directory,
      vector.kind,
      vector.input,
      vector.data,
      options.timeoutMs,
    );
    if (outcome.kind === "blocked") return settle(vector.id, "blocked", outcome.cause);
    const { state, detail } = classify(vector, outcome.response, options.invariants);
    return settle(vector.id, state, detail);
  };
  for (const vector of vectors.values()) await evaluate(vector);

  results.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  return { results, discovered: found.length };
}

function count(results: readonly VectorResult[], state: ConformanceState): number {
  return results.filter((result) => result.state === state).length;
}

export function exitCode(results: readonly VectorResult[], discovered: number): 0 | 1 | 2 | 3 {
  const counted = STATES.reduce((sum, state) => sum + count(results, state), 0);
  if (discovered === 0 || results.length !== discovered || counted !== discovered) return 3;
  if (count(results, "fail") > 0) return 1;
  if (count(results, "unavailable") + count(results, "blocked") > 0) return 2;
  return 0;
}

export function summaryLine(results: readonly VectorResult[], discovered: number): string {
  const counters = STATES.map((state) => `${state}=${count(results, state)}`).join(" ");
  return `discovered=${discovered} total=${results.length} ${counters}`;
}

/** Ids and details come from file names and vector files: keep each on its own line and field. */
function printable(text: string): string {
  let line = "";
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    line += code < 0x20 || code === 0x7f ? "?" : character;
  }
  return line;
}

function parseArguments(args: readonly string[]): {
  root: string;
  implementation: string;
  filter: string | null;
} {
  const flags = new Map<string, string>();
  const positional: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index] ?? "";
    if (!argument.startsWith("--")) {
      positional.push(argument);
      continue;
    }
    if (argument !== "--impl" && argument !== "--filter")
      throw new ConformanceUsageError(`unknown option ${argument}`);
    if (flags.has(argument)) throw new ConformanceUsageError(`${argument} is given twice`);
    const value = args[index + 1];
    if (value === undefined) throw new ConformanceUsageError(`${argument} needs a value`);
    flags.set(argument, value);
    index += 1;
  }
  const [root, ...extra] = positional;
  if (root === undefined || extra.length > 0)
    throw new ConformanceUsageError("exactly one root is expected");
  const implementation = flags.get("--impl");
  if (implementation === undefined || implementation === "")
    throw new ConformanceUsageError("--impl is required");
  return { root, implementation, filter: flags.get("--filter") ?? null };
}

async function main(args: readonly string[]): Promise<0 | 1 | 2 | 3> {
  try {
    const { root, implementation, filter } = parseArguments(args);
    const { results, discovered } = await runConformance({
      root,
      implementation,
      filter,
      // No domain kind ships with the runner: each lot that catalogs a kind registers its own.
      invariants: new Map(),
      timeoutMs: CASE_TIMEOUT_MS,
    });
    for (const result of results)
      console.log(`${result.state}\t${printable(result.id)}\t${printable(result.detail)}`);
    console.log(summaryLine(results, discovered));
    const code = exitCode(results, discovered);
    if (discovered === 0) console.error("conformance-runner: no vector discovered");
    else if (code === 3) console.error("conformance-runner: counters do not add up");
    return code;
  } catch (error) {
    if (!(error instanceof ConformanceUsageError)) {
      // Never let a runner defect exit with 1, which would read as a failing vector.
      console.error("conformance-runner: internal error");
      return 3;
    }
    console.error(`conformance-runner: ${printable(error.message)}`);
    console.error(
      "usage: bun tools/quality/conformance-runner.ts <root> --impl <command> [--filter <subdirectory>]",
    );
    return 3;
  }
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
