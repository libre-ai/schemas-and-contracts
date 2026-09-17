/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiCorrectionRecordV1 = {
	schemaVersion: "libre-ai.correction-record.v1";
	id: string;
	projectionId: string;
	previousDigest: string;
	correctedDigest: string;
	reason: string;
	correctedAt: string;
	approval: {
		role: string;
		approvedAt: string;
		reference: string;
		subjectDigest: string;
	};
};
