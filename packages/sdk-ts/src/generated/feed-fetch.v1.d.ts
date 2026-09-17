/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiFeedFetchRequestOrResultV1 =
	| ({
			schemaVersion: "libre-ai.feed-fetch.v1";
			kind: "request" | "result";
			tenantId: string;
			sourceId: string;
			fetchId: string;
			scheduledAt: string;
			[key: string]: unknown;
	  } & {
			schemaVersion: unknown;
			kind: "request";
			tenantId: unknown;
			sourceId: unknown;
			fetchId: unknown;
			scheduledAt: unknown;
			url: string;
			limits: { maxBytes: number; timeoutMs: number; maxRedirects: number };
	  })
	| ({
			schemaVersion: "libre-ai.feed-fetch.v1";
			kind: "request" | "result";
			tenantId: string;
			sourceId: string;
			fetchId: string;
			scheduledAt: string;
			[key: string]: unknown;
	  } & {
			schemaVersion: unknown;
			kind: "result";
			tenantId: unknown;
			sourceId: unknown;
			fetchId: unknown;
			scheduledAt: unknown;
			status: "accepted" | "not-modified" | "rejected" | "failed";
			completedAt: string;
			reasonCode?: string;
			itemDigests: Array<string>;
	  });

export type Base = {
	schemaVersion: "libre-ai.feed-fetch.v1";
	kind: "request" | "result";
	tenantId: string;
	sourceId: string;
	fetchId: string;
	scheduledAt: string;
	[key: string]: unknown;
};

export type Request = {
	schemaVersion: "libre-ai.feed-fetch.v1";
	kind: "request" | "result";
	tenantId: string;
	sourceId: string;
	fetchId: string;
	scheduledAt: string;
	[key: string]: unknown;
} & {
	schemaVersion: unknown;
	kind: "request";
	tenantId: unknown;
	sourceId: unknown;
	fetchId: unknown;
	scheduledAt: unknown;
	url: string;
	limits: { maxBytes: number; timeoutMs: number; maxRedirects: number };
};

export type Result = {
	schemaVersion: "libre-ai.feed-fetch.v1";
	kind: "request" | "result";
	tenantId: string;
	sourceId: string;
	fetchId: string;
	scheduledAt: string;
	[key: string]: unknown;
} & {
	schemaVersion: unknown;
	kind: "result";
	tenantId: unknown;
	sourceId: unknown;
	fetchId: unknown;
	scheduledAt: unknown;
	status: "accepted" | "not-modified" | "rejected" | "failed";
	completedAt: string;
	reasonCode?: string;
	itemDigests: Array<string>;
};
