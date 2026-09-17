/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiDeletionReceiptV1 = {
	schemaVersion: "libre-ai.deletion-receipt.v1";
	id: string;
	tenantId: string;
	owner:
		| "practices"
		| "radar"
		| "sessions"
		| "model-policy"
		| "specifications"
		| "missions"
		| "auth-web"
		| "proof"
		| "artifact";
	subjectDigests: Array<string>;
	requestedBy: string | string;
	requestedAt: string;
	completedAt?: string;
	status: "complete" | "blocked";
	stores: Array<{
		store: "postgresql" | "cellar" | "redis" | "search" | "key-store";
		outcome: "deleted" | "not-applicable" | "blocked";
		reasonCode?: string;
	}>;
	backupExpiresAt?: string;
	legalHold?: { reasonCode: string; authority: string; expiresAt: string };
};
