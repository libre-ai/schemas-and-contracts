// Candidate vectors for the preparation of untrusted text before it is served
// to an agent (docs/adr/2026-11-17-served-text-preparation-vectors.md).
//
// This module is the reference oracle and the document checker of
// contracts/fixtures/served-text-preparation-candidate/vectors.v1.json. It is
// exported by no package: implementations live where content is processed and
// replay the vectors there, against this authority at a pinned revision.
//
// Why the tables are literals: a table derived at run time from the Unicode
// data of the runtime would follow the runtime, and two implementations on two
// Unicode versions would silently disagree. The test compares these literals
// with the vendored Unicode 17.0 character database; the literals are the contract.

import { createHash } from "node:crypto";

type JsonRecord = Record<string, unknown>;

export const servedTextPreparationSchemaVersion = "libre-ai.served-text-preparation-vectors.v1";

/**
 * Removed code points, as inclusive ranges: the union of
 * Default_Ignorable_Code_Point, Cc, Cf, Zl and Zp of Unicode 17.0, minus
 * U+0009 and U+000A. Sorted, disjoint and non-adjacent.
 */
export const removedRanges: readonly (readonly [number, number])[] = [
  [0x0000, 0x0008],
  [0x000b, 0x001f],
  [0x007f, 0x009f],
  [0x00ad, 0x00ad],
  [0x034f, 0x034f],
  [0x0600, 0x0605],
  [0x061c, 0x061c],
  [0x06dd, 0x06dd],
  [0x070f, 0x070f],
  [0x0890, 0x0891],
  [0x08e2, 0x08e2],
  [0x115f, 0x1160],
  [0x17b4, 0x17b5],
  [0x180b, 0x180f],
  [0x200b, 0x200f],
  [0x2028, 0x202e],
  [0x2060, 0x206f],
  [0x3164, 0x3164],
  [0xfe00, 0xfe0f],
  [0xfeff, 0xfeff],
  [0xffa0, 0xffa0],
  [0xfff0, 0xfffb],
  [0x110bd, 0x110bd],
  [0x110cd, 0x110cd],
  [0x13430, 0x1343f],
  [0x1bca0, 0x1bca3],
  [0x1d173, 0x1d17a],
  [0xe0000, 0xe0fff],
];

/**
 * Every code point whose NFC, NFD, NFKC or NFKD form contains `[`, `]`, `<`
 * or `>`, mapped to a counterpart that is stable under the four forms.
 */
export const delimiterReplacements: ReadonlyMap<number, number> = new Map([
  [0x005b, 0x27e6],
  [0xff3b, 0x27e6],
  [0xfe47, 0x27e6],
  [0x005d, 0x27e7],
  [0xff3d, 0x27e7],
  [0xfe48, 0x27e7],
  [0x003c, 0x2039],
  [0xff1c, 0x2039],
  [0xfe64, 0x2039],
  [0x226e, 0x2039],
  [0x003e, 0x203a],
  [0xff1e, 0x203a],
  [0xfe65, 0x203a],
  [0x226f, 0x203a],
]);

/** U+2026, U+27E6, "truncated", U+27E7: 12 code points. */
export const truncationMarker = "\u{2026}\u{27E6}truncated\u{27E7}";
const truncationMarkerLength = Array.from(truncationMarker).length;

export interface PreparedText {
  readonly text: string;
  readonly altered: boolean;
  readonly truncated: boolean;
  readonly neutralized: number;
}

function assertWellFormed(text: string): void {
  if (typeof text !== "string" || !text.isWellFormed())
    throw new TypeError("text must be a well-formed string: a lone surrogate is refused");
}

function assertBound(bound: number): void {
  if (!Number.isInteger(bound) || bound < 0)
    throw new RangeError(`bound must be a non-negative integer of code points, got ${bound}`);
}

export function isForbiddenCodePoint(codePoint: number): boolean {
  for (const [first, last] of removedRanges) {
    if (codePoint < first) return false;
    if (codePoint <= last) return true;
  }
  return false;
}

/** Step 1: remove every forbidden code point, then apply NFC. */
export function sanitize(text: string): string {
  assertWellFormed(text);
  let kept = "";
  for (const character of text) {
    if (!isForbiddenCodePoint(character.codePointAt(0) ?? 0)) kept += character;
  }
  return kept.normalize("NFC");
}

/**
 * Step 2: a text longer than `bound` code points keeps its first
 * max(bound - 12, 0) code points, followed by the truncation marker.
 */
export function truncate(text: string, bound: number): { text: string; truncated: boolean } {
  assertWellFormed(text);
  assertBound(bound);
  const codePoints = Array.from(text);
  if (codePoints.length <= bound) return { text, truncated: false };
  const kept = codePoints.slice(0, Math.max(bound - truncationMarkerLength, 0));
  return { text: kept.join("") + truncationMarker, truncated: true };
}

/** Step 3: replace each delimiter form by its counterpart, one code point for one. */
export function neutralize(text: string): { text: string; neutralized: number } {
  assertWellFormed(text);
  let replaced = "";
  let neutralized = 0;
  for (const character of text) {
    const counterpart = delimiterReplacements.get(character.codePointAt(0) ?? 0);
    if (counterpart === undefined) {
      replaced += character;
    } else {
      replaced += String.fromCodePoint(counterpart);
      neutralized += 1;
    }
  }
  return { text: replaced, neutralized };
}

/**
 * Sanitize, truncate, neutralize, in this order. Truncating before
 * neutralizing is what keeps `neutralized` a count of the delimiters actually
 * served; sanitizing before truncating is what keeps invisible padding from
 * pushing visible text past the bound.
 */
export function prepare(text: string, bound: number): PreparedText {
  assertWellFormed(text);
  assertBound(bound);
  const sanitized = sanitize(text);
  const cut = truncate(sanitized, bound);
  const safe = neutralize(cut.text);
  return {
    text: safe.text,
    altered: sanitized !== text.normalize("NFC"),
    truncated: cut.truncated,
    neutralized: safe.neutralized,
  };
}

export const servedTextPreparationFamilies = [
  "range",
  "sanitize",
  "truncate",
  "neutralize",
  "order",
  "tool-call",
] as const;

const semanticsPath = "contracts/served-text-preparation-candidate/SEMANTICS.md";
const recordPattern = /^docs\/adr\/\d{4}-\d{2}-\d{2}-served-text-preparation-vectors\.md$/;
const hexPattern = /^(?:[0-9A-F]{4}|[1-9A-F][0-9A-F]{4}|10[0-9A-F]{4})$/;
const sha256Pattern = /^[0-9a-f]{64}$/;
// A repeated input is expanded in memory: the bound keeps a document from
// asking the checker for an arbitrary allocation.
const maximumExpandedUnits = 1_048_576;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function hasExactKeys(value: JsonRecord, required: string[], optional: string[] = []): boolean {
  const keys = Object.keys(value);
  return (
    required.every((key) => keys.includes(key)) &&
    keys.every((key) => required.includes(key) || optional.includes(key))
  );
}

function parseHex(value: unknown): number | undefined {
  if (typeof value !== "string" || !hexPattern.test(value)) return undefined;
  const codePoint = Number.parseInt(value, 16);
  return codePoint >= 0xd800 && codePoint <= 0xdfff ? undefined : codePoint;
}

function parseHexPair(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const first = parseHex(value[0]);
  const second = parseHex(value[1]);
  return first === undefined || second === undefined ? undefined : [first, second];
}

function formatCodePoint(codePoint: number): string {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

function wellFormedString(value: unknown): value is string {
  return typeof value === "string" && value.isWellFormed();
}

function rangesFailures(value: unknown): string[] {
  if (!Array.isArray(value)) return ["removedRanges must be an array"];
  const failures: string[] = [];
  if (value.length !== removedRanges.length)
    failures.push(
      `removedRanges: ${value.length} ranges declared, the oracle holds ${removedRanges.length}`,
    );
  let previousLast = -2;
  for (const [index, entry] of value.entries()) {
    const pair = parseHexPair(entry);
    if (pair === undefined) {
      failures.push(`removedRanges.${index}: must be [first, last] in uppercase hexadecimal`);
      continue;
    }
    const [first, last] = pair;
    if (first > last) failures.push(`removedRanges.${index}: first is after last`);
    if (first <= previousLast + 1)
      failures.push(`removedRanges.${index}: not sorted, disjoint and non-adjacent`);
    previousLast = last;
    const oracle = removedRanges[index];
    if (oracle === undefined || oracle[0] !== first || oracle[1] !== last)
      failures.push(`removedRanges.${index}: differs from the oracle's range`);
  }
  return failures;
}

function neighboursFailures(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0)
    return ["keptNeighbours must be a non-empty array"];
  const failures: string[] = [];
  const seen = new Set<number>();
  for (const [index, entry] of value.entries()) {
    const codePoint = parseHex(entry);
    if (codePoint === undefined) {
      failures.push(`keptNeighbours.${index}: must be a code point in uppercase hexadecimal`);
      continue;
    }
    if (seen.has(codePoint)) failures.push(`keptNeighbours.${index}: duplicate`);
    seen.add(codePoint);
    const text = `x${String.fromCodePoint(codePoint)}y`;
    if (sanitize(text) !== text)
      failures.push(`keptNeighbours.${index}: ${formatCodePoint(codePoint)} is not kept`);
  }
  // Closure: both outer edges of every range are listed, so that widening a
  // range by one code point contradicts the document.
  for (const [first, last] of removedRanges) {
    for (const edge of [first - 1, last + 1]) {
      if (edge < 0 || edge > 0x10ffff || (edge >= 0xd800 && edge <= 0xdfff)) continue;
      if (!seen.has(edge))
        failures.push(`keptNeighbours: ${formatCodePoint(edge)}, edge of a range, is not listed`);
    }
  }
  return failures;
}

function delimitersFailures(value: unknown): string[] {
  if (!Array.isArray(value)) return ["delimiters must be an array"];
  const failures: string[] = [];
  const seen = new Set<number>();
  for (const [index, entry] of value.entries()) {
    const pair = parseHexPair(entry);
    if (pair === undefined) {
      failures.push(`delimiters.${index}: must be [form, counterpart] in uppercase hexadecimal`);
      continue;
    }
    const [form, counterpart] = pair;
    if (seen.has(form)) failures.push(`delimiters.${index}: duplicate form`);
    seen.add(form);
    if (delimiterReplacements.get(form) !== counterpart)
      failures.push(`delimiters.${index}: differs from the oracle's replacement`);
  }
  for (const form of delimiterReplacements.keys())
    if (!seen.has(form)) failures.push(`delimiters: ${formatCodePoint(form)} is not listed`);
  return failures;
}

interface VectorInput {
  text: string;
  bound: number;
}

function inputOf(value: unknown, id: string, failures: string[]): VectorInput | undefined {
  if (!isRecord(value)) {
    failures.push(`${id}: input must be an object`);
    return undefined;
  }
  if (!isNonNegativeInteger(value.bound)) {
    failures.push(`${id}: input.bound must be a non-negative integer`);
    return undefined;
  }
  if ("text" in value) {
    if (!hasExactKeys(value, ["text", "bound"]) || !wellFormedString(value.text)) {
      failures.push(`${id}: input must be exactly a well-formed text and a bound`);
      return undefined;
    }
    return { text: value.text, bound: value.bound };
  }
  const repeat = value.repeat;
  if (
    !hasExactKeys(value, ["repeat", "bound"], ["prefix", "suffix"]) ||
    !isRecord(repeat) ||
    !hasExactKeys(repeat, ["unit", "count"]) ||
    !wellFormedString(repeat.unit) ||
    repeat.unit.length === 0 ||
    !isNonNegativeInteger(repeat.count) ||
    repeat.count === 0 ||
    !("prefix" in value ? wellFormedString(value.prefix) : true) ||
    !("suffix" in value ? wellFormedString(value.suffix) : true)
  ) {
    failures.push(`${id}: input must be a text or a repeat { unit, count } with a bound`);
    return undefined;
  }
  if (repeat.unit.length * repeat.count > maximumExpandedUnits) {
    failures.push(`${id}: input.repeat expands past ${maximumExpandedUnits} code units`);
    return undefined;
  }
  const prefix = typeof value.prefix === "string" ? value.prefix : "";
  const suffix = typeof value.suffix === "string" ? value.suffix : "";
  return { text: prefix + repeat.unit.repeat(repeat.count) + suffix, bound: value.bound };
}

function expectedFailures(value: unknown, id: string, actual: PreparedText): string[] {
  if (!isRecord(value)) return [`${id}: expected must be an object`];
  const flags = ["altered", "truncated", "neutralized"];
  const inline = hasExactKeys(value, ["text", ...flags]) && typeof value.text === "string";
  const digested =
    hasExactKeys(value, ["textSha256", "codePoints", ...flags]) &&
    typeof value.textSha256 === "string" &&
    sha256Pattern.test(value.textSha256) &&
    isNonNegativeInteger(value.codePoints);
  if (
    !(inline || digested) ||
    typeof value.altered !== "boolean" ||
    typeof value.truncated !== "boolean" ||
    !isNonNegativeInteger(value.neutralized)
  ) {
    return [`${id}: expected must be a text, or its SHA-256 and code point count, and three flags`];
  }
  const failures: string[] = [];
  if (inline && actual.text !== value.text) failures.push(`${id}: text does not replay`);
  if (digested) {
    const digest = createHash("sha256").update(actual.text, "utf8").digest("hex");
    if (digest !== value.textSha256) failures.push(`${id}: textSha256 does not replay`);
    const codePoints = Array.from(actual.text).length;
    if (codePoints !== value.codePoints)
      failures.push(`${id}: replays to ${codePoints} code points, expects ${value.codePoints}`);
  }
  if (actual.altered !== value.altered)
    failures.push(`${id}: altered replays to ${actual.altered}, expects ${value.altered}`);
  if (actual.truncated !== value.truncated)
    failures.push(`${id}: truncated replays to ${actual.truncated}, expects ${value.truncated}`);
  if (actual.neutralized !== value.neutralized)
    failures.push(
      `${id}: neutralized replays to ${actual.neutralized}, expects ${value.neutralized}`,
    );
  return failures;
}

/**
 * A `range` vector names one removed range and carries "x", the first code
 * point, an interior one when the range holds at least three, the last one
 * when it holds at least two, then "y".
 */
function rangeVectorFailures(vector: JsonRecord, id: string, input: VectorInput): string[] {
  const pair = parseHexPair(vector.range);
  if (pair === undefined) return [`${id}: a range vector names its [first, last] range`];
  const [first, last] = pair;
  if (!removedRanges.some((range) => range[0] === first && range[1] === last))
    return [`${id}: names a range that is not a removed range`];
  const codePoints = Array.from(input.text, (character) => character.codePointAt(0) ?? 0);
  const size = last - first + 1;
  const interior = codePoints[2];
  const wellShaped =
    codePoints.length === Math.min(size, 3) + 2 &&
    codePoints[0] === 0x78 &&
    codePoints[1] === first &&
    (size < 2 || codePoints[codePoints.length - 2] === last) &&
    (size < 3 || (interior !== undefined && interior > first && interior < last)) &&
    codePoints[codePoints.length - 1] === 0x79;
  return wellShaped ? [] : [`${id}: text is not x, the range's first, interior and last, y`];
}

/**
 * Structural and semantic failures of a vector document. An empty list means:
 * closed members, tables equal to the oracle's, every neighbour kept and every
 * range edge listed, unique ids, the six families present, every removed range
 * named by exactly one `range` vector, and every vector replaying to its
 * expected text and flags.
 */
export function servedTextPreparationDocumentFailures(document: unknown): string[] {
  if (!isRecord(document)) return ["document must be an object"];
  const failures: string[] = [];
  const members = [
    "schemaVersion",
    "record",
    "semantics",
    "unicodeVersion",
    "removedRanges",
    "keptNeighbours",
    "delimiters",
    "truncationMarker",
    "vectors",
  ];
  if (!hasExactKeys(document, members))
    failures.push(`document members are not exactly ${members.join(", ")}`);
  if (document.schemaVersion !== servedTextPreparationSchemaVersion)
    failures.push(`schemaVersion must be ${servedTextPreparationSchemaVersion}`);
  if (typeof document.record !== "string" || !recordPattern.test(document.record))
    failures.push("record must be the path of the decision under docs/adr");
  if (document.semantics !== semanticsPath) failures.push(`semantics must be ${semanticsPath}`);
  if (document.unicodeVersion !== "17.0") failures.push('unicodeVersion must be "17.0"');
  failures.push(...rangesFailures(document.removedRanges));
  failures.push(...neighboursFailures(document.keptNeighbours));
  failures.push(...delimitersFailures(document.delimiters));
  if (document.truncationMarker !== truncationMarker)
    failures.push("truncationMarker differs from the oracle's marker");

  const vectors = Array.isArray(document.vectors) ? document.vectors : undefined;
  if (vectors === undefined || vectors.length === 0) {
    failures.push("vectors must be a non-empty array");
    return failures;
  }

  const ids = new Set<string>();
  const families = new Set<string>();
  const namedRanges = new Map<string, string>();
  for (const [index, vector] of vectors.entries()) {
    if (!isRecord(vector) || typeof vector.id !== "string" || vector.id.length === 0) {
      failures.push(`vectors.${index}: needs a string id`);
      continue;
    }
    const id = vector.id;
    if (ids.has(id)) failures.push(`${id}: duplicate id`);
    ids.add(id);
    const family = vector.family;
    if (
      typeof family !== "string" ||
      !(servedTextPreparationFamilies as readonly string[]).includes(family)
    ) {
      failures.push(`${id}: family is not closed`);
      continue;
    }
    families.add(family);
    const keys = ["id", "family", "input", "expected"];
    if (!hasExactKeys(vector, family === "range" ? [...keys, "range"] : keys))
      failures.push(`${id}: members are not closed for the ${family} family`);

    const input = inputOf(vector.input, id, failures);
    if (input === undefined) continue;
    if (family === "range") {
      const problems = rangeVectorFailures(vector, id, input);
      failures.push(...problems);
      if (problems.length === 0) {
        const key = JSON.stringify(vector.range);
        const other = namedRanges.get(key);
        if (other !== undefined) failures.push(`${id}: names the same range as ${other}`);
        namedRanges.set(key, id);
      }
    }
    failures.push(...expectedFailures(vector.expected, id, prepare(input.text, input.bound)));
  }

  for (const family of servedTextPreparationFamilies)
    if (!families.has(family)) failures.push(`family ${family} has no vector`);
  for (const [first, last] of removedRanges) {
    const key = JSON.stringify(
      [first, last].map((codePoint) => formatCodePoint(codePoint).slice(2)),
    );
    if (!namedRanges.has(key))
      failures.push(`range ${formatCodePoint(first)}-${formatCodePoint(last)} has no range vector`);
  }
  return failures;
}
