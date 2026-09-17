/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiOrchestratoreventV2 = {
	schemaVersion: "libre-ai.orchestrator-event.v2";
	id: string;
	tenantId: string;
	missionId: string;
	runId: string;
	orchestratorId: string;
	planDigest: string;
	authorizationDigest: string;
	sequence: number;
	previousEventDigest: null | string;
	causationId: null | string;
	commandId?: string;
	attempt: number;
	type:
		| "started"
		| "progressed"
		| "blocked"
		| "decision-requested"
		| "paused"
		| "resumed"
		| "budget-exceeded"
		| "cancelled"
		| "result-submitted"
		| "failed";
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
	data: {
		reasonCode?: string;
		progressPermille?: number;
		decisionRequestId?: string;
		artifact?: { id: string; digest: string; mediaType: string };
		evidence?: { id: string; digest: string; mediaType: string };
		contributorLineage?: { id: string; digest: string; mediaType: string };
		harnessAttestation?: { id: string; digest: string; mediaType: string };
	};
	eventDigest: string;
};

export type Budgetcounters = {
	durationSeconds: number;
	toolCalls: number;
	inputTokens: number;
	outputTokens: number;
	processesStarted: number;
	filesChanged: number;
	changedBytes: number;
};
