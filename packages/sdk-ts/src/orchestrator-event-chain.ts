export interface OrchestratorBudgetCounters {
  durationSeconds: number;
  toolCalls: number;
  inputTokens: number;
  outputTokens: number;
  processesStarted: number;
  filesChanged: number;
  changedBytes: number;
}

export interface OrchestratorCausalEventFacts {
  id: string;
  eventDigest: string;
  tenantId: string;
  missionId: string;
  runId: string;
  orchestratorId: string;
  planDigest: string;
  authorizationDigest: string;
  sequence: number;
  previousEventDigest: string | null;
  attempt: number;
  budgetDelta: OrchestratorBudgetCounters;
  budgetTotal: OrchestratorBudgetCounters;
}

export interface AcceptedEventCollision {
  id: string;
  sequence: number;
  eventDigest: string;
}

export type OrchestratorEventChainResult =
  | "valid"
  | "idempotent-duplicate"
  | "duplicate-divergent"
  | "genesis-invalid"
  | "identity-mismatch"
  | "sequence-invalid"
  | "previous-digest-mismatch"
  | "attempt-decreased"
  | "budget-decreased"
  | "budget-arithmetic-invalid";

const budgetKeys = [
  "durationSeconds",
  "toolCalls",
  "inputTokens",
  "outputTokens",
  "processesStarted",
  "filesChanged",
  "changedBytes",
] as const satisfies readonly (keyof OrchestratorBudgetCounters)[];

function sameRunAuthority(
  previous: OrchestratorCausalEventFacts,
  current: OrchestratorCausalEventFacts,
): boolean {
  return (
    previous.tenantId === current.tenantId &&
    previous.missionId === current.missionId &&
    previous.runId === current.runId &&
    previous.orchestratorId === current.orchestratorId &&
    previous.planDigest === current.planDigest &&
    previous.authorizationDigest === current.authorizationDigest
  );
}

/** Evaluate one schema-validated event against accepted causal state without logging values. */
export function evaluateOrchestratorEventChain(
  previous: OrchestratorCausalEventFacts | null,
  current: OrchestratorCausalEventFacts,
  collision: AcceptedEventCollision | null,
): OrchestratorEventChainResult {
  if (collision !== null) {
    const sameId = current.id === collision.id;
    const sameSequence = current.sequence === collision.sequence;
    if (sameId && sameSequence && current.eventDigest === collision.eventDigest) {
      return "idempotent-duplicate";
    }
    if (sameId || sameSequence) return "duplicate-divergent";
  }

  if (previous === null) {
    if (current.sequence !== 1 || current.previousEventDigest !== null) return "genesis-invalid";
    for (const key of budgetKeys) {
      if (current.budgetTotal[key] !== current.budgetDelta[key]) {
        return "budget-arithmetic-invalid";
      }
    }
    return "valid";
  }

  if (!sameRunAuthority(previous, current)) return "identity-mismatch";
  if (current.sequence !== previous.sequence + 1) return "sequence-invalid";
  if (current.previousEventDigest !== previous.eventDigest) return "previous-digest-mismatch";
  if (current.attempt < previous.attempt) return "attempt-decreased";

  for (const key of budgetKeys) {
    if (current.budgetTotal[key] < previous.budgetTotal[key]) return "budget-decreased";
    if (previous.budgetTotal[key] + current.budgetDelta[key] !== current.budgetTotal[key]) {
      return "budget-arithmetic-invalid";
    }
  }

  return "valid";
}
