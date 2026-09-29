import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type approvedEvidence from "../../docs/reviews/build-brief-missions-specification-lock.json";

// This gate admits one reviewed change, not an extensible source of permissions.
// Updating the proof requires a new reviewed pin; caller-controlled manifests
// cannot broaden the transition or replace their own baseline.
const EVIDENCE_DIGEST = "39c8bb96a25cf1e5cb6e9d832f2a4f3e44acbf3a47a37b73d3f0b5de75888eb6";

export interface SpecificationLockInput {
  targetCatalog: unknown;
  evidence: unknown;
  documents: ReadonlyMap<string, Uint8Array>;
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
  for (const [path, expectedHash] of expectedHashes) {
    const bytes = input.documents.get(path);
    if (!bytes || digest(bytes) !== expectedHash) return ["Missing or altered protected input"];
  }
  // The pinned baseline is immutable data. Preserve every field and array
  // position; only the fifteen approved statuses and review objects may change.
  const baselineBytes = input.documents.get(evidence.baselineCatalog.path);
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
  return isDeepStrictEqual(input.targetCatalog, baseline)
    ? []
    : ["Catalog differs from the exact fifteen-authority transition"];
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
