/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiMissionHandoffBindingV1Candidate = {
	schemaVersion: "libre-ai.mission-handoff-binding.v1";
	tenantId: string;
	handoff: {
		schemaVersion: "libre-ai.agent-handoff.v2";
		id: string;
		documentDigest: string;
		archiveReference: {
			id: string;
			digest: string;
			mediaType: "application/json";
		};
	};
	specPackage: {
		schemaVersion: "libre-ai.spec-package.v2";
		id: string;
		version: number;
		bodyDigest: string;
	};
	acceptanceDigest: string;
	acceptanceCriteria: Array<string>;
};
