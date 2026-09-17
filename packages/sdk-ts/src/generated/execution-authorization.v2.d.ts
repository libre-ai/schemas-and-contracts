/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiExecutionauthorizationV2 = {
	schemaVersion: "libre-ai.execution-authorization.v2";
	id: string;
	organizationId: string;
	missionId: string;
	missionRevision: number;
	missionRecordDigest: string;
	planId: string;
	planDigest: string;
	graphDigest: string;
	planQuorum: { id: string; digest: string; mediaType: string };
	protectedHumanGate?: {
		role: string;
		approvedAt: string;
		reference: string;
		subjectDigest: string;
	};
	generation: number;
	lineageMode: "initial" | "successor";
	successorBinding: null | {
		executionTransferId: string;
		executionTransferDigest: string;
		predecessorRunId: string;
		predecessorPlanDigest: string;
		sealedRevision: number;
		terminalEffectInventoryDigest: string;
	};
	revocationId: string;
	issuedAt: string;
	expiresAt: string;
	authorizationDigest: string;
};

export type Successorbinding = {
	executionTransferId: string;
	executionTransferDigest: string;
	predecessorRunId: string;
	predecessorPlanDigest: string;
	sealedRevision: number;
	terminalEffectInventoryDigest: string;
};
