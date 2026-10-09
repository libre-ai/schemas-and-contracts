/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiP02WorkerJobCommandOrResultV1 =
	| ({
			schemaVersion: "libre-ai.p02-job.v1";
			kind: "command" | "result";
			jobId: string;
			tenantId: string;
			[key: string]: unknown;
	  } & {
			schemaVersion: unknown;
			kind: "command";
			jobId: unknown;
			tenantId: unknown;
			idempotencyKey: string;
			enqueuedAt: string;
			operation: {
				type: "fetch-source";
				sourceId: string;
				url: string;
				bodyKind: "feed" | "page";
				validators?: { etag?: string; lastModified?: string };
			};
	  })
	| ({
			schemaVersion: "libre-ai.p02-job.v1";
			kind: "command" | "result";
			jobId: string;
			tenantId: string;
			[key: string]: unknown;
	  } & {
			schemaVersion: unknown;
			kind: "result";
			jobId: unknown;
			tenantId: unknown;
			completedAt: string;
			status: "succeeded" | "refused" | "failed";
			outcome?: {
				type: "fetch-source";
				finalUrl: string;
				httpStatus: number;
				redirects: number;
				notModified: boolean;
				etag?: string;
				lastModified?: string;
				contentType?: string;
				retryAfter?: string;
				body?: { bytes: number; blake3: string };
			};
			reasonCode?: string;
	  });

export type Base = {
	schemaVersion: "libre-ai.p02-job.v1";
	kind: "command" | "result";
	jobId: string;
	tenantId: string;
	[key: string]: unknown;
};

export type Validators = { etag?: string; lastModified?: string };

export type Fetchsource = {
	type: "fetch-source";
	sourceId: string;
	url: string;
	bodyKind: "feed" | "page";
	validators?: { etag?: string; lastModified?: string };
};

export type Command = {
	schemaVersion: "libre-ai.p02-job.v1";
	kind: "command" | "result";
	jobId: string;
	tenantId: string;
	[key: string]: unknown;
} & {
	schemaVersion: unknown;
	kind: "command";
	jobId: unknown;
	tenantId: unknown;
	idempotencyKey: string;
	enqueuedAt: string;
	operation: {
		type: "fetch-source";
		sourceId: string;
		url: string;
		bodyKind: "feed" | "page";
		validators?: { etag?: string; lastModified?: string };
	};
};

export type Bodydigest = { bytes: number; blake3: string };

export type Fetchsourceoutcome = {
	type: "fetch-source";
	finalUrl: string;
	httpStatus: number;
	redirects: number;
	notModified: boolean;
	etag?: string;
	lastModified?: string;
	contentType?: string;
	retryAfter?: string;
	body?: { bytes: number; blake3: string };
};

export type Result = {
	schemaVersion: "libre-ai.p02-job.v1";
	kind: "command" | "result";
	jobId: string;
	tenantId: string;
	[key: string]: unknown;
} & {
	schemaVersion: unknown;
	kind: "result";
	jobId: unknown;
	tenantId: unknown;
	completedAt: string;
	status: "succeeded" | "refused" | "failed";
	outcome?: {
		type: "fetch-source";
		finalUrl: string;
		httpStatus: number;
		redirects: number;
		notModified: boolean;
		etag?: string;
		lastModified?: string;
		contentType?: string;
		retryAfter?: string;
		body?: { bytes: number; blake3: string };
	};
	reasonCode?: string;
};
