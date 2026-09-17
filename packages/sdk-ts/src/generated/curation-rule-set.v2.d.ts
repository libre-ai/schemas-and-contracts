/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiCurationRuleSetV2 = {
	schemaVersion: "libre-ai.curation-rule-set.v2";
	id: string;
	tenantId: string;
	version: number;
	status: "draft" | "active" | "retired";
	rules: Array<{
		id: string;
		field:
			| "title"
			| "summary"
			| "author"
			| "tags"
			| "publishedAt"
			| "sourceHost";
		operator: "equals" | "contains" | "prefix" | "after" | "before";
		value: string;
		decision: "retain" | "reject";
		explanation: string;
	}>;
	createdAt: string;
};
