/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiHumandecisionresponseV1 = {
	schemaVersion: "libre-ai.human-decision-response.v1";
	id: string;
	organizationId: string;
	missionId: string;
	runId: string;
	stepId: string;
	attemptId: string;
	requestId: string;
	requestDigest: string;
	choiceId: string;
	actorAuthorization: {
		role: string;
		approvedAt: string;
		reference: string;
		subjectDigest: string;
	};
	expectedRevision: number;
	idempotencyKey: string;
	commentArtifactRef: null | { id: string; digest: string; mediaType: string };
	submittedAt: string;
	responseDigest: string;
};
