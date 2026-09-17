/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiAgentreviewquorumviewV1 = {
	schemaVersion: "libre-ai.agent-review-quorum-view.v1";
	tenantId: string;
	missionId: string;
	subjectType: "execution-plan" | "mission-result";
	subjectDigest: string;
	quorumDigest: string;
	identityMode: "redacted" | "need-to-know";
	reviewers: Array<{
		reviewDigest: string;
		reviewerAgentId?: string;
		verdict: "approve";
		summary: Array<{ code: string; severity: "minor" | "info"; count: number }>;
	}>;
	contributorCount: number;
	contributorAgentIds?: Array<string>;
	retentionPolicyId: "mission-record";
	retentionExpiresAt: string;
};
