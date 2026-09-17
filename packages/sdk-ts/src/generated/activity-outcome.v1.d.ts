/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiActivityOutcomeV1 = {
	schemaVersion: "libre-ai.activity-outcome.v1";
	id: string;
	activityId: string;
	activityVersion: string;
	localSessionId: string;
	state: "in-progress" | "completed" | "stopped";
	responseDigest: string;
	feedbackRuleIds: Array<string>;
	recordedAt: string;
};
