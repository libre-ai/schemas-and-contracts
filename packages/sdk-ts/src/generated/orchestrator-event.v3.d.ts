/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiOrchestratoreventV3 = {
	schemaVersion: "libre-ai.orchestrator-event.v3";
	id: string;
	organizationId: string;
	missionId: string;
	runId: string;
	orchestratorId: string;
	planDigest: string;
	authorizationDigest: string;
	graphDigest: string;
	generation: number;
	sequence: number;
	previousEventDigest: null | string;
	stepId: string | null;
	attemptId: string | null;
	workerInvocationId: string | null;
	selectedEdgeId: string | null;
	cause: {
		kind: "command" | "event" | "decision" | "effect" | "transfer";
		id: string;
		digest: string;
	};
	type:
		| "graph-activated"
		| "step-authorized"
		| "invocation-started"
		| "step-result-recorded"
		| "decision-requested"
		| "decision-consumed"
		| "effect-reserved"
		| "effect-started"
		| "effect-terminal"
		| "effect-unknown"
		| "predecessor-sealed"
		| "generation-transferred"
		| "run-blocked"
		| "quarantined"
		| "run-completed";
	budgetDelta: {
		durationSeconds: number;
		toolCalls: number;
		inputTokens: number;
		outputTokens: number;
		processesStarted: number;
		filesChanged: number;
		changedBytes: number;
	};
	budgetTotal: {
		durationSeconds: number;
		toolCalls: number;
		inputTokens: number;
		outputTokens: number;
		processesStarted: number;
		filesChanged: number;
		changedBytes: number;
	};
	occurredAt: string;
	data:
		| { graphRef: { id: string; digest: string; mediaType: string } }
		| { authorizationRef: { id: string; digest: string; mediaType: string } }
		| { invocationRef: { id: string; digest: string; mediaType: string } }
		| {
				resultRef: { id: string; digest: string; mediaType: string };
				outcomeCode: string;
		  }
		| { decisionRequestRef: { id: string; digest: string; mediaType: string } }
		| {
				decisionResponseRef: { id: string; digest: string; mediaType: string };
				outcomeCode: string;
		  }
		| {
				effectId: string;
				effectEmissionId: string;
				effectStatus:
					| "reserved"
					| "started"
					| "committed"
					| "rejected-final"
					| "not-committed-final"
					| "state-unknown";
				lifecycleRef: { id: string; digest: string; mediaType: string };
		  }
		| { sealedRevision: number; terminalEffectInventoryDigest: string }
		| {
				executionTransferRef: { id: string; digest: string; mediaType: string };
		  }
		| {
				reasonCode:
					| "orchestrator-authorization-refused"
					| "orchestrator-budget-exceeded"
					| "orchestrator-causal-conflict"
					| "orchestrator-effect-continuity-barrier"
					| "orchestrator-lineage-closed";
				lifecycleRef: { id: string; digest: string; mediaType: string };
		  }
		| { outcomeCode: string };
	eventDigest: string;
};

export type Nullableurn = string | null;

export type Budgetcounters = {
	durationSeconds: number;
	toolCalls: number;
	inputTokens: number;
	outputTokens: number;
	processesStarted: number;
	filesChanged: number;
	changedBytes: number;
};

export type Cause = {
	kind: "command" | "event" | "decision" | "effect" | "transfer";
	id: string;
	digest: string;
};

export type Graphpayload = {
	graphRef: { id: string; digest: string; mediaType: string };
};

export type Authorizationpayload = {
	authorizationRef: { id: string; digest: string; mediaType: string };
};

export type Invocationpayload = {
	invocationRef: { id: string; digest: string; mediaType: string };
};

export type Resultpayload = {
	resultRef: { id: string; digest: string; mediaType: string };
	outcomeCode: string;
};

export type Decisionrequestpayload = {
	decisionRequestRef: { id: string; digest: string; mediaType: string };
};

export type Decisionresponsepayload = {
	decisionResponseRef: { id: string; digest: string; mediaType: string };
	outcomeCode: string;
};

export type Effectpayload = {
	effectId: string;
	effectEmissionId: string;
	effectStatus:
		| "reserved"
		| "started"
		| "committed"
		| "rejected-final"
		| "not-committed-final"
		| "state-unknown";
	lifecycleRef: { id: string; digest: string; mediaType: string };
};

export type Sealpayload = {
	sealedRevision: number;
	terminalEffectInventoryDigest: string;
};

export type Transferpayload = {
	executionTransferRef: { id: string; digest: string; mediaType: string };
};

export type Diagnosticpayload = {
	reasonCode:
		| "orchestrator-authorization-refused"
		| "orchestrator-budget-exceeded"
		| "orchestrator-causal-conflict"
		| "orchestrator-effect-continuity-barrier"
		| "orchestrator-lineage-closed";
	lifecycleRef: { id: string; digest: string; mediaType: string };
};

export type Completionpayload = { outcomeCode: string };
