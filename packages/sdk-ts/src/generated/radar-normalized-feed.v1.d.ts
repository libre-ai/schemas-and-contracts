/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiRadarNormalizedFeedV1 = {
	schemaVersion: "libre-ai.radar-normalized-feed.v1";
	sourceId: string;
	baseUrl: string;
	format: "rss-2.0" | "atom-1.0" | "json-feed-1" | "json-feed-1.1";
	title: string;
	homeUrl: null | string;
	items: Array<{
		schemaVersion: "libre-ai.radar-normalized-item.v1";
		sourceId: string;
		id: string;
		deduplicationKey: string;
		externalId: null | string;
		url: null | string;
		sourceHost: string;
		title: string;
		summary: string;
		authors: Array<string>;
		tags: Array<string>;
		publishedAt: null | string;
		updatedAt: null | string;
	}>;
};
