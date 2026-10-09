import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  CATALOG_PATH,
  CatalogStatusError,
  pagesEqual,
  parseCatalogStatus,
  renderStatusPage,
  STATUS_PAGE_PATH,
} from "./catalog-status";

const script = resolve("tools/quality/catalog-status-page.ts");
let root = "";

interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function run(...args: string[]): Promise<RunResult> {
  const child = Bun.spawn(["bun", script, ...args, `--root=${root}`], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

const baseCatalog = {
  schemaVersion: "libre-ai.contract-catalog.v1",
  contracts: [
    {
      id: "zeta-v1",
      kind: "json-schema",
      path: "contracts/schemas/zeta.v1.schema.json",
      status: "locked",
    },
    {
      id: "alpha-v2",
      kind: "json-schema",
      path: "contracts/schemas/alpha.v2.schema.json",
      status: "candidate",
      review: { state: "pending-independent-agent-review" },
    },
    { id: "world-v1", kind: "wit", path: "contracts/wit/world-v1/world.wit", status: "locked" },
  ],
};

async function writeCatalog(value: unknown): Promise<void> {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  await writeFile(join(root, CATALOG_PATH), text);
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "catalog-status-"));
  await mkdir(dirname(join(root, CATALOG_PATH)), { recursive: true });
  await writeCatalog(baseCatalog);
});

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

test("an up-to-date page passes and prints the volume it examined", async () => {
  expect((await run("--write")).exitCode).toBe(0);
  const result = await run("--check");
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain(
    "3 catalog entries read (2 locked, 1 candidate) across 2 families",
  );
  expect(result.stderr).toBe("");
});

test("a catalog changed without regeneration fails the check", async () => {
  expect((await run("--write")).exitCode).toBe(0);
  const promoted = structuredClone(baseCatalog);
  const candidate = promoted.contracts[1];
  if (!candidate) throw new Error("fixture shape");
  candidate.status = "locked";
  delete candidate.review;
  await writeCatalog(promoted);
  const result = await run("--check");
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("diverges from contracts/catalog.v1.json");
  expect(result.stderr).toContain("3 catalog entries read (3 locked, 0 candidate)");
});

test("a hand edit of the page fails the check", async () => {
  expect((await run("--write")).exitCode).toBe(0);
  const pagePath = join(root, STATUS_PAGE_PATH);
  const page = await readFile(pagePath, "utf8");
  await writeFile(pagePath, page.replace("| `alpha-v2` | candidate |", "| `alpha-v2` | locked |"));
  expect((await run("--check")).exitCode).toBe(1);
});

test("a missing page fails the check", async () => {
  const result = await run("--check");
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("contracts/STATUS.md is missing or unreadable");
});

test("a missing catalog is a failure, never an empty catalog", async () => {
  expect((await run("--write")).exitCode).toBe(0);
  await rm(join(root, CATALOG_PATH));
  const result = await run("--check");
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("contracts/catalog.v1.json is missing or unreadable");
});

test.each([
  ["invalid JSON", "{ not json"],
  [
    "duplicate member",
    '{"schemaVersion":"libre-ai.contract-catalog.v1","contracts":[],"contracts":[]}',
  ],
  ["empty contracts", { schemaVersion: "libre-ai.contract-catalog.v1", contracts: [] }],
  ["wrong schemaVersion", { ...baseCatalog, schemaVersion: "other" }],
])("an unreadable catalog (%s) fails the check", async (_label, catalog) => {
  expect((await run("--write")).exitCode).toBe(0);
  await writeCatalog(catalog);
  const result = await run("--check");
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("contracts/catalog.v1.json rejected");
  expect(result.stdout).toBe("");
});

test("an unknown status, duplicate id or markup-bearing value is refused", () => {
  const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
  const withRow = (row: Record<string, unknown>) => ({
    ...baseCatalog,
    contracts: [...baseCatalog.contracts, row],
  });
  const rejected = [
    withRow({ id: "x-v1", kind: "wit", path: "contracts/x", status: "deprecated" }),
    withRow({ id: "zeta-v1", kind: "wit", path: "contracts/x", status: "locked" }),
    withRow({ id: "x-v1 | injected", kind: "wit", path: "contracts/x", status: "locked" }),
    withRow({ id: "x-v1", kind: "wit", path: "contracts/`x`", status: "locked" }),
    withRow({
      id: "x-v1",
      kind: "wit",
      path: "contracts/x",
      status: "locked",
      review: { state: "<b>" },
    }),
  ];
  for (const catalog of rejected)
    expect(() => parseCatalogStatus(encode(catalog))).toThrow(CatalogStatusError);
});

test("rendering is deterministic and independent of catalog order", () => {
  const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
  const reversed = { ...baseCatalog, contracts: [...baseCatalog.contracts].reverse() };
  const forward = renderStatusPage(parseCatalogStatus(encode(baseCatalog)));
  expect(renderStatusPage(parseCatalogStatus(encode(reversed)))).toBe(forward);
  expect(forward.indexOf("`alpha-v2`")).toBeLessThan(forward.indexOf("`zeta-v1`"));
  expect(forward.indexOf("### json-schema (2)")).toBeLessThan(forward.indexOf("### wit (1)"));
  expect(forward).toContain("| locked | 2 |\n| candidate | 1 |\n| total | 3 |");
  expect(forward).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
});

test("the comparator distinguishes different pages", () => {
  expect(pagesEqual("a\n", "a\n")).toBe(true);
  expect(pagesEqual("a\n", "b\n")).toBe(false);
});

test("the committed status page matches the committed catalog", async () => {
  const catalog = await readFile(CATALOG_PATH);
  const page = await readFile(STATUS_PAGE_PATH, "utf8");
  expect(pagesEqual(renderStatusPage(parseCatalogStatus(catalog)), page)).toBe(true);
});
