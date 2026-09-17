/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiRetentionPolicyV3Candidate = {
	schemaVersion: "libre-ai.retention-policy.v3";
	authority: "urn:libre-ai:decision:adr-0042-auth-minimal-lookup-and-organization-rls";
	status: "candidate";
	backupExpiry: "P35D";
	restoreOrder: [
		"execution-deletion-tombstone",
		"orchestrator-execution-record",
	];
	authRestore: {
		discard: [
			"browser-session",
			"auth-session-locator",
			"auth-oidc-transaction",
			"auth-membership-projection",
			"auth-subject-locator",
		];
		invalidateCookieAndTransactionEpochs: true;
		replayDeletionEvidence: true;
		rebuildFrom: "independently-current-sessions-authority";
		missingAuthority: "deny-reopening";
		controllerState: "absent-memory-only";
		preserveInheritedExecutionRestoreOrder: true;
	};
	rules: Array<unknown>;
};

export type Activeseconds = number;

export type Posteventseconds = 0;
