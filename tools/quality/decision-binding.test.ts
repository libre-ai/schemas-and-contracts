import { describe, expect, test } from "bun:test";

import {
  type DecisionBindingOutcome,
  decisionBindingDocumentFailures,
  decisionBindingOutcomes,
  evaluateDecisionBinding,
} from "./decision-binding";

const vectorPath = "contracts/fixtures/authorized-execution-v1/decision-binding-vectors.v1.json";

interface BindingDocument {
  schemaVersion: string;
  cases: { id: string; domain: string; input: Record<string, unknown>; expected: string }[];
}

async function readDocument(): Promise<BindingDocument> {
  return (await Bun.file(vectorPath).json()) as BindingDocument;
}

async function validInput(): Promise<Record<string, unknown>> {
  const document = await readDocument();
  const valid = document.cases.find((vector) => vector.id === "decision-binding-valid");
  if (valid === undefined) throw new Error("decision-binding-valid is missing");
  return structuredClone(valid.input);
}

describe("candidate decision-binding vectors", () => {
  test("replay every case with its exact closed outcome", async () => {
    const document = await readDocument();
    expect(decisionBindingDocumentFailures(document)).toEqual([]);
    for (const vector of document.cases) {
      expect(evaluateDecisionBinding(vector.input), vector.id).toBe(
        vector.expected as DecisionBindingOutcome,
      );
    }
    // The examined volume, so an empty or truncated file cannot pass silently.
    expect(document.cases.length).toBe(16);
    const covered = new Set(document.cases.map((vector) => vector.expected));
    expect([...covered].sort()).toEqual([...decisionBindingOutcomes].sort());
  });

  test("a request that inverts the outcomes of its choices is not bound", async () => {
    const input = await validInput();
    const inverted = structuredClone(input);
    const request = inverted.request as { choices: { consequenceCode: string }[] };
    const [first, second] = request.choices;
    if (first === undefined || second === undefined) throw new Error("two choices expected");
    [first.consequenceCode, second.consequenceCode] = [
      second.consequenceCode,
      first.consequenceCode,
    ];
    expect(evaluateDecisionBinding(input)).toBe("decision-binding-valid");
    expect(evaluateDecisionBinding(inverted)).toBe("decision-policy-mismatch");
  });

  test("the document checker refuses gaps, ambiguity and a case that does not replay", async () => {
    const document = await readDocument();
    const truncated = structuredClone(document);
    truncated.cases = truncated.cases.filter(
      (vector) => vector.expected !== "graph-binding-mismatch",
    );
    expect(decisionBindingDocumentFailures(truncated)).toContain(
      "outcome graph-binding-mismatch is not covered",
    );

    const ambiguous = structuredClone(document) as unknown as {
      cases: Record<string, unknown>[];
    };
    const first = ambiguous.cases[0];
    if (first === undefined) throw new Error("a case is expected");
    first.domain = "decision";
    first.unexpected = true;
    first.id = "Binding Valid";
    expect(decisionBindingDocumentFailures(ambiguous)).toEqual(
      expect.arrayContaining([
        "case[0] has unknown properties",
        "case[0] domain does not match input.domain",
        "case[0] id is invalid",
      ]),
    );

    const wrong = structuredClone(document);
    const swapped = wrong.cases.find((vector) => vector.id === "decision-binding-swapped-outcomes");
    if (swapped === undefined) throw new Error("swapped-outcomes is missing");
    swapped.expected = "decision-binding-valid";
    const index = wrong.cases.indexOf(swapped);
    expect(decisionBindingDocumentFailures(wrong)).toContain(
      `case[${index}] does not replay to its expected outcome`,
    );

    expect(decisionBindingDocumentFailures({ schemaVersion: "x", cases: [] })).toEqual([
      "document schemaVersion is invalid",
      "document cases must contain between 1 and 64 items",
    ]);
  });

  test("malformed input is refused, never resolved", async () => {
    const repeatedRequest = await validInput();
    (repeatedRequest.request as { choices: unknown[] }).choices = [
      { choiceId: "approve", consequenceCode: "approved" },
      { choiceId: "approve", consequenceCode: "rejected" },
    ];
    expect(() => evaluateDecisionBinding(repeatedRequest)).toThrow(
      "request.choices repeats choice approve",
    );

    const repeatedPolicy = await validInput();
    const steps = (repeatedPolicy.graph as { steps: { decisionPolicy?: { choices: unknown[] } }[] })
      .steps;
    const decide = steps[1];
    if (decide?.decisionPolicy === undefined) throw new Error("decide step expected");
    decide.decisionPolicy.choices = [
      { choiceId: "approve", outcomeCode: "approved" },
      { choiceId: "approve", outcomeCode: "rejected" },
    ];
    expect(() => evaluateDecisionBinding(repeatedPolicy)).toThrow(
      "policy.choices repeats choice approve",
    );

    // Two steps share the identifier: the first one is not silently trusted,
    // whatever the order.
    for (const order of ["weak-first", "strong-first"] as const) {
      const duplicated = await validInput();
      const graph = duplicated.graph as { steps: Record<string, unknown>[] };
      const strong = graph.steps[1];
      if (strong === undefined) throw new Error("decide step expected");
      const weak = structuredClone(strong);
      (weak.decisionPolicy as { requiredRole: string }).requiredRole = "viewer";
      graph.steps = order === "weak-first" ? [weak, strong] : [strong, weak];
      expect(() => evaluateDecisionBinding(duplicated), order).toThrow(
        "graph.steps repeats step decide",
      );
    }

    const noPolicy = await validInput();
    delete (noPolicy.graph as { steps: Record<string, unknown>[] }).steps[1]?.decisionPolicy;
    expect(() => evaluateDecisionBinding(noPolicy)).toThrow(
      "step.decisionPolicy must be an object",
    );

    const otherDomain = { ...(await validInput()), domain: "decision" };
    expect(() => evaluateDecisionBinding(otherDomain)).toThrow("vector.domain is unknown");
  });
});
