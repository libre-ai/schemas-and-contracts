// File reading of the signalement-policy-receipt-v1 golden document: entry, declared parts, sizes
// and the members a part may carry (world SEMANTICS, "Continuation files").
//
// Why a module of its own: check-contracts.ts reads the golden document too. It must not load
// any contract verifier for that (AJV compilation, the receipt schema read at load time,
// @noble/curves): a candidate verifier that breaks at load would then kill the shared gate with
// an exception instead of a named failure. This module depends only on the vector loader and the
// strict JSON parser, never on a verifier.
import { readdir, stat } from "node:fs/promises";
import { parseStrictJson } from "./policy-core-raw-inputs";
import { loadSignalementV1Vectors } from "./signalement-v1-vector-loader";

/** Ceiling of one golden file, and of the merged document, in octets (8 MiB). */
export const POLICY_RECEIPT_GOLDEN_MAX_BYTES = 8388608;
export const POLICY_RECEIPT_GOLDEN_ENTRY = "golden-vectors.v1.json";
/** Repository path of the entry, as check-contracts names it. */
export const POLICY_RECEIPT_GOLDEN_PATH =
  "contracts/fixtures/signalement-policy-receipt-v1/golden-vectors.v1.json";
export const POLICY_RECEIPT_GOLDEN_DIRECTORY = `${import.meta.dir}/../../contracts/fixtures/signalement-policy-receipt-v1`;

type JsonObject = Record<string, unknown>;

export interface GoldenFile {
  /** Bare file name in the golden directory. */
  name: string;
  /** The file's document as written (the entry still carries `parts`). */
  document: unknown;
}

export interface LoadedPolicyReceiptGolden {
  /** Entry and declared parts merged, `parts` removed; null whenever a failure is named. */
  document: JsonObject | null;
  /** The entry then each declared part, in declaration order; empty whenever a failure is named. */
  files: GoldenFile[];
  failures: string[];
}

const GOLDEN_STEM = POLICY_RECEIPT_GOLDEN_ENTRY.slice(0, -".json".length);
const PART_MEMBERS = "cases,schemaVersion";

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function refused(failures: string[]): LoadedPolicyReceiptGolden {
  return { document: null, files: [], failures };
}

async function readParsed(path: string): Promise<unknown> {
  try {
    return parseStrictJson(await Bun.file(path).bytes());
  } catch {
    return undefined;
  }
}

/**
 * Reads the entry and its declared parts with the signalement v1 continuation rule. Every
 * `golden-vectors.v1*.json` file is measured before any is read, so an oversized file is
 * never decoded. A golden part carries exactly `schemaVersion` and a `cases` array: anything
 * else would be merged into the document's metadata (an extra `contractFiles`, for instance).
 */
export async function loadPolicyReceiptGolden(
  directory: string = POLICY_RECEIPT_GOLDEN_DIRECTORY,
): Promise<LoadedPolicyReceiptGolden> {
  let names: string[];
  try {
    names = (await readdir(directory)).sort();
  } catch {
    return refused(["golden.parts:directory is unreadable"]);
  }
  const sizeFailures: string[] = [];
  for (const name of names) {
    if (!name.startsWith(GOLDEN_STEM) || !name.endsWith(".json")) continue;
    const size = await stat(`${directory}/${name}`).then(
      (entry) => entry.size,
      () => 0,
    );
    if (size > POLICY_RECEIPT_GOLDEN_MAX_BYTES) sizeFailures.push(`golden.size_limit:${name}`);
  }
  if (sizeFailures.length > 0) return refused(sizeFailures);
  const loaded = await loadSignalementV1Vectors(directory, POLICY_RECEIPT_GOLDEN_ENTRY);
  if (loaded.vectors === null)
    return refused(loaded.failures.map((failure) => `golden.parts:${failure}`));

  // The loader accepted the files; read them once more as written, for the part members rule
  // and so that a caller can attribute a finding to the file it comes from.
  const entry = await readParsed(`${directory}/${POLICY_RECEIPT_GOLDEN_ENTRY}`);
  const declared: unknown = isRecord(entry) ? entry.parts : undefined;
  const parts = Array.isArray(declared) ? (declared as string[]) : [];
  const files: GoldenFile[] = [{ name: POLICY_RECEIPT_GOLDEN_ENTRY, document: entry }];
  const failures: string[] = [];
  for (const name of parts) {
    const part = await readParsed(`${directory}/${name}`);
    if (
      !isRecord(part) ||
      Object.keys(part).sort().join() !== PART_MEMBERS ||
      !Array.isArray(part.cases)
    ) {
      failures.push(`golden.part_members:${name}`);
      continue;
    }
    files.push({ name, document: part });
  }
  if (failures.length > 0) return refused(failures);
  return { document: loaded.vectors, files, failures: [] };
}

export interface GoldenInspectionTargets {
  /** One target per file, labelled with its path, so a finding names the file it is in. */
  files: { label: string; document: unknown }[];
  /** Label of the merged document: only aggregate bounds (cases, nodes) can fail there. */
  merged: string;
}

/** Inspection targets of a loaded golden document whose entry is at `entryPath`. */
export function goldenInspectionTargets(
  loaded: LoadedPolicyReceiptGolden,
  entryPath: string,
): GoldenInspectionTargets {
  const directory = entryPath.slice(0, entryPath.length - POLICY_RECEIPT_GOLDEN_ENTRY.length);
  const parts = loaded.files.slice(1).map((file) => file.name);
  return {
    files: loaded.files.map((file) => ({
      label: `${directory}${file.name}`,
      document: file.document,
    })),
    merged: parts.length === 0 ? entryPath : `${entryPath} (merged with ${parts.join(", ")})`,
  };
}
