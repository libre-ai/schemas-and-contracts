// Candidate semantics: a human-decision request binds the decision policy of
// its step in the execution graph (docs/reviews/decision-binding-v1-review.md).
//
// The locked semantic vectors judge a request against its response only, so a
// request may declare its own choices, outcome mapping, no-response outcome and
// required role. This oracle adds the missing check without touching the locked
// set: a request is bound when it names the graph by digest and organization,
// names a human-decision step of that graph, and restates that step's policy
// exactly.
//
// Preconditions owned by the caller, not checked here: both documents are
// schema-valid, and the graph is authorized and its digest recomputed from its
// content (its preimage covers `organizationId` and `steps`).

type JsonRecord = Record<string, unknown>;

export type DecisionBindingOutcome =
  | "decision-binding-valid"
  | "graph-binding-mismatch"
  | "step-not-decision"
  | "decision-policy-mismatch";

export const decisionBindingOutcomes = [
  "decision-binding-valid",
  "graph-binding-mismatch",
  "step-not-decision",
  "decision-policy-mismatch",
] as const satisfies readonly DecisionBindingOutcome[];

export const decisionBindingSchemaVersion =
  "libre-ai.authorized-execution-decision-binding-vectors.v1";

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): JsonRecord {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object`);
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value;
}

/** `choiceId` → outcome, refusing a repeated choice identifier. */
function choiceMap(choices: unknown[], outcomeKey: string, label: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const [index, raw] of choices.entries()) {
    const choice = requireRecord(raw, `${label}.${index}`);
    const id = requireString(choice.choiceId, `${label}.${index}.choiceId`);
    if (map.has(id)) throw new TypeError(`${label} repeats choice ${id}`);
    map.set(id, requireString(choice[outcomeKey], `${label}.${index}.${outcomeKey}`));
  }
  return map;
}

function sameMapping(left: Map<string, string>, right: Map<string, string>): boolean {
  return left.size === right.size && [...left].every(([id, outcome]) => right.get(id) === outcome);
}

/**
 * Evaluates one decision-binding vector input: `{ domain, graph, request }`.
 * Precedence: graph identity, then step kind, then the policy restatement.
 */
export function evaluateDecisionBinding(vector: unknown): DecisionBindingOutcome {
  const record = requireRecord(vector, "vector");
  if (record.domain !== "decision-binding") throw new TypeError("vector.domain is unknown");
  const graph = requireRecord(record.graph, "graph");
  const request = requireRecord(record.request, "request");

  if (
    requireString(request.graphDigest, "request.graphDigest") !==
      requireString(graph.graphDigest, "graph.graphDigest") ||
    requireString(request.organizationId, "request.organizationId") !==
      requireString(graph.organizationId, "graph.organizationId")
  ) {
    return "graph-binding-mismatch";
  }
  const stepId = requireString(request.stepId, "request.stepId");
  const named = requireArray(graph.steps, "graph.steps")
    .map((raw, index) => requireRecord(raw, `graph.steps.${index}`))
    .filter((candidate) => candidate.stepId === stepId);
  // Two steps with one identifier make the answer depend on array order:
  // malformed, never resolved by picking one.
  if (named.length > 1) throw new TypeError(`graph.steps repeats step ${stepId}`);
  const step = named[0];
  if (step === undefined || step.kind !== "human-decision") return "step-not-decision";
  const policy = requireRecord(step.decisionPolicy, "step.decisionPolicy");

  const offered = choiceMap(
    requireArray(request.choices, "request.choices"),
    "consequenceCode",
    "request.choices",
  );
  const allowed = choiceMap(
    requireArray(policy.choices, "policy.choices"),
    "outcomeCode",
    "policy.choices",
  );
  if (
    !sameMapping(offered, allowed) ||
    requireString(request.noResponseOutcomeCode, "request.noResponseOutcomeCode") !==
      requireString(policy.noResponseOutcomeCode, "policy.noResponseOutcomeCode") ||
    requireString(request.requiredRole, "request.requiredRole") !==
      requireString(policy.requiredRole, "policy.requiredRole")
  ) {
    return "decision-policy-mismatch";
  }
  return "decision-binding-valid";
}

function hasExactKeys(record: JsonRecord, expected: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

/** Envelope failures of a decision-binding vector document; empty when sound. */
export function decisionBindingDocumentFailures(document: unknown): string[] {
  const failures: string[] = [];
  if (!isRecord(document)) return ["document root must be an object"];
  if (!hasExactKeys(document, ["cases", "schemaVersion"])) {
    failures.push("document root has unknown or missing properties");
  }
  if (document.schemaVersion !== decisionBindingSchemaVersion) {
    failures.push("document schemaVersion is invalid");
  }
  if (!Array.isArray(document.cases) || document.cases.length < 1 || document.cases.length > 64) {
    failures.push("document cases must contain between 1 and 64 items");
    return failures;
  }
  const ids = new Set<string>();
  const covered = new Set<string>();
  for (const [index, raw] of document.cases.entries()) {
    const label = `case[${index}]`;
    if (!isRecord(raw)) {
      failures.push(`${label} must be an object`);
      continue;
    }
    if (!hasExactKeys(raw, ["domain", "expected", "id", "input"])) {
      failures.push(`${label} has unknown properties`);
    }
    if (typeof raw.id !== "string" || !/^decision-binding-[a-z0-9-]{1,111}$/.test(raw.id)) {
      failures.push(`${label} id is invalid`);
    } else if (ids.has(raw.id)) {
      failures.push(`${label} id is repeated`);
    } else {
      ids.add(raw.id);
    }
    if (
      raw.domain !== "decision-binding" ||
      !isRecord(raw.input) ||
      raw.input.domain !== raw.domain
    ) {
      failures.push(`${label} domain does not match input.domain`);
    }
    if (
      typeof raw.expected !== "string" ||
      !(decisionBindingOutcomes as readonly string[]).includes(raw.expected)
    ) {
      failures.push(`${label} expected outcome is unknown`);
    } else {
      covered.add(raw.expected);
      // Replays the case, as the locked document checker does: a vector that
      // contradicts the oracle, or cannot be evaluated, is a document failure.
      try {
        if (evaluateDecisionBinding(raw.input) !== raw.expected) {
          failures.push(`${label} does not replay to its expected outcome`);
        }
      } catch {
        failures.push(`${label} input is structurally invalid`);
      }
    }
  }
  for (const outcome of decisionBindingOutcomes) {
    if (!covered.has(outcome)) failures.push(`outcome ${outcome} is not covered`);
  }
  return failures;
}
