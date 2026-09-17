/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiEvidenceReportV1 = {
	schemaVersion: "libre-ai.evidence-report.v1";
	id: string;
	subject: string;
	subjectDigest: string;
	status: "pass" | "fail" | "indeterminate";
	checks: Array<{
		id: string;
		status: "pass" | "fail" | "indeterminate";
		ruleVersion: string;
		evidence?: { id: string; digest: string; mediaType: string };
		reasonCode?: string;
	}>;
	generatedAt: string;
	producer: { name: string; version: string };
};
