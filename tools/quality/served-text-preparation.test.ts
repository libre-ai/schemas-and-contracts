import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";

import {
  delimiterReplacements,
  isForbiddenCodePoint,
  neutralize,
  prepare,
  removedRanges,
  sanitize,
  servedTextPreparationDocumentFailures,
  servedTextPreparationFamilies,
  truncate,
  truncationMarker,
} from "./served-text-preparation";

const vectorPath = "contracts/fixtures/served-text-preparation-candidate/vectors.v1.json";
const semanticsPath = "contracts/served-text-preparation-candidate/SEMANTICS.md";
const oraclePath = "tools/quality/served-text-preparation.ts";

interface Vector {
  id: string;
  family: string;
  range?: [string, string];
  input: { text?: string; bound: number; [key: string]: unknown };
  expected: {
    text?: string;
    textSha256?: string;
    codePoints?: number;
    altered: boolean;
    truncated: boolean;
    neutralized: number;
  };
}

interface VectorDocument {
  record: string;
  semantics: string;
  removedRanges: [string, string][];
  keptNeighbours: string[];
  delimiters: [string, string][];
  vectors: Vector[];
  [key: string]: unknown;
}

// No conditional skip: a missing or unreadable file rejects, and the test fails.
async function readDocument(): Promise<VectorDocument> {
  return (await Bun.file(vectorPath).json()) as VectorDocument;
}

function vector(document: VectorDocument, id: string): Vector {
  const found = document.vectors.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} is missing`);
  return found;
}

function codePointCount(text: string): number {
  return Array.from(text).length;
}

function isSurrogate(codePoint: number): boolean {
  return codePoint >= 0xd800 && codePoint <= 0xdfff;
}

const delimiterForms = /[[\]<>]/;

// The Unicode Character Database files the table is checked against, vendored
// byte for byte from https://www.unicode.org/Public/17.0.0/ucd/ (see
// third_party/unicode-ucd-17.0.0/README.md). The digests pin those bytes: the
// expected classes never come from the runtime, whose ICU varies by platform.
const ucdFiles = {
  coreProperties: {
    path: "third_party/unicode-ucd-17.0.0/DerivedCoreProperties.txt",
    header: "# DerivedCoreProperties-17.0.0.txt",
    sha256: "24c7fed1195c482faaefd5c1e7eb821c5ee1fb6de07ecdbaa64b56a99da22c08",
  },
  generalCategory: {
    path: "third_party/unicode-ucd-17.0.0/DerivedGeneralCategory.txt",
    header: "# DerivedGeneralCategory-17.0.0.txt",
    sha256: "d62e5bab70ca74f099343f71224fa051cb1fdd61a1ab45c0488c44cfc0b6102e",
  },
} as const;

interface UcdFile {
  readonly path: string;
  readonly header: string;
  readonly sha256: string;
}

interface UcdEntry {
  readonly first: number;
  readonly last: number;
  readonly value: string;
}

// The value field keeps everything up to the comment: DerivedCoreProperties also
// carries enumerated properties written "InCB; Linker", which never equal a name below.
const ucdLine = /^([0-9A-F]{4,6})(?:\.\.([0-9A-F]{4,6}))?\s*;\s*([^#]*[^#\s])\s*(?:#.*)?$/;

// Reads a vendored UCD file after checking its digest and version header; every
// non-comment line must parse, so a malformed or substituted file fails.
async function readUcdEntries(file: UcdFile): Promise<UcdEntry[]> {
  const bytes = await Bun.file(file.path).bytes();
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(file.sha256);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const lines = text.split("\n");
  expect(lines[0]).toBe(file.header);
  const entries: UcdEntry[] = [];
  for (const line of lines) {
    const content = line.trim();
    if (content === "" || content.startsWith("#")) continue;
    const match = ucdLine.exec(content);
    if (match === null) throw new Error(`${file.path}: unparsed line ${JSON.stringify(content)}`);
    const [, first, last, value] = match;
    if (first === undefined || value === undefined)
      throw new Error(`${file.path}: incomplete line ${JSON.stringify(content)}`);
    const firstCodePoint = Number.parseInt(first, 16);
    entries.push({
      first: firstCodePoint,
      last: last === undefined ? firstCodePoint : Number.parseInt(last, 16),
      value,
    });
  }
  return entries;
}

describe("served-text preparation vectors", () => {
  test("the document is closed and every vector replays", async () => {
    const document = await readDocument();
    expect(servedTextPreparationDocumentFailures(document)).toEqual([]);
    // The examined volume, so an empty or truncated file cannot pass silently.
    expect(document.removedRanges.length).toBe(28);
    expect(document.keptNeighbours.length).toBe(55);
    expect(document.delimiters.length).toBe(14);
    const perFamily = new Map<string, number>();
    for (const entry of document.vectors)
      perFamily.set(entry.family, (perFamily.get(entry.family) ?? 0) + 1);
    expect(Object.fromEntries(perFamily)).toEqual({
      range: 28,
      sanitize: 4,
      truncate: 4,
      neutralize: 2,
      order: 3,
      "tool-call": 8,
    });
    expect([...perFamily.keys()].sort()).toEqual([...servedTextPreparationFamilies].sort());
    expect(new Set(document.vectors.map((entry) => entry.id)).size).toBe(document.vectors.length);
    const ranges = document.vectors
      .filter((entry) => entry.family === "range")
      .map((entry) => JSON.stringify(entry.range));
    expect(new Set(ranges).size).toBe(28);
    expect([...ranges].sort()).toEqual(
      document.removedRanges.map((range) => JSON.stringify(range)).sort(),
    );
    console.info(
      `Served-text preparation vectors: ${document.removedRanges.length} ranges, ` +
        `${document.keptNeighbours.length} neighbours, ${document.delimiters.length} delimiters, ` +
        `${document.vectors.length} vectors (${[...perFamily]
          .map(([family, count]) => `${family} ${count}`)
          .join(", ")})`,
    );
  });

  test("the vector file holds ASCII bytes only", async () => {
    const bytes = await Bun.file(vectorPath).bytes();
    expect(bytes.length).toBeGreaterThan(0);
    expect(bytes.findIndex((byte) => byte > 0x7f)).toBe(-1);
  });

  test("the oracle's ranges equal the document's, sorted, disjoint and non-adjacent", async () => {
    const document = await readDocument();
    expect(removedRanges.length).toBe(28);
    expect(
      removedRanges.map(([first, last]) => [
        first.toString(16).toUpperCase().padStart(4, "0"),
        last.toString(16).toUpperCase().padStart(4, "0"),
      ]),
    ).toEqual(document.removedRanges);
    let previousLast = -2;
    for (const [first, last] of removedRanges) {
      expect(first).toBeLessThanOrEqual(last);
      expect(first).toBeGreaterThan(previousLast + 1);
      previousLast = last;
    }
  });

  test("every code point of every range is removed", () => {
    let swept = 0;
    for (const [first, last] of removedRanges) {
      for (let codePoint = first; codePoint <= last; codePoint += 1) {
        swept += 1;
        if (sanitize(`x${String.fromCodePoint(codePoint)}y`) !== "xy")
          throw new Error(`U+${codePoint.toString(16)} is not removed`);
      }
    }
    // Sum of the 28 range sizes of the specification, added by hand.
    expect(swept).toBe(4271);
    console.info(`Served-text preparation ranges: ${swept} code points swept, all removed`);
  });

  test("the neighbours listed by the document are kept", async () => {
    const document = await readDocument();
    for (const neighbour of document.keptNeighbours) {
      const text = `x${String.fromCodePoint(Number.parseInt(neighbour, 16))}y`;
      expect(sanitize(text)).toBe(text);
    }
    expect(sanitize("a\tb\nc d")).toBe("a\tb\nc d");
    console.info(`Served-text preparation neighbours: ${document.keptNeighbours.length} kept`);
  });

  test("the table equals the Unicode 17.0 property classes of the vendored character database", async () => {
    const document = await readDocument();
    expect(document.unicodeVersion).toBe("17.0");
    const classes = new Set<number>();
    const sources = [
      { file: ucdFiles.coreProperties, values: ["Default_Ignorable_Code_Point"] },
      { file: ucdFiles.generalCategory, values: ["Cc", "Cf", "Zl", "Zp"] },
    ];
    const parsed: string[] = [];
    for (const { file, values } of sources) {
      const entries = await readUcdEntries(file);
      let matching = 0;
      for (const entry of entries) {
        if (!values.includes(entry.value)) continue;
        matching += 1;
        for (let codePoint = entry.first; codePoint <= entry.last; codePoint += 1)
          classes.add(codePoint);
      }
      // A file that parses to no matching line is a failure, never an empty class.
      expect(matching).toBeGreaterThan(0);
      parsed.push(`${file.path}: ${entries.length} entries, ${matching} in ${values.join("/")}`);
    }
    classes.delete(0x09);
    classes.delete(0x0a);
    const differences: string[] = [];
    let swept = 0;
    for (let codePoint = 0; codePoint <= 0x10ffff; codePoint += 1) {
      if (isSurrogate(codePoint)) continue;
      swept += 1;
      if (isForbiddenCodePoint(codePoint) !== classes.has(codePoint))
        differences.push(`U+${codePoint.toString(16)}`);
    }
    expect(differences).toEqual([]);
    expect(swept).toBe(0x110000 - 0x800);
    expect(classes.size).toBe(4271);
    console.info(
      `Served-text preparation classes: Unicode ${document.unicodeVersion} database ` +
        `(${parsed.join("; ")}), ${swept} code points swept, ${classes.size} in the table, ` +
        `${differences.length} difference`,
    );
  });

  // Informational: the runtime's own tables follow its ICU build, not the Bun pin
  // (the pinned revision reports Unicode 17.0 on darwin-arm64 and 15.1 on
  // linux-x64). The oracle is the vendored database above; this gap is printed and
  // counted so that a runtime that diverges from the table is visible, not masked.
  test("the runtime's property classes are compared to the table, and the gap is printed", () => {
    const classes = /[\p{Default_Ignorable_Code_Point}\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
    const differences: string[] = [];
    let swept = 0;
    for (let codePoint = 0; codePoint <= 0x10ffff; codePoint += 1) {
      if (isSurrogate(codePoint)) continue;
      swept += 1;
      const inRuntime =
        codePoint !== 0x09 && codePoint !== 0x0a && classes.test(String.fromCodePoint(codePoint));
      if (isForbiddenCodePoint(codePoint) !== inRuntime)
        differences.push(`U+${codePoint.toString(16)}`);
    }
    expect(swept).toBe(0x110000 - 0x800);
    console.info(
      `Served-text preparation runtime comparison: runtime Unicode ${process.versions.unicode}, ` +
        `${swept} code points swept, ${differences.length} differ from the table` +
        (differences.length > 0 ? ` (${differences.slice(0, 20).join(" ")})` : ""),
    );
  });

  test("the delimiter forms are exactly the code points that normalize to one", () => {
    const found: number[] = [];
    let swept = 0;
    for (let codePoint = 0; codePoint <= 0x10ffff; codePoint += 1) {
      if (isSurrogate(codePoint)) continue;
      swept += 1;
      const character = String.fromCodePoint(codePoint);
      if (
        delimiterForms.test(character.normalize("NFC")) ||
        delimiterForms.test(character.normalize("NFD")) ||
        delimiterForms.test(character.normalize("NFKC")) ||
        delimiterForms.test(character.normalize("NFKD"))
      )
        found.push(codePoint);
    }
    expect(found).toEqual([...delimiterReplacements.keys()].sort((a, b) => a - b));
    expect(found.length).toBe(14);
    const counterparts = new Set(delimiterReplacements.values());
    expect([...counterparts].sort((a, b) => a - b)).toEqual([0x2039, 0x203a, 0x27e6, 0x27e7]);
    for (const counterpart of counterparts) {
      const character = String.fromCodePoint(counterpart);
      for (const form of ["NFC", "NFD", "NFKC", "NFKD"] as const)
        expect(character.normalize(form)).toBe(character);
    }
    console.info(
      `Served-text preparation delimiters: ${swept} code points swept, ${found.length} forms, ` +
        `${counterparts.size} counterparts stable under 4 normalization forms`,
    );
  });

  test("neutralize keeps the code point count and leaves no delimiter form", () => {
    const forms = [...delimiterReplacements.keys()].map((form) => String.fromCodePoint(form));
    const source = `a${forms.join("\u{1F600}")}z`;
    const result = neutralize(source);
    expect(result.neutralized).toBe(14);
    expect(codePointCount(result.text)).toBe(codePointCount(source));
    for (const form of forms) expect(result.text.includes(form)).toBe(false);
    expect(delimiterForms.test(result.text.normalize("NFKC"))).toBe(false);
    expect(delimiterForms.test(result.text.normalize("NFKD"))).toBe(false);
    const counterparts = "\u{27E6}kept\u{27E7}";
    expect(neutralize(counterparts)).toEqual({ text: counterparts, neutralized: 0 });
  });

  test("the vectors the specification names replay to their flags", async () => {
    const document = await readDocument();
    const replay = (id: string) => {
      const { input } = vector(document, id);
      if (typeof input.text !== "string") throw new Error(`${id} has no inline text`);
      return prepare(input.text, input.bound);
    };
    expect(replay("sanitize-removal-then-nfc")).toEqual({
      text: "\u{E9}",
      altered: true,
      truncated: false,
      neutralized: 0,
    });
    expect(replay("sanitize-nfc-alone-does-not-alter").altered).toBe(false);
    expect(replay("truncate-bound-below-the-marker").text).toBe(truncationMarker);
    expect(replay("truncate-source-ends-with-the-marker").truncated).toBe(false);
    expect(replay("order-forged-closing-line-in-bidi-controls")).toEqual({
      text: "\u{27E6}/bloc\u{27E7}",
      altered: true,
      truncated: false,
      neutralized: 2,
    });
    expect(replay("tool-call-json-form").neutralized).toBe(0);

    // The order: 19 996 invisible code points never reach the bound, and only
    // the delimiters that are served are counted.
    expect(prepare(`ab${"\u{200B}".repeat(19996)}cd`, 200)).toEqual({
      text: "abcd",
      altered: true,
      truncated: false,
      neutralized: 0,
    });
    expect(prepare("[".repeat(20000), 200)).toEqual({
      text: "\u{27E6}".repeat(188) + truncationMarker,
      altered: false,
      truncated: true,
      neutralized: 188,
    });
  });

  test("the bound is exact, counted in code points, and a cut ends with the marker", () => {
    expect(codePointCount(truncationMarker)).toBe(12);
    expect(truncationMarker).toBe("\u{2026}\u{27E6}truncated\u{27E7}");
    for (let bound = 0; bound <= 40; bound += 1) {
      const exact = "\u{1F600}".repeat(bound);
      expect(truncate(exact, bound)).toEqual({ text: exact, truncated: false });
      const past = truncate(`${exact}\u{1F600}`, bound);
      expect(past.truncated).toBe(true);
      expect(past.text.endsWith(truncationMarker)).toBe(true);
      expect(codePointCount(past.text)).toBe(Math.max(bound, 12));
      expect(past.text.isWellFormed()).toBe(true);
    }
    expect(truncate("abcdefghijklmnopqrst", 5)).toEqual({
      text: truncationMarker,
      truncated: true,
    });
  });

  test("an ill-formed text and an invalid bound are refused", () => {
    for (const text of ["a\ud800b", "\udc00", "ok\ud83d"]) {
      expect(() => prepare(text, 64)).toThrow(TypeError);
      expect(() => sanitize(text)).toThrow(TypeError);
      expect(() => truncate(text, 64)).toThrow(TypeError);
      expect(() => neutralize(text)).toThrow(TypeError);
    }
    for (const bound of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => prepare("ok", bound)).toThrow(RangeError);
      expect(() => truncate("ok", bound)).toThrow(RangeError);
    }
    expect(prepare("", 0)).toEqual({ text: "", altered: false, truncated: false, neutralized: 0 });
  });

  test("the semantics name their eight sections and cite paths that exist", async () => {
    const document = await readDocument();
    const semantics = await Bun.file(semanticsPath).text();
    const headings = semantics
      .split("\n")
      .filter((line) => line.startsWith("## "))
      .map((line) => line.slice(3));
    expect(headings).toEqual([
      "Scope",
      "Steps",
      "Removed ranges",
      "Delimiters",
      "Truncation",
      "Flags",
      "Coexistence with envelope v1",
      "Replaying the vectors",
    ]);
    expect(document.semantics).toBe(semanticsPath);
    for (const path of [vectorPath, document.record, oraclePath]) {
      expect(semantics.includes(`\`${path}\``)).toBe(true);
      expect(await Bun.file(path).exists()).toBe(true);
    }
  });

  test("the decision record carries its identifier, status and arbitration lines", async () => {
    const document = await readDocument();
    const lines = (await Bun.file(document.record).text()).split("\n");
    for (const prefix of ["Decision identifier: ", "Status: ", "Owner-arbitration: "])
      expect(lines.filter((line) => line.startsWith(prefix)).length).toBe(1);
    const date = /^docs\/adr\/(\d{4}-\d{2}-\d{2})-/.exec(document.record)?.[1];
    expect(lines).toContain(
      `Decision identifier: \`urn:libre-ai:decision:${date}-served-text-preparation-vectors\`.`,
    );
  });

  describe("the checker refuses a document that does not hold", () => {
    test("a duplicate id", async () => {
      const document = await readDocument();
      vector(document, "tool-call-closing-tag").id = "tool-call-opening-tag";
      expect(servedTextPreparationDocumentFailures(document)).toContain(
        "tool-call-opening-tag: duplicate id",
      );
    });

    test("a family with no vector", async () => {
      const document = await readDocument();
      document.vectors = document.vectors.filter((entry) => entry.family !== "order");
      expect(servedTextPreparationDocumentFailures(document)).toContain(
        "family order has no vector",
      );
    });

    test("an open family", async () => {
      const document = await readDocument();
      vector(document, "neutralize-no-delimiter").family = "other";
      expect(servedTextPreparationDocumentFailures(document)).toContain(
        "neutralize-no-delimiter: family is not closed",
      );
    });

    test("two range vectors naming the same range", async () => {
      const document = await readDocument();
      const second = vector(document, "range-110cd");
      second.range = ["110BD", "110BD"];
      second.input.text = "x\u{110BD}y";
      const failures = servedTextPreparationDocumentFailures(document);
      expect(failures).toContain("range-110cd: names the same range as range-110bd");
      expect(failures).toContain("range U+110CD-U+110CD has no range vector");
    });

    test("a range vector that does not carry the edges of its range", async () => {
      const document = await readDocument();
      vector(document, "range-200b-200f").input.text = "x\u{200B}\u{200C}\u{200E}y";
      expect(servedTextPreparationDocumentFailures(document)).toContain(
        "range-200b-200f: text is not x, the range's first, interior and last, y",
      );
    });

    test("a removed range that differs from the oracle's", async () => {
      const document = await readDocument();
      document.removedRanges[14] = ["200B", "200E"];
      expect(servedTextPreparationDocumentFailures(document)).toContain(
        "removedRanges.14: differs from the oracle's range",
      );
    });

    test("a neighbour that is removed, and a range edge that is not listed", async () => {
      const document = await readDocument();
      document.keptNeighbours[0] = "0008";
      const failures = servedTextPreparationDocumentFailures(document);
      expect(failures).toContain("keptNeighbours.0: U+0008 is not kept");
      expect(failures).toContain("keptNeighbours: U+0009, edge of a range, is not listed");
    });

    test("a delimiter mapped to another counterpart, and a missing one", async () => {
      const document = await readDocument();
      document.delimiters[0] = ["005B", "27E7"];
      document.delimiters = document.delimiters.filter(([form]) => form !== "FE47");
      const failures = servedTextPreparationDocumentFailures(document);
      expect(failures).toContain("delimiters.0: differs from the oracle's replacement");
      expect(failures).toContain("delimiters: U+FE47 is not listed");
    });

    test("an expectation that does not replay", async () => {
      const document = await readDocument();
      vector(document, "tool-call-opening-tag").expected.neutralized = 1;
      vector(document, "sanitize-nfc-alone-does-not-alter").expected.altered = true;
      vector(document, "truncate-exactly-the-bound").expected.text = "abc";
      const failures = servedTextPreparationDocumentFailures(document);
      expect(failures).toContain("tool-call-opening-tag: neutralized replays to 2, expects 1");
      expect(failures).toContain(
        "sanitize-nfc-alone-does-not-alter: altered replays to false, expects true",
      );
      expect(failures).toContain("truncate-exactly-the-bound: text does not replay");
    });

    test("a digest or a code point count that does not replay", async () => {
      const document = await readDocument();
      const long = vector(document, "order-truncate-before-neutralize").expected;
      long.textSha256 = "0".repeat(64);
      long.codePoints = 199;
      const failures = servedTextPreparationDocumentFailures(document);
      expect(failures).toContain("order-truncate-before-neutralize: textSha256 does not replay");
      expect(failures).toContain(
        "order-truncate-before-neutralize: replays to 200 code points, expects 199",
      );
    });

    test("an ill-formed input, an oversized repeat and an open member", async () => {
      const document = await readDocument();
      vector(document, "tool-call-small-forms").input.text = "a\ud800";
      vector(document, "order-sanitize-before-truncate").input.repeat = {
        unit: "\u{200B}",
        count: 1_048_577,
      };
      document.extra = true;
      const failures = servedTextPreparationDocumentFailures(document);
      expect(failures).toContain(
        "tool-call-small-forms: input must be exactly a well-formed text and a bound",
      );
      expect(failures).toContain(
        "order-sanitize-before-truncate: input.repeat expands past 1048576 code units",
      );
      expect(
        failures.some((failure) => failure.startsWith("document members are not exactly")),
      ).toBe(true);
    });

    test("another Unicode version, schema version or marker", async () => {
      const document = await readDocument();
      document.unicodeVersion = "16.0";
      document.schemaVersion = "libre-ai.served-text-preparation-vectors.v2";
      document.truncationMarker = "...";
      const failures = servedTextPreparationDocumentFailures(document);
      expect(failures).toContain('unicodeVersion must be "17.0"');
      expect(failures).toContain(
        "schemaVersion must be libre-ai.served-text-preparation-vectors.v1",
      );
      expect(failures).toContain("truncationMarker differs from the oracle's marker");
    });
  });
});
