// Schema-fixture inventory of the P02 v1 contract family (ADR 2026-10-22).
// The contracts gate and the SDK fixture tests consume the same documents; this module
// is the single place that decides what a well-formed inventory is, so a malformed
// file is a named failure, never a silent zero.

export interface P02FixtureMutation {
  name: string;
  path: string;
  value?: unknown;
  remove?: boolean;
}

export interface P02FixtureCase {
  schema: string;
  valid: Record<string, unknown>;
  invalidMutations: P02FixtureMutation[];
}

export interface P02FixtureInventory {
  cases: P02FixtureCase[];
  failures: string[];
}

export const P02_CONTRACT_FIXTURE_DIRECTORIES: readonly string[] = [
  "curation-rule-set-v3",
  "p02-export-v1",
  "knowledge-excerpt-v1",
  "usage-statement-v1",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUnknownList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function isMutation(value: unknown): value is P02FixtureMutation {
  return isRecord(value) && typeof value.name === "string" && typeof value.path === "string";
}

function isFixtureCase(value: unknown): value is P02FixtureCase {
  if (!isRecord(value) || typeof value.schema !== "string" || !isRecord(value.valid)) return false;
  const mutations: unknown = value.invalidMutations;
  return isUnknownList(mutations) && mutations.length > 0 && mutations.every(isMutation);
}

export async function loadP02ContractFixtureCases(
  root: string = "contracts/fixtures",
): Promise<P02FixtureInventory> {
  const cases: P02FixtureCase[] = [];
  const failures: string[] = [];
  for (const directory of P02_CONTRACT_FIXTURE_DIRECTORIES) {
    const documentPath: string = `${root}/${directory}/schema-fixtures.json`;
    const document: unknown = await Bun.file(documentPath).json();
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
