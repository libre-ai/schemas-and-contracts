/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiUntrustedenvelopeV1 = {
	schemaVersion: "libre-ai.envelope.v1";
	trusted: false;
	source:
		| "web"
		| "email"
		| "memory"
		| "tool-output"
		| "tool-description"
		| "mcp-description";
	label?: string;
	content: string;
	capturedAt: string;
	integrity: { alg: "HMAC-SHA256"; keyId: string; mac: string };
};
