// Vector file loader of the signalement v1 contract family (test material only).
//
// Why it exists: signalement vendors these fixtures and refuses, through its public-boundary
// scanner, any file above 65,536 code points. A vector file therefore stays under that budget by
// two means, both stated normatively in each affected contract's SEMANTICS.md, "Test material":
//
// 1. Continuation files. The entry file (`vectors.json`, or another fixed name such as
//    `signature-vectors.v1.json`) MAY carry `parts`: a non-empty list of distinct bare file
//    names, each `<stem>*.json` where `<stem>` is the entry name without `.json`, other than the
//    entry itself. Each part is a JSON object with the entry's `schemaVersion` and no `parts`.
//    Loading appends, part by part in declaration order, every member of the part to the entry:
//    an array is appended to the entry's array at the same member path, an object is merged
//    member by member, an absent member is added. Any other meeting is refused. A declared part
//    that is absent or unreadable is a failure; a `<stem>*.json` file in the directory that the
//    entry does not declare is a failure (orphan).
// 2. Recipes, only for a contract whose SEMANTICS defines them (the caller passes
//    `admitRecipes: true`); elsewhere any recipe vector is a failure. A vector (an object with a
//    string `name` in a vector list) MAY replace `document` and `raw` by `recipe` plus `sha256`,
//    the lowercase hex SHA-256 of the generated octets. The vocabulary is closed:
//    - `document` (required): a JSON value whose numbers are safe integers;
//    - `repeat` (optional): `{ member, count, element, indexMember, indexPrefix }`; `document` is
//      an object whose `member` is an array; that array is replaced by `count` (0..4096) copies
//      of the object `element`, the copy at index i (from 0) having its member `indexMember` set
//      to the string `indexPrefix` followed by i in decimal;
//    - `padWithSpacesTo` (optional): an octet length (at most 1 MiB).
//    The octets are the UTF-8 JCS form (RFC 8785) of the document after `repeat`, followed by
//    U+0020 octets up to `padWithSpacesTo` when present (never shorter than the JCS form). The
//    generated octets never exceed 1 MiB (1,048,576), padded or not; a `repeat` is measured
//    exactly before any copy is built, so an oversized one is never materialized.
//    A recipe is resolved to `raw` (base64url of the octets); `recipe` and `sha256` are dropped.
//    Regenerated octets with another digest are refused: no verifier ever sees them. A list
//    element that carries `recipe` without a string `name` is refused, never skipped.
//
// Every vector file, entry or part, is read up to 1 MiB, as the Rust oracle reads it: a larger
// file is refused without being read whole.
//
// Any failure is named and returned, never thrown, and then no vector is returned at all, so a
// broken fixture cannot shrink a suite to the vectors that happened to load.

import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import { canonicalJson } from "./authorized-execution";
import { parseStrictJson } from "./policy-core-raw-inputs";

type JsonObject = Record<string, unknown>;

export interface LoadedVectorFile {
  /** Entry and parts merged, recipes resolved to `raw`; null whenever a failure is named. */
  vectors: JsonObject | null;
  failures: string[];
}

export interface VectorLoadOptions {
  /** Only a contract whose SEMANTICS defines recipes admits them; the default refuses them. */
  admitRecipes: boolean;
}

export const RECIPE_MAX_COUNT = 4096;
export const RECIPE_MAX_OCTETS = 1_048_576;
/** Read cap of one vector file, as the Rust oracle's (`MAX_FILE_OCTETS`). */
export const VECTOR_FILE_MAX_OCTETS = 1_048_576;
const OVERSIZED = `above ${VECTOR_FILE_MAX_OCTETS} octets, not read`;

const RECIPE_MEMBERS = new Set(["document", "repeat", "padWithSpacesTo"]);
const REPEAT_MEMBERS = ["count", "element", "indexMember", "indexPrefix", "member"];

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isVector(value: unknown): value is JsonObject {
  return isRecord(value) && typeof value.name === "string";
}

type FileRead =
  | { kind: "parsed"; value: unknown }
  | { kind: "unreadable" }
  | { kind: "invalid" }
  | { kind: "oversized" };

/** Reads at most one octet past the 1 MiB bound, so an oversized file is never loaded whole. */
async function readStrictJson(path: string): Promise<FileRead> {
  let bytes: Uint8Array;
  try {
    bytes = await Bun.file(path)
      .slice(0, VECTOR_FILE_MAX_OCTETS + 1)
      .bytes();
  } catch {
    return { kind: "unreadable" };
  }
  if (bytes.byteLength > VECTOR_FILE_MAX_OCTETS) return { kind: "oversized" };
  try {
    return { kind: "parsed", value: parseStrictJson(bytes) };
  } catch {
    return { kind: "invalid" };
  }
}

function hasSchemaVersion(value: unknown): value is JsonObject & { schemaVersion: string } {
  return isRecord(value) && typeof value.schemaVersion === "string";
}

function isDeclaredName(name: unknown, entry: string, stem: string): name is string {
  return (
    typeof name === "string" &&
    name !== entry &&
    name.startsWith(stem) &&
    name.endsWith(".json") &&
    !name.includes("/") &&
    !name.includes("\\") &&
    !name.includes("\0")
  );
}

function declaredParts(entry: string, stem: string, parts: unknown): string[] | null {
  if (parts === undefined) return [];
  if (!Array.isArray(parts) || parts.length === 0) return null;
  if (!parts.every((name) => isDeclaredName(name, entry, stem))) return null;
  return new Set(parts).size === parts.length ? (parts as string[]) : null;
}

function isNonNegativeInteger(value: unknown, maximum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= maximum;
}

type RecipeResult = Uint8Array | "invalid recipe" | "generated octets above 1048576";

/** UTF-8 octets of the JCS form, or null when the value is not canonicalizable. */
function jcsLength(value: unknown): number | null {
  try {
    return new TextEncoder().encode(canonicalJson(value)).length;
  } catch {
    return null;
  }
}

/** Decimal digits written by the indexes 0 to count - 1, without leading zeros. */
function indexDigits(count: number): number {
  let digits = 0;
  for (let index = 0; index < count; index += 1) digits += String(index).length;
  return digits;
}

/**
 * The exact octet length of the JCS form after `repeat`, measured without building the copies:
 * the document with an empty array, plus each copy, plus the commas between copies. A copy is
 * the element with its index member set to the prefix, plus the digits of its index: digits are
 * ASCII, so they add one octet each and never an escape.
 */
function repeatedLength(
  document: JsonObject,
  member: string,
  count: number,
  element: JsonObject,
  indexMember: string,
  indexPrefix: string,
): number | null {
  const base = jcsLength({ ...document, [member]: [] });
  const copy = jcsLength({ ...element, [indexMember]: indexPrefix });
  if (base === null || copy === null) return null;
  return base + count * copy + indexDigits(count) + Math.max(count - 1, 0);
}

/** The recipe's octets, or the failure: outside the closed vocabulary, or above 1 MiB. */
function recipeOctets(recipe: unknown): RecipeResult {
  if (!isRecord(recipe) || !Object.hasOwn(recipe, "document")) return "invalid recipe";
  if (!Object.keys(recipe).every((member) => RECIPE_MEMBERS.has(member))) return "invalid recipe";
  let document: unknown = recipe.document;
  const repeated = Object.hasOwn(recipe, "repeat");
  if (repeated) {
    const repeat: unknown = recipe.repeat;
    if (!isRecord(repeat) || Object.keys(repeat).sort().join() !== REPEAT_MEMBERS.join()) {
      return "invalid recipe";
    }
    const { member, count, element, indexMember, indexPrefix } = repeat;
    if (
      !isRecord(document) ||
      typeof member !== "string" ||
      !Object.hasOwn(document, member) ||
      !Array.isArray(document[member]) ||
      !isNonNegativeInteger(count, RECIPE_MAX_COUNT) ||
      !isRecord(element) ||
      typeof indexMember !== "string" ||
      typeof indexPrefix !== "string"
    ) {
      return "invalid recipe";
    }
    // Measured before any copy exists: an oversized recipe is never materialized.
    const length = repeatedLength(document, member, count, element, indexMember, indexPrefix);
    if (length === null) return "invalid recipe";
    if (length > RECIPE_MAX_OCTETS) return "generated octets above 1048576";
    const copies = Array.from({ length: count }, (_, index) => ({
      ...element,
      [indexMember]: `${indexPrefix}${index}`,
    }));
    document = { ...document, [member]: copies };
  }
  let text: string;
  try {
    text = canonicalJson(document);
  } catch {
    return "invalid recipe";
  }
  const canonical = new TextEncoder().encode(text);
  // A repeated document was measured exactly above; a plain one is already in memory.
  if (!repeated && canonical.length > RECIPE_MAX_OCTETS) return "generated octets above 1048576";
  if (!Object.hasOwn(recipe, "padWithSpacesTo")) return canonical;
  const length: unknown = recipe.padWithSpacesTo;
  if (!isNonNegativeInteger(length, RECIPE_MAX_OCTETS) || length < canonical.length) {
    return "invalid recipe";
  }
  const padded = new Uint8Array(length).fill(0x20);
  padded.set(canonical);
  return padded;
}

/**
 * Resolves in place every recipe vector of one file, failures named by file. Vector lists are
 * arrays reached through objects (families such as `valid` or `keySetVectors.invalid`); a vector
 * is never descended into, so a document member is never read as a recipe.
 */
function resolveRecipes(
  value: unknown,
  file: string,
  admitRecipes: boolean,
  failures: string[],
): void {
  if (Array.isArray(value)) {
    let namelessRecipe = false;
    value.forEach((element, index) => {
      if (!isRecord(element) || !Object.hasOwn(element, "recipe")) return;
      // A recipe that no name labels would otherwise be neither resolved nor refused.
      if (!isVector(element)) {
        namelessRecipe = true;
        return;
      }
      const { recipe, sha256, ...rest } = element;
      const label = `${file}: vector ${JSON.stringify(element.name)}`;
      if (!admitRecipes) {
        failures.push(`${label}: recipe not admitted for these vectors`);
        return;
      }
      const octets =
        typeof sha256 === "string" &&
        /^[0-9a-f]{64}$/.test(sha256) &&
        !Object.hasOwn(rest, "document") &&
        !Object.hasOwn(rest, "raw")
          ? recipeOctets(recipe)
          : "invalid recipe";
      if (typeof octets === "string") {
        failures.push(`${label}: ${octets}`);
        return;
      }
      if (createHash("sha256").update(octets).digest("hex") !== sha256) {
        failures.push(`${label}: regenerated octets do not match the recorded SHA-256`);
        return;
      }
      value[index] = { ...rest, raw: Buffer.from(octets).toString("base64url") };
    });
    if (namelessRecipe)
      failures.push(`${file}: a list element carries a recipe without a string name`);
    return;
  }
  if (isRecord(value)) {
    for (const member of Object.values(value)) {
      resolveRecipes(member, file, admitRecipes, failures);
    }
  }
}

/** Appends `part` to `target`; returns the JSON Pointer of the first member that cannot be. */
function append(target: JsonObject, part: JsonObject, pointer: string): string | null {
  for (const [member, value] of Object.entries(part)) {
    const path = `${pointer}/${member}`;
    const existing: unknown = target[member];
    if (!Object.hasOwn(target, member)) target[member] = value;
    else if (Array.isArray(existing) && Array.isArray(value))
      target[member] = [...existing, ...value];
    else if (isRecord(existing) && isRecord(value)) {
      const conflict = append(existing, value, path);
      if (conflict !== null) return conflict;
    } else return path;
  }
  return null;
}

export async function loadSignalementV1Vectors(
  directory: string,
  entry: string = "vectors.json",
  options: VectorLoadOptions = { admitRecipes: false },
): Promise<LoadedVectorFile> {
  const { admitRecipes } = options;
  const failures: string[] = [];
  const refused = (): LoadedVectorFile => ({ vectors: null, failures });
  const stem = entry.slice(0, -".json".length);

  const read = await readStrictJson(`${directory}/${entry}`);
  if (read.kind !== "parsed") {
    const reason = {
      unreadable: "absent or unreadable",
      invalid: "not strict JSON",
      oversized: OVERSIZED,
    }[read.kind];
    failures.push(`${entry}: ${reason}`);
    return refused();
  }
  const merged: unknown = read.value;
  if (!hasSchemaVersion(merged)) {
    failures.push(`${entry}: not a vector file object with a schemaVersion`);
    return refused();
  }
  const parts = declaredParts(entry, stem, merged.parts);
  if (parts === null) {
    failures.push(`${entry}: invalid parts declaration`);
    return refused();
  }
  delete merged.parts;
  resolveRecipes(merged, entry, admitRecipes, failures);

  let siblings: string[];
  try {
    siblings = (await readdir(directory)).sort();
  } catch {
    failures.push(`${entry}: directory is unreadable`);
    return refused();
  }
  for (const name of siblings) {
    if (isDeclaredName(name, entry, stem) && !parts.includes(name)) {
      failures.push(`${name}: vector file not declared by ${entry}`);
    }
  }

  for (const name of parts) {
    const partRead = await readStrictJson(`${directory}/${name}`);
    if (partRead.kind === "unreadable") {
      failures.push(`${name}: declared by ${entry} but absent or unreadable`);
      continue;
    }
    if (partRead.kind === "invalid") {
      failures.push(`${name}: not strict JSON`);
      continue;
    }
    if (partRead.kind === "oversized") {
      failures.push(`${name}: ${OVERSIZED}`);
      continue;
    }
    const part: unknown = partRead.value;
    if (!hasSchemaVersion(part)) {
      failures.push(`${name}: not a vector file object with a schemaVersion`);
      continue;
    }
    if (part.schemaVersion !== merged.schemaVersion) {
      failures.push(`${name}: schemaVersion differs from ${entry}`);
      continue;
    }
    if (Object.hasOwn(part, "parts")) {
      failures.push(`${name}: a part declares no parts`);
      continue;
    }
    const { schemaVersion: _, ...members } = part;
    resolveRecipes(members, name, admitRecipes, failures);
    const conflict = append(merged, members, "");
    if (conflict !== null)
      failures.push(`${name}: member ${conflict} cannot be appended to ${entry}`);
  }
  return failures.length === 0 ? { vectors: merged, failures } : refused();
}
