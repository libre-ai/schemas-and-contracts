/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiBoussoleLocalResponseSetV2 = {
	schemaVersion: "libre-ai.boussole-response-set.v2";
	datasetId: string;
	datasetDigest: string;
	methodId: string;
	methodDigest: string;
	responses: Array<
		| { statementId: string; kind: "answer"; value: number }
		| { statementId: string; kind: "skip" }
	>;
};
