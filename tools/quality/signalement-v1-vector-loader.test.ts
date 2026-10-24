import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadSignalementV1Vectors,
  RECIPE_MAX_COUNT,
  RECIPE_MAX_OCTETS,
} from "./signalement-v1-vector-loader";

type JsonObject = Record<string, unknown>;

const SCHEMA_VERSION = "libre-ai.example-vectors.v1";

async function directoryWith(files: Record<string, unknown>): Promise<string> {
  const directory: string = await mkdtemp(join(tmpdir(), "signalement-vectors-"));
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
    const result = await loadSignalementV1Vectors(directory);
    await chmod(directory, 0o700);
    expect(result).toEqual({ vectors: null, failures: ["vectors.json: directory is unreadable"] });
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
    return loadSignalementV1Vectors(directory);
  }

  test("the bounds of a recipe are 4096 repeated elements and 1 MiB of octets", () => {
    expect(RECIPE_MAX_COUNT).toBe(4096);
    expect(RECIPE_MAX_OCTETS).toBe(1_048_576);
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
    expect((await loadSignalementV1Vectors(directory)).failures).toEqual([
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
