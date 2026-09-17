import { describe, expect, test } from "bun:test";
import {
  type AcceptedEventCollision,
  evaluateOrchestratorEventChain,
  type OrchestratorCausalEventFacts,
  type OrchestratorEventChainResult,
} from "./orchestrator-event-chain";

type Scenario = {
  previous: OrchestratorCausalEventFacts | null;
  current: OrchestratorCausalEventFacts;
};

type VectorDocument = {
  pair: Scenario;
  genesis: Scenario;
  cases: Array<{
    id: string;
    scenario: "pair" | "genesis";
    mutations: Array<{ target: "previous" | "current"; path: string; value: unknown }>;
    collision: "none" | "exact-current" | "same-id-different-digest" | "same-sequence-different-id";
    expected: OrchestratorEventChainResult;
  }>;
};

const vectors = (await Bun.file(
  new URL(
    "../../../contracts/fixtures/agent-orchestration-v1/event-chain-vectors.v1.json",
    import.meta.url,
  ),
).json()) as VectorDocument;

function setPath(target: unknown, path: string, value: unknown): void {
  const segments = path.split(".");
  const property = segments.pop();
  if (property === undefined) throw new Error("empty mutation path");
  let cursor = target as Record<string, unknown>;
  for (const segment of segments) {
    const next = cursor[segment];
    if (typeof next !== "object" || next === null) throw new Error(`missing path ${path}`);
    cursor = next as Record<string, unknown>;
  }
  cursor[property] = value;
}

function collision(
  mode: VectorDocument["cases"][number]["collision"],
  current: OrchestratorCausalEventFacts,
): AcceptedEventCollision | null {
  switch (mode) {
    case "none":
      return null;
    case "exact-current":
      return { id: current.id, sequence: current.sequence, eventDigest: current.eventDigest };
    case "same-id-different-digest":
      return { id: current.id, sequence: current.sequence, eventDigest: "b".repeat(64) };
    case "same-sequence-different-id":
      return {
        id: "urn:libre-ai:event:collision",
        sequence: current.sequence,
        eventDigest: "b".repeat(64),
      };
  }
}

describe("orchestrator causal event vectors", () => {
  for (const vector of vectors.cases) {
    test(vector.id, () => {
      const scenario = structuredClone(vectors[vector.scenario]);
      for (const mutation of vector.mutations) {
        const target = scenario[mutation.target];
        if (target === null) throw new Error(`cannot mutate null ${mutation.target}`);
        setPath(target, mutation.path, mutation.value);
      }
      expect(
        evaluateOrchestratorEventChain(
          scenario.previous,
          scenario.current,
          collision(vector.collision, scenario.current),
        ),
      ).toBe(vector.expected);
    });
  }
});
