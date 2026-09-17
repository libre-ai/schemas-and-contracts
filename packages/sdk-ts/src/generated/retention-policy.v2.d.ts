/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiRetentionPolicyV2 = {
	schemaVersion: "libre-ai.retention-policy.v2";
	authority: string;
	approvedAt: string;
	backupExpiry: "P35D";
	restoreOrder: Array<unknown>;
	rules: Array<{
		id: string;
		owner:
			| "practices"
			| "radar"
			| "notebook"
			| "sessions"
			| "model-policy"
			| "boussole"
			| "specifications"
			| "missions"
			| "auth-web"
			| "operations"
			| "proof-artifact"
			| "backup"
			| "agent-orchestrator";
		dataClass: string;
		location:
			| "memory"
			| "local"
			| "postgresql"
			| "redis"
			| "cellar"
			| "logs"
			| "backup";
		mode: "immediate" | "fixed" | "until-delete" | "while-referenced";
		trigger:
			| "normalization"
			| "failure"
			| "creation"
			| "last-seen"
			| "expiry"
			| "explicit-delete"
			| "reference-release";
		defaultRetention?: string;
		postReferenceRetention?: string;
		maximumActiveHours?: number;
		configurable?: { minimum?: string; maximum?: string };
		effectiveRetentionEqualsRule?: "mission-record";
	}>;
};

export type Duration = string;

export type Rule = {
	id: string;
	owner:
		| "practices"
		| "radar"
		| "notebook"
		| "sessions"
		| "model-policy"
		| "boussole"
		| "specifications"
		| "missions"
		| "auth-web"
		| "operations"
		| "proof-artifact"
		| "backup"
		| "agent-orchestrator";
	dataClass: string;
	location:
		| "memory"
		| "local"
		| "postgresql"
		| "redis"
		| "cellar"
		| "logs"
		| "backup";
	mode: "immediate" | "fixed" | "until-delete" | "while-referenced";
	trigger:
		| "normalization"
		| "failure"
		| "creation"
		| "last-seen"
		| "expiry"
		| "explicit-delete"
		| "reference-release";
	defaultRetention?: string;
	postReferenceRetention?: string;
	maximumActiveHours?: number;
	configurable?: { minimum?: string; maximum?: string };
	effectiveRetentionEqualsRule?: "mission-record";
};
