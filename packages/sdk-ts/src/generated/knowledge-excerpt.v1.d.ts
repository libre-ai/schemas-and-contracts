/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiKnowledgeExcerptV1 = {
	schemaVersion: "libre-ai.knowledge-excerpt.v1";
	frontMatter: {
		itemId: string;
		sourceId: string;
		version: number;
		url: string;
		publishedAt: string | null;
		collectedAt: string;
		excerptAnchor: string;
	};
	body: string;
};
