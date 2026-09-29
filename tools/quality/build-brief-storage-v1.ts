import Ajv2020 from "ajv/dist/2020";
import schema from "../../contracts/schemas/retention-policy.v4.schema.json";

const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

/** Candidate conformance only; no storage, signing or authorization is performed. */
export function retentionV4Failures(value: unknown): string[] {
  if (validate(value)) return [];
  return (validate.errors ?? []).map((error) => `${error.instancePath}: ${error.keyword}`);
}

type Decision =
  | "reserve"
  | "confirm"
  | "append"
  | "idempotent"
  | "retain"
  | "release"
  | "purge"
  | "restore"
  | "read-archive"
  | "plan"
  | "bounded-backup"
  | "deny";
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exact(value: Record<string, unknown>, fields: readonly string[]): boolean {
  return (
    Object.keys(value).length === fields.length && fields.every((key) => Object.hasOwn(value, key))
  );
}
function epoch(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function nullableEpoch(value: unknown): boolean {
  return value === null || epoch(value);
}

/**
 * Synthetic observation oracle, never a callable product authority. Boolean
 * observations stand for independently verified ports in consumer tests; this
 * function neither authenticates those ports nor computes a P5Y deadline.
 */
export function evaluateBriefStorage(value: unknown): Decision {
  if (!record(value)) return "deny";
  if (value.kind === "append") {
    const evidence = [
      "bodyMatches",
      "allReceiptsVerified",
      "historicalProofComplete",
      "sourceEvidenceAuthenticated",
      "contributorsVerified",
      "currentPermission",
      "currentKeyActive",
    ];
    if (
      !exact(value, [
        "kind",
        ...evidence,
        "expectedRevision",
        "currentRevision",
        "receiptState",
        "releaseBefore",
        "releaseAfter",
      ]) ||
      !evidence.every((key) => value[key] === true)
    )
      return "deny";
    if (
      !epoch(value.expectedRevision) ||
      !epoch(value.currentRevision) ||
      value.currentRevision === 0 ||
      value.expectedRevision !== value.currentRevision ||
      !nullableEpoch(value.releaseBefore) ||
      !nullableEpoch(value.releaseAfter) ||
      value.releaseBefore !== value.releaseAfter
    )
      return "deny";
    if (value.receiptState === "identical") return "idempotent";
    return value.receiptState === "new" ? "append" : "deny";
  }
  if (value.kind === "reference") {
    if (
      !exact(value, [
        "kind",
        "action",
        "state",
        "everConfirmed",
        "releasedBy",
        "releaseEvidenceDigest",
        "identityMatches",
        "currentPermission",
        "sourceOutcome",
        "sourceEvidenceDigest",
      ]) ||
      value.identityMatches !== true ||
      value.currentPermission !== true ||
      typeof value.everConfirmed !== "boolean" ||
      typeof value.state !== "string" ||
      !["missing", "reserved", "confirmed", "released"].includes(value.state) ||
      typeof value.action !== "string" ||
      !["reserve", "confirm", "release", "reconcile"].includes(value.action) ||
      typeof value.sourceOutcome !== "string" ||
      !["absent", "unknown", "committed", "not-committed-final", "removed-final"].includes(
        value.sourceOutcome,
      )
    )
      return "deny";
    const evidence = (item: unknown): boolean =>
      typeof item === "string" && /^[a-f0-9]{64}$/.test(item);
    if (value.state !== "released") {
      if (
        value.releasedBy !== null ||
        value.releaseEvidenceDigest !== null ||
        value.everConfirmed !== (value.state === "confirmed")
      )
        return "deny";
    } else if (
      !evidence(value.releaseEvidenceDigest) ||
      (value.releasedBy !== "removed-final" && value.releasedBy !== "not-committed-final") ||
      (value.everConfirmed && value.releasedBy === "not-committed-final")
    )
      return "deny";
    const noEvidence = value.sourceOutcome === "absent" || value.sourceOutcome === "unknown";
    if (noEvidence ? value.sourceEvidenceDigest !== null : !evidence(value.sourceEvidenceDigest))
      return "deny";
    if (value.state === "released")
      return (value.action === "release" || value.action === "reconcile") &&
        value.sourceOutcome === value.releasedBy &&
        value.sourceEvidenceDigest === value.releaseEvidenceDigest
        ? "idempotent"
        : "deny";
    if (value.sourceOutcome === "unknown") return "retain";
    if (value.everConfirmed && value.sourceOutcome === "not-committed-final") return "deny";
    if (value.state === "missing")
      return value.action === "reserve" && value.sourceOutcome === "absent" ? "reserve" : "deny";
    const decisions: Record<string, Record<string, Decision>> = {
      confirm: { committed: "confirm" },
      reconcile: {
        absent: "retain",
        committed: "confirm",
        "removed-final": "release",
        "not-committed-final": "release",
      },
      release: { "removed-final": "release", "not-committed-final": "release" },
      reserve: { committed: "retain" },
    };
    if (
      value.action === "reserve" &&
      value.state === "reserved" &&
      value.sourceOutcome === "absent"
    )
      return "retain";
    return decisions[value.action]?.[value.sourceOutcome] ?? "deny";
  }
  if (value.kind === "retention") {
    if (
      !exact(value, [
        "kind",
        "activeReferences",
        "uncertainReferences",
        "referencesCurrent",
        "releasedAt",
        "policyDeadline",
        "deadlineAnchor",
        "deadlineVerified",
        "now",
      ]) ||
      !epoch(value.activeReferences) ||
      !epoch(value.uncertainReferences) ||
      value.referencesCurrent !== true ||
      !epoch(value.now) ||
      typeof value.deadlineVerified !== "boolean" ||
      !nullableEpoch(value.releasedAt) ||
      !nullableEpoch(value.policyDeadline) ||
      !nullableEpoch(value.deadlineAnchor)
    )
      return "deny";
    // A reappearing or unresolved reference defeats even a previously due purge.
    if (value.activeReferences > 0 || value.uncertainReferences > 0) return "retain";
    if (
      value.deadlineVerified !== true ||
      !epoch(value.releasedAt) ||
      !epoch(value.policyDeadline) ||
      value.deadlineAnchor !== value.releasedAt ||
      value.policyDeadline <= value.releasedAt ||
      value.now < value.releasedAt
    )
      return "deny";
    return value.now >= value.policyDeadline ? "purge" : "retain";
  }
  if (value.kind === "joint-reference") {
    if (
      !exact(value, [
        "kind",
        "archiveReferences",
        "packageReferences",
        "archiveReleasedAt",
        "packageReleasedAt",
        "identityMatches",
        "atomicOwnerCommit",
      ]) ||
      !epoch(value.archiveReferences) ||
      !epoch(value.packageReferences) ||
      !nullableEpoch(value.archiveReleasedAt) ||
      !nullableEpoch(value.packageReleasedAt) ||
      value.identityMatches !== true ||
      value.atomicOwnerCommit !== true
    )
      return "deny";
    if (value.archiveReferences > 0)
      return value.packageReferences > 0 &&
        value.archiveReleasedAt === null &&
        value.packageReleasedAt === null
        ? "retain"
        : "deny";
    if (!epoch(value.archiveReleasedAt)) return "deny";
    if (value.packageReferences > 0) return value.packageReleasedAt === null ? "retain" : "deny";
    return epoch(value.packageReleasedAt) && value.packageReleasedAt >= value.archiveReleasedAt
      ? "release"
      : "deny";
  }
  if (value.kind === "restore") {
    const prerequisites = [
      "ownerDeletionReplayed",
      "canonicalDigestsVerified",
      "historicalProofComplete",
      "referencesReconciled",
      "currentAuthoritiesAvailable",
      "inheritedExecutionRestoreOrderPreserved",
    ];
    return exact(value, ["kind", ...prerequisites]) &&
      prerequisites.every((key) => value[key] === true)
      ? "restore"
      : "deny";
  }
  if (value.kind === "archive-use") {
    const prerequisites = [
      "currentPermission",
      "historicalProofVerified",
      "producerBindingVerified",
      "bytesVerified",
    ];
    if (
      !exact(value, ["kind", "purpose", ...prerequisites, "now", "expiresAt"]) ||
      !prerequisites.every((key) => value[key] === true) ||
      !epoch(value.now) ||
      !epoch(value.expiresAt)
    )
      return "deny";
    if (value.purpose === "audit") return "read-archive";
    return value.purpose === "plan" && value.now < value.expiresAt ? "plan" : "deny";
  }
  if (value.kind === "backup") {
    if (
      !exact(value, ["kind", "deletedAt", "backupExpiresAt"]) ||
      !epoch(value.deletedAt) ||
      !epoch(value.backupExpiresAt) ||
      value.backupExpiresAt < value.deletedAt ||
      value.backupExpiresAt - value.deletedAt > 35 * 24 * 60 * 60 * 1000
    )
      return "deny";
    return "bounded-backup";
  }
  return "deny";
}
