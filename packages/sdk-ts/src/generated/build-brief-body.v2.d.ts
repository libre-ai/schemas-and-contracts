/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiBuildBriefBodyV2Candidate = {
	schemaVersion: "libre-ai.build-brief-body.v2";
	id: string;
	tenantId: string;
	version: number;
	problem: string;
	actors: Array<string>;
	requirements: Array<{
		id: string;
		text: string;
		priority: "must" | "should" | "could";
	}>;
	decisions: Array<{ id: string; status: "accepted"; decision: string }>;
	contracts: Array<string>;
	risks: Array<{
		id: string;
		severity: "low" | "medium" | "high" | "critical";
		control: string;
	}>;
	acceptanceCriteria: Array<{
		id: string;
		observable: string;
		evidenceRule: string;
	}>;
	contributors: Array<string>;
};
