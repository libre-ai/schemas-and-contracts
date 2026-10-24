// Authority-fixture verifier only; no browser, privacy or implementation admission.
// The evaluation semantics (DL8) are normative in SEMANTICS.md and implemented by the
// consumer's policy component; this verifier admits or refuses a policy document only.
import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020";
import { canonicalJson } from "./authorized-execution";
import { parseStrictJson } from "./policy-core-raw-inputs";

/** Ceiling of one routing policy document, in octets (1 MiB). */
export const ROUTING_POLICY_MAX_BYTES = 1048576;

type TargetKind = "github-repository" | "gitlab-project" | "jira-project" | "plane-project";

interface Destination {
  id: string;
  profileId: string;
  target: { kind: TargetKind };
}

interface RoutingRule {
  id: string;
  imposed: string[];
  optional: string[];
  selectable: string[];
  denied: string[];
}

interface RoutingPolicy {
  destinations: Destination[];
  routingRules: RoutingRule[];
  disclosureRules: { id: string }[];
}

/** The only target kind each profile family can address; any other family addresses none. */
const TARGET_KIND_BY_FAMILY: ReadonlyMap<string, TargetKind> = new Map([
  ["github-issues", "github-repository"],
  ["gitlab-issues", "gitlab-project"],
  ["jira-cloud", "jira-project"],
  ["plane", "plane-project"],
]);

const ajv = new Ajv2020({ strict: true, allErrors: true });
const validate = ajv.compile<RoutingPolicy>(
  await Bun.file(
    new URL("../../contracts/schemas/signalement-routing-policy.v1.schema.json", import.meta.url),
  ).json(),
);

/** Destinations and both rule kinds share one identifier space, scanned in document order. */
function firstDuplicateId(policy: RoutingPolicy): string | null {
  const seen = new Set<string>();
  const ids = [
    ...policy.destinations.map((destination) => destination.id),
    ...policy.routingRules.map((rule) => rule.id),
    ...policy.disclosureRules.map((rule) => rule.id),
  ];
  for (const id of ids) {
    if (seen.has(id)) return id;
    seen.add(id);
  }
  return null;
}

function ruleLists(rule: RoutingRule): string[][] {
  return [rule.imposed, rule.optional, rule.selectable, rule.denied];
}

function firstRuleWithUnknownDestination(policy: RoutingPolicy): string | null {
  const known = new Set(policy.destinations.map((destination) => destination.id));
  const rule = policy.routingRules.find((candidate) =>
    ruleLists(candidate).some((list) => list.some((id) => !known.has(id))),
  );
  return rule?.id ?? null;
}

/** Each list is a set (schema `uniqueItems`), so a repeated id across the lists is an overlap. */
function firstOverlappingRule(policy: RoutingPolicy): string | null {
  const rule = policy.routingRules.find((candidate) => {
    const all = ruleLists(candidate).flat();
    return new Set(all).size !== all.length;
  });
  return rule?.id ?? null;
}

function firstTargetProfileMismatch(policy: RoutingPolicy): string | null {
  const destination = policy.destinations.find((candidate) => {
    const family = candidate.profileId.split("/")[0] ?? "";
    return TARGET_KIND_BY_FAMILY.get(family) !== candidate.target.kind;
  });
  return destination?.id ?? null;
}

/**
 * The size is checked on octets before any parsing, so an oversized input is never decoded.
 * Exactly one code is returned, the first in the documented order. The only document data a
 * code may carry is one identifier, already constrained by the schema id pattern.
 */
export function rawRoutingPolicyFailures(bytes: Uint8Array): string[] {
  if (bytes.byteLength > ROUTING_POLICY_MAX_BYTES) return ["policy.size_limit"];
  let parsed: unknown;
  try {
    parsed = parseStrictJson(bytes, 8);
  } catch {
    return ["policy.raw_json"];
  }
  if (!validate(parsed)) return ["policy.schema"];
  const duplicate = firstDuplicateId(parsed);
  if (duplicate !== null) return [`policy.duplicate_id:${duplicate}`];
  const unknown = firstRuleWithUnknownDestination(parsed);
  if (unknown !== null) return [`policy.unknown_destination:${unknown}`];
  const overlap = firstOverlappingRule(parsed);
  if (overlap !== null) return [`policy.routing_overlap:${overlap}`];
  const mismatch = firstTargetProfileMismatch(parsed);
  if (mismatch !== null) return [`policy.target_profile_mismatch:${mismatch}`];
  return [];
}

/** `policyDigest` of the evaluation: SHA-256, lowercase hexadecimal, of the JCS form. */
export function routingPolicyDigest(document: unknown): string {
  return createHash("sha256").update(canonicalJson(document)).digest("hex");
}
