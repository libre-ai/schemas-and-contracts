export type AgentReviewQuorumResult =
  | "valid"
  | "review-count-invalid"
  | "review-rejected"
  | "lineage-invalid"
  | "reviewer-identity-invalid"
  | "review-isolation-invalid"
  | "non-disclosure-invalid"
  | "signing-key-invalid"
  | "reviewer-is-contributor"
  | "duplicate-reviewer"
  | "duplicate-review-run"
  | "duplicate-nonce"
  | "duplicate-signature"
  | "diversity-requirement-violated"
  | "subject-mismatch"
  | "evidence-mismatch"
  | "lineage-mismatch"
  | "lineage-subject-mismatch"
  | "lineage-contributors-mismatch"
  | "signature-invalid"
  | "nonce-replayed"
  | "blind-review-violated"
  | "review-expired"
  | "review-time-invalid";

export interface AgentReviewFacts {
  reviewerAgentId: string;
  reviewerRunId: string;
  reviewerPoolId: string;
  runtimeFamily: string;
  modelFamily: string;
  providerId: string;
  subjectDigest: string;
  evidenceDigests: string[];
  lineageDigest: string;
  contributorAgentIds: string[];
  verdict: "approve" | "reject";
  blindReview: boolean;
  siblingReviewDisclosed: boolean;
  reviewerIdentityAttested: boolean;
  isolationAttested: boolean;
  nonDisclosureAttested: boolean;
  signingKeyActive: boolean;
  signatureValid: boolean;
  nonceClaimed: boolean;
  nonce: string;
  signature: string;
  issuedAt: string;
  expiresAt: string;
}

export interface AgentReviewQuorumFacts {
  evaluationTime: string;
  subjectDigest: string;
  evidenceDigests: string[];
  lineageDigest: string;
  lineageSubjectDigest: string;
  lineageSignatureValid: boolean;
  lineageComplete: boolean;
  contributorAgentIds: string[];
  diversityRequirements: Array<"reviewer-pool" | "runtime-family" | "model-family" | "provider">;
  reviews: AgentReviewFacts[];
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function hasDuplicate(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

/**
 * Evaluate already authenticated review facts against the canonical two-agent quorum semantics.
 * Signature verification and atomic nonce claiming remain mandatory boundary operations; their
 * fail-closed outcomes are supplied as `signatureValid` and `nonceClaimed`.
 */
export function evaluateAgentReviewQuorum(facts: AgentReviewQuorumFacts): AgentReviewQuorumResult {
  if (facts.reviews.length !== 2) return "review-count-invalid";

  const evaluationTime = Date.parse(facts.evaluationTime);
  if (!Number.isFinite(evaluationTime)) return "review-time-invalid";
  if (!facts.lineageSignatureValid || !facts.lineageComplete) return "lineage-invalid";
  if (facts.lineageSubjectDigest !== facts.subjectDigest) return "lineage-subject-mismatch";

  for (const review of facts.reviews) {
    if (review.verdict !== "approve") return "review-rejected";
    if (!review.reviewerIdentityAttested) return "reviewer-identity-invalid";
    if (!review.isolationAttested) return "review-isolation-invalid";
    if (!review.nonDisclosureAttested) return "non-disclosure-invalid";
    if (!review.signingKeyActive) return "signing-key-invalid";
    if (facts.contributorAgentIds.includes(review.reviewerAgentId))
      return "reviewer-is-contributor";
    if (review.subjectDigest !== facts.subjectDigest) return "subject-mismatch";
    if (!sameStringSet(review.evidenceDigests, facts.evidenceDigests)) return "evidence-mismatch";
    if (review.lineageDigest !== facts.lineageDigest) return "lineage-mismatch";
    if (!sameStringSet(review.contributorAgentIds, facts.contributorAgentIds))
      return "lineage-contributors-mismatch";
    if (!review.blindReview || review.siblingReviewDisclosed) return "blind-review-violated";
    if (!review.signatureValid) return "signature-invalid";
    if (!review.nonceClaimed) return "nonce-replayed";

    const issuedAt = Date.parse(review.issuedAt);
    const expiresAt = Date.parse(review.expiresAt);
    if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || issuedAt >= expiresAt)
      return "review-time-invalid";
    if (evaluationTime < issuedAt) return "review-time-invalid";
    if (evaluationTime >= expiresAt) return "review-expired";
  }

  if (hasDuplicate(facts.reviews.map((review) => review.reviewerAgentId)))
    return "duplicate-reviewer";
  if (hasDuplicate(facts.reviews.map((review) => review.reviewerRunId)))
    return "duplicate-review-run";
  if (hasDuplicate(facts.reviews.map((review) => review.nonce))) return "duplicate-nonce";
  if (hasDuplicate(facts.reviews.map((review) => review.signature))) return "duplicate-signature";

  const diversityValues = {
    "reviewer-pool": facts.reviews.map((review) => review.reviewerPoolId),
    "runtime-family": facts.reviews.map((review) => review.runtimeFamily),
    "model-family": facts.reviews.map((review) => review.modelFamily),
    provider: facts.reviews.map((review) => review.providerId),
  } as const;
  for (const requirement of facts.diversityRequirements) {
    if (hasDuplicate(diversityValues[requirement])) return "diversity-requirement-violated";
  }

  return "valid";
}
