/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiSignalementConnectorProfileV1 = {
	schemaVersion: "libre-ai.signalement-connector-profile.v1";
	profileId: string;
	family: string;
	edition: string;
	api: { style: "rest" | "graphql"; version: string };
	providerVersion: string | null;
	auth: {
		mode:
			| "fine-grained-token"
			| "project-access-token"
			| "personal-access-token"
			| "api-token"
			| "api-key";
		scopes: Array<string>;
	};
	bodyFormat: "markdown-gfm" | "markdown-glfm" | "adf" | "html";
	capabilities: {
		discovery: "supported" | "unsupported" | "unproven";
		mappingValidation: "supported" | "unsupported" | "unproven";
		idempotentCreate: "supported" | "unsupported" | "unproven";
		attachExisting: "supported" | "unsupported" | "unproven";
		attachmentUpload: "supported" | "unsupported" | "unproven";
		comment: "supported" | "unsupported" | "unproven";
		cursorRead: "supported" | "unsupported" | "unproven";
		visibility: "discovered" | "declared";
		consistentLookup: {
			method:
				| "issue-list"
				| "filtered-list"
				| "jql"
				| "entity-property"
				| "external-id"
				| "none";
			status: "supported" | "unsupported" | "unproven";
		};
	};
	limits: {
		maxBodyBytes: number | null;
		maxAttachmentBytes: number | null;
		maxAttachmentsPerItem: number | null;
	};
	conflictPolicy: {
		title:
			| "dossier-owned"
			| "provider-owned"
			| "merge-set"
			| "human-resolution";
		body: "dossier-owned" | "provider-owned" | "merge-set" | "human-resolution";
		attachments:
			| "dossier-owned"
			| "provider-owned"
			| "merge-set"
			| "human-resolution";
		comments:
			| "dossier-owned"
			| "provider-owned"
			| "merge-set"
			| "human-resolution";
		status:
			| "dossier-owned"
			| "provider-owned"
			| "merge-set"
			| "human-resolution";
		closure:
			| "dossier-owned"
			| "provider-owned"
			| "merge-set"
			| "human-resolution";
	};
};

export type Family = string;

export type Edition = string;

export type Capability = "supported" | "unsupported" | "unproven";

export type Policy =
	| "dossier-owned"
	| "provider-owned"
	| "merge-set"
	| "human-resolution";

export type Positivelimit = number | null;

export type Countlimit = number | null;
