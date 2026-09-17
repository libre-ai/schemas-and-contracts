/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiBuildBriefAcceptanceV2Candidate = {
	schemaVersion: "libre-ai.build-brief-acceptance.v2";
	statement: {
		schemaVersion: "libre-ai.build-brief-acceptance-statement.v2";
		id: string;
		tenantId: string;
		specPackageId: string;
		specPackageVersion: number;
		subjectDigest: string;
		approverId: string;
		role: "build-brief-approver";
		acceptedAt: string;
		membershipRevision: number;
		policyDigest: string;
		signingKeyId: string;
	};
	signature: string;
};
