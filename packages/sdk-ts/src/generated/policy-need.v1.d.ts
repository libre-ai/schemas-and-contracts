/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiPolicyNeedV1 = {
	schemaVersion: "libre-ai.policy-need.v1";
	id: string;
	tenantId: string;
	facts: Array<{ name: string; value: string | number | boolean }>;
	digest: string;
};

export type Factscalar = string | number | boolean;
