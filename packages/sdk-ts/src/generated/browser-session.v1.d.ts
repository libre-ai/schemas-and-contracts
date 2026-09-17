/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiBrowserSessionRecordV1 = {
	schemaVersion: "libre-ai.browser-session.v1";
	id: string;
	sessionDigest: string;
	userId: string;
	tenantId: string;
	roles: Array<string>;
	membershipRevision: number;
	oidc: {
		issuer: string;
		subjectDigest: string;
		authenticatedAt: string;
		assurance?: string;
	};
	csrfSecretDigest: string;
	status: "active" | "revoked" | "expired";
	createdAt: string;
	lastSeenAt: string;
	idleExpiresAt: string;
	absoluteExpiresAt: string;
	revokedAt?: string;
	revocationReason?: string;
	revision: number;
};
