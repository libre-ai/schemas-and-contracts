/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiOrchestratorEventV1 = {
	schemaVersion: "libre-ai.orchestrator-event.v1";
	id: string;
	tenantId: string;
	missionId: string;
	orchestratorId: string;
	sequence: number;
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
	occurredAt: string;
	data: {
		reasonCode?: string;
		progressPermille?: number;
		decisionRequestId?: string;
		artifact?: { id: string; digest: string; mediaType: string };
		evidence?: { id: string; digest: string; mediaType: string };
	};
};
