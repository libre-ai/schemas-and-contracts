import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import evidence from "../../docs/reviews/build-brief-missions-specification-lock.json";
import { POST_LOCK_ADDITIONS_PATH, specificationLockDocumentPaths } from "./specification-lock";
import { readSpecificationLockInputs } from "./specification-lock-inputs";

const script = resolve("tools/quality/check-specification-lock.ts");
let fixtureRoot = "";

beforeAll(async () => {
  fixtureRoot = await mkdtemp(join(tmpdir(), "specification-lock-fixture-"));
  for (const path of specificationLockDocumentPaths(evidence)) {
    await mkdir(dirname(join(fixtureRoot, path)), { recursive: true });
    await writeFile(join(fixtureRoot, path), await readFile(path));
  }
  await writeFile(
    join(fixtureRoot, "docs/reviews/build-brief-missions-specification-lock.json"),
    JSON.stringify(evidence),
  );
  const catalog = JSON.parse(await readFile(evidence.baselineCatalog.path, "utf8"));
  for (const row of catalog.contracts) {
    if (evidence.transitions.some((entry) => entry.id === row.id)) {
      row.status = "locked";
      delete row.review;
    }
  }
  const additions = await readFile(POST_LOCK_ADDITIONS_PATH);
  await writeFile(join(fixtureRoot, POST_LOCK_ADDITIONS_PATH), additions);
  for (const addition of JSON.parse(additions.toString("utf8")).additions)
    catalog.contracts.push(addition.entry);
  await writeFile(join(fixtureRoot, "contracts/catalog.v1.json"), JSON.stringify(catalog));
});

afterAll(async () => {
  if (fixtureRoot) await rm(fixtureRoot, { recursive: true, force: true });
});

async function run(): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const process = Bun.spawn(["bun", script, fixtureRoot], { stdout: "pipe", stderr: "pipe" });
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

test("qualifies the real filesystem transition with an explicit non-runtime result", async () => {
  const input = await readSpecificationLockInputs(fixtureRoot);
  expect(input.documents.size).toBe(specificationLockDocumentPaths(evidence).length);
  const result = await run();
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("Specification lock verified; runtime admission not granted");
  expect(result.stderr).toBe("");
});

test("refuses a real one-byte mutation without echoing contents or fixture paths", async () => {
  const path = join(fixtureRoot, evidence.consumerMatrix.path);
  const original = await readFile(path);
  try {
    await writeFile(path, Buffer.concat([original, Buffer.from("synthetic-private-sentinel")]));
    const result = await run();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Missing or altered protected input");
    expect(result.stderr).not.toContain("synthetic-private-sentinel");
    expect(result.stderr).not.toContain(fixtureRoot);
  } finally {
    await writeFile(path, original);
  }
});

test("rejects symlinked evidence even when its target contains the correct bytes", async () => {
  const path = join(fixtureRoot, evidence.consumerMatrix.path);
  const original = await readFile(path);
  const other = join(fixtureRoot, "correct-but-indirect.json");
  await writeFile(other, original);
  try {
    await rm(path);
    await symlink(other, path);
    await expect(readSpecificationLockInputs(fixtureRoot)).rejects.toThrow("Indirect input");
    const result = await run();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unreadable or indirect specification input");
  } finally {
    await rm(path);
    await writeFile(path, original);
  }
});
