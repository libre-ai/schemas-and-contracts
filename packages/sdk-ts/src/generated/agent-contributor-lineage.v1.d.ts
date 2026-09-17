/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiAgentcontributorlineageV1 = {
	schemaVersion: "libre-ai.agent-contributor-lineage.v1";
	id: string;
	tenantId: string;
	missionId: string;
	subjectDigest: string;
	contributors: Array<{
		agentId: string;
		roles: Array<"author" | "executor" | "fixer" | "editor">;
		contributionDigest: string;
	}>;
	observations: Array<{ id: string; digest: string; mediaType: string }>;
	generatedAt: string;
	signingKeyId: string;
	lineageDigest: string;
	signature: string;
};
