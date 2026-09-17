/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiContextDocumentV2 = {
	schemaVersion: "libre-ai.context-document.v2";
	id: string;
	rootBlockIds: Array<string>;
	blocks: Array<{
		id: string;
		mediaType: "text/plain" | "text/markdown" | "application/json";
		content: string;
		links: Array<string>;
	}>;
	totalBytes: number;
	digest: string;
};

export type Exportblockid = string;
