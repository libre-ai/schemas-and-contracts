/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiRuleCommonFormsV1 = {
	schemaVersion: "libre-ai.rule-common.v1";
	ruleId: string;
	excerptDigest: string;
	slug: string;
	edition: string;
	overlayReference: string;
	level: "MUST" | "MUST_NOT" | "SHOULD" | "SHOULD_NOT" | "MAY";
	triggerType: "glob" | "keyword" | "type";
};

export type Ruleid = string;

export type Excerptdigest = string;

export type Slug = string;

export type Edition = string;

export type Overlayreference = string;

export type Level = "MUST" | "MUST_NOT" | "SHOULD" | "SHOULD_NOT" | "MAY";

export type Triggertype = "glob" | "keyword" | "type";
