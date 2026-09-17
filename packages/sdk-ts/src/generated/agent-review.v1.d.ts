/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiAgentreviewV1 = {
	schemaVersion: "libre-ai.agent-review.v1";
	id: string;
	tenantId: string;
	missionId: string;
	subjectType: "execution-plan" | "mission-result";
	subjectDigest: string;
	evidence: Array<{ id: string; digest: string; mediaType: string }>;
	contributorLineage: { id: string; digest: string; mediaType: string };
	contributorAgentIds: Array<string>;
	reviewerAgentId: string;
	reviewerRunId: string;
	reviewerManifestDigest: string;
	reviewerPoolId: string;
	runtimeFamily: string;
	modelFamily: string;
	providerId: string;
	isolationProfileDigest: string;
	reviewSessionAttestation: { id: string; digest: string; mediaType: string };
	blindReview: true;
	verdict: "approve" | "reject";
	summary: Array<{
		code: string;
		severity: "blocking" | "major" | "minor" | "info";
		count: number;
	}>;
	detailsEvidence?: { id: string; digest: string; mediaType: string };
	nonce: string;
	issuedAt: string;
	expiresAt: string;
	signingKeyId: string;
	preimageDigest: string;
	signature: string;
};
