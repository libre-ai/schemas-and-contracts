import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  CATALOG_PATH,
  CatalogStatusError,
  firstDifferingLine,
  KNOWN_STATUSES,
  pagesEqual,
  parseCatalogStatus,
  renderStatusPage,
  STATUS_PAGE_PATH,
  summarizeCatalogStatus,
} from "./catalog-status";

type Mode = "check" | "write";

function parseArguments(argv: string[]): { mode: Mode; root: string } {
  let mode: Mode | null = null;
  let root = ".";
  for (const argument of argv) {
    if (argument === "--check" || argument === "--write") {
      if (mode !== null) throw new Error("usage");
      mode = argument === "--check" ? "check" : "write";
    } else if (argument.startsWith("--root=") && argument.length > "--root=".length) {
      root = argument.slice("--root=".length);
    } else {
      throw new Error("usage");
    }
  }
  if (mode === null) throw new Error("usage");
  return { mode, root };
}

async function main(): Promise<void> {
  let options: { mode: Mode; root: string };
  try {
    options = parseArguments(process.argv.slice(2));
  } catch {
    console.error("usage: bun tools/quality/catalog-status-page.ts --check|--write [--root=<dir>]");
    process.exitCode = 2;
    return;
  }

  let catalogBytes: Uint8Array;
  try {
    catalogBytes = await readFile(join(options.root, CATALOG_PATH));
  } catch {
    // An unreadable catalog is a failure, never an empty catalog.
    console.error(`catalog status: ${CATALOG_PATH} is missing or unreadable`);
    process.exitCode = 1;
    return;
  }

  let page: string;
  let volume: string;
  try {
    const entries = parseCatalogStatus(catalogBytes);
    const summary = summarizeCatalogStatus(entries);
    page = renderStatusPage(entries);
    const perStatus = KNOWN_STATUSES.map(
      (status) => `${summary.byStatus.get(status) ?? 0} ${status}`,
    ).join(", ");
    volume = `${entries.length} catalog entries read (${perStatus}) across ${summary.byKind.size} families`;
  } catch (error) {
    const reason = error instanceof CatalogStatusError ? error.message : "unexpected parse failure";
    console.error(`catalog status: ${CATALOG_PATH} rejected: ${reason}`);
    process.exitCode = 1;
    return;
  }

  const pagePath = join(options.root, STATUS_PAGE_PATH);
  if (options.mode === "write") {
    await writeFile(pagePath, page);
    console.log(`catalog status: wrote ${STATUS_PAGE_PATH}; ${volume}`);
    return;
  }

  let current: string;
  try {
    current = await readFile(pagePath, "utf8");
  } catch {
    console.error(
      `catalog status: ${STATUS_PAGE_PATH} is missing or unreadable; ${volume}. Run: bun tools/quality/catalog-status-page.ts --write`,
    );
    process.exitCode = 1;
    return;
  }
  if (!pagesEqual(page, current)) {
    console.error(
      `catalog status: ${STATUS_PAGE_PATH} diverges from ${CATALOG_PATH} at line ${firstDifferingLine(page, current)}; ${volume}. Run: bun tools/quality/catalog-status-page.ts --write`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(`catalog status: ${STATUS_PAGE_PATH} matches ${CATALOG_PATH}; ${volume}`);
}

await main();
