// Schema-fixture inventory of the signalement v1 contract family (ADR signalement-v1-contracts).
// Same shape as the P02 inventory, with one difference: an absent or unreadable fixture
// document is a named failure, never an exception, so one broken contract cannot hide
// the verdict on the others.

import type { P02FixtureCase } from "./p02-v1-fixture-inventory";

export interface SignalementFixtureInventory {
  cases: P02FixtureCase[];
  failures: string[];
}

// Grows with each admitted contract (step 6 of the admission procedure).
export const SIGNALEMENT_V1_FIXTURE_DIRECTORIES: readonly string[] = [];

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
