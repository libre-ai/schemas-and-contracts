import { afterEach, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadSignalementV1FixtureCases,
  measureSignalementV1FixtureBudget,
  SIGNALEMENT_V1_BUDGETED_DIRECTORIES,
  SIGNALEMENT_V1_BUDGETED_FILES,
  SIGNALEMENT_V1_FIXTURE_CODE_POINT_BUDGET,
  SIGNALEMENT_V1_FIXTURE_DIRECTORIES,
} from "./signalement-v1-fixture-inventory";

// Every temporary directory a test creates is removed after it, whatever its assertions do.
const created: string[] = [];
const removed: string[] = [];

async function scratch(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  created.push(directory);
  return directory;
}

afterEach(async () => {
  for (const directory of created.splice(0)) {
    await rm(directory, { recursive: true, force: true });
    removed.push(directory);
  }
});

function fixtureCase(schema: string): Record<string, unknown> {
  return {
    schema,
    valid: { id: "x" },
    invalidMutations: [{ name: "drop-id", path: "id", remove: true }],
  };
}

async function writeInventory(root: string, directory: string, body: string): Promise<void> {
  await mkdir(join(root, directory), { recursive: true });
  await writeFile(join(root, directory, "schema-fixtures.json"), body);
}

test("a directory without a well-formed single-case fixture document is a named failure", async () => {
  const root = await scratch("signalement-inventory-");
  const wrap = (cases: unknown[]): string =>
    JSON.stringify({ schemaVersion: "libre-ai.schema-fixtures.v1", cases });
  await writeInventory(root, "ok", wrap([fixtureCase("ok.v1.schema.json")]));
  await writeInventory(
    root,
    "two",
    wrap([fixtureCase("a.v1.schema.json"), fixtureCase("b.v1.schema.json")]),
  );
  await writeInventory(root, "garbage", "not json {");
  // "absent": no directory and no file at all.
  const result = await loadSignalementV1FixtureCases(root, ["ok", "two", "garbage", "absent"]);
  expect(result.cases).toHaveLength(1);
  expect(result.failures).toEqual([
    "two: invalid separate schema fixture inventory",
    "garbage: invalid separate schema fixture inventory",
    "absent: invalid separate schema fixture inventory",
  ]);
});

test("the production list equals the admitted contracts", () =>
  expect(SIGNALEMENT_V1_FIXTURE_DIRECTORIES).toEqual([
    "signalement-delivery-envelope-v1",
    "signalement-connector-profile-v1",
    "signalement-routing-policy-v1",
    "signalement-projection-receipt-v1",
  ])); // grows with each admission

// The budget is the public-boundary scanner of signalement (maximumDecodedCodePoints in the
// governance public-source-scanner): above it a file is unscannable, hence refused as sensitive.
test("the budget is 65536 code points over the admitted contracts, the world's golden vectors and the local export", () => {
  expect(SIGNALEMENT_V1_FIXTURE_CODE_POINT_BUDGET).toBe(65_536);
  expect(SIGNALEMENT_V1_BUDGETED_DIRECTORIES).toEqual([
    ...SIGNALEMENT_V1_FIXTURE_DIRECTORIES,
    "signalement-policy-receipt-v1",
    "signalement-local-export-v1",
  ]);
});

test("the catalog, vendored by signalement, is budgeted as a file of its own", () =>
  expect(SIGNALEMENT_V1_BUDGETED_FILES).toEqual(["contracts/catalog.v1.json"]));

test("the budget counts code points of the decoded text, not octets nor UTF-16 units", async () => {
  const root = await scratch("signalement-budget-");
  await mkdir(join(root, "d"));
  // 4 code points: 1 + 3 octets ("€") + 4 octets and 2 UTF-16 units (U+1F600) + 1.
  await writeFile(join(root, "d", "at-budget.json"), "a€\u{1F600}b");
  await writeFile(join(root, "d", "over-budget.json"), "a€\u{1F600}bc");
  // A byte order mark is a code point the scanner sees: it is counted, never stripped.
  await writeFile(join(root, "d", "bom.json"), "\u{FEFF}abcd");
  const report = await measureSignalementV1FixtureBudget(root, ["d"], 4, []);
  expect(report.failures).toEqual([
    "d/bom.json: 5 code points, over the budget of 4",
    "d/over-budget.json: 5 code points, over the budget of 4",
  ]);
  expect(report.examined).toBe(3);
  expect(report.largest).toEqual({ path: "d/bom.json", codePoints: 5 });
});

test("the budget also holds after NFKC, normalized character by character as the scanner does", async () => {
  const root = await scratch("signalement-budget-");
  await mkdir(join(root, "d"));
  // U+FDFA is 1 code point as written and 18 after NFKC: over a budget of 4 only once normalized.
  await writeFile(join(root, "d", "ligature.json"), "\u{FDFA}");
  // U+0344 decomposes to two marks. Normalized alone it gives 2 code points, so "e" + U+0344 gives
  // 3; normalizing the whole string composes "e" + U+0308 into one code point and gives only 2.
  await writeFile(join(root, "d", "marks.json"), "e\u{0344}");
  // Composition never lowers the count below the text as written: "e" + U+0301 stays 2.
  await writeFile(join(root, "d", "composable.json"), "e\u{0301}");
  const report = await measureSignalementV1FixtureBudget(root, ["d"], 2, []);
  expect(report.failures).toEqual([
    "d/ligature.json: 18 code points after NFKC normalization, over the budget of 2",
    "d/marks.json: 3 code points after NFKC normalization, over the budget of 2",
  ]);
  expect(report.examined).toBe(3);
  expect(report.largest).toEqual({ path: "d/ligature.json", codePoints: 18 });
});

test("an unreadable, non-UTF-8 or absent source fails closed; a link is counted apart", async () => {
  const root = await scratch("signalement-budget-");
  await mkdir(join(root, "d", "nested"), { recursive: true });
  await writeFile(join(root, "d", "fine.json"), "{}");
  await writeFile(join(root, "d", "nested", "deep.json"), "12345");
  await writeFile(join(root, "d", "latin1.json"), new Uint8Array([0x7b, 0xe9, 0x7d]));
  await writeFile(join(root, "d", "locked.json"), "{}");
  await symlink("fine.json", join(root, "d", "link.json"));
  await mkdir(join(root, "d", "sealed"));
  await writeFile(join(root, "d", "sealed", "hidden.json"), "123456789");
  await chmod(join(root, "d", "locked.json"), 0o000);
  await chmod(join(root, "d", "sealed"), 0o000);
  let report: Awaited<ReturnType<typeof measureSignalementV1FixtureBudget>>;
  try {
    report = await measureSignalementV1FixtureBudget(root, ["d", "absent"], 4, []);
  } finally {
    // Restored before any assertion, so the directory can be removed whatever they do.
    await chmod(join(root, "d", "sealed"), 0o700);
    await chmod(join(root, "d", "locked.json"), 0o600);
  }
  expect(report.failures).toEqual([
    "d/latin1.json: not valid UTF-8",
    "d/locked.json: unreadable",
    "d/nested/deep.json: 5 code points, over the budget of 4",
    "d/sealed: directory is unreadable",
    "absent: budgeted directory is absent or unreadable",
  ]);
  expect(report.directories).toBe(1);
  expect(report.encountered).toBe(5);
  expect(report.examined).toBe(2);
  expect(report.unreadable).toBe(2);
  expect(report.notRegular).toEqual(["d/link.json"]);
  expect(report.encountered).toBe(report.examined + report.unreadable + report.notRegular.length);
});

test("a budgeted file is measured on its own; absent or not regular, it is named", async () => {
  const root = await scratch("signalement-budget-");
  await mkdir(join(root, "fixtures", "d"), { recursive: true });
  await writeFile(join(root, "fixtures", "d", "inside.json"), "{}");
  await writeFile(join(root, "catalog.json"), "{}");
  await writeFile(join(root, "big.json"), "12345");
  await symlink("catalog.json", join(root, "link.json"));
  const report = await measureSignalementV1FixtureBudget(
    join(root, "fixtures"),
    ["d"],
    4,
    ["catalog.json", "big.json", "absent.json", "link.json"],
    root,
  );
  expect(report.failures).toEqual([
    "big.json: 5 code points, over the budget of 4",
    "absent.json: budgeted file is absent or unreadable",
  ]);
  // The directory part is unchanged: one file in one directory.
  expect(report.directories).toBe(1);
  expect(report.files).toBe(2);
  expect(report.examined).toBe(3);
  expect(report.notRegular).toEqual(["link.json"]);
  expect(report.encountered).toBe(report.examined + report.unreadable + report.notRegular.length);
  expect(report.largest).toEqual({ path: "big.json", codePoints: 5 });
});

test("every file of the budgeted directories and every budgeted file fits the public scanner budget", async () => {
  const report = await measureSignalementV1FixtureBudget();
  expect(report.failures).toEqual([]);
  expect(report.directories).toBe(SIGNALEMENT_V1_BUDGETED_DIRECTORIES.length);
  expect(report.files).toBe(SIGNALEMENT_V1_BUDGETED_FILES.length);
  expect(report.encountered).toBe(report.examined + report.unreadable + report.notRegular.length);
  expect(report.examined).toBeGreaterThan(report.files);
  const largest = report.largest;
  console.log(
    `Fixture budget verified: ${report.examined} file(s) examined in ${report.directories} ` +
      `directories and ${report.files} budgeted file(s) (${SIGNALEMENT_V1_BUDGETED_FILES.join(", ")}), ` +
      `${report.notRegular.length} not regular${report.notRegular.length > 0 ? ` (${report.notRegular.join(", ")})` : ""}; ` +
      `largest ${largest?.path} at ${largest?.codePoints} of ${SIGNALEMENT_V1_FIXTURE_CODE_POINT_BUDGET} code points`,
  );
});

// Last test of the file: the directories of every earlier test are gone.
test("every temporary directory of the earlier tests has been removed", () => {
  expect(removed.length).toBe(5);
  for (const directory of removed) expect(existsSync(directory), directory).toBeFalse();
});
