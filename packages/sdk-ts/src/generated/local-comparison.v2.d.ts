/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiLocalComparisonV2 = {
	schemaVersion: "libre-ai.local-comparison.v2";
	datasetId: string;
	datasetDigest: string;
	methodId: string;
	methodDigest: string;
	responseSetDigest: string;
	score: number;
	denominator: number;
	omitted: number;
	contributions: Array<{
		statementId: string;
		contribution: number;
		votesConsidered: number;
		votesOmitted: number;
	}>;
	computedAt: string;
};
