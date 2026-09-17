import { describe, expect, test } from "bun:test";
import {
  type AgentReviewFacts,
  type AgentReviewQuorumFacts,
  type AgentReviewQuorumResult,
  evaluateAgentReviewQuorum,
} from "./agent-review-quorum";

type Mutation = {
  review: number;
  field: keyof AgentReviewFacts;
  value?: unknown;
  copyFromReview?: number;
};

type VectorDocument = {
  schemaVersion: string;
  evaluationTime: string;
  subjectDigest: string;
  evidenceDigests: string[];
  lineageDigest: string;
  lineageSubjectDigest: string;
  lineageSignatureValid: boolean;
  lineageComplete: boolean;
  contributorAgentIds: string[];
  diversityRequirements: AgentReviewQuorumFacts["diversityRequirements"];
  baseReviews: AgentReviewFacts[];
  cases: Array<{
    id: string;
    mutation: Mutation | null;
    rootMutation: {
      field:
        | "lineageSignatureValid"
        | "lineageComplete"
        | "lineageSubjectDigest"
        | "diversityRequirements";
      value: boolean | string | AgentReviewQuorumFacts["diversityRequirements"];
    } | null;
    expected: AgentReviewQuorumResult;
  }>;
};

const vectors = (await Bun.file(
  new URL(
    "../../../contracts/fixtures/agent-orchestration-v1/quorum-vectors.v1.json",
    import.meta.url,
  ),
).json()) as VectorDocument;

function applyMutation(reviews: AgentReviewFacts[], mutation: Mutation | null): void {
  if (mutation === null) return;
  const target = reviews[mutation.review];
  if (target === undefined) throw new Error(`invalid target review ${mutation.review}`);
  const value =
    mutation.copyFromReview === undefined
      ? mutation.value
      : reviews[mutation.copyFromReview]?.[mutation.field];
  if (value === undefined) throw new Error(`invalid mutation for ${mutation.field}`);
  Object.assign(target, { [mutation.field]: value });
}

describe("agent review quorum semantic vectors", () => {
  for (const vector of vectors.cases) {
    test(vector.id, () => {
      const reviews = structuredClone(vectors.baseReviews);
      applyMutation(reviews, vector.mutation);
      const facts: AgentReviewQuorumFacts = {
        evaluationTime: vectors.evaluationTime,
        subjectDigest: vectors.subjectDigest,
        evidenceDigests: vectors.evidenceDigests,
        lineageDigest: vectors.lineageDigest,
        lineageSubjectDigest: vectors.lineageSubjectDigest,
        lineageSignatureValid: vectors.lineageSignatureValid,
        lineageComplete: vectors.lineageComplete,
        contributorAgentIds: vectors.contributorAgentIds,
        diversityRequirements: vectors.diversityRequirements,
        reviews,
      };
      if (vector.rootMutation !== null) {
        Object.assign(facts, { [vector.rootMutation.field]: vector.rootMutation.value });
      }
      expect(evaluateAgentReviewQuorum(facts)).toBe(vector.expected);
    });
  }
});
