/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiPolicyEvaluationV2 = {
	schemaVersion: "libre-ai.policy-evaluation.v2";
	id: string;
	tenantId: string;
	policyId: string;
	policyDigest: string;
	snapshotId: string;
	snapshotDigest: string;
	needDigest: string;
	engineVersion: string;
	verdict: "eligible" | "ineligible" | "indeterminate";
	ruleResults: Array<{
		ruleId: string;
		status: "satisfied" | "failed" | "unknown";
		reasonCode:
			| "policy.rule_satisfied"
			| "policy.rule_failed"
			| "policy.fact_absent"
			| "policy.fact_type_mismatch"
			| "policy.snapshot_stale"
			| "policy.source_from_future";
	}>;
	evaluatedAt: string;
	digest: string;
};
