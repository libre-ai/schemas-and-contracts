/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiActivityDefinitionV1 = {
	schemaVersion: "libre-ai.activity-definition.v1";
	id: string;
	version: string;
	status: "draft" | "reviewed" | "published" | "withdrawn";
	title: string;
	objective: string;
	sources: Array<{
		uri: string;
		retrievedAt: string;
		digest: string;
		licence: string;
	}>;
	responseSchema: {
		type:
			| "string"
			| "number"
			| "integer"
			| "boolean"
			| "choice"
			| "multi-choice";
		minLength?: number;
		maxLength?: number;
		minimum?: number;
		maximum?: number;
		options?: Array<string>;
	};
	feedbackRules: Array<{
		id: string;
		explanation: string;
		sourceIndexes: Array<number>;
	}>;
	generatedContent: boolean;
	approvals?: Array<{
		role: string;
		approvedAt: string;
		reference: string;
		subjectDigest: string;
	}>;
};
