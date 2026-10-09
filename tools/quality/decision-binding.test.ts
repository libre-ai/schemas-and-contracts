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
    expect(document.cases.length).toBe(10);
    const covered = new Set(document.cases.map((vector) => vector.expected));
    expect([...covered].sort()).toEqual([...decisionBindingOutcomes].sort());
  });

  test("a request that inverts the outcomes of its choices is not bound", async () => {
    const document = await readDocument();
    const exact = document.cases.find((vector) => vector.id === "binding-exact");
    if (exact === undefined) throw new Error("binding-exact is missing");
    const inverted = structuredClone(exact.input);
    const request = inverted.request as { choices: { consequenceCode: string }[] };
    const [first, second] = request.choices;
    if (first === undefined || second === undefined) throw new Error("two choices expected");
    [first.consequenceCode, second.consequenceCode] = [
      second.consequenceCode,
      first.consequenceCode,
    ];
    expect(evaluateDecisionBinding(exact.input)).toBe("decision-request-bound");
    expect(evaluateDecisionBinding(inverted)).toBe("decision-policy-mismatch");
  });

  test("an incomplete outcome inventory and envelope ambiguity are refused", async () => {
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
    expect(decisionBindingDocumentFailures(ambiguous)).toEqual(
      expect.arrayContaining([
        "case[0] has unknown properties",
        "case[0] domain does not match input.domain",
      ]),
    );
    expect(decisionBindingDocumentFailures({ schemaVersion: "x", cases: [] })).toEqual([
      "document schemaVersion is invalid",
      "document cases must contain between 1 and 64 items",
    ]);
  });

  test("a repeated choice identifier is malformed, not a mismatch", async () => {
    const document = await readDocument();
    const exact = document.cases.find((vector) => vector.id === "binding-exact");
    if (exact === undefined) throw new Error("binding-exact is missing");
    const repeated = structuredClone(exact.input);
    (repeated.request as { choices: unknown[] }).choices = [
      { choiceId: "approve", consequenceCode: "approved" },
      { choiceId: "approve", consequenceCode: "rejected" },
    ];
    expect(() => evaluateDecisionBinding(repeated)).toThrow("repeats choice approve");
  });
});
