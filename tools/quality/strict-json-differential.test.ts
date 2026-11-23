// Differential test of the two strict JSON readers of this authority, on documents where
// TypeScript and Rust readers classically diverge (numbers past 2^53, signed zero, exponents,
// astral and combining characters, UTF-16 versus code point key order, depth, duplicates).
//
// - TypeScript: `parseStrictJson` (tools/quality/policy-core-raw-inputs.ts) then the authority
//   canonicalizer `canonicalJson` (tools/quality/authorized-execution.ts).
// - Rust: `strict_json::parse` then `strict_json::canonicalize` (crates/sdk-rs), run through
//   tools/quality/strict-json-oracle.
//
// No expected verdict is recorded anywhere: each document's verdict is the Rust one compared
// with the TypeScript one. The only admitted difference is the number rule of
// docs/adr/2026-11-17-strict-json-reader-home.md (decision 2): the Rust reader judges the
// literal, so it refuses an integral value written `1.0` or `1e2` that the TypeScript pipeline,
// which judges the binary64 value, accepts. That difference is admitted only when the literal at
// the Rust offset is, by the grammar of that decision, not a safe-integer literal.

import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalJson } from "./authorized-execution";
import { parseStrictJson, StrictJsonError } from "./policy-core-raw-inputs";
import { loadPolicyReceiptGolden } from "./signalement-policy-receipt-golden-files";

const REPOSITORY_ROOT = resolve(import.meta.dir, "../..");
const TRAP_CORPUS_PATH = join(import.meta.dir, "strict-json-differential-traps.json");
const TRAP_CORPUS_SCHEMA = "libre-ai.strict-json-differential-traps.v1";
const ORACLE_MANIFEST = join(import.meta.dir, "strict-json-oracle", "Cargo.toml");
const RAW_INPUT_ROOT = join(REPOSITORY_ROOT, "contracts/fixtures/policy-core-invalid-json");
// parseStrictJson counts the top-level value as depth 0, strict_json as depth 1 with a
// maximum of 64: 63 here bounds both readers to the same 64 levels.
const TYPESCRIPT_MAX_DEPTH = 63;
// The first build of the oracle compiles crates/sdk-rs and its dependencies.
const ORACLE_TIMEOUT_MS = 900_000;

const TRAP_LISTS = ["int", "float", "string", "regex", "json"] as const;
type TrapList = (typeof TRAP_LISTS)[number];
type TrapCorpus = Record<TrapList, string[]>;

interface Document {
  id: string;
  bytes: Uint8Array;
}

interface Accepted {
  accepted: true;
  canonical: string;
}

interface Refused {
  accepted: false;
  stage: "parse" | "canonicalize";
  defect: string;
  offset?: number;
}

type Verdict = Accepted | Refused;

interface Divergence {
  id: string;
  input: string;
  typescript: Verdict;
  rust: Verdict;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

const encoder = new TextEncoder();

/** An absent, unreadable, malformed or empty corpus is an error, never an empty set. */
async function loadTrapCorpus(path: string): Promise<TrapCorpus> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await readFile(path));
  } catch {
    throw new Error(`trap corpus is absent or unreadable: ${path}`);
  }
  const document = parseStrictJson(bytes);
  if (!isRecord(document) || document.schemaVersion !== TRAP_CORPUS_SCHEMA)
    throw new Error(`trap corpus has no ${TRAP_CORPUS_SCHEMA} schemaVersion`);
  if (typeof document.provenance !== "string" || document.provenance.length === 0)
    throw new Error("trap corpus has no provenance");
  const traps = document.traps;
  if (!isRecord(traps)) throw new Error("trap corpus has no traps object");
  const corpus = {} as TrapCorpus;
  for (const list of TRAP_LISTS) {
    const values = traps[list];
    if (!Array.isArray(values) || values.length === 0)
      throw new Error(`trap corpus list ${list} is absent or empty`);
    if (!values.every((value) => typeof value === "string"))
      throw new Error(`trap corpus list ${list} holds a non-string value`);
    corpus[list] = values as string[];
  }
  return corpus;
}

/** Every non-ASCII UTF-16 code unit as a `\uXXXX` escape: surrogate pairs travel escaped. */
function escapedJsonString(value: string): string {
  return JSON.stringify(value).replace(
    /[\u0080-￿]/g,
    (unit) => `\\u${unit.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

function trapDocuments(corpus: TrapCorpus): Document[] {
  const documents: Document[] = [];
  const add = (id: string, text: string): void => {
    documents.push({ id, bytes: encoder.encode(text) });
  };
  for (const list of ["int", "float"] as const)
    for (const [index, literal] of corpus[list].entries())
      add(`${list}[${index}]:literal`, literal);
  const strings = [...corpus.string, ...corpus.regex];
  for (const list of ["string", "regex"] as const) {
    corpus[list].forEach((value, index) => {
      add(`${list}[${index}]:value`, JSON.stringify(value));
      add(`${list}[${index}]:value-escaped`, escapedJsonString(value));
      add(`${list}[${index}]:key`, `{${JSON.stringify(value)}:0}`);
      add(`${list}[${index}]:key-escaped`, `{${escapedJsonString(value)}:0}`);
    });
  }
  // All distinct trap strings as members of one object: the UTF-16 order of their names is
  // where code point order and code unit order part ways.
  const members = [...new Set(strings)].map((name, index) => `${JSON.stringify(name)}:${index}`);
  add("string+regex:all-keys", `{${members.join(",")}}`);
  for (const [index, text] of corpus.json.entries()) add(`json[${index}]:document`, text);
  return documents;
}

/** The raw refusal vectors of policy-core, reused as they are. */
async function rawInputDocuments(): Promise<Document[]> {
  const manifest = parseStrictJson(
    new Uint8Array(await readFile(join(RAW_INPUT_ROOT, "manifest.json"))),
  );
  const cases = isRecord(manifest) && Array.isArray(manifest.cases) ? manifest.cases : [];
  const documents: Document[] = [];
  for (const entry of cases) {
    if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.file !== "string")
      throw new Error("policy-core raw input case is malformed");
    if (!/^[a-z0-9-]+\.bin$/.test(entry.file))
      throw new Error(`policy-core raw input file name is unsafe: ${entry.id}`);
    const bytes = new Uint8Array(await readFile(join(RAW_INPUT_ROOT, entry.file)));
    documents.push({ id: `policy-core-invalid-json:${entry.id}`, bytes });
  }
  if (documents.length === 0) throw new Error("policy-core raw input manifest has no case");
  return documents;
}

/** The `canonicalize` golden cases of signalement-policy-receipt-v1, reused as they are. */
async function canonicalizeGoldenDocuments(): Promise<Document[]> {
  const loaded = await loadPolicyReceiptGolden();
  if (loaded.document === null)
    throw new Error(`policy receipt golden is unreadable: ${loaded.failures.join(", ")}`);
  const cases = Array.isArray(loaded.document.cases) ? loaded.document.cases : [];
  const documents: Document[] = [];
  for (const entry of cases) {
    if (!isRecord(entry) || entry.operation !== "canonicalize") continue;
    const jsonBytes = isRecord(entry.args) ? entry.args.jsonBytes : undefined;
    if (typeof entry.id !== "string" || typeof jsonBytes !== "string")
      throw new Error("canonicalize golden case is malformed");
    documents.push({
      id: `signalement-policy-receipt-v1:${entry.id}`,
      bytes: new Uint8Array(Buffer.from(jsonBytes, "base64url")),
    });
  }
  if (documents.length === 0) throw new Error("policy receipt golden has no canonicalize case");
  return documents;
}

/**
 * Strict JSON traps not carried, as standalone documents, by the vectors above. The BOM,
 * duplicate members, escaped lone surrogates and depth 65 arrays are reused from them.
 */
function additionDocuments(): Document[] {
  const additions: [string, string][] = [
    ["integral-literal-fraction", "1.0"],
    ["integral-literal-exponent", "1e2"],
    ["depth-64-arrays", `${"[".repeat(64)}${"]".repeat(64)}`],
    ["depth-65-scalar", `${"[".repeat(64)}0${"]".repeat(64)}`],
    ["depth-64-objects", `${'{"a":'.repeat(63)}{}${"}".repeat(63)}`],
    ["depth-65-objects", `${'{"a":'.repeat(64)}{}${"}".repeat(64)}`],
  ];
  return additions.map(([id, text]) => ({ id: `addition:${id}`, bytes: encoder.encode(text) }));
}

function typescriptVerdict(bytes: Uint8Array): Verdict {
  let value: unknown;
  try {
    value = parseStrictJson(bytes, TYPESCRIPT_MAX_DEPTH);
  } catch (error) {
    if (error instanceof StrictJsonError)
      return { accepted: false, stage: "parse", defect: error.defect };
    throw error;
  }
  try {
    return { accepted: true, canonical: toHex(encoder.encode(canonicalJson(value))) };
  } catch (error) {
    if (error instanceof TypeError && error.message === "canonical numbers must be safe integers")
      return { accepted: false, stage: "canonicalize", defect: "non-safe-integer" };
    throw error;
  }
}

function isVerdict(value: unknown): value is Verdict {
  if (!isRecord(value)) return false;
  if (value.accepted === true) return typeof value.canonical === "string";
  return (
    value.accepted === false &&
    (value.stage === "parse" || value.stage === "canonicalize") &&
    typeof value.defect === "string" &&
    (value.offset === undefined || typeof value.offset === "number")
  );
}

/** A Rust oracle that cannot be built, run or read is an error, never a skipped comparison. */
async function rustVerdicts(documents: Document[], manifest = ORACLE_MANIFEST): Promise<Verdict[]> {
  const input = JSON.stringify({ documents: documents.map((document) => toHex(document.bytes)) });
  let child: Bun.Subprocess<"pipe", "pipe", "pipe">;
  try {
    child = Bun.spawn(["cargo", "run", "--quiet", "--locked", "--manifest-path", manifest], {
      cwd: REPOSITORY_ROOT,
      env: { ...process.env, CARGO_TERM_COLOR: "never" },
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch (error) {
    throw new Error(`Rust oracle cannot be launched: ${String(error)}`);
  }
  // Both calls can reject with EPIPE once the oracle closed its stdin or exited unread (seen on
  // Linux). Unhandled, the write would end the test process; awaited, the end would replace the
  // oracle's own exit code and stderr: those decide below, so both rejections are dropped.
  void Promise.resolve(child.stdin.write(input)).catch(() => undefined);
  await Promise.resolve(child.stdin.end()).catch(() => undefined);
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (exitCode !== 0) throw new Error(`Rust oracle exited with ${exitCode}: ${stderr.trim()}`);
  const output: unknown = JSON.parse(stdout);
  const verdicts = isRecord(output) ? output.verdicts : undefined;
  if (!Array.isArray(verdicts) || verdicts.length !== documents.length)
    throw new Error("Rust oracle did not answer one verdict per document");
  if (!verdicts.every(isVerdict)) throw new Error("Rust oracle answered a malformed verdict");
  return verdicts;
}

const SAFE_INTEGER_LITERAL = /^-?(?:0|[1-9][0-9]*)$/;
const MAX_SAFE_MAGNITUDE = 2n ** 53n - 1n;

/** The run of number characters starting at `offset`, read from the input octets. */
function literalAt(bytes: Uint8Array, offset: number): string {
  let end = offset;
  while (end < bytes.length && /[0-9+\-.eE]/.test(String.fromCharCode(bytes[end] ?? 0))) end += 1;
  return new TextDecoder().decode(bytes.subarray(offset, end));
}

type Agreement = "identical" | "number-literal";

/**
 * Identical verdicts agree. The number rule of the strict reader ADR (decision 2) admits one
 * more pairing, checked against the literal itself rather than against either reader:
 * - Rust `invalid-number` on a literal outside `-?(0|[1-9][0-9]*)`, where TypeScript accepts
 *   the binary64 value or refuses it as not a safe integer;
 * - Rust `unsafe-integer` on an integer literal of magnitude above 2^53 - 1, where TypeScript
 *   refuses the value as not a safe integer.
 */
function agreement(bytes: Uint8Array, typescript: Verdict, rust: Verdict): Agreement | null {
  if (typescript.accepted && rust.accepted)
    return typescript.canonical === rust.canonical ? "identical" : null;
  if (!typescript.accepted && !rust.accepted && typescript.stage === rust.stage)
    return typescript.defect === rust.defect ? "identical" : null;
  if (rust.accepted || rust.stage !== "parse" || rust.offset === undefined) return null;
  const literal = literalAt(bytes, rust.offset);
  const typescriptRefusesValue =
    !typescript.accepted &&
    typescript.stage === "canonicalize" &&
    typescript.defect === "non-safe-integer";
  if (rust.defect === "invalid-number") {
    const notIntegerLiteral = /^-?[0-9]/.test(literal) && !SAFE_INTEGER_LITERAL.test(literal);
    return notIntegerLiteral && (typescript.accepted || typescriptRefusesValue)
      ? "number-literal"
      : null;
  }
  if (rust.defect === "unsafe-integer") {
    const unsafeIntegerLiteral =
      SAFE_INTEGER_LITERAL.test(literal) &&
      (literal.startsWith("-") ? -BigInt(literal) : BigInt(literal)) > MAX_SAFE_MAGNITUDE;
    return unsafeIntegerLiteral && typescriptRefusesValue ? "number-literal" : null;
  }
  return null;
}

function printable(bytes: Uint8Array): string {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const shown = text.length > 80 ? `${text.slice(0, 80)}...` : text;
  return `${JSON.stringify(shown)} (hex ${toHex(bytes.subarray(0, 40))}${bytes.length > 40 ? "..." : ""})`;
}

describe("strict JSON differential: TypeScript and Rust readers", () => {
  test("an absent, unreadable or empty trap corpus is an error", async () => {
    const scratch = await mkdtemp(join(tmpdir(), "strict-json-differential-"));
    try {
      await expect(loadTrapCorpus(join(scratch, "absent.json"))).rejects.toThrow("absent");
      const empty = join(scratch, "empty.json");
      await writeFile(empty, "");
      await expect(loadTrapCorpus(empty)).rejects.toThrow();
      const emptyList = join(scratch, "empty-list.json");
      const traps = { int: [], float: ["0.1"], string: ["a"], regex: ["b"], json: ["{}"] };
      await writeFile(
        emptyList,
        JSON.stringify({ schemaVersion: TRAP_CORPUS_SCHEMA, provenance: "test", traps }),
      );
      await expect(loadTrapCorpus(emptyList)).rejects.toThrow("int is absent or empty");
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
  });

  test(
    "an oracle that cannot run is an error",
    async () => {
      const missing = join(import.meta.dir, "strict-json-oracle", "absent", "Cargo.toml");
      await expect(rustVerdicts([], missing)).rejects.toThrow("Rust oracle");
    },
    ORACLE_TIMEOUT_MS,
  );

  test(
    "an oracle that exits without reading its input is judged on its exit code",
    async () => {
      // The input is larger than a pipe buffer, and cargo exits on the missing manifest
      // without reading it: writing it fails with EPIPE after the write call has returned.
      // That failure must neither end the test process (an unhandled rejection, seen on Linux)
      // nor replace the oracle's own exit code and stderr in the error.
      const missing = join(import.meta.dir, "strict-json-oracle", "absent", "Cargo.toml");
      const documents = [{ id: "large", bytes: encoder.encode(`"${"x".repeat(900_000)}"`) }];
      await expect(rustVerdicts(documents, missing)).rejects.toThrow("Rust oracle exited with");
    },
    ORACLE_TIMEOUT_MS,
  );

  test(
    "both readers give the same verdict on every trap document",
    async () => {
      const traps = trapDocuments(await loadTrapCorpus(TRAP_CORPUS_PATH));
      const reused = [...(await rawInputDocuments()), ...(await canonicalizeGoldenDocuments())];
      const additions = additionDocuments();
      const documents = [...traps, ...reused, ...additions];
      expect(new Set(documents.map((document) => document.id)).size).toBe(documents.length);

      const rust = await rustVerdicts(documents);
      const divergences: Divergence[] = [];
      let identical = 0;
      let numberLiteral = 0;
      documents.forEach((document, index) => {
        const typescript = typescriptVerdict(document.bytes);
        const rustVerdict = rust[index];
        if (rustVerdict === undefined) throw new Error(`no Rust verdict for ${document.id}`);
        const outcome = agreement(document.bytes, typescript, rustVerdict);
        if (outcome === "identical") identical += 1;
        else if (outcome === "number-literal") numberLiteral += 1;
        else
          divergences.push({
            id: document.id,
            input: printable(document.bytes),
            typescript,
            rust: rustVerdict,
          });
      });

      console.log(
        `strict JSON differential: ${documents.length} documents compared ` +
          `(${traps.length} derived from traps, ${reused.length} reused vectors, ` +
          `${additions.length} additions); ${identical} identical verdicts, ` +
          `${numberLiteral} number-literal refusals admitted by ADR 2026-11-17 decision 2, ` +
          `${divergences.length} divergences`,
      );
      expect(divergences).toEqual([]);
    },
    ORACLE_TIMEOUT_MS,
  );
});
