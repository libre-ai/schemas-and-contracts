import { parseStrictJson } from "./policy-core-raw-inputs";

export const CATALOG_PATH = "contracts/catalog.v1.json";
export const STATUS_PAGE_PATH = "contracts/STATUS.md";

const CATALOG_SCHEMA_VERSION = "libre-ai.contract-catalog.v1";

// The fixed order keeps the page byte-stable; an unknown status is refused rather than
// rendered, so a new lifecycle state cannot appear without a reviewed generator change.
export const KNOWN_STATUSES = ["locked", "candidate"] as const;
export type CatalogStatus = (typeof KNOWN_STATUSES)[number];

export interface CatalogStatusEntry {
  id: string;
  kind: string;
  path: string;
  status: CatalogStatus;
  reviewState: string | null;
}

export interface CatalogStatusSummary {
  entries: CatalogStatusEntry[];
  byStatus: Map<CatalogStatus, number>;
  byKind: Map<string, CatalogStatusEntry[]>;
}

export class CatalogStatusError extends Error {}

// Every value rendered into Markdown is restricted to a character set that cannot open a
// table cell, code span, link or HTML element: the catalog is data, never page markup.
const IDENTIFIER = /^[a-z0-9][a-z0-9.-]*$/;
const CONTRACT_PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isKnownStatus(value: unknown): value is CatalogStatus {
  return typeof value === "string" && (KNOWN_STATUSES as readonly string[]).includes(value);
}

function requireMatch(value: unknown, pattern: RegExp, label: string): string {
  if (typeof value !== "string" || !pattern.test(value))
    throw new CatalogStatusError(`${label}: missing or outside the renderable character set`);
  return value;
}

export function parseCatalogStatus(bytes: Uint8Array): CatalogStatusEntry[] {
  let catalog: unknown;
  try {
    catalog = parseStrictJson(bytes);
  } catch {
    // The parser message may quote catalog bytes; only the failure class is reported.
    throw new CatalogStatusError("catalog is not strict JSON");
  }
  if (!isRecord(catalog) || catalog.schemaVersion !== CATALOG_SCHEMA_VERSION)
    throw new CatalogStatusError("catalog envelope or schemaVersion is invalid");
  const contracts = catalog.contracts;
  if (!Array.isArray(contracts) || contracts.length === 0)
    throw new CatalogStatusError("catalog has no contracts array or it is empty");

  const seen = new Set<string>();
  return contracts.map((row, index) => {
    const label = `contracts[${index}]`;
    if (!isRecord(row)) throw new CatalogStatusError(`${label}: not an object`);
    const id = requireMatch(row.id, IDENTIFIER, `${label}.id`);
    if (seen.has(id)) throw new CatalogStatusError(`${label}.id: duplicate identifier`);
    seen.add(id);
    const kind = requireMatch(row.kind, IDENTIFIER, `${label}.kind`);
    const path = requireMatch(row.path, CONTRACT_PATH, `${label}.path`);
    if (!isKnownStatus(row.status))
      throw new CatalogStatusError(`${label}.status: not one of ${KNOWN_STATUSES.join(", ")}`);
    let reviewState: string | null = null;
    if (row.review !== undefined) {
      if (!isRecord(row.review)) throw new CatalogStatusError(`${label}.review: not an object`);
      reviewState = requireMatch(row.review.state, IDENTIFIER, `${label}.review.state`);
    }
    return { id, kind, path, status: row.status, reviewState };
  });
}

// Code-point order, not locale order: the page must be identical on every host.
function compareCodePoints(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function summarizeCatalogStatus(entries: CatalogStatusEntry[]): CatalogStatusSummary {
  const byStatus = new Map<CatalogStatus, number>(KNOWN_STATUSES.map((status) => [status, 0]));
  const byKind = new Map<string, CatalogStatusEntry[]>();
  for (const entry of entries) {
    byStatus.set(entry.status, (byStatus.get(entry.status) ?? 0) + 1);
    const family = byKind.get(entry.kind) ?? [];
    family.push(entry);
    byKind.set(entry.kind, family);
  }
  const sortedKinds = [...byKind.keys()].sort(compareCodePoints);
  const sortedByKind = new Map<string, CatalogStatusEntry[]>();
  for (const kind of sortedKinds) {
    const family = byKind.get(kind) ?? [];
    sortedByKind.set(
      kind,
      [...family].sort((left, right) => compareCodePoints(left.id, right.id)),
    );
  }
  return { entries, byStatus, byKind: sortedByKind };
}

function countStatus(entries: CatalogStatusEntry[], status: CatalogStatus): number {
  return entries.filter((entry) => entry.status === status).length;
}

export function renderStatusPage(entries: CatalogStatusEntry[]): string {
  const summary = summarizeCatalogStatus(entries);
  const lines: string[] = [
    "<!-- Generated from contracts/catalog.v1.json by tools/quality/catalog-status-page.ts. Do not edit. -->",
    "",
    "# Contract status",
    "",
    "Generated from [`catalog.v1.json`](catalog.v1.json) by",
    "`bun tools/quality/catalog-status-page.ts --write`. Do not edit this page by hand:",
    "`bun run check:catalog-status` fails whenever it differs from the catalog.",
    "",
    "`catalog.v1.json` is the sole status authority. Status statements in `contracts/README.md`,",
    "`contracts/CATALOG.md`, `contracts/COMPATIBILITY.md` and `docs/protocols/` are frozen snapshots:",
    "their exact bytes are bound by review evidence (inherited-authority fixtures, the specification",
    "lock and the protocol-authority maps), so they are not edited to follow catalog changes. Where",
    "they disagree with this page, this page states the current catalog.",
    "",
    "## Counts by status",
    "",
    "| Status | Entries |",
    "| --- | ---: |",
  ];
  for (const status of KNOWN_STATUSES)
    lines.push(`| ${status} | ${summary.byStatus.get(status) ?? 0} |`);
  lines.push(`| total | ${entries.length} |`, "", "## Counts by family", "");
  lines.push(`| Family | Entries | ${KNOWN_STATUSES.join(" | ")} |`);
  lines.push(`| --- | ---: | ${KNOWN_STATUSES.map(() => "---:").join(" | ")} |`);
  for (const [kind, family] of summary.byKind) {
    const counts = KNOWN_STATUSES.map((status) => countStatus(family, status));
    lines.push(`| ${kind} | ${family.length} | ${counts.join(" | ")} |`);
  }
  lines.push("", "## Contracts by family");
  for (const [kind, family] of summary.byKind) {
    lines.push("", `### ${kind} (${family.length})`, "");
    lines.push("| Contract | Status | Review | Path |", "| --- | --- | --- | --- |");
    for (const entry of family)
      lines.push(
        `| \`${entry.id}\` | ${entry.status} | ${entry.reviewState ?? "none"} | \`${entry.path}\` |`,
      );
  }
  return `${lines.join("\n")}\n`;
}

// Single comparison site for the gate; tests neutralize it to prove they discriminate.
export function pagesEqual(expected: string, actual: string): boolean {
  return expected === actual;
}

export function firstDifferingLine(expected: string, actual: string): number {
  const expectedLines = expected.split("\n");
  const actualLines = actual.split("\n");
  const length = Math.max(expectedLines.length, actualLines.length);
  for (let index = 0; index < length; index += 1)
    if (expectedLines[index] !== actualLines[index]) return index + 1;
  return length;
}
