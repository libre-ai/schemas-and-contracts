// Schema-fixture inventory of the signalement v1 contract family (ADR signalement-v1-contracts).
// Same shape as the P02 inventory, with one difference: an absent or unreadable fixture
// document is a named failure, never an exception, so one broken contract cannot hide
// the verdict on the others.
//
// It also measures the fixture size budget: signalement scans every tracked file with its
// public-boundary scanner, which refuses as sensitive any file above 65,536 Unicode code points
// (governance tools/quality/public-source-scanner.ts, maximumDecodedCodePoints), and it vendors
// these fixtures. A file over that budget would be refused there, whatever it contains.

import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import type { P02FixtureCase } from "./p02-v1-fixture-inventory";

export interface SignalementFixtureInventory {
  cases: P02FixtureCase[];
  failures: string[];
}

// Grows with each admitted contract (step 6 of the admission procedure).
export const SIGNALEMENT_V1_FIXTURE_DIRECTORIES: readonly string[] = [
  "signalement-delivery-envelope-v1",
  "signalement-connector-profile-v1",
  "signalement-routing-policy-v1",
  "signalement-projection-receipt-v1",
];

export const SIGNALEMENT_V1_FIXTURE_CODE_POINT_BUDGET = 65_536;

// The locked local export is vendored by signalement too, so it is held to the same budget.
export const SIGNALEMENT_V1_BUDGETED_DIRECTORIES: readonly string[] = [
  ...SIGNALEMENT_V1_FIXTURE_DIRECTORIES,
  "signalement-local-export-v1",
];

export interface FixtureBudgetReport {
  /** Budgeted directories that could be listed. */
  directories: number;
  /** Entries met under them, other than directories: examined + unreadable + not regular. */
  encountered: number;
  /** Regular files decoded and counted, within the budget or not. */
  examined: number;
  /** Regular files that could not be read or are not UTF-8: each is also a failure. */
  unreadable: number;
  /** Entries neither a regular file nor a directory (a link is not followed), by path. */
  notRegular: string[];
  largest: { path: string; codePoints: number } | null;
  failures: string[];
}

function countCodePoints(text: string): number {
  let count = 0;
  for (const _codePoint of text) count += 1;
  return count;
}

export async function measureSignalementV1FixtureBudget(
  root: string = "contracts/fixtures",
  directories: readonly string[] = SIGNALEMENT_V1_BUDGETED_DIRECTORIES,
  budget: number = SIGNALEMENT_V1_FIXTURE_CODE_POINT_BUDGET,
): Promise<FixtureBudgetReport> {
  const report: FixtureBudgetReport = {
    directories: 0,
    encountered: 0,
    examined: 0,
    unreadable: 0,
    notRegular: [],
    largest: null,
    failures: [],
  };
  // fatal: a file that is not UTF-8 has no code point count; ignoreBOM: a mark is counted.
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

  async function walk(relative: string): Promise<boolean> {
    let entries: Dirent[];
    try {
      entries = await readdir(`${root}/${relative}`, { withFileTypes: true });
    } catch {
      return false;
    }
    entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
    for (const entry of entries) {
      const path = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!(await walk(path))) report.failures.push(`${path}: directory is unreadable`);
        continue;
      }
      report.encountered += 1;
      if (!entry.isFile()) {
        report.notRegular.push(path);
        continue;
      }
      let bytes: Uint8Array;
      try {
        bytes = await readFile(`${root}/${path}`);
      } catch {
        report.unreadable += 1;
        report.failures.push(`${path}: unreadable`);
        continue;
      }
      let text: string;
      try {
        text = decoder.decode(bytes);
      } catch {
        report.unreadable += 1;
        report.failures.push(`${path}: not valid UTF-8`);
        continue;
      }
      report.examined += 1;
      const codePoints = countCodePoints(text);
      if (report.largest === null || codePoints > report.largest.codePoints) {
        report.largest = { path, codePoints };
      }
      if (codePoints > budget) {
        report.failures.push(`${path}: ${codePoints} code points, over the budget of ${budget}`);
      }
    }
    return true;
  }

  for (const directory of directories) {
    if (await walk(directory)) report.directories += 1;
    else report.failures.push(`${directory}: budgeted directory is absent or unreadable`);
  }
  return report;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUnknownList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function isMutation(value: unknown): boolean {
  return isRecord(value) && typeof value.name === "string" && typeof value.path === "string";
}

function isFixtureCase(value: unknown): value is P02FixtureCase {
  if (!isRecord(value) || typeof value.schema !== "string" || !isRecord(value.valid)) return false;
  const mutations: unknown = value.invalidMutations;
  return isUnknownList(mutations) && mutations.length > 0 && mutations.every(isMutation);
}

async function readJson(path: string): Promise<unknown> {
  try {
    return await Bun.file(path).json();
  } catch {
    return null;
  }
}

export async function loadSignalementV1FixtureCases(
  root: string = "contracts/fixtures",
  directories: readonly string[] = SIGNALEMENT_V1_FIXTURE_DIRECTORIES,
): Promise<SignalementFixtureInventory> {
  const cases: P02FixtureCase[] = [];
  const failures: string[] = [];
  for (const directory of directories) {
    const document: unknown = await readJson(`${root}/${directory}/schema-fixtures.json`);
    const documentCases: unknown = isRecord(document) ? document.cases : null;
    if (
      !isRecord(document) ||
      document.schemaVersion !== "libre-ai.schema-fixtures.v1" ||
      !isUnknownList(documentCases) ||
      documentCases.length !== 1 ||
      !isFixtureCase(documentCases[0])
    ) {
      failures.push(`${directory}: invalid separate schema fixture inventory`);
      continue;
    }
    cases.push(documentCases[0]);
  }
  return { cases, failures };
}
