/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiExecutiontransferV1 = {
	schemaVersion: "libre-ai.execution-transfer.v1";
	id: string;
	organizationId: string;
	missionId: string;
	predecessorRunId: string;
	predecessorPlanDigest: string;
	currentGeneration: number;
	expectedRevision: number;
	successorPlanDigest: string;
	idempotencyKey: string;
	issuedAt: string;
	expiresAt: string;
	transferDigest: string;
};
