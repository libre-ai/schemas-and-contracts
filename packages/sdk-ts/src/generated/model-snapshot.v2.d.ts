/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiModelSnapshotV2 = {
	schemaVersion: "libre-ai.model-snapshot.v2";
	id: string;
	tenantId: string;
	modelId: string;
	capturedAt: string;
	facts: Array<{
		name: string;
		value: string | number | boolean;
		source: {
			uri: string;
			retrievedAt: string;
			digest: string;
			licence: string;
		};
	}>;
	digest: string;
};

export type Factscalar = string | number | boolean;

export type Factsource = {
	uri: string;
	retrievedAt: string;
	digest: string;
	licence: string;
};
