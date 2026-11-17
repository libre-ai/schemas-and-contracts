// The runner is exercised here only against synthetic shell commands created in a temporary
// directory: this repository never drives an SDK or a product through it (AGENTS.md).

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  type ConformanceState,
  ConformanceUsageError,
  exitCode,
  type KindInvariant,
  runConformance,
  summaryLine,
  type VectorResult,
} from "./conformance-runner";
import { runCase } from "./conformance-runner-process";

const script = resolve(import.meta.dir, "conformance-runner.ts");
const ACCEPT = `printf '{"outcome":"accept"}'`;
let scratch = "";
let trees = 0;

beforeAll(async () => {
  scratch = await mkdtemp(join(tmpdir(), "conformance-runner-test-"));
});

afterAll(async () => {
  if (scratch) await rm(scratch, { recursive: true, force: true });
});

type Members = Record<string, unknown>;

function vector(id: string, members: Members = {}): Members {
  return {
    id,
    criteria: ["criterion"],
    kind: `kind-${id}`,
    description: "synthetic vector",
    dependsOn: [],
    data: [],
    input: { value: 1 },
    expected: { outcome: "accept" },
    ...members,
  };
}

/** A fresh root holding `<id>.vector.json` for each vector, plus the raw files given. */
async function tree(vectors: readonly Members[], files: Record<string, string> = {}) {
  trees += 1;
  const root = join(scratch, `tree-${trees}`);
  const all: Record<string, string> = { ...files };
  for (const item of vectors) all[`${String(item.id)}.vector.json`] = JSON.stringify(item);
  await mkdir(root, { recursive: true });
  for (const [path, content] of Object.entries(all)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  return root;
}

interface Run {
  results: VectorResult[];
  discovered: number;
  code: 0 | 1 | 2 | 3;
  state: (id: string) => ConformanceState | undefined;
  detail: (id: string) => string | undefined;
}

function countersOf(line: string): Record<string, number> {
  return Object.fromEntries(
    line.split(" ").map((field) => {
      const [name, value] = field.split("=");
      return [name ?? "", Number(value)];
    }),
  );
}

/** Every run of this suite goes through here, so the counters are checked on each of them. */
async function run(
  root: string,
  implementation: string,
  options: { filter?: string; invariants?: Map<string, KindInvariant>; timeoutMs?: number } = {},
): Promise<Run> {
  const { results, discovered } = await runConformance({
    root,
    implementation,
    filter: options.filter ?? null,
    invariants: options.invariants ?? new Map(),
    timeoutMs: options.timeoutMs ?? 10_000,
  });
  const counters = countersOf(summaryLine(results, discovered));
  expect(
    (counters.pass ?? 0) +
      (counters.fail ?? 0) +
      (counters.unavailable ?? 0) +
      (counters.blocked ?? 0),
  ).toBe(discovered);
  expect(counters.total).toBe(discovered);
  expect(counters.discovered).toBe(discovered);
  const find = (id: string) => results.find((result) => result.id === id);
  return {
    results,
    discovered,
    code: exitCode(results, discovered),
    state: (id) => find(id)?.state,
    detail: (id) => find(id)?.detail,
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function cli(args: readonly string[]) {
  const child = Bun.spawn([process.execPath, script, ...args], { stdout: "pipe", stderr: "pipe" });
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { code, stdout, stderr };
}

describe("discovery", () => {
  test("a root without any vector file discovers nothing and exits 3", async () => {
    const root = await tree([], { "readme.txt": "no vector here", "sub/data.json": "{}" });
    const outcome = await run(root, ACCEPT);
    expect(outcome.discovered).toBe(0);
    expect(outcome.results).toEqual([]);
    expect(outcome.code).toBe(3);
  });

  test("near-miss names are counted and blocked, never skipped", async () => {
    const root = await tree([vector("good")], {
      "a.vectors.json": JSON.stringify(vector("a")),
      "b.Vector.json": JSON.stringify(vector("b")),
      "c.vector.JSON": JSON.stringify(vector("c")),
    });
    await symlink(join(root, "good.vector.json"), join(root, "linked.vector.json"));
    const outcome = await run(root, ACCEPT);
    expect(outcome.discovered).toBe(5);
    expect(outcome.results.length).toBe(5);
    for (const name of ["a.vectors.json", "b.Vector.json", "c.vector.JSON", "linked.vector.json"]) {
      expect(outcome.state(name)).toBe("blocked");
      expect(outcome.detail(name)).toBe("near-miss vector file name");
    }
    expect(outcome.state("good")).toBe("pass");
    expect(outcome.code).toBe(2);
  });

  test("a vector whose id differs from its path is blocked", async () => {
    const root = await tree([], {
      "sub/right.vector.json": JSON.stringify(vector("sub/right")),
      "sub/wrong.vector.json": JSON.stringify(vector("wrong")),
    });
    const outcome = await run(root, ACCEPT);
    expect(outcome.state("sub/right")).toBe("pass");
    expect(outcome.state("sub/wrong")).toBe("blocked");
    expect(outcome.detail("sub/wrong")).toBe("id differs from path");
  });

  test("the member set of a vector is closed, strict and capped", async () => {
    const { description: _dropped, ...withoutDescription } = vector("missing");
    const root = await tree([vector("extra", { note: "unknown member" }), withoutDescription], {
      "duplicate.vector.json": '{"id":"duplicate","id":"duplicate"}',
      "huge.vector.json": JSON.stringify(vector("huge", { description: "x".repeat(1_048_577) })),
      "outcome.vector.json": JSON.stringify(vector("outcome", { expected: { outcome: "maybe" } })),
    });
    const outcome = await run(root, ACCEPT);
    expect(outcome.detail("extra")).toBe("invalid vector: unknown member");
    expect(outcome.detail("missing")).toBe("invalid vector: missing member description");
    expect(outcome.detail("duplicate")).toBe("invalid vector: not strict JSON");
    expect(outcome.detail("huge")).toBe("file above 1048576 octets");
    expect(outcome.detail("outcome")).toBe(
      "invalid vector: expected is not an object with outcome accept or reject",
    );
    expect(outcome.results.map((result) => result.state)).toEqual(Array(5).fill("blocked"));
  });
});

describe("classification", () => {
  test("an implementation that accepts everything fails every negative vector", async () => {
    const root = await tree([
      vector("positive"),
      vector("negative", { expected: { outcome: "reject" } }),
      vector("coded", { expected: { outcome: "reject", code: "too-long" } }),
      vector("detailed", { expected: { outcome: "accept", total: 3 } }),
    ]);
    const outcome = await run(root, ACCEPT);
    expect(outcome.state("positive")).toBe("pass");
    expect(outcome.state("negative")).toBe("fail");
    expect(outcome.state("coded")).toBe("fail");
    expect(outcome.state("detailed")).toBe("fail");
    expect(outcome.detail("detailed")).toBe("member total differs from expected");
    expect(outcome.code).toBe(1);
  });

  test("all vectors passing exits 0", async () => {
    const root = await tree([
      vector("one", { expected: { outcome: "reject", code: "bad" } }),
      vector("two", { expected: { outcome: "reject" } }),
    ]);
    const outcome = await run(root, `printf '{"code":"bad","outcome":"reject","extra":true}'`);
    expect(outcome.results.map((result) => result.state)).toEqual(["pass", "pass"]);
    expect(outcome.code).toBe(0);
  });

  test("a non-zero exit code blocks every vector and never echoes stderr", async () => {
    const root = await tree([vector("one"), vector("two")]);
    const outcome = await run(root, `echo leaked-diagnostic >&2; ${ACCEPT}; exit 1`);
    for (const id of ["one", "two"]) {
      expect(outcome.state(id)).toBe("blocked");
      expect(outcome.detail(id)).toBe("exit code 1");
    }
    expect(outcome.code).toBe(2);
  });

  test("non-JSON output is blocked", async () => {
    const root = await tree([vector("one"), vector("list")]);
    const text = await run(root, "printf 'all good'");
    expect(text.state("one")).toBe("blocked");
    expect(text.detail("one")).toBe("non-JSON output");
    const list = await run(root, "printf '[1]'");
    expect(list.detail("list")).toBe("non-JSON output: not an object");
    expect(list.code).toBe(2);
  });

  test("output above the cap is blocked", async () => {
    const root = await tree([vector("one")]);
    const outcome = await run(root, "head -c 1048577 /dev/zero | tr '\\0' ' '; printf '{}'");
    expect(outcome.state("one")).toBe("blocked");
    expect(outcome.detail("one")).toBe("output above 1048576 octets");
  });

  test("an unsupported answer is unavailable", async () => {
    const root = await tree([vector("one"), vector("two", { expected: { outcome: "reject" } })]);
    const outcome = await run(root, `printf '{"outcome":"unsupported"}'`);
    expect(outcome.results.map((result) => result.state)).toEqual(["unavailable", "unavailable"]);
    expect(outcome.code).toBe(2);
  });

  test("a reject without errors is unavailable, with other errors it fails", async () => {
    const errors = [{ keyword: "required", instancePath: "/subject" }];
    const root = await tree([vector("negative", { expected: { outcome: "reject", errors } })]);
    const silent = await run(root, `printf '{"outcome":"reject"}'`);
    expect(silent.state("negative")).toBe("unavailable");
    expect(silent.code).toBe(2);
    const other = await run(
      root,
      `printf '{"outcome":"reject","errors":[{"keyword":"type","instancePath":"/subject"}]}'`,
    );
    expect(other.state("negative")).toBe("fail");
    expect(other.detail("negative")).toBe("member errors differs from expected");
    expect(other.code).toBe(1);
    const same = await run(
      root,
      `printf '{"errors":[{"instancePath":"/subject","keyword":"required"}],"outcome":"reject"}'`,
    );
    expect(same.state("negative")).toBe("pass");
  });

  test("a registered invariant fails an accepted response that matches its expectation", async () => {
    const reply = { outcome: "accept", parts: [1, 2], total: 4 };
    const root = await tree([
      vector("sum", { kind: "test-sum", expected: reply }),
      vector("other", { expected: reply }),
    ]);
    const invariant: KindInvariant = (_kind, _input, response) => {
      const parts = Array.isArray(response.parts) ? response.parts : [];
      const sum = parts.reduce((total: number, part) => total + Number(part), 0);
      return sum === response.total ? null : `parts add up to ${sum}, total says 4`;
    };
    const command = `printf '${JSON.stringify(reply)}'`;
    const outcome = await run(root, command, { invariants: new Map([["test-sum", invariant]]) });
    expect(outcome.state("sum")).toBe("fail");
    expect(outcome.detail("sum")).toBe("invariant: parts add up to 3, total says 4");
    expect(outcome.state("other")).toBe("pass");
    const unregistered = await run(root, command);
    expect(unregistered.state("sum")).toBe("pass");
  });

  test("an implementation past the time limit is killed and the next vector still runs", async () => {
    const root = await tree([vector("a-slow", { kind: "slow-kind" }), vector("b-quick")]);
    const started = Date.now();
    const outcome = await run(root, `if grep -q slow-kind; then sleep 20; fi; ${ACCEPT}`, {
      timeoutMs: 300,
    });
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(outcome.state("a-slow")).toBe("blocked");
    expect(outcome.detail("a-slow")).toBe("timeout: exceeded 300 ms");
    expect(outcome.state("b-quick")).toBe("pass");
    expect(outcome.code).toBe(2);
  });
});

describe("dependencies", () => {
  test("a vector whose dependency fails is blocked without launching the implementation", async () => {
    const root = await tree([
      vector("a", { expected: { outcome: "reject" } }),
      vector("b", { dependsOn: ["a"] }),
    ]);
    const witness = join(root, "witness.txt");
    const outcome = await run(root, `cat >> '${witness}'; ${ACCEPT}`);
    expect(outcome.state("a")).toBe("fail");
    expect(outcome.state("b")).toBe("blocked");
    expect(outcome.detail("b")).toBe("dependency a is fail");
    const launched = await readFile(witness, "utf8");
    expect(launched).toContain("kind-a");
    expect(launched).not.toContain("kind-b");
  });

  test("dependencies run first, whatever the id order", async () => {
    const root = await tree([vector("a", { dependsOn: ["z"] }), vector("z")]);
    const witness = join(root, "witness.txt");
    const outcome = await run(root, `cat >> '${witness}'; ${ACCEPT}`);
    expect(outcome.results.map((result) => result.state)).toEqual(["pass", "pass"]);
    const launched = await readFile(witness, "utf8");
    expect(launched.indexOf("kind-z")).toBeLessThan(launched.indexOf("kind-a"));
    expect(launched.indexOf("kind-z")).toBeGreaterThanOrEqual(0);
  });

  test("every member of a cycle is blocked and the run ends", async () => {
    const root = await tree([
      vector("a", { dependsOn: ["b"] }),
      vector("b", { dependsOn: ["a"] }),
      vector("self", { dependsOn: ["self"] }),
      vector("after", { dependsOn: ["a"] }),
    ]);
    const witness = join(root, "witness.txt");
    const outcome = await run(root, `cat >> '${witness}'; ${ACCEPT}`);
    for (const id of ["a", "b", "self"]) {
      expect(outcome.state(id)).toBe("blocked");
      expect(outcome.detail(id)).toBe("dependency cycle");
    }
    expect(outcome.detail("after")).toBe("dependency a is blocked");
    expect(await exists(witness)).toBe(false);
    expect(outcome.code).toBe(2);
  });

  test("with a filter, a dependency outside the filter is unknown", async () => {
    const root = await tree([], {
      "in/child.vector.json": JSON.stringify(vector("in/child", { dependsOn: ["out/parent"] })),
      "out/parent.vector.json": JSON.stringify(vector("out/parent")),
    });
    const filtered = await run(root, ACCEPT, { filter: "in" });
    expect(filtered.discovered).toBe(1);
    expect(filtered.state("in/child")).toBe("blocked");
    expect(filtered.detail("in/child")).toBe("unknown dependency out/parent");
    const whole = await run(root, ACCEPT);
    expect(whole.state("in/child")).toBe("pass");
  });

  test("a filter that selects nothing, or leaves the root, exits 3", async () => {
    const root = await tree([vector("one")], { "empty/readme.txt": "nothing" });
    const empty = await run(root, ACCEPT, { filter: "empty" });
    expect(empty.discovered).toBe(0);
    expect(empty.code).toBe(3);
    await expect(run(root, ACCEPT, { filter: ".." })).rejects.toBeInstanceOf(ConformanceUsageError);
    await expect(run(root, ACCEPT, { filter: "absent" })).rejects.toBeInstanceOf(
      ConformanceUsageError,
    );
    expect((await cli([root, "--impl", ACCEPT, "--filter", "empty"])).code).toBe(3);
    expect((await cli([root, "--impl", ACCEPT, "--filter", ".."])).code).toBe(3);
    expect((await cli([root, "--impl", ACCEPT, "--filter", scratch])).code).toBe(3);
  });
});

describe("isolation", () => {
  test("a data path that is a symbolic link, leaves the directory or names a vector is blocked before launch", async () => {
    const root = await tree(
      [
        vector("link", { data: ["link.txt"] }),
        vector("through", { data: ["linked-dir/real.txt"] }),
        vector("parent", { data: ["../x"] }),
        vector("absolute", { data: ["/etc/hosts"] }),
        vector("peer", { data: ["link.vector.json"] }),
        vector("absent", { data: ["absent.txt"] }),
      ],
      { "real.txt": "data", "dir/real.txt": "data" },
    );
    await symlink(join(root, "real.txt"), join(root, "link.txt"));
    await symlink(join(root, "dir"), join(root, "linked-dir"));
    const witness = join(root, "witness.txt");
    const outcome = await run(root, `cat >> '${witness}'; ${ACCEPT}`);
    const symbolic = "data path traverses or designates a symbolic link";
    expect(outcome.detail("link")).toBe(symbolic);
    expect(outcome.detail("through")).toBe(symbolic);
    expect(outcome.detail("parent")).toBe("data path is absolute or contains '..'");
    expect(outcome.detail("absolute")).toBe("data path is absolute or contains '..'");
    expect(outcome.detail("peer")).toBe("data path names a vector file");
    expect(outcome.detail("absent")).toBe("unreadable data");
    expect(outcome.results.map((result) => result.state)).toEqual(Array(6).fill("blocked"));
    expect(await exists(witness)).toBe(false);
  });

  test("the private directory holds only the listed data and is removed afterwards", async () => {
    const root = await tree([vector("case", { data: ["a.txt", "sub/b.txt"] })], {
      "a.txt": "first",
      "sub/b.txt": "second",
      "sub/unlisted.txt": "never copied",
      "expected.json": "never copied",
    });
    const witness = join(root, "stdin.json");
    const command = `cat > '${witness}'; printf '{"outcome":"accept","listing":"%s","cwd":"%s","b":"%s"}' "$(find . | sort | tr '\\n' ' ')" "$(pwd)" "$(cat sub/b.txt)"`;
    const outcome = await runCase(
      command,
      root,
      "kind",
      { value: 1 },
      ["a.txt", "sub/b.txt"],
      10_000,
    );
    if (outcome.kind !== "response") throw new Error(outcome.cause);
    expect(outcome.response.listing).toBe(". ./a.txt ./sub ./sub/b.txt ");
    expect(outcome.response.b).toBe("second");
    const request = JSON.parse(await readFile(witness, "utf8")) as Members;
    expect(Object.keys(request).sort()).toEqual(["dir", "input", "kind"]);
    expect(request).toEqual({ kind: "kind", input: { value: 1 }, dir: outcome.response.cwd });
    expect(String(request.dir)).not.toContain(root);
    expect(await exists(String(request.dir))).toBe(false);
  });

  test("the private directory is removed when the case is blocked", async () => {
    const root = await tree([], { "a.txt": "first" });
    const witness = join(root, "cwd.txt");
    const outcome = await runCase(
      `pwd > '${witness}'; exit 7`,
      root,
      "kind",
      null,
      ["a.txt"],
      10_000,
    );
    expect(outcome).toEqual({ kind: "blocked", cause: "exit code 7" });
    const dir = (await readFile(witness, "utf8")).trim();
    expect(dir.length).toBeGreaterThan(0);
    expect(await exists(dir)).toBe(false);
  });

  test("the child environment holds PATH alone", async () => {
    // Variables a POSIX shell sets by itself at startup, whatever it inherits.
    const shellOwn = new Set(["PWD", "OLDPWD", "SHLVL", "_"]);
    process.env.CONFORMANCE_RUNNER_CANARY = "must not reach the child";
    try {
      const command = `printf '{"outcome":"accept","names":"%s"}' "$(env | cut -d= -f1 | sort | tr '\\n' ' ')"`;
      const outcome = await runCase(command, scratch, "kind", null, [], 10_000);
      if (outcome.kind !== "response") throw new Error(outcome.cause);
      const names = String(outcome.response.names)
        .split(" ")
        .filter((name) => name !== "" && !shellOwn.has(name));
      expect(names).toEqual(["PATH"]);
    } finally {
      delete process.env.CONFORMANCE_RUNNER_CANARY;
    }
  });
});

describe("counters and exit codes", () => {
  test("a result removed before exitCode yields 3", async () => {
    const root = await tree([vector("one"), vector("two")]);
    const outcome = await run(root, ACCEPT);
    expect(exitCode(outcome.results, outcome.discovered)).toBe(0);
    expect(exitCode(outcome.results.slice(1), outcome.discovered)).toBe(3);
    expect(exitCode(outcome.results, outcome.discovered + 1)).toBe(3);
    expect(exitCode([], 0)).toBe(3);
  });

  test("the command line prints one line per vector, then counters that add up", async () => {
    const root = await tree([
      vector("b", { expected: { outcome: "reject" } }),
      vector("a"),
      vector("c", { dependsOn: ["b"] }),
    ]);
    const outcome = await cli([root, "--impl", ACCEPT]);
    expect(outcome.stdout).toBe(
      [
        "pass\ta\t",
        "fail\tb\toutcome is not reject",
        "blocked\tc\tdependency b is fail",
        "discovered=3 total=3 pass=1 fail=1 unavailable=0 blocked=1",
        "",
      ].join("\n"),
    );
    expect(outcome.code).toBe(1);
    const passing = await cli([root, "--impl", ACCEPT, "--filter", "."]);
    expect(passing.code).toBe(1);
  });

  test("the command line refuses a repeated, missing or unknown option with 3", async () => {
    const root = await tree([vector("one")]);
    expect((await cli([root, "--impl", ACCEPT])).code).toBe(0);
    const twice = await cli([root, "--impl", ACCEPT, "--impl", ACCEPT]);
    expect(twice.code).toBe(3);
    expect(twice.stdout).toBe("");
    expect(twice.stderr).toContain("--impl is given twice");
    expect((await cli([root])).code).toBe(3);
    expect((await cli([root, "--impl"])).code).toBe(3);
    expect((await cli(["--impl", ACCEPT])).code).toBe(3);
    expect((await cli([root, "--impl", ACCEPT, "--timeout", "5"])).code).toBe(3);
    expect((await cli([root, "--impl", ACCEPT, "--filter", ".", "--filter", "."])).code).toBe(3);
    expect((await cli([join(root, "absent"), "--impl", ACCEPT])).code).toBe(3);
    const empty = await tree([]);
    const nothing = await cli([empty, "--impl", ACCEPT]);
    expect(nothing.code).toBe(3);
    expect(nothing.stdout).toBe("discovered=0 total=0 pass=0 fail=0 unavailable=0 blocked=0\n");
  });
});
