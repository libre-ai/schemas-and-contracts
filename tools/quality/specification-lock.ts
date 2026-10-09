import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type approvedEvidence from "../../docs/reviews/build-brief-missions-specification-lock.json";

// This gate admits one reviewed change, not an extensible source of permissions.
// Updating the proof requires a new reviewed pin; caller-controlled manifests
// cannot broaden the transition or replace their own baseline.
const EVIDENCE_DIGEST = "39c8bb96a25cf1e5cb6e9d832f2a4f3e44acbf3a47a37b73d3f0b5de75888eb6";

// Entries admitted after the reviewed baseline. The registry is data, but its
// exact bytes are pinned here: adding an entry requires changing this digest
// in a reviewed, owner-arbitrated change (ADR 2026-10-09).
export const POST_LOCK_ADDITIONS_PATH = "contracts/catalog-post-lock-additions.v1.json";
const POST_LOCK_ADDITIONS_DIGEST =
  "86f4144859119386792e002c2eb2a177480e74105d52bf0f19302d0591649bf6";

export interface SpecificationLockInput {
  targetCatalog: unknown;
  evidence: unknown;
  documents: ReadonlyMap<string, Uint8Array>;
  postLockAdditions: Uint8Array;
}

/** Catalog entries the pinned registry appends after the baseline, or null if unrecognized. */
export function pinnedPostLockAdditions(bytes: Uint8Array): unknown[] | null {
  // Hash our own copy so a caller buffer mutated after this check changes nothing.
  const snapshot = new Uint8Array(bytes);
  if (digest(snapshot) !== POST_LOCK_ADDITIONS_DIGEST) return null;
  try {
    const registry: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(snapshot),
    );
    if (
      typeof registry !== "object" ||
      registry === null ||
      !("additions" in registry) ||
      !Array.isArray(registry.additions)
    )
      return null;
    return registry.additions.map((addition: { entry?: unknown }) => addition.entry);
  } catch {
    return null;
  }
}

function digest(bytes: string | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function pinnedEvidence(value: unknown): typeof approvedEvidence | null {
  try {
    const serialized = JSON.stringify(value);
    if (digest(serialized) !== EVIDENCE_DIGEST) return null;
    // Use only the bytes we verified, never caller fields that may serialize
    // differently or mutate between verification and document selection.
    return JSON.parse(serialized) as typeof approvedEvidence;
  } catch {
    return null;
  }
}

/** Resolve paths only after the exact review package has been authenticated by
 * its content pin. This authenticates bytes, never the human decision itself. */
export function specificationLockDocumentPaths(value: unknown): string[] {
  const evidence = pinnedEvidence(value);
  if (!evidence) throw new Error("Unrecognized specification lock evidence");
  return [
    evidence.baselineCatalog.path,
    evidence.consumerMatrix.path,
    ...Object.keys(evidence.preservedFiles),
    ...evidence.roleVerdicts.map((entry) => entry.path),
  ];
}

export function specificationLockFailures(input: SpecificationLockInput): string[] {
  const evidence = pinnedEvidence(input.evidence);
  if (!evidence) return ["Unrecognized specification lock evidence"];
  const expectedHashes = new Map<string, string>([
    [evidence.baselineCatalog.path, evidence.baselineCatalog.sha256],
    [evidence.consumerMatrix.path, evidence.consumerMatrix.sha256],
    ...Object.entries(evidence.preservedFiles),
    ...evidence.roleVerdicts.map((entry): [string, string] => [entry.path, entry.sha256]),
  ]);
  const verifiedDocuments = new Map<string, Uint8Array>();
  for (const [path, expectedHash] of expectedHashes) {
    const bytes = input.documents.get(path);
    if (!bytes) return ["Missing or altered protected input"];
    // Read each caller entry once and retain our own bytes before hashing.
    // Subsequent getters may replace entries or mutate their original buffers.
    const snapshot = new Uint8Array(bytes);
    if (digest(snapshot) !== expectedHash) return ["Missing or altered protected input"];
    verifiedDocuments.set(path, snapshot);
  }
  // The pinned baseline is immutable data. Preserve every field and array
  // position; only the fifteen approved statuses and review objects may change.
  const baselineBytes = verifiedDocuments.get(evidence.baselineCatalog.path);
  if (!baselineBytes) return ["Missing baseline"];
  const baseline: {
    schemaVersion: string;
    contracts: Array<{ id: string; status: string; review?: unknown }>;
  } = JSON.parse(new TextDecoder().decode(baselineBytes));
  const transitions = new Set(evidence.transitions.map((entry) => entry.id));
  for (const row of baseline.contracts) {
    if (transitions.has(row.id)) {
      row.status = "locked";
      delete row.review;
    }
  }
  const additions = pinnedPostLockAdditions(input.postLockAdditions);
  if (!additions) return ["Unrecognized post-lock additions registry"];
  // Baseline rows keep every field and position; registered additions follow
  // in registry order. Nothing else may appear, move or change.
  baseline.contracts.push(...(additions as typeof baseline.contracts));
  return isDeepStrictEqual(input.targetCatalog, baseline)
    ? []
    : ["Catalog differs from the exact fifteen-authority transition plus registered additions"];
}

/** Tooling provenance only: this result must never become a runtime authority. */
export function specificationLockProtocolSource(
  input: SpecificationLockInput,
): typeof approvedEvidence.protocolSource {
  if (specificationLockFailures(input).length > 0)
    throw new Error("Unqualified specification lock");
  const evidence = pinnedEvidence(input.evidence);
  if (!evidence) throw new Error("Changed specification lock evidence");
  return evidence.protocolSource;
}
