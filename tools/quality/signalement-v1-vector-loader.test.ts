import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadSignalementV1Vectors,
  RECIPE_MAX_COUNT,
  RECIPE_MAX_OCTETS,
} from "./signalement-v1-vector-loader";

type JsonObject = Record<string, unknown>;

const SCHEMA_VERSION = "libre-ai.example-vectors.v1";
const ADMIT_RECIPES = { admitRecipes: true } as const;

// Every temporary directory a test creates is removed after it, whatever its assertions do.
const created: string[] = [];
const everCreated: string[] = [];
const removed: string[] = [];

afterEach(async () => {
  for (const directory of created.splice(0)) {
    // A test may have withdrawn a permission: give it back so the removal cannot fail on it.
    await chmod(directory, 0o700);
    await rm(directory, { recursive: true, force: true });
    removed.push(directory);
  }
});

async function directoryWith(files: Record<string, unknown>): Promise<string> {
  const directory: string = await mkdtemp(join(tmpdir(), "signalement-vectors-"));
  created.push(directory);
  everCreated.push(directory);
  for (const [name, content] of Object.entries(files)) {
    await writeFile(
      join(directory, name),
      typeof content === "string" || content instanceof Uint8Array
        ? content
        : JSON.stringify(content),
    );
  }
  return directory;
}

function sha256Hex(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function decoded(vectors: JsonObject | null, family: string, index: number): string {
  const list = vectors?.[family] as { raw: string }[];
  return Buffer.from((list[index] as { raw: string }).raw, "base64url").toString("utf8");
}

const oneVector = (name: string): JsonObject => ({ name, document: { n: name } });

describe("entry and continuation files", () => {
  test("an entry without a declaration is returned as written", async () => {
    const entry = { schemaVersion: SCHEMA_VERSION, valid: [oneVector("a")], invalid: [] };
    const result = await loadSignalementV1Vectors(await directoryWith({ "vectors.json": entry }));
    expect(result).toEqual({ vectors: entry, failures: [] });
  });

  test("declared parts are appended in declaration order, family by family", async () => {
    const directory = await directoryWith({
      "vectors.json": {
        schemaVersion: SCHEMA_VERSION,
        parts: ["vectors.part-b.json", "vectors.part-a.json"],
        valid: [oneVector("v1")],
        invalid: [oneVector("i1")],
      },
      "vectors.part-a.json": {
        schemaVersion: SCHEMA_VERSION,
        invalid: [oneVector("i3")],
        keySetVectors: { invalid: [oneVector("k2")] },
      },
      "vectors.part-b.json": {
        schemaVersion: SCHEMA_VERSION,
        invalid: [oneVector("i2")],
        keySetVectors: { valid: [oneVector("k1")] },
      },
    });
    const result = await loadSignalementV1Vectors(directory);
    expect(result.failures).toEqual([]);
    expect(result.vectors).toEqual({
      schemaVersion: SCHEMA_VERSION,
      valid: [oneVector("v1")],
      invalid: [oneVector("i1"), oneVector("i2"), oneVector("i3")],
      keySetVectors: { valid: [oneVector("k1")], invalid: [oneVector("k2")] },
    });
  });

  test("a declared part that is absent is a named failure and no vector is returned", async () => {
    const directory = await directoryWith({
      "vectors.json": {
        schemaVersion: SCHEMA_VERSION,
        parts: ["vectors.part-2.json"],
        valid: [oneVector("a")],
      },
    });
    expect(await loadSignalementV1Vectors(directory)).toEqual({
      vectors: null,
      failures: ["vectors.part-2.json: declared by vectors.json but absent or unreadable"],
    });
  });

  test("a vector file next to the entry that it does not declare is an orphan", async () => {
    const directory = await directoryWith({
      "vectors.json": {
        schemaVersion: SCHEMA_VERSION,
        parts: ["vectors.part-2.json"],
        valid: [oneVector("a")],
      },
      "vectors.part-2.json": { schemaVersion: SCHEMA_VERSION, valid: [oneVector("b")] },
      "vectors.part-3.json": { schemaVersion: SCHEMA_VERSION, valid: [oneVector("c")] },
      "vectors-old.json": { schemaVersion: SCHEMA_VERSION, valid: [] },
      // Files of other names belong to other entries or to the schema fixture: not orphans.
      "schema-fixtures.json": {},
      "signature-vectors.v1.json": { schemaVersion: "other", valid: [] },
    });
    expect(await loadSignalementV1Vectors(directory)).toEqual({
      vectors: null,
      failures: [
        "vectors-old.json: vector file not declared by vectors.json",
        "vectors.part-3.json: vector file not declared by vectors.json",
      ],
    });
  });

  test("another entry name has its own parts and its own orphans", async () => {
    const directory = await directoryWith({
      "signature-vectors.v1.json": {
        schemaVersion: SCHEMA_VERSION,
        parts: ["signature-vectors.v1.part-2.json"],
        valid: [oneVector("a")],
      },
      "signature-vectors.v1.part-2.json": {
        schemaVersion: SCHEMA_VERSION,
        valid: [oneVector("b")],
      },
      "vectors.json": { schemaVersion: "unrelated", valid: [] },
    });
    const result = await loadSignalementV1Vectors(directory, "signature-vectors.v1.json");
    expect(result.failures).toEqual([]);
    expect(result.vectors).toEqual({
      schemaVersion: SCHEMA_VERSION,
      valid: [oneVector("a"), oneVector("b")],
    });
  });

  test("a directory that cannot be listed fails closed: orphans could not be seen", async () => {
    const directory = await directoryWith({
      "vectors.json": { schemaVersion: SCHEMA_VERSION, valid: [oneVector("a")] },
    });
    // Search without read: the entry can be opened, the directory cannot be listed.
    await chmod(directory, 0o300);
    let result: Awaited<ReturnType<typeof loadSignalementV1Vectors>>;
    try {
      result = await loadSignalementV1Vectors(directory);
    } finally {
      await chmod(directory, 0o700);
    }
    expect(result).toEqual({ vectors: null, failures: ["vectors.json: directory is unreadable"] });
  });

  test("a vector file is read up to 1 MiB: one octet more is refused, entry or part", async () => {
    const padded = (document: JsonObject, length: number): Uint8Array => {
      const octets = new Uint8Array(length).fill(0x20);
      octets.set(new TextEncoder().encode(JSON.stringify(document)));
      return octets;
    };
    const entry = { schemaVersion: SCHEMA_VERSION, valid: [oneVector("a")] };
    const atBound = await directoryWith({ "vectors.json": padded(entry, RECIPE_MAX_OCTETS) });
    expect(await loadSignalementV1Vectors(atBound)).toEqual({ vectors: entry, failures: [] });
    const overEntry = await directoryWith({
      "vectors.json": padded(entry, RECIPE_MAX_OCTETS + 1),
    });
    expect(await loadSignalementV1Vectors(overEntry)).toEqual({
      vectors: null,
      failures: ["vectors.json: above 1048576 octets, not read"],
    });
    const overPart = await directoryWith({
      "vectors.json": { ...entry, parts: ["vectors.part-2.json"] },
      "vectors.part-2.json": padded(
        { schemaVersion: SCHEMA_VERSION, valid: [oneVector("b")] },
        RECIPE_MAX_OCTETS + 1,
      ),
    });
    expect(await loadSignalementV1Vectors(overPart)).toEqual({
      vectors: null,
      failures: ["vectors.part-2.json: above 1048576 octets, not read"],
    });
  });

  test("a vector inside a document is never read as a recipe", async () => {
    const document = { items: [{ name: "inner", recipe: { document: {} } }] };
    const entry = { schemaVersion: SCHEMA_VERSION, valid: [{ name: "outer", document }] };
    const result = await loadSignalementV1Vectors(await directoryWith({ "vectors.json": entry }));
    expect(result).toEqual({ vectors: entry, failures: [] });
  });

  test("an absent, non-strict or shapeless entry is a named failure", async () => {
    const empty = await directoryWith({});
    expect(await loadSignalementV1Vectors(empty)).toEqual({
      vectors: null,
      failures: ["vectors.json: absent or unreadable"],
    });
    const duplicate = await directoryWith({
      "vectors.json": `{"schemaVersion":"${SCHEMA_VERSION}","valid":[],"valid":[]}`,
    });
    expect((await loadSignalementV1Vectors(duplicate)).failures).toEqual([
      "vectors.json: not strict JSON",
    ]);
    const notUtf8 = await directoryWith({ "vectors.json": new Uint8Array([0x7b, 0xe9, 0x7d]) });
    expect((await loadSignalementV1Vectors(notUtf8)).failures).toEqual([
      "vectors.json: not strict JSON",
    ]);
    for (const shapeless of [[], { valid: [] }, { schemaVersion: 1 }]) {
      const directory = await directoryWith({ "vectors.json": shapeless });
      expect((await loadSignalementV1Vectors(directory)).failures).toEqual([
        "vectors.json: not a vector file object with a schemaVersion",
      ]);
    }
  });

  test("a declaration that is not a list of distinct sibling vector file names is refused", async () => {
    for (const parts of [
      [],
      "vectors.part-2.json",
      ["vectors.part-2.json", "vectors.part-2.json"],
      ["vectors.json"],
      ["../vectors.part-2.json"],
      ["sub/vectors.part-2.json"],
      ["other.json"],
      ["vectors.part-2.txt"],
      [2],
    ]) {
      const directory = await directoryWith({
        "vectors.json": { schemaVersion: SCHEMA_VERSION, parts, valid: [] },
        "vectors.part-2.json": { schemaVersion: SCHEMA_VERSION, valid: [] },
      });
      const result = await loadSignalementV1Vectors(directory);
      expect(result.failures, JSON.stringify(parts)).toContain(
        "vectors.json: invalid parts declaration",
      );
      expect(result.vectors).toBeNull();
    }
  });

  test("a part must be strict, carry the entry version, declare nothing and only append", async () => {
    const cases: [unknown, string][] = [
      ["{", "vectors.part-2.json: not strict JSON"],
      [
        { schemaVersion: "libre-ai.other-vectors.v1", valid: [] },
        "vectors.part-2.json: schemaVersion differs from vectors.json",
      ],
      [[], "vectors.part-2.json: not a vector file object with a schemaVersion"],
      [
        { schemaVersion: SCHEMA_VERSION, parts: ["vectors.part-3.json"], valid: [] },
        "vectors.part-2.json: a part declares no parts",
      ],
      [
        { schemaVersion: SCHEMA_VERSION, valid: { nested: [] } },
        "vectors.part-2.json: member /valid cannot be appended to vectors.json",
      ],
      [
        { schemaVersion: SCHEMA_VERSION, family: { list: "x" } },
        "vectors.part-2.json: member /family/list cannot be appended to vectors.json",
      ],
    ];
    for (const [part, failure] of cases) {
      const directory = await directoryWith({
        "vectors.json": {
          schemaVersion: SCHEMA_VERSION,
          parts: ["vectors.part-2.json"],
          valid: [oneVector("a")],
          family: { list: [] },
        },
        "vectors.part-2.json": part,
      });
      expect(await loadSignalementV1Vectors(directory), failure).toEqual({
        vectors: null,
        failures: [failure],
      });
    }
  });
});

describe("recipes", () => {
  async function loadRecipe(vector: JsonObject): Promise<{
    vectors: JsonObject | null;
    failures: string[];
  }> {
    const directory = await directoryWith({
      "vectors.json": { schemaVersion: SCHEMA_VERSION, invalid: [vector] },
    });
    return loadSignalementV1Vectors(directory, "vectors.json", ADMIT_RECIPES);
  }

  test("the bounds of a recipe are 4096 repeated elements and 1 MiB of octets", () => {
    expect(RECIPE_MAX_COUNT).toBe(4096);
    expect(RECIPE_MAX_OCTETS).toBe(1_048_576);
  });

  test("a recipe is refused, in the entry or a part, unless the contract admits recipes", async () => {
    const expected = '{"a":1}';
    const recipeVector = (name: string): JsonObject => ({
      name,
      recipe: { document: { a: 1 } },
      sha256: sha256Hex(expected),
    });
    const directory = await directoryWith({
      "vectors.json": {
        schemaVersion: SCHEMA_VERSION,
        parts: ["vectors.part-2.json"],
        invalid: [recipeVector("in the entry")],
      },
      "vectors.part-2.json": {
        schemaVersion: SCHEMA_VERSION,
        invalid: [recipeVector("in a part")],
      },
    });
    const refusal = {
      vectors: null,
      failures: [
        'vectors.json: vector "in the entry": recipe not admitted for these vectors',
        'vectors.part-2.json: vector "in a part": recipe not admitted for these vectors',
      ],
    };
    // Refusal is the default: a contract whose semantics define no recipe passes nothing.
    expect(await loadSignalementV1Vectors(directory)).toEqual(refusal);
    expect(
      await loadSignalementV1Vectors(directory, "vectors.json", { admitRecipes: false }),
    ).toEqual(refusal);
    const admitted = await loadSignalementV1Vectors(directory, "vectors.json", ADMIT_RECIPES);
    expect(admitted.failures).toEqual([]);
    expect(decoded(admitted.vectors, "invalid", 1)).toBe(expected);
  });

  test("generated octets never exceed 1 MiB, padded or not", async () => {
    // A vector file holds at most 1 MiB, so a plain document reaches the bound only through JCS
    // expansion: `1e15` is 4 octets as written and 16 (`1000000000000000`) in JCS. Expected
    // text written here from RFC 8785: `{"n":[` + 61680 numbers + `],"s":"` + pad + `"}`.
    const count = 61_680;
    const expected = (pad: string) =>
      `{"n":[${Array(count).fill("1000000000000000").join(",")}],"s":"${pad}"}`;
    expect(expected("aa").length).toBe(RECIPE_MAX_OCTETS);
    const entry = (pad: string) =>
      `{"schemaVersion":"${SCHEMA_VERSION}","invalid":[{"name":"unpadded","recipe":{"document":` +
      `{"n":[${Array(count).fill("1e15").join(",")}],"s":"${pad}"}},` +
      `"sha256":"${sha256Hex(expected(pad))}"}]}`;
    const load = async (pad: string) =>
      loadSignalementV1Vectors(
        await directoryWith({ "vectors.json": entry(pad) }),
        "vectors.json",
        ADMIT_RECIPES,
      );
    const atBound = await load("aa");
    expect(atBound.failures).toEqual([]);
    expect(decoded(atBound.vectors, "invalid", 0)).toBe(expected("aa"));
    expect(await load("aaa")).toEqual({
      vectors: null,
      failures: ['vectors.json: vector "unpadded": generated octets above 1048576'],
    });
  });

  test("a repeat is measured before its copies are built, exactly, at the 1 MiB bound", async () => {
    // Written here from RFC 8785, not by the code under test: members sorted ("i" < "p",
    // "keys" < "pad"), copies joined by commas. 4096 copies hold 15274 index digits (0..4095).
    const count = RECIPE_MAX_COUNT;
    const fill = "x".repeat(236);
    const copies = Array.from({ length: count }, (_, index) => `{"i":"${index}","p":"${fill}"}`);
    const text = (pad: string) => `{"keys":[${copies.join(",")}],"pad":"${pad}"}`;
    const exact = "y".repeat(1091);
    expect(text(exact).length).toBe(RECIPE_MAX_OCTETS);
    const vector = (pad: string): JsonObject => ({
      name: "repeated to the bound",
      recipe: {
        document: { keys: [], pad },
        repeat: { member: "keys", count, element: { p: fill }, indexMember: "i", indexPrefix: "" },
      },
      sha256: sha256Hex(text(pad)),
    });
    const atBound = await loadRecipe(vector(exact));
    expect(atBound.failures).toEqual([]);
    expect(decoded(atBound.vectors, "invalid", 0)).toBe(text(exact));
    // One octet over: the recorded digest is that of the over-bound octets, so only the measure,
    // taken before any copy is built, can refuse it.
    expect(await loadRecipe(vector(`${exact}y`))).toEqual({
      vectors: null,
      failures: ['vectors.json: vector "repeated to the bound": generated octets above 1048576'],
    });
  });

  test("a list element with a recipe but no string name is a named failure", async () => {
    const digest = sha256Hex('{"a":1}');
    for (const [label, element] of [
      ["no name", { recipe: { document: { a: 1 } }, sha256: digest }],
      ["numeric name", { name: 7, recipe: { document: { a: 1 } }, sha256: digest }],
    ] as const) {
      for (const options of [ADMIT_RECIPES, { admitRecipes: false }]) {
        const directory = await directoryWith({
          "vectors.json": { schemaVersion: SCHEMA_VERSION, invalid: [oneVector("a"), element] },
        });
        expect(
          await loadSignalementV1Vectors(directory, "vectors.json", options),
          `${label} ${options.admitRecipes}`,
        ).toEqual({
          vectors: null,
          failures: ["vectors.json: a list element carries a recipe without a string name"],
        });
      }
    }
  });

  test("a document is written in JCS, then padded with spaces to the stated octet length", async () => {
    // Expected octets written by hand from RFC 8785, not produced by the code under test.
    const expected = `{"a":"x","b":1}${" ".repeat(5)}`;
    const result = await loadRecipe({
      name: "padded",
      recipe: { document: { b: 1, a: "x" }, padWithSpacesTo: 20 },
      sha256: sha256Hex(expected),
      failures: ["x.size_limit"],
    });
    expect(result.failures).toEqual([]);
    expect(decoded(result.vectors, "invalid", 0)).toBe(expected);
    // The recipe becomes octets: the vector keeps its name and failures and gains raw only.
    const invalid = result.vectors?.invalid as JsonObject[] | undefined;
    expect(Object.keys(invalid?.[0] ?? {}).sort()).toEqual(["failures", "name", "raw"]);
  });

  test("repeat fills a top-level array with indexed copies of one element before JCS", async () => {
    const expected = '{"keys":[{"id":"k-0","v":1},{"id":"k-1","v":1},{"id":"k-2","v":1}],"o":"e"}';
    const result = await loadRecipe({
      name: "repeated",
      recipe: {
        document: { o: "e", keys: [{ dropped: true }] },
        repeat: {
          member: "keys",
          count: 3,
          element: { v: 1 },
          indexMember: "id",
          indexPrefix: "k-",
        },
      },
      sha256: sha256Hex(expected),
      failures: ["x.schema"],
    });
    expect(result.failures).toEqual([]);
    expect(decoded(result.vectors, "invalid", 0)).toBe(expected);
  });

  test("an index member already in the element is overwritten by the index", async () => {
    const expected = '{"keys":[{"id":"k-0"},{"id":"k-1"}]}';
    const result = await loadRecipe({
      name: "overwritten",
      recipe: {
        document: { keys: [] },
        repeat: {
          member: "keys",
          count: 2,
          element: { id: "x" },
          indexMember: "id",
          indexPrefix: "k-",
        },
      },
      sha256: sha256Hex(expected),
    });
    expect(result.failures).toEqual([]);
    expect(decoded(result.vectors, "invalid", 0)).toBe(expected);
  });

  test("regenerated octets whose SHA-256 differs from the recorded one are refused", async () => {
    const result = await loadRecipe({
      name: "drifted",
      recipe: { document: { b: 1, a: "x" }, padWithSpacesTo: 20 },
      // The digest of the same document padded to 21 octets: one octet of drift.
      sha256: sha256Hex(`{"a":"x","b":1}${" ".repeat(6)}`),
      failures: ["x.size_limit"],
    });
    expect(result).toEqual({
      vectors: null,
      failures: [
        'vectors.json: vector "drifted": regenerated octets do not match the recorded SHA-256',
      ],
    });
  });

  test("a recipe in a part is resolved and named with that part", async () => {
    const expected = '{"a":1}';
    const directory = await directoryWith({
      "vectors.json": {
        schemaVersion: SCHEMA_VERSION,
        parts: ["vectors.part-2.json"],
        invalid: [oneVector("first")],
      },
      "vectors.part-2.json": {
        schemaVersion: SCHEMA_VERSION,
        invalid: [
          { name: "good", recipe: { document: { a: 1 } }, sha256: sha256Hex(expected) },
          { name: "bad", recipe: { document: { a: 1 } }, sha256: "0".repeat(64) },
        ],
      },
    });
    expect(
      (await loadSignalementV1Vectors(directory, "vectors.json", ADMIT_RECIPES)).failures,
    ).toEqual([
      'vectors.part-2.json: vector "bad": regenerated octets do not match the recorded SHA-256',
    ]);
  });

  test("a recipe outside the closed vocabulary or its bounds is refused, never guessed", async () => {
    const digest = "0".repeat(64);
    const repeat = (patch: JsonObject): JsonObject => ({
      member: "keys",
      count: 2,
      element: { v: 1 },
      indexMember: "id",
      indexPrefix: "k-",
      ...patch,
    });
    const invalid: [string, JsonObject][] = [
      ["no document", { recipe: { padWithSpacesTo: 10 }, sha256: digest }],
      ["unknown operation", { recipe: { document: {}, text: "{}" }, sha256: digest }],
      ["recipe not an object", { recipe: "{}", sha256: digest }],
      ["document and recipe", { document: {}, recipe: { document: {} }, sha256: digest }],
      ["raw and recipe", { raw: "e30", recipe: { document: {} }, sha256: digest }],
      ["no digest", { recipe: { document: {} } }],
      ["digest in upper case", { recipe: { document: {} }, sha256: "A".repeat(64) }],
      [
        "pad shorter than the document",
        { recipe: { document: { a: 1 }, padWithSpacesTo: 6 }, sha256: digest },
      ],
      [
        "pad above the bound",
        { recipe: { document: {}, padWithSpacesTo: RECIPE_MAX_OCTETS + 1 }, sha256: digest },
      ],
      ["pad not an integer", { recipe: { document: {}, padWithSpacesTo: 2.5 }, sha256: digest }],
      ["document not canonicalizable", { recipe: { document: { a: 1.5 } }, sha256: digest }],
      [
        "repeat on a document that is not an object",
        { recipe: { document: [], repeat: repeat({}) }, sha256: digest },
      ],
      [
        "repeat on an absent member",
        { recipe: { document: { other: [] }, repeat: repeat({}) }, sha256: digest },
      ],
      [
        "repeat on a member that is not an array",
        { recipe: { document: { keys: {} }, repeat: repeat({}) }, sha256: digest },
      ],
      [
        "repeat count above the bound",
        {
          recipe: { document: { keys: [] }, repeat: repeat({ count: RECIPE_MAX_COUNT + 1 }) },
          sha256: digest,
        },
      ],
      [
        "repeat count negative",
        { recipe: { document: { keys: [] }, repeat: repeat({ count: -1 }) }, sha256: digest },
      ],
      [
        "repeat element not canonicalizable",
        {
          recipe: { document: { keys: [] }, repeat: repeat({ element: { v: 1.5 } }) },
          sha256: digest,
        },
      ],
      [
        "repeat element not an object",
        { recipe: { document: { keys: [] }, repeat: repeat({ element: [] }) }, sha256: digest },
      ],
      [
        "repeat index member not a string",
        { recipe: { document: { keys: [] }, repeat: repeat({ indexMember: 1 }) }, sha256: digest },
      ],
      [
        "repeat index prefix not a string",
        {
          recipe: { document: { keys: [] }, repeat: repeat({ indexPrefix: null }) },
          sha256: digest,
        },
      ],
      [
        "repeat with an unknown parameter",
        { recipe: { document: { keys: [] }, repeat: repeat({ step: 2 }) }, sha256: digest },
      ],
      ["repeat not an object", { recipe: { document: { keys: [] }, repeat: [] }, sha256: digest }],
    ];
    for (const [name, vector] of invalid) {
      expect(await loadRecipe({ name, ...vector }), name).toEqual({
        vectors: null,
        failures: [`vectors.json: vector "${name}": invalid recipe`],
      });
    }
  });

  test("a recipe at both bounds is generated", async () => {
    const result = await loadRecipe({
      name: "at the bounds",
      recipe: {
        document: { keys: [] },
        repeat: {
          member: "keys",
          count: RECIPE_MAX_COUNT,
          element: {},
          indexMember: "i",
          indexPrefix: "",
        },
        padWithSpacesTo: RECIPE_MAX_OCTETS,
      },
      sha256: "0".repeat(64),
    });
    // Generated, so the only failure left is the digest of this hand-written vector.
    expect(result.failures).toEqual([
      'vectors.json: vector "at the bounds": regenerated octets do not match the recorded SHA-256',
    ]);
  });
});

// Last test of the file: the directories of every earlier test are gone.
test("every temporary directory of the earlier tests has been removed", () => {
  expect(everCreated.length).toBeGreaterThan(0);
  expect(removed).toEqual(everCreated);
  for (const directory of removed) expect(existsSync(directory), directory).toBeFalse();
});
