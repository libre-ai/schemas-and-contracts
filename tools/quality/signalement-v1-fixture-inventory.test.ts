import { expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadSignalementV1FixtureCases,
  SIGNALEMENT_V1_FIXTURE_DIRECTORIES,
} from "./signalement-v1-fixture-inventory";

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
  const root: string = await mkdtemp(join(tmpdir(), "signalement-inventory-"));
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
  ])); // grows with each admission
