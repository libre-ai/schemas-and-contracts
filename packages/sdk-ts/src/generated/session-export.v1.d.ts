/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiSessionExportV1 = {
	schemaVersion: "libre-ai.session-export.v1";
	id: string;
	tenantId: string;
	sessionId: string;
	audience: "facilitators" | "session";
	exportedAt: string;
	sources: Array<{
		uri: string;
		retrievedAt: string;
		digest: string;
		licence: string;
	}>;
	contributions: Array<{
		id: string;
		audience: "facilitators" | "session";
		contentDigest: string;
	}>;
	approvedOutcomes: Array<{ id: string; digest: string; mediaType: string }>;
	eventCursor: number;
	digest: string;
};
