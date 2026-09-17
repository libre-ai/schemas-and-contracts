/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiPolicyDefinitionV1 = {
	schemaVersion: "libre-ai.policy-definition.v1";
	id: string;
	tenantId: string;
	version: number;
	status: "approved";
	rules: Array<{
		id: string;
		fact: string;
		operator:
			| "equals"
			| "not-equals"
			| "in"
			| "not-in"
			| "at-least"
			| "at-most";
		value:
			| (string | number | boolean)
			| (Array<string> | Array<number> | Array<boolean>);
		unknown: "indeterminate" | "ineligible";
		source: {
			uri: string;
			retrievedAt: string;
			digest: string;
			licence: string;
		};
		maxSourceAgeDays?: number;
	}>;
	digest: string;
	approvedAt: string;
	approval: {
		role: string;
		approvedAt: string;
		reference: string;
		subjectDigest: string;
	};
};

export type Factscalar = string | number | boolean;

export type Factset = Array<string> | Array<number> | Array<boolean>;

export type Policysource = {
	uri: string;
	retrievedAt: string;
	digest: string;
	licence: string;
};

export type Rule = {
	id: string;
	fact: string;
	operator: "equals" | "not-equals" | "in" | "not-in" | "at-least" | "at-most";
	value:
		| (string | number | boolean)
		| (Array<string> | Array<number> | Array<boolean>);
	unknown: "indeterminate" | "ineligible";
	source: { uri: string; retrievedAt: string; digest: string; licence: string };
	maxSourceAgeDays?: number;
};
