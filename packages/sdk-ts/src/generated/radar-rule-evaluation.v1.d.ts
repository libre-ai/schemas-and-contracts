/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiRadarRuleEvaluationV1 = {
	schemaVersion: "libre-ai.radar-rule-evaluation.v1";
	itemDigest: string;
	ruleSetDigest: string;
	ruleSetId: string;
	ruleSetVersion: number;
	decision: "retain" | "reject";
	reasonCode: "radar.rule_matched" | "radar.default_reject";
	decidingRuleId: null | string;
	explanation: null | string;
	ruleResults: Array<{ ruleId: string; matched: boolean }>;
};
