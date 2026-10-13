import { sha256Canonical } from "./authorized-execution";
import { parseStrictJson } from "./policy-core-raw-inputs";

// Import rule of the export majors that carry a whole-export digest
// (curated-item-export.v3, practice-progress-export.v2), I-10 as widened by
// project-governance ADR-0049. JSON Schema can require the digest; it cannot
// recompute it, so the comparison lives here. This is a test oracle for the
// vectors, not a runtime: products implement the same rule and prove it
// against these vectors at a pinned revision.

export type ExportImportVerdict = "export-importable" | "export-refused";

// Deep enough for both documents (root, array, item, nested array: depth 4),
// small enough to refuse a hostile nesting before the schema walks it.
export const EXPORT_MAX_DEPTH = 16;

export type ExportSchemaValidator = (document: unknown) => boolean;

/** SHA-256 over the RFC 8785 form of the export without its own `digest` member. */
export async function exportDigest(document: Readonly<Record<string, unknown>>): Promise<string> {
  const { digest: _excluded, ...preimage } = document;
  return sha256Canonical(preimage);
}

/** Every reason the raw bytes must not be imported. Empty means importable. */
export async function exportImportFailures(
  bytes: Uint8Array,
  validate: ExportSchemaValidator,
): Promise<string[]> {
  let document: unknown;
  try {
    // Duplicate members, lone surrogates, a BOM or invalid UTF-8 would let two
    // parsers disagree on the digested value: refuse before parsing.
    document = parseStrictJson(bytes, EXPORT_MAX_DEPTH);
  } catch {
    return ["export.json_not_strict"];
  }
  if (!validate(document)) return ["export.schema_invalid"];
  const record = document as Record<string, unknown>;
  let recomputed: string;
  try {
    recomputed = await exportDigest(record);
  } catch {
    return ["export.not_canonicalizable"];
  }
  return recomputed === record.digest ? [] : ["export.digest_mismatch"];
}

export async function importExport(
  bytes: Uint8Array,
  validate: ExportSchemaValidator,
): Promise<ExportImportVerdict> {
  const failures = await exportImportFailures(bytes, validate);
  return failures.length === 0 ? "export-importable" : "export-refused";
}
