/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiAgentHandoffV2Candidate = {
	schemaVersion: "libre-ai.agent-handoff.v2";
	id: string;
	tenantId: string;
	specPackageId: string;
	specPackageDigest: string;
	capabilities: Array<"plan">;
	acceptanceCriteria: Array<string>;
	evidenceReports?: Array<{ id: string; digest: string; mediaType: string }>;
	createdAt: string;
	expiresAt: string;
	specPackageVersion: number;
	acceptanceDigest: string;
};
