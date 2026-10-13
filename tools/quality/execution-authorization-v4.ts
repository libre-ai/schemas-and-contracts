// Reference oracle for the execution-authorization.v4 candidate binding.
//
// It checks identities and digests only. It never verifies a quorum, issues a
// token or admits an effect, and its positive verdict is not an execution
// admission: ADR-0045 decision 4 keeps every v4 plan unexecuted until the
// execution-plan-body.v4 oracle, or the harness itself, passes the ADR-0045 red
// vectors (contracts/execution-authorization-v4/SEMANTICS.md).
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { canonicalJson } from "./authorized-execution";
import { buildBriefDigest } from "./build-brief-v2";
import { type PlanV4, planV4ResolutionFailures } from "./execution-plan-body-v4";
import { harnessProfileV3ResolutionFailures } from "./harness-profile-v3";
import type { ArchiveReference, MissionBinding } from "./missions-v3";
import { parseStrictJson } from "./policy-core-raw-inputs";

export type AuthorizationV4Verdict = "authorization-bound" | "authorization-refused";

const SCHEMA_BASE = "https://contracts.libre-ai.fr/schemas/";
const DOCUMENT_SCHEMAS = [
  "mission-record.v3",
  "execution-plan-body.v4",
  "harness-profile.v3",
  "execution-authorization.v4",
] as const;
const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;

const ajv = new Ajv2020({ strict: true, allErrors: true });
addFormats(ajv);
for (const name of ["common.v1", "mission-handoff-binding.v1", ...DOCUMENT_SCHEMAS]) {
  ajv.addSchema(
    await Bun.file(new URL(`../../contracts/schemas/${name}.schema.json`, import.meta.url)).json(),
  );
}

interface MissionInput {
  id: string;
  tenantId: string;
  revision: number;
  handoffBinding: MissionBinding;
  handoffBindingDigest: string;
  acceptanceCriteria: string[];
  plan?: { id: string; digest: string };
  planQuorum?: ArchiveReference;
}

interface PlanInput extends PlanV4 {
  organizationId: string;
  missionId: string;
  id: string;
  bodyDigest: string;
  handoffBindingDigest: string;
  acceptanceCriteria: string[];
  requestedGeneration: number;
  executionGraph: ArchiveReference;
  harnessProfile: ArchiveReference;
}

interface ProfileInput extends Record<string, unknown> {
  id: string;
  noProgressGuard: { repeatThreshold: number; windowSize: number };
  profileDigest: string;
}

interface AuthorizationInput {
  organizationId: string;
  missionId: string;
  missionRevision: number;
  missionRecordDigest: string;
  planId: string;
  planDigest: string;
  graphDigest: string;
  planQuorum: ArchiveReference;
  generation: number;
  handoffBindingDigest: string;
  harnessProfileDigest: string;
  authorizationDigest: string;
}

export interface AuthorizationV4Documents {
  mission: Uint8Array;
  plan: Uint8Array;
  profile: Uint8Array;
  authorization: Uint8Array;
}

function parseCanonical(raw: Uint8Array, schema: string): unknown {
  if (raw.byteLength > MAX_DOCUMENT_BYTES) throw new Error(`${schema}: too large`);
  const value = parseStrictJson(raw, 32);
  if (new TextDecoder("utf-8", { fatal: true }).decode(raw) !== canonicalJson(value))
    throw new Error(`${schema}: not RFC 8785 canonical`);
  if (!ajv.validate(`${SCHEMA_BASE}${schema}.schema.json`, value))
    throw new Error(`${schema}: schema refused`);
  return value;
}

/** Every reason the four documents do not bind. Empty means bound, never executable. */
export async function authorizationV4BindingFailures(
  documents: AuthorizationV4Documents,
): Promise<string[]> {
  let mission: MissionInput;
  let plan: PlanInput;
  let profile: ProfileInput;
  let authorization: AuthorizationInput;
  try {
    mission = parseCanonical(documents.mission, "mission-record.v3") as MissionInput;
    plan = parseCanonical(documents.plan, "execution-plan-body.v4") as PlanInput;
    profile = parseCanonical(documents.profile, "harness-profile.v3") as ProfileInput;
    authorization = parseCanonical(
      documents.authorization,
      "execution-authorization.v4",
    ) as AuthorizationInput;
  } catch (error) {
    return [error instanceof Error ? error.message : "unreadable document"];
  }

  const failures = [
    ...planV4ResolutionFailures(plan).map((failure) => `plan: ${failure}`),
    ...(await harnessProfileV3ResolutionFailures(profile)).map((failure) => `profile: ${failure}`),
  ];
  const { bodyDigest, ...planUnsigned } = plan;
  const { authorizationDigest, ...authorizationUnsigned } = authorization;
  const rules: [string, boolean][] = [
    // Mission-side bindings, unchanged from execution-authorization.v3.
    [
      "mission handoff binding digest",
      mission.handoffBindingDigest === buildBriefDigest(mission.handoffBinding),
    ],
    ["mission handoff tenant", mission.handoffBinding.tenantId === mission.tenantId],
    [
      "mission handoff archive digest",
      mission.handoffBinding.handoff.archiveReference.digest ===
        mission.handoffBinding.handoff.documentDigest,
    ],
    [
      "mission acceptance criteria",
      canonicalJson(mission.acceptanceCriteria) ===
        canonicalJson(mission.handoffBinding.acceptanceCriteria),
    ],
    [
      "plan acceptance criteria",
      canonicalJson(plan.acceptanceCriteria) === canonicalJson(mission.acceptanceCriteria),
    ],
    ["plan handoff binding", plan.handoffBindingDigest === mission.handoffBindingDigest],
    [
      "authorization handoff binding",
      authorization.handoffBindingDigest === mission.handoffBindingDigest,
    ],
    ["plan organization", plan.organizationId === mission.tenantId],
    ["authorization organization", authorization.organizationId === mission.tenantId],
    ["plan mission", plan.missionId === mission.id],
    ["authorization mission", authorization.missionId === mission.id],
    ["mission revision", authorization.missionRevision === mission.revision],
    ["mission record digest", authorization.missionRecordDigest === buildBriefDigest(mission)],
    ["plan quorum", canonicalJson(authorization.planQuorum) === canonicalJson(mission.planQuorum)],
    // Plan-side bindings: bodyDigest covers v4 isolation and steps.
    ["plan body digest", bodyDigest === buildBriefDigest(planUnsigned)],
    ["mission plan id", mission.plan?.id === plan.id],
    ["mission plan digest", mission.plan?.digest === bodyDigest],
    ["authorization plan id", authorization.planId === plan.id],
    ["authorization plan digest", authorization.planDigest === bodyDigest],
    ["authorization generation", authorization.generation === plan.requestedGeneration],
    ["authorization graph digest", authorization.graphDigest === plan.executionGraph.digest],
    // Harness-profile binding, new in v4: k and w reach the run only through a v3 profile.
    ["plan harness profile id", plan.harnessProfile.id === profile.id],
    ["plan harness profile digest", plan.harnessProfile.digest === profile.profileDigest],
    [
      "authorization harness profile digest",
      authorization.harnessProfileDigest === profile.profileDigest,
    ],
    ["authorization digest", authorizationDigest === buildBriefDigest(authorizationUnsigned)],
  ];
  for (const [name, holds] of rules) if (!holds) failures.push(`binding: ${name}`);
  return failures;
}

export async function verifyAuthorizationV4Binding(
  documents: AuthorizationV4Documents,
): Promise<AuthorizationV4Verdict> {
  return (await authorizationV4BindingFailures(documents)).length === 0
    ? "authorization-bound"
    : "authorization-refused";
}
