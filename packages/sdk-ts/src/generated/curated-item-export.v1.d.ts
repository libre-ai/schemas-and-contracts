/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiCuratedItemExportV1 = {
	schemaVersion: "libre-ai.curated-item-export.v1";
	tenantId: string;
	exportedAt: string;
	items: Array<{
		id: string;
		sourceUrl: string;
		title: string;
		normalizedDigest: string;
		decision: "retain" | "reject";
		ruleSetId: string;
		ruleSetVersion: number;
		decidedAt: string;
	}>;
};
