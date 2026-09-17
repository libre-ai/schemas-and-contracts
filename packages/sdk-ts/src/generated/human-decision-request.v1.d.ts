/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiHumandecisionrequestV1 = {
	schemaVersion: "libre-ai.human-decision-request.v1";
	id: string;
	organizationId: string;
	missionId: string;
	runId: string;
	planDigest: string;
	graphDigest: string;
	stepId: string;
	attemptId: string;
	choices: Array<{ choiceId: string; label: string; consequenceCode: string }>;
	requiredRole: string;
	expectedRevision: number;
	expiresAt: string;
	noResponseOutcomeCode: string;
	evidenceRefs: Array<{ id: string; digest: string; mediaType: string }>;
	requestDigest: string;
};

export type Choice = {
	choiceId: string;
	label: string;
	consequenceCode: string;
};
