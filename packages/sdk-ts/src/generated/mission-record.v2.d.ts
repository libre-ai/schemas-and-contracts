/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiMissionrecordV2 = {
	schemaVersion: "libre-ai.mission-record.v2";
	id: string;
	tenantId: string;
	revision: number;
	state:
		| "proposed"
		| "assessed"
		| "plan-review"
		| "plan-rejected"
		| "authorized"
		| "running"
		| "blocked"
		| "paused"
		| "cancelled"
		| "result-submitted"
		| "result-review"
		| "validated"
		| "rejected"
		| "failed"
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
		maxInputTokens: number;
		maxOutputTokens: number;
		network: "none" | "private-gateway-only";
	};
	acceptanceCriteria: Array<string>;
	plan?: { id: string; digest: string; mediaType: string };
	planQuorum?: { id: string; digest: string; mediaType: string };
	executionAuthorization?: { id: string; digest: string; mediaType: string };
	planReviewOutcome?: {
		status: "rejected";
		rejectionReview: { id: string; digest: string; mediaType: string };
		reasonCode: string;
		decidedAt: string;
	};
	protectedHumanGate?: {
		role: string;
		approvedAt: string;
		reference: string;
		subjectDigest: string;
	};
	runId?: string;
	runHarnessAttestation?: { id: string; digest: string; mediaType: string };
	reviews: Array<{ id: string; digest: string; mediaType: string }>;
	eventCursor: number;
	result?: {
		artifact: { id: string; digest: string; mediaType: string };
		evidence: { id: string; digest: string; mediaType: string };
		contributorLineage: { id: string; digest: string; mediaType: string };
		submittedAt: string;
	};
	resultQuorum?: { id: string; digest: string; mediaType: string };
	validation?: {
		status: "validated" | "rejected" | "abandoned";
		rejectionReview?: { id: string; digest: string; mediaType: string };
		reasonCode: string;
		decidedAt: string;
	};
	createdAt: string;
};
