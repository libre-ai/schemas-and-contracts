/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiLocalComparisonV3 = {
	schemaVersion: "libre-ai.local-comparison.v3";
	datasetId: string;
	datasetDigest: string;
	methodId: string;
	methodDigest: string;
	responseSetDigest: string;
	scoreMicros: number;
	score: string;
	weightedNumerator: number;
	scaledDenominator: number;
	denominator: number;
	omissions: Array<{
		statementId: string;
		reason:
			| "explicit-skip"
			| "abstention"
			| "vote-data-unavailable"
			| "representative-absent";
	}>;
	contributions: Array<{
		statementId: string;
		contributionMicros: number;
		contribution: string;
		weightedTerm: number;
		votesConsidered: number;
		votesOmitted: number;
	}>;
	computedAt: string;
};

export type Sixdecimalscore = string;

export type Microscore = number;

export type Omissionreason =
	| "explicit-skip"
	| "abstention"
	| "vote-data-unavailable"
	| "representative-absent";
