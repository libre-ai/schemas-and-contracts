/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiMissionrecordV1 = {
	schemaVersion: "libre-ai.mission-record.v1";
	id: string;
	tenantId: string;
	revision: number;
	state:
		| "proposed"
		| "assessed"
		| "approved"
		| "refused"
		| "running"
		| "blocked"
		| "paused"
		| "cancelled"
		| "result-submitted"
		| "accepted"
		| "rejected"
		| "abandoned";
	handoffId: string;
	handoffDigest: string;
	risk?: {
		level: "low" | "medium" | "high" | "critical";
		policyVersion: string;
	};
	budgets: {
		maxDurationSeconds: number;
		maxToolCalls: number;
		network: "none" | "allowlisted";
	};
	acceptanceCriteria: Array<string>;
	approvals?: Array<{
		role: string;
		approvedAt: string;
		reference: string;
		subjectDigest: string;
	}>;
	eventCursor: number;
	result?: {
		artifact: { id: string; digest: string; mediaType: string };
		evidence: { id: string; digest: string; mediaType: string };
		submittedAt: string;
	};
	verdict?: {
		status: "accepted" | "rejected" | "abandoned";
		reasonCode: string;
		decidedAt: string;
	};
	createdAt: string;
};
