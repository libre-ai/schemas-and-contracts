/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiContextDocumentV1 = {
	schemaVersion: "libre-ai.context-document.v1";
	id: string;
	createdAt: string;
	rootBlockIds: Array<string>;
	blocks: Array<{
		id: string;
		revision: number;
		mediaType: "text/plain" | "text/markdown" | "application/json";
		content: string;
		links: Array<string>;
	}>;
	totalBytes: number;
	excludedBlockIds?: Array<string>;
	digest: string;
};
