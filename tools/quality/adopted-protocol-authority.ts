import { isDeepStrictEqual } from "node:util";
import type {
  CandidateProtocolAuthority,
  CandidateProtocolRequirement,
} from "./candidate-protocol-authority";
import { candidateProtocolAuthorities } from "./candidate-protocol-authority";
import type { SpecificationLockInput } from "./specification-lock";
import { specificationLockProtocolSource } from "./specification-lock";

export function adoptedMissionProtocolAuthority(
  registry: unknown,
  requirement: CandidateProtocolRequirement,
  lock: SpecificationLockInput,
): CandidateProtocolAuthority {
  if (
    !isDeepStrictEqual(requirement, {
      slug: "missions",
      major: 3,
      status: "locked",
      sourceRepository: "libre-ai/ai-work-supervision",
    })
  )
    throw new Error("No adoption for this protocol requirement");
  const adopted = specificationLockProtocolSource(lock);
  // Source lifecycle remains candidate. The independently checked adoption
  // joins that historical provenance to exactly one locked specification.
  const authority = candidateProtocolAuthorities(registry, [
    { ...requirement, status: "candidate" },
  ]).get("missions:3");
  if (!authority || !isDeepStrictEqual(authority, adopted))
    throw new Error("Protocol source differs from the adopted owner source");
  return authority;
}
