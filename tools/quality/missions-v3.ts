// Candidate authority fixture ports; no HTTP handler or storage implementation.
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { canonicalJson } from "./authorized-execution";
import {
  buildBriefDigest,
  type CandidateContext,
  verifyBuildBriefCandidate,
} from "./build-brief-v2";
import { parseStrictJson } from "./policy-core-raw-inputs";

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
for (const name of [
  "common.v1",
  "mission-handoff-binding.v1",
  "mission-record.v3",
  "execution-plan-body.v3",
  "execution-authorization.v3",
]) {
  ajv.addSchema(
    await Bun.file(new URL(`../../contracts/schemas/${name}.schema.json`, import.meta.url)).json(),
  );
}
const validateBinding = ajv.getSchema(
  "https://contracts.libre-ai.fr/schemas/mission-handoff-binding.v1.schema.json",
);
if (!validateBinding) throw new Error("Missing mission binding schema");
export interface ArchiveReference {
  id: string;
  digest: string;
  mediaType: string;
}
export interface PlanningContext {
  brief: CandidateContext;
  caller: {
    organization: string;
    membershipRevision: number;
    currentMembershipRevision: number;
    operation: "plan" | "none";
  } | null;
  source: {
    organization: string;
    handoffId: string;
    archiveReference: ArchiveReference;
    revision: number;
    currentRevision: number;
  } | null;
  historicalAcceptanceDigests: readonly string[] | null;
}
export interface MissionBinding {
  schemaVersion: "libre-ai.mission-handoff-binding.v1";
  tenantId: string;
  handoff: {
    schemaVersion: "libre-ai.agent-handoff.v2";
    id: string;
    documentDigest: string;
    archiveReference: ArchiveReference;
  };
  specPackage: {
    schemaVersion: "libre-ai.spec-package.v2";
    id: string;
    version: number;
    bodyDigest: string;
  };
  acceptanceDigest: string;
  acceptanceCriteria: string[];
}
export type PlanningResult =
  | { ok: true; binding: MissionBinding; bindingDigest: string }
  | { ok: false; code: string };
export interface ReferenceIdentity {
  organization: string;
  missionId: string;
  bindingDigest: string;
  archiveId: string;
  handoffDigest: string;
  referenceId: string;
}
export type ReferenceAction = "reserve" | "confirm" | "reconcile" | "release";
export type ReferenceState = "missing" | "reserved" | "confirmed" | "released";
export interface MissionObservation {
  outcome: "absent" | "unknown" | "committed" | "not-committed-final" | "removed-final";
  evidenceDigest: string | null;
}
export interface ReferenceHistory {
  everConfirmed: boolean;
  releasedBy: "not-committed-final" | "removed-final" | null;
  releaseEvidenceDigest: string | null;
}
export type ReferenceDecision =
  | "reserve"
  | "confirm"
  | "protect"
  | "release"
  | "already-released"
  | "refuse";
interface VerifiedPackage {
  body: { id: string; tenantId: string; version: number; acceptanceCriteria: { id: string }[] };
  bodyDigest: string;
  acceptances: unknown[];
}
interface VerifiedHandoff {
  id: string;
  tenantId: string;
  acceptanceDigest: string;
}
function positiveRevision(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}
/** Synthetic trusted observations exercise the contract; they are not wire proof. */
export function deriveMissionBinding(
  packageRaw: Uint8Array,
  handoffRaw: Uint8Array,
  context: PlanningContext,
): PlanningResult {
  if (verifyBuildBriefCandidate(packageRaw, context.brief, handoffRaw).length)
    return { ok: false, code: "mission.source-invalid" };
  // Parsing follows the inherited raw-byte, shape, signature and semantic verifier.
  const accepted = JSON.parse(new TextDecoder().decode(packageRaw)) as VerifiedPackage;
  const handoff = JSON.parse(new TextDecoder().decode(handoffRaw)) as VerifiedHandoff;
  const { caller, source, historicalAcceptanceDigests: history } = context;
  if (!caller || !source || !history) return { ok: false, code: "mission.authority-unavailable" };
  if (
    caller.organization !== accepted.body.tenantId ||
    source.organization !== accepted.body.tenantId ||
    caller.operation !== "plan" ||
    !positiveRevision(caller.membershipRevision) ||
    caller.membershipRevision !== caller.currentMembershipRevision ||
    !positiveRevision(source.revision) ||
    source.revision !== source.currentRevision ||
    source.handoffId !== handoff.id
  )
    return { ok: false, code: "mission.current-authority-invalid" };
  const receipts = accepted.acceptances.map(buildBriefDigest);
  if (
    new Set(history).size !== history.length ||
    history.length !== receipts.length ||
    receipts.some((d) => !history.includes(d))
  )
    return { ok: false, code: "mission.historical-proof-unavailable" };
  const handoffDigest = buildBriefDigest(handoff);
  if (source.archiveReference.digest !== handoffDigest)
    return { ok: false, code: "mission.archive-mismatch" };
  const binding: MissionBinding = {
    schemaVersion: "libre-ai.mission-handoff-binding.v1",
    tenantId: accepted.body.tenantId,
    handoff: {
      schemaVersion: "libre-ai.agent-handoff.v2",
      id: handoff.id,
      documentDigest: handoffDigest,
      archiveReference: { ...source.archiveReference },
    },
    specPackage: {
      schemaVersion: "libre-ai.spec-package.v2",
      id: accepted.body.id,
      version: accepted.body.version,
      bodyDigest: accepted.bodyDigest,
    },
    acceptanceDigest: handoff.acceptanceDigest,
    acceptanceCriteria: accepted.body.acceptanceCriteria.map((item) => item.id),
  };
  if (!validateBinding?.(binding)) return { ok: false, code: "mission.binding-invalid" };
  return { ok: true, binding, bindingDigest: buildBriefDigest(binding) };
}
/** Pure lifecycle oracle only: observations must come from qualified owner ports. */
export function referenceDecision(
  action: ReferenceAction,
  state: ReferenceState,
  mission: MissionObservation,
  expected: ReferenceIdentity,
  observed: ReferenceIdentity,
  history: ReferenceHistory,
): ReferenceDecision {
  if (
    !expected ||
    typeof expected !== "object" ||
    Array.isArray(expected) ||
    !observed ||
    typeof observed !== "object" ||
    Array.isArray(observed)
  )
    return "refuse";
  const patterns: Record<keyof ReferenceIdentity, RegExp> = {
    organization: /^ten_[a-f0-9]{16}$/,
    missionId: /^urn:libre-ai:[a-z][a-z0-9-]*:[A-Za-z0-9._~-]+$/,
    bindingDigest: /^[a-f0-9]{64}$/,
    archiveId: /^urn:libre-ai:[a-z][a-z0-9-]*:[A-Za-z0-9._~-]+$/,
    handoffDigest: /^[a-f0-9]{64}$/,
    referenceId: /^urn:libre-ai:[a-z][a-z0-9-]*:[A-Za-z0-9._~-]+$/,
  };
  const keys = Object.keys(patterns) as (keyof ReferenceIdentity)[];
  if (
    Object.keys(expected).length !== keys.length ||
    Object.keys(observed).length !== keys.length ||
    keys.some(
      (key) =>
        typeof expected[key] !== "string" ||
        expected[key].length > 512 ||
        !patterns[key].test(expected[key]) ||
        expected[key] !== observed[key],
    )
  )
    return "refuse";
  if (
    !history ||
    typeof history !== "object" ||
    Array.isArray(history) ||
    Object.keys(history).length !== 3 ||
    typeof history.everConfirmed !== "boolean" ||
    !["reserve", "confirm", "reconcile", "release"].includes(action) ||
    !["missing", "reserved", "confirmed", "released"].includes(state) ||
    !mission ||
    typeof mission !== "object" ||
    Array.isArray(mission) ||
    Object.keys(mission).length !== 2 ||
    !["absent", "unknown", "committed", "not-committed-final", "removed-final"].includes(
      mission.outcome,
    )
  )
    return "refuse";
  const terminal =
    history.releasedBy === "not-committed-final" || history.releasedBy === "removed-final";
  const proof = (value: unknown): value is string =>
    typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
  if (state === "released") {
    if (
      !terminal ||
      !proof(history.releaseEvidenceDigest) ||
      (history.everConfirmed && history.releasedBy === "not-committed-final")
    )
      return "refuse";
  } else if (
    history.releasedBy !== null ||
    history.releaseEvidenceDigest !== null ||
    history.everConfirmed !== (state === "confirmed")
  )
    return "refuse";
  if (
    ["unknown", "absent"].includes(mission.outcome)
      ? mission.evidenceDigest !== null
      : !proof(mission.evidenceDigest)
  )
    return "refuse";
  // Terminal evidence is immutable: retries cannot rewrite the release reason or anchor.
  if (state === "released")
    return (action === "release" || action === "reconcile") &&
      mission.outcome === history.releasedBy &&
      mission.evidenceDigest === history.releaseEvidenceDigest
      ? "already-released"
      : "refuse";
  // Unavailability is an observation, never a replacement for durable confirmation.
  if (mission.outcome === "unknown") return "protect";
  if (history.everConfirmed && mission.outcome === "not-committed-final") return "refuse";
  if (state === "missing")
    return action === "reserve" && mission.outcome === "absent" ? "reserve" : "refuse";
  if (action === "reserve")
    return mission.outcome === "committed" || (state === "reserved" && mission.outcome === "absent")
      ? "protect"
      : "refuse";
  if (action === "confirm") return mission.outcome === "committed" ? "confirm" : "refuse";
  if (action === "reconcile") {
    if (mission.outcome === "committed") return "confirm";
    if (mission.outcome === "absent") return "protect";
    return "release";
  }
  return mission.outcome === "removed-final" || mission.outcome === "not-committed-final"
    ? "release"
    : "refuse";
}
interface MissionDigestInput {
  id: string;
  tenantId: string;
  revision: number;
  handoffBinding: MissionBinding;
  handoffBindingDigest: string;
  acceptanceCriteria: string[];
  plan?: { id: string; digest: string };
  planQuorum?: ArchiveReference;
}
interface PlanDigestInput {
  organizationId: string;
  missionId: string;
  id: string;
  bodyDigest: string;
  handoffBindingDigest: string;
  acceptanceCriteria: string[];
  requestedGeneration: number;
  executionGraph: { digest: string };
}
interface AuthorizationDigestInput {
  organizationId: string;
  missionId: string;
  missionRevision: number;
  missionRecordDigest: string;
  planId: string;
  planDigest: string;
  handoffBindingDigest: string;
  generation: number;
  graphDigest: string;
  planQuorum: ArchiveReference;
  authorizationDigest: string;
}
/** Checks identity/digests only; it never verifies quorum, issues tokens or permits an effect. */
export function verifyMissionBindingDigests(
  missionRaw: Uint8Array,
  planRaw: Uint8Array,
  authorizationRaw: Uint8Array,
): boolean {
  try {
    const documents: unknown[] = [];
    const names = ["mission-record.v3", "execution-plan-body.v3", "execution-authorization.v3"];
    for (const [index, raw] of [missionRaw, planRaw, authorizationRaw].entries()) {
      if (raw.byteLength > 2 * 1024 * 1024) return false;
      const value = parseStrictJson(raw, 32);
      if (new TextDecoder("utf-8", { fatal: true }).decode(raw) !== canonicalJson(value))
        return false;
      if (!ajv.validate(`https://contracts.libre-ai.fr/schemas/${names[index]}.schema.json`, value))
        return false;
      documents.push(value);
    }
    const mission = documents[0] as MissionDigestInput;
    const plan = documents[1] as PlanDigestInput;
    const authorization = documents[2] as AuthorizationDigestInput;
    const { bodyDigest, ...planUnsigned } = plan;
    const { authorizationDigest, ...authorizationUnsigned } = authorization;
    return (
      mission.handoffBindingDigest === buildBriefDigest(mission.handoffBinding) &&
      mission.handoffBinding.tenantId === mission.tenantId &&
      mission.handoffBinding.handoff.archiveReference.digest ===
        mission.handoffBinding.handoff.documentDigest &&
      canonicalJson(mission.acceptanceCriteria) ===
        canonicalJson(mission.handoffBinding.acceptanceCriteria) &&
      canonicalJson(plan.acceptanceCriteria) === canonicalJson(mission.acceptanceCriteria) &&
      plan.handoffBindingDigest === mission.handoffBindingDigest &&
      authorization.handoffBindingDigest === mission.handoffBindingDigest &&
      plan.organizationId === mission.tenantId &&
      authorization.organizationId === mission.tenantId &&
      plan.missionId === mission.id &&
      authorization.missionId === mission.id &&
      bodyDigest === buildBriefDigest(planUnsigned) &&
      mission.plan?.id === plan.id &&
      mission.plan.digest === bodyDigest &&
      authorization.missionRevision === mission.revision &&
      authorization.missionRecordDigest === buildBriefDigest(mission) &&
      authorization.planId === plan.id &&
      authorization.planDigest === bodyDigest &&
      canonicalJson(authorization.planQuorum) === canonicalJson(mission.planQuorum) &&
      authorization.generation === plan.requestedGeneration &&
      authorization.graphDigest === plan.executionGraph.digest &&
      authorizationDigest === buildBriefDigest(authorizationUnsigned)
    );
  } catch {
    return false;
  }
}

/** Authority tooling only: no product data is accepted through this inventory. */
export function inheritedAuthorityFailures(
  inventory: unknown,
  bytes: ReadonlyMap<string, Uint8Array>,
): string[] {
  const record = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);
  if (
    !record(inventory) ||
    Object.keys(inventory).length !== 3 ||
    inventory.base !== "4f3d53c3ecd96e7064057afd1587de41b66f13c1" ||
    !record(inventory.hashes) ||
    Object.keys(inventory.hashes).length !== 213 ||
    !Array.isArray(inventory.catalog) ||
    inventory.catalog.length !== 112
  )
    return ["inherited.invalid-inventory"];
  const names = Object.keys(inventory.hashes);
  const catalogPaths = inventory.catalog.map((entry: unknown) =>
    record(entry) ? entry.path : null,
  );
  if (
    new Set(catalogPaths).size !== 112 ||
    catalogPaths.some((path) => typeof path !== "string" || !names.includes(path))
  )
    return ["inherited.incomplete-catalog"];
  const failures: string[] = [];
  for (const [name, digest] of Object.entries(inventory.hashes)) {
    if (
      !/^contracts\/[A-Za-z0-9_./-]+$/.test(name) ||
      name.includes("..") ||
      name === "contracts/catalog.v1.json" ||
      typeof digest !== "string" ||
      !/^[a-f0-9]{64}$/.test(digest)
    ) {
      failures.push("inherited.invalid-entry");
      continue;
    }
    const source = bytes.get(name);
    if (!source) failures.push("inherited.missing-bytes");
    else if (new Bun.CryptoHasher("sha256").update(source).digest("hex") !== digest)
      failures.push("inherited.bytes-mismatch");
  }
  return failures;
}
