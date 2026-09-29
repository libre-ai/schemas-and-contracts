import { expect, test } from "bun:test";
import inventory from "../../contracts/fixtures/missions-v3/inherited.json";
import { inheritedAuthorityFailures } from "./missions-v3";

const contents = new Map<string, Uint8Array>();
for (const name of Object.keys(inventory.hashes)) contents.set(name, await Bun.file(name).bytes());
test("the complete historical inventory verifies actual unchanged authority bytes", () => {
  expect(inheritedAuthorityFailures(inventory, contents)).toEqual([]);
});
test("empty or incomplete inherited inventories cannot claim byte equality", () => {
  expect(inheritedAuthorityFailures({ ...inventory, hashes: {} }, contents).length).toBeGreaterThan(
    0,
  );
  const hashes: Record<string, string> = { ...inventory.hashes };
  delete hashes[Object.keys(hashes)[0] as string];
  expect(inheritedAuthorityFailures({ ...inventory, hashes }, contents).length).toBeGreaterThan(0);
});
test("an actual inherited byte change is detected without mutating the reviewed authority", () => {
  const altered = new Map(contents);
  const name = "contracts/schemas/mission-record.v2.schema.json";
  const original = contents.get(name);
  if (!original) throw new Error("Missing historical test authority");
  const changed = new Uint8Array(original);
  changed[0] = (changed[0] as number) ^ 1;
  altered.set(name, changed);
  expect(inheritedAuthorityFailures(inventory, altered)).toContain("inherited.bytes-mismatch");
  expect(inheritedAuthorityFailures(inventory, contents)).toEqual([]);
});
test("missing source bytes and malformed provenance refuse", () => {
  expect(inheritedAuthorityFailures(inventory, new Map()).length).toBeGreaterThan(0);
  for (const value of [
    null,
    [],
    {},
    { ...inventory, base: "latest" },
    { ...inventory, catalog: [] },
    { ...inventory, extra: true },
  ])
    expect(inheritedAuthorityFailures(value, contents).length).toBeGreaterThan(0);
});
