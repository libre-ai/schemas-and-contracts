/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiBoussoleMethodV1 = {
	schemaVersion: "libre-ai.boussole-method.v1";
	id: string;
	version: string;
	responseScale: Array<number>;
	abstentionTreatment: "excluded-from-denominator" | "neutral";
	missingTreatment: "excluded-and-reported";
	formula: "normalized-agreement-v1";
	approvedAt: string;
	digest: string;
	approvals: Array<{
		role: string;
		approvedAt: string;
		reference: string;
		subjectDigest: string;
	}> &
		unknown &
		unknown;
};
