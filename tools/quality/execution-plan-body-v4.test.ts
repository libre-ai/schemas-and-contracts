import { describe, expect, test } from "bun:test";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import redVectors from "../../contracts/fixtures/execution-plan-body-v4/red-vectors.json";
import fixtures from "../../contracts/fixtures/execution-plan-body-v4/schema-fixtures.json";
import common from "../../contracts/schemas/common.v1.schema.json";
import v3 from "../../contracts/schemas/execution-plan-body.v3.schema.json";
import schema from "../../contracts/schemas/execution-plan-body.v4.schema.json";
import { sha256Canonical } from "./authorized-execution";
import {
  type CaptureSegment,
  evaluateArgumentCall,
  evaluatePromptCapture,
  evaluateQuarantineOutput,
  type PlanV4,
  type ProposedCall,
  resolvePlanV4,
  type TrackedValue,
} from "./execution-plan-body-v4";

interface Mutation {
  name?: string;
  path: string;
  value?: unknown;
  remove?: boolean;
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(common);
const validate = ajv.compile(schema);

function mutate(document: unknown, mutation: Mutation): unknown {
  const copy = structuredClone(document) as Record<string, unknown>;
  const segments = mutation.path.split("/").slice(1);
  const last = segments.pop();
  if (last === undefined) throw new Error(`${mutation.path}: empty pointer`);
  let parent: Record<string, unknown> = copy;
  for (const segment of segments) {
    const next = parent[segment];
    if (typeof next !== "object" || next === null) throw new Error(`${mutation.path}: no parent`);
    parent = next as Record<string, unknown>;
  }
  if (mutation.remove) delete parent[last];
  else parent[last] = mutation.value;
  return copy;
}

const [fixture] = fixtures.cases;
if (!fixture) throw new Error("missing execution-plan-body.v4 fixture case");
const canonicalPlan = fixture.valid as unknown as PlanV4;
const values = redVectors.values as TrackedValue[];

// The closed verdict set of a future evaluator or harness (contracts/execution-plan-body-v4/SEMANTICS.md).
const verdicts = new Set([
  "plan-resolvable",
  "plan-invalid",
  "call-admitted",
  "call-refused-by-argument-policy",
  "privileged-context-clean",
  "untrusted-bytes-in-privileged-context",
  "quarantine-output-accepted",
  "quarantine-output-rejected",
]);

describe("execution-plan-body.v4 candidate schema", () => {
  test("accepts the canonical fixture, whose bodyDigest covers its RFC 8785 preimage", async () => {
    expect(validate(fixture.valid)).toBe(true);
    const { bodyDigest, ...preimage } = fixture.valid;
    expect(await sha256Canonical(preimage)).toBe(bodyDigest);
  });

  test.each(
    (fixture.invalidMutations as Mutation[]).map((mutation) => [mutation.name, mutation]),
  )("refuses %s", (_name, mutation) => {
    expect(validate(mutate(fixture.valid, mutation))).toBe(false);
  });

  test("a quarantine step holds no tool, and the plan no longer carries a plan-wide tools list", () => {
    expect(schema.required).not.toContain("tools");
    expect(v3.properties.tools.minItems).toBe(1);
    const quarantineBranch = schema.$defs.planStep.oneOf[1];
    expect(quarantineBranch?.properties.tools).toEqual({ type: "array", maxItems: 0 });
  });

  test("neither k nor w is declared by the plan (ADR-0046 Q1)", () => {
    const text = JSON.stringify(schema);
    expect(text).not.toContain("repeatThreshold");
    expect(text).not.toContain("windowSize");
  });

  test("an action-selector plan without quarantine and with trusted inputs only is accepted", () => {
    const plan = structuredClone(fixture.valid);
    plan.isolation.realization = "action-selector";
    plan.steps = plan.steps.slice(1);
    const [privileged] = plan.steps;
    if (!privileged) throw new Error("missing privileged step");
    privileged.inputs = privileged.inputs.slice(0, 1);
    for (const tool of privileged.tools) tool.untrustedArgumentAdmissions = [];
    expect(validate(plan)).toBe(true);
  });
});

describe("ADR-0045 red vectors", () => {
  test("the inventory names its decision and every verdict is closed and exercised", () => {
    expect(redVectors.schemaVersion).toBe("libre-ai.adr-0045-red-vectors.v1");
    const expected = [
      ...redVectors.plans,
      ...redVectors.calls,
      ...redVectors.captures,
      ...redVectors.quarantineOutputs,
    ].map((vector) => vector.expected);
    for (const verdict of expected) expect(verdicts.has(verdict)).toBe(true);
    expect([...new Set(expected)].sort()).toEqual([...verdicts].sort());
  });

  test("every ADR-0045 contract vector (1 to 3) has a red and a green case", () => {
    const byVector = new Map<number, Set<string>>();
    for (const vector of [
      ...redVectors.calls,
      ...redVectors.captures,
      ...redVectors.quarantineOutputs,
    ]) {
      const set = byVector.get(vector.adrVector) ?? new Set<string>();
      set.add(vector.expected);
      byVector.set(vector.adrVector, set);
    }
    expect([...byVector.keys()].sort()).toEqual([1, 2, 3]);
    for (const set of byVector.values()) expect(set.size).toBe(2);
  });

  test("plan vectors are schema-valid, so their verdict is a resolution rule", () => {
    for (const vector of redVectors.plans) {
      let plan: unknown = fixture.valid;
      for (const mutation of vector.planMutations as Mutation[]) plan = mutate(plan, mutation);
      expect(validate(plan), vector.name).toBe(true);
    }
  });

  test.each(
    redVectors.plans.map((vector) => [vector.name, vector]),
  )("plan: %s", (_name, vector) => {
    let plan: unknown = fixture.valid;
    for (const mutation of vector.planMutations as Mutation[]) plan = mutate(plan, mutation);
    expect(resolvePlanV4(plan as PlanV4)).toBe(vector.expected as never);
  });

  test.each(
    redVectors.calls.map((vector) => [vector.name, vector]),
  )("call: %s", (_name, vector) => {
    // A refusal is terminal (ADR-0045 Q5): no vector may expect a human decision.
    expect(vector.humanDecisionRequested).toBe(false);
    expect(
      evaluateArgumentCall(canonicalPlan, values, vector.call as unknown as ProposedCall),
    ).toBe(vector.expected as never);
  });

  test.each(
    redVectors.captures.map((vector) => [vector.name, vector]),
  )("capture: %s", (_name, vector) => {
    expect(
      evaluatePromptCapture(redVectors.untrustedDocument, vector.segments as CaptureSegment[]),
    ).toBe(vector.expected as never);
  });

  test.each(
    redVectors.quarantineOutputs.map((vector) => [vector.name, vector]),
  )("quarantine output: %s", (_name, vector) => {
    // A quarantine step holds no tool: whatever its verdict, it produces no call.
    expect(vector.callsProduced).toBe(0);
    expect(
      evaluateQuarantineOutput(
        canonicalPlan,
        vector.stepId,
        vector.result,
        redVectors.referentials,
      ),
    ).toBe(vector.expected as never);
  });

  test("vector and mutation names are unique", () => {
    const names = [
      ...fixture.invalidMutations.map((mutation) => mutation.name),
      ...redVectors.plans.map((vector) => vector.name),
      ...redVectors.calls.map((vector) => vector.name),
      ...redVectors.captures.map((vector) => vector.name),
      ...redVectors.quarantineOutputs.map((vector) => vector.name),
    ];
    expect(new Set(names).size).toBe(names.length);
  });
});
