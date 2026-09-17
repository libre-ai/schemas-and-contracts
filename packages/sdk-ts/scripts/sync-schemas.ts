/**
 * Vendors the canonical JSON Schemas into the package.
 *
 * The published `@libre-ai/contracts` tarball must be self-contained: a
 * consumer's `node_modules` has no monorepo root, so the registry cannot load
 * `contracts/schemas` from the repository. This script keeps a byte-exact copy
 * under `packages/contracts/schemas/` (committed, shipped via `files`), and its
 * `--check` mode is the CI drift gate — the same committed-projection pattern
 * as `src/generated/*.d.ts` + `generate:check`.
 *
 * Run: `bun scripts/sync-schemas.ts` (sync) | `--check` (verify only).
 */
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

async function listSchemaFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
}

/** Byte-exact comparison; returns human-readable issues (empty = in sync). */
export async function compareSchemaDirectories(
  sourceDirectory: string,
  vendoredDirectory: string,
): Promise<string[]> {
  const issues: string[] = [];
  const sourceFiles = await listSchemaFiles(sourceDirectory);
  if (sourceFiles.length === 0) throw new Error("Canonical schema authority is empty");
  const vendoredFiles = await listSchemaFiles(vendoredDirectory);
  const vendoredSet = new Set(vendoredFiles);

  for (const name of sourceFiles) {
    if (!vendoredSet.has(name)) {
      issues.push(`${name}: missing from the vendored copy`);
      continue;
    }
    const [sourceBytes, vendoredBytes] = await Promise.all([
      Bun.file(join(sourceDirectory, name)).arrayBuffer(),
      Bun.file(join(vendoredDirectory, name)).arrayBuffer(),
    ]);
    if (Buffer.compare(Buffer.from(sourceBytes), Buffer.from(vendoredBytes)) !== 0) {
      issues.push(`${name}: vendored copy differs from contracts/schemas`);
    }
  }

  const sourceSet = new Set(sourceFiles);
  for (const name of vendoredFiles) {
    if (!sourceSet.has(name)) issues.push(`${name}: extra file not present in contracts/schemas`);
  }

  return issues;
}

/** Makes the vendored directory a byte-exact mirror of the source directory. */
export async function syncSchemaDirectories(
  sourceDirectory: string,
  vendoredDirectory: string,
): Promise<void> {
  const sourceFiles = await listSchemaFiles(sourceDirectory);
  if (sourceFiles.length === 0) throw new Error("Canonical schema authority is empty");
  // Read every input before any projection is changed.
  const contents = await Promise.all(
    sourceFiles.map(async (name) => ({
      name,
      bytes: await Bun.file(join(sourceDirectory, name)).arrayBuffer(),
    })),
  );
  await mkdir(vendoredDirectory, { recursive: true });
  const sourceSet = new Set(sourceFiles);

  for (const name of await listSchemaFiles(vendoredDirectory)) {
    if (!sourceSet.has(name)) await rm(join(vendoredDirectory, name));
  }
  for (const { name, bytes } of contents) {
    await writeFile(join(vendoredDirectory, name), Buffer.from(bytes));
  }
}

if (import.meta.main) {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  // Canonical source: the contracts authority at its pinned git-dep revision.
  const sourceDirectory = resolve(packageRoot, "../../contracts/schemas");
  const vendoredDirectory = resolve(packageRoot, "schemas");

  if (process.argv.includes("--check")) {
    const issues = await compareSchemaDirectories(sourceDirectory, vendoredDirectory);
    if (issues.length > 0) {
      for (const issue of issues) console.error(issue);
      console.error(
        "Vendored schemas drift from contracts/schemas. Run: bun scripts/sync-schemas.ts",
      );
      process.exit(1);
    }
    console.log("Vendored schemas are byte-exact against contracts/schemas");
  } else {
    await syncSchemaDirectories(sourceDirectory, vendoredDirectory);
    console.log("Vendored schemas synchronized from contracts/schemas");
  }
}
