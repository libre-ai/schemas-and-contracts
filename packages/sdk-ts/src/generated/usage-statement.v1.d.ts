/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiUsageStatementV1 = {
	schemaVersion: "libre-ai.usage-statement.v1";
	organizationId: string;
	period: { from: string; to: string };
	counters: {
		sources: number;
		itemsRetained: number;
		fetches: number;
		members: number;
	};
	digest: string;
	signature: { kid: string; signature: string };
};
