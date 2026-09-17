/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiAgentreviewsessionattestationV1 = {
	schemaVersion: "libre-ai.agent-review-session-attestation.v1";
	id: string;
	tenantId: string;
	missionId: string;
	subjectDigest: string;
	reviewerAgentId: string;
	reviewerRunId: string;
	reviewerManifestDigest: string;
	reviewerPoolId: string;
	runtimeFamily: string;
	modelFamily: string;
	providerId: string;
	isolationProfileDigest: string;
	harnessAttestation: { id: string; digest: string; mediaType: string };
	readOnlyWorkspace: true;
	sharedMutableState: false;
	siblingVerdictDisclosed: false;
	issuedAt: string;
	expiresAt: string;
	signingKeyId: string;
	attestationDigest: string;
	signature: string;
};
