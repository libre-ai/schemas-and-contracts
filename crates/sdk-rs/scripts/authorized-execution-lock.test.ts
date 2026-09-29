import { describe, expect, test } from "bun:test";

interface CatalogEntry {
  readonly id: string;
  readonly status: "candidate" | "locked";
  readonly review?: unknown;
}

const authorizedExecutionIds = [
  "effect-attestation-v1",
  "execution-authorization-v2",
  "execution-graph-v1",
  "execution-plan-body-v2",
  "execution-transfer-v1",
  "human-decision-request-v1",
  "human-decision-response-v1",
  "orchestrator-event-v3",
  "retention-policy-schema-v2",
  "retention-policy-v2",
  "step-invocation-v1",
] as const;

const briefAndMissionsIds = [
  "build-brief-body-v2",
  "build-brief-acceptance-v2",
  "spec-package-v2",
  "agent-handoff-v2",
  "build-brief-policy-v2",
  "specifications-api-v2",
  "build-brief-api-v2",
  "retention-policy-v4",
  "retention-policy-schema-v4",
  "mission-handoff-binding-v1",
  "mission-record-v3",
  "execution-plan-body-v3",
  "execution-authorization-v3",
  "missions-api-schema-v3",
  "missions-api-v3",
] as const;
const remainingCandidateIds = [
  "boussole-method-v3",
  "harness-profile-v2",
  "local-comparison-v3",
  "public-vote-dataset-v3",
  "retention-policy-schema-v3",
  "retention-policy-v3",
] as const;

describe("authorized execution Specification Lock pin", () => {
  test("consumes exactly the reviewed locked family", async () => {
    const catalog = (await Bun.file("../../contracts/catalog.v1.json").json()) as {
      contracts: CatalogEntry[];
    };
    const entriesById = new Map(catalog.contracts.map((entry) => [entry.id, entry]));

    for (const id of [...authorizedExecutionIds, ...briefAndMissionsIds]) {
      const entry = entriesById.get(id);
      expect(entry, `${id} must exist in the pinned catalog`).toBeDefined();
      expect(entry?.status, `${id} must be locked by the pinned authority`).toBe("locked");
      expect(
        Object.hasOwn(entry ?? {}, "review"),
        `${id} must not retain candidate review state`,
      ).toBeFalse();
    }

    const candidateIds = catalog.contracts
      .filter((entry) => entry.status === "candidate")
      .map((entry) => entry.id)
      .sort();
    expect(candidateIds).toEqual([...remainingCandidateIds]);
  });
});
