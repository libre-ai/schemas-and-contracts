/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiPublicProjectionV1 = {
	schemaVersion: "libre-ai.public-projection.v1";
	id: string;
	route: string;
	locale: "fr";
	title: string;
	summary: string;
	sourceDigest: string;
	reviewedAt: string;
	claims: Array<{
		id: string;
		text: string;
		sources: Array<{
			uri: string;
			retrievedAt: string;
			digest: string;
			licence: string;
		}>;
	}>;
};
