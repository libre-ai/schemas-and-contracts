// Reference oracle for the ADR-0045 semantic vectors of execution-plan-body.v4.
//
// This is not a runtime and grants no capability: it gives each vector's
// expected verdict an executable definition, so that neutralizing one control
// turns its vectors red. The harness that ADR-0045 decision 5 makes the sole
// authority of the argument policy implements its own evaluator against the
// same vectors.

export type PlanVerdict = "plan-resolvable" | "plan-invalid";
export type CallVerdict = "call-admitted" | "call-refused-by-argument-policy";
export type CaptureVerdict = "privileged-context-clean" | "untrusted-bytes-in-privileged-context";
export type QuarantineVerdict = "quarantine-output-accepted" | "quarantine-output-rejected";

interface ArtifactReference {
  id: string;
  digest: string;
  mediaType: string;
}

interface ClosedField {
  name: string;
  kind: "enum" | "identifier" | "boolean" | "integer";
  values?: string[];
  referential?: ArtifactReference;
  minimum?: number;
  maximum?: number;
}

interface Admission {
  parameter: string;
  sourceStepId: string;
  sourceField: string;
}

interface Tool {
  name: string;
  access: string;
  effectClass: string;
  untrustedArgumentAdmissions: Admission[];
}

interface Input {
  inputId: string;
  source: { kind: string; stepId?: string };
}

interface Step {
  stepId: string;
  role: "privileged" | "quarantine";
  tools: Tool[];
  inputs: Input[];
  quarantineOutput?: { fields: ClosedField[]; failureCodes: string[] };
}

export interface PlanV4 {
  steps: Step[];
}

// Only these kinds may carry an untrusted value into a tool argument: an
// enumeration or an identifier validated against a pinned referential. A
// bounded integer or a boolean extracted from untrusted content is closed, but
// an attacker still chooses it (an amount, a switch), so it is never admitted.
const ADMISSIBLE_FIELD_KINDS = new Set(["enum", "identifier"]);

/** Plan rules that JSON Schema cannot state, because they relate two places of the plan. */
export function planV4ResolutionFailures(plan: PlanV4): string[] {
  const failures: string[] = [];
  const stepIds = plan.steps.map((step) => step.stepId);
  if (new Set(stepIds).size !== stepIds.length) failures.push("duplicate stepId");
  const stepIndex = new Map(plan.steps.map((step, index) => [step.stepId, index]));
  for (const [index, step] of plan.steps.entries()) {
    const toolNames = step.tools.map((tool) => tool.name);
    if (new Set(toolNames).size !== toolNames.length)
      failures.push(`${step.stepId}: duplicate tool name`);
    const inputIds = step.inputs.map((input) => input.inputId);
    if (new Set(inputIds).size !== inputIds.length)
      failures.push(`${step.stepId}: duplicate inputId`);
    for (const input of step.inputs) {
      if (input.source.kind !== "step-output") continue;
      const source = stepIndex.get(input.source.stepId ?? "");
      if (source === undefined || source >= index)
        failures.push(`${step.stepId}: input ${input.inputId} reads no earlier step`);
    }
    const fields = step.quarantineOutput?.fields ?? [];
    const fieldNames = fields.map((field) => field.name);
    if (new Set(fieldNames).size !== fieldNames.length)
      failures.push(`${step.stepId}: duplicate output field`);
    for (const field of fields) {
      if (field.kind === "integer" && (field.minimum ?? 0) > (field.maximum ?? 0))
        failures.push(`${step.stepId}: ${field.name} has inverted bounds`);
    }
    for (const tool of step.tools) {
      for (const admission of tool.untrustedArgumentAdmissions) {
        const sourceIndex = stepIndex.get(admission.sourceStepId);
        const source = sourceIndex === undefined ? undefined : plan.steps[sourceIndex];
        const field = source?.quarantineOutput?.fields.find(
          (candidate) => candidate.name === admission.sourceField,
        );
        if (
          sourceIndex === undefined ||
          sourceIndex >= index ||
          source?.role !== "quarantine" ||
          field === undefined ||
          !ADMISSIBLE_FIELD_KINDS.has(field.kind)
        )
          failures.push(`${step.stepId}: ${tool.name}.${admission.parameter} admission unresolved`);
      }
    }
  }
  return failures;
}

export function resolvePlanV4(plan: PlanV4): PlanVerdict {
  return planV4ResolutionFailures(plan).length === 0 ? "plan-resolvable" : "plan-invalid";
}

export type ValueProvenance =
  | { kind: "trusted-request" }
  | { kind: "untrusted-content"; inputId: string }
  | { kind: "quarantine-field"; stepId: string; field: string };

export interface TrackedValue {
  id: string;
  provenance: ValueProvenance;
  dependsOn: string[];
}

export interface ProposedCall {
  stepId: string;
  tool: string;
  arguments: Record<string, string>;
  controlDependencies: string[];
}

function dependencyClosure(roots: string[], values: Map<string, TrackedValue>): TrackedValue[] {
  const seen = new Set<string>();
  const pending = [...roots];
  const closure: TrackedValue[] = [];
  while (pending.length > 0) {
    const id = pending.pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const value = values.get(id);
    // An unknown value has no provenance, and an unknown provenance is untrusted.
    if (value === undefined) {
      closure.push({
        id,
        provenance: { kind: "untrusted-content", inputId: "unknown" },
        dependsOn: [],
      });
      continue;
    }
    closure.push(value);
    pending.push(...value.dependsOn);
  }
  return closure;
}

/**
 * INV-b: judge every argument and its dependency graph, condition included.
 * A refusal is terminal for the call; nothing here can yield a human decision.
 */
export function evaluateArgumentCall(
  plan: PlanV4,
  values: TrackedValue[],
  call: ProposedCall,
): CallVerdict {
  if (planV4ResolutionFailures(plan).length > 0) return "call-refused-by-argument-policy";
  const step = plan.steps.find((candidate) => candidate.stepId === call.stepId);
  const tool = step?.tools.find((candidate) => candidate.name === call.tool);
  if (step === undefined || step.role !== "privileged" || tool === undefined)
    return "call-refused-by-argument-policy";
  const byId = new Map(values.map((value) => [value.id, value]));
  for (const [parameter, valueId] of Object.entries(call.arguments)) {
    // Implicit dependencies: a condition on a value taints every argument of the call.
    const closure = dependencyClosure([valueId, ...call.controlDependencies], byId);
    for (const value of closure) {
      const { provenance } = value;
      if (provenance.kind === "trusted-request") continue;
      const admitted =
        provenance.kind === "quarantine-field" &&
        tool.untrustedArgumentAdmissions.some(
          (admission) =>
            admission.parameter === parameter &&
            admission.sourceStepId === provenance.stepId &&
            admission.sourceField === provenance.field,
        );
      if (!admitted) return "call-refused-by-argument-policy";
    }
  }
  return "call-admitted";
}

export interface CaptureSegment {
  provenance: "trusted-request" | "plan" | "opaque-reference" | "compaction" | "untrusted-content";
  text: string;
}

// The window below which a shared substring is not attributed to the document.
// "No byte of the document" cannot be checked literally on natural language
// (both sides share letters and spaces); provenance labels are the primary
// control and this window is the byte-level backstop of the test oracle.
export const CAPTURE_WINDOW_BYTES = 8;

/** INV-a, ADR-0045 red vector 2: the captured privileged prompt holds no untrusted byte. */
export function evaluatePromptCapture(
  untrustedDocument: string,
  segments: CaptureSegment[],
): CaptureVerdict {
  if (segments.some((segment) => segment.provenance === "untrusted-content"))
    return "untrusted-bytes-in-privileged-context";
  const document = new TextEncoder().encode(untrustedDocument);
  const capture = Buffer.from(segments.map((segment) => segment.text).join("\n"), "utf8");
  for (let start = 0; start + CAPTURE_WINDOW_BYTES <= document.length; start += 1) {
    const window = document.subarray(start, start + CAPTURE_WINDOW_BYTES);
    if (capture.includes(window)) return "untrusted-bytes-in-privileged-context";
  }
  return "privileged-context-clean";
}

export type QuarantineResult =
  | { status: "ok"; values: Record<string, unknown> }
  | { status: "failed"; failureCode: string };

function fieldValueAdmitted(
  field: ClosedField,
  value: unknown,
  referentials: Record<string, string[]>,
): boolean {
  switch (field.kind) {
    case "enum":
      return typeof value === "string" && (field.values ?? []).includes(value);
    case "identifier":
      return (
        typeof value === "string" &&
        (referentials[field.referential?.id ?? ""] ?? []).includes(value)
      );
    case "boolean":
      return typeof value === "boolean";
    case "integer":
      return (
        Number.isSafeInteger(value) &&
        (value as number) >= (field.minimum ?? 0) &&
        (value as number) <= (field.maximum ?? 0)
      );
  }
}

/** INV-c, ADR-0045 red vector 3: an output outside the closed vocabulary is rejected. */
export function evaluateQuarantineOutput(
  plan: PlanV4,
  stepId: string,
  result: unknown,
  referentials: Record<string, string[]>,
): QuarantineVerdict {
  const output = plan.steps.find((step) => step.stepId === stepId)?.quarantineOutput;
  if (output === undefined || typeof result !== "object" || result === null)
    return "quarantine-output-rejected";
  const record = result as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (record.status === "failed") {
    const closedFailure =
      keys.join(",") === "failureCode,status" &&
      typeof record.failureCode === "string" &&
      output.failureCodes.includes(record.failureCode);
    return closedFailure ? "quarantine-output-accepted" : "quarantine-output-rejected";
  }
  if (record.status !== "ok" || keys.join(",") !== "status,values")
    return "quarantine-output-rejected";
  const values = record.values;
  if (typeof values !== "object" || values === null) return "quarantine-output-rejected";
  const entries = values as Record<string, unknown>;
  const expected = output.fields.map((field) => field.name).sort();
  if (Object.keys(entries).sort().join(",") !== expected.join(","))
    return "quarantine-output-rejected";
  for (const field of output.fields) {
    if (!fieldValueAdmitted(field, entries[field.name], referentials))
      return "quarantine-output-rejected";
  }
  return "quarantine-output-accepted";
}
