/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiExecutionauthorizationV1 = {
	schemaVersion: "libre-ai.execution-authorization.v1";
	id: string;
	tenantId: string;
	missionId: string;
	missionRevision: number;
	missionRecordDigest: string;
	planId: string;
	planDigest: string;
	planQuorum: { id: string; digest: string; mediaType: string };
	protectedHumanGate?: {
		role: string;
		approvedAt: string;
		reference: string;
		subjectDigest: string;
	};
	revocationId: string;
	issuedAt: string;
	expiresAt: string;
	authorizationDigest: string;
};
