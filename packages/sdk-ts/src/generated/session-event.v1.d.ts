/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiSessionEventV1 = {
	schemaVersion: "libre-ai.session-event.v1";
	id: string;
	tenantId: string;
	sessionId: string;
	sequence: number;
	revision: number;
	type:
		| "member-added"
		| "session-created"
		| "source-attached"
		| "participant-joined"
		| "contribution-submitted"
		| "synthesis-drafted"
		| "outcome-approved"
		| "outcome-rejected"
		| "session-closed"
		| "session-exported"
		| "session-deleted";
	actor: { kind: "human" | "provider" | "system"; id: string };
	occurredAt: string;
	data: {
		resourceId?: string;
		audience?: "private" | "facilitators" | "session";
		contentDigest?: string;
		reasonCode?: string;
		artifact?: { id: string; digest: string; mediaType: string };
	};
};
