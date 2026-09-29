/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiRetentionPolicyV4Candidate = {
	schemaVersion: "libre-ai.retention-policy.v4";
	authority: "urn:libre-ai:decision:2026-09-29-specifications-handoff-archive";
	status: "candidate";
	backupExpiry: "P35D";
	restoreOrder: [
		"execution-deletion-tombstone",
		"orchestrator-execution-record",
	];
	acceptedPackageProofs: {
		owner: "specifications";
		ruleId: "spec-package";
		components: [
			"canonical-body",
			"detached-acceptance",
			"historical-membership-role",
			"contributor-provenance",
			"key-validity-binding",
			"exact-policy-bytes",
		];
		lifecycle: "joint-package-lifecycle";
		currentAuthority: "independently-rechecked";
	};
	handoffArchive: {
		owner: "specifications";
		ruleId: "spec-handoff-archive";
		encoding: "rfc8785-utf8";
		maximumBytes: 2097152;
		maximumDepth: 32;
		referenceStates: ["reserved", "confirmed", "released"];
		unknownReference: "retain-without-durable-state-change";
		release: "owner-authenticated-terminal-evidence";
		expiry: "still-required-for-new-planning";
		executionAuthority: "none";
		confirmationHistory: "monotone-ever-confirmed";
		terminalRelease: "same-tuple-reason-and-evidence-digest";
	};
	proofRestore: {
		ownerDeletionBeforeExposure: true;
		verifyCanonicalBytes: true;
		reconcileReferences: true;
		currentAuthorityBeforeUse: true;
		preserveInheritedExecutionRestoreOrder: true;
	};
	rules: [
		{
			id: "browser-session";
			owner: "auth-web";
			dataClass: "browser-session-and-revocation";
			location: "postgresql";
			mode: "fixed";
			trigger: "expiry";
			defaultRetention: "P1D";
			maximumActiveHours: 12;
		},
		{
			id: "practices-progress";
			owner: "practices";
			dataClass: "learner-progress";
			location: "local";
			mode: "until-delete";
			trigger: "explicit-delete";
		},
		{
			id: "radar-body";
			owner: "radar";
			dataClass: "untrusted-fetch-body";
			location: "memory";
			mode: "immediate";
			trigger: "normalization";
		},
		{
			id: "radar-quarantine";
			owner: "radar";
			dataClass: "failed-fetch-quarantine";
			location: "cellar";
			mode: "fixed";
			trigger: "failure";
			defaultRetention: "P7D";
		},
		{
			id: "radar-normalized";
			owner: "radar";
			dataClass: "normalized-item-and-decision";
			location: "postgresql";
			mode: "fixed";
			trigger: "creation";
			defaultRetention: "P90D";
			configurable: { minimum: "P7D"; maximum: "P365D" };
		},
		{
			id: "notebook-content";
			owner: "notebook";
			dataClass: "block-link-index";
			location: "local";
			mode: "until-delete";
			trigger: "explicit-delete";
		},
		{
			id: "boussole-local";
			owner: "boussole";
			dataClass: "response-and-result";
			location: "local";
			mode: "until-delete";
			trigger: "explicit-delete";
		},
		{
			id: "sessions-presence";
			owner: "sessions";
			dataClass: "participant-presence";
			location: "redis";
			mode: "fixed";
			trigger: "last-seen";
			defaultRetention: "P1D";
		},
		{
			id: "sessions-content";
			owner: "sessions";
			dataClass: "session-content-and-outcome";
			location: "postgresql";
			mode: "fixed";
			trigger: "creation";
			defaultRetention: "P90D";
			configurable: { minimum: "P7D"; maximum: "P365D" };
		},
		{
			id: "model-snapshot";
			owner: "model-policy";
			dataClass: "accepted-model-snapshot";
			location: "postgresql";
			mode: "while-referenced";
			trigger: "reference-release";
			postReferenceRetention: "P5Y";
		},
		{
			id: "spec-package";
			owner: "specifications";
			dataClass: "accepted-spec-package";
			location: "postgresql";
			mode: "while-referenced";
			trigger: "reference-release";
			postReferenceRetention: "P5Y";
		},
		{
			id: "mission-record";
			owner: "missions";
			dataClass: "mission-event-and-evidence-reference";
			location: "postgresql";
			mode: "fixed";
			trigger: "creation";
			defaultRetention: "P1Y";
			configurable: { maximum: "P6Y" };
		},
		{
			id: "operational-log";
			owner: "operations";
			dataClass: "content-free-operational-log";
			location: "logs";
			mode: "fixed";
			trigger: "creation";
			defaultRetention: "P30D";
		},
		{
			id: "proof-artifact";
			owner: "proof-artifact";
			dataClass: "proof-and-artifact-manifest";
			location: "postgresql";
			mode: "while-referenced";
			trigger: "reference-release";
		},
		{
			id: "encrypted-backup";
			owner: "backup";
			dataClass: "encrypted-disaster-recovery-snapshot";
			location: "backup";
			mode: "fixed";
			trigger: "creation";
			defaultRetention: "P35D";
		},
		{
			id: "orchestrator-execution-record";
			owner: "agent-orchestrator";
			dataClass: "content-free-authorized-execution-state";
			location: "postgresql";
			mode: "fixed";
			trigger: "creation";
			defaultRetention: "P1Y";
			configurable: { maximum: "P6Y" };
			effectiveRetentionEqualsRule: "mission-record";
		},
		{
			id: "execution-deletion-tombstone";
			owner: "agent-orchestrator";
			dataClass: "content-free-execution-deletion-tombstone";
			location: "postgresql";
			mode: "fixed";
			trigger: "explicit-delete";
			defaultRetention: "P35D";
		},
		{
			id: "spec-handoff-archive";
			owner: "specifications";
			dataClass: "accepted-planning-handoff-archive";
			location: "postgresql";
			mode: "while-referenced";
			trigger: "reference-release";
			postReferenceRetention: "P5Y";
		},
	];
	decisionRecord: "docs/adr/2026-09-29-specifications-handoff-archive.md";
};
