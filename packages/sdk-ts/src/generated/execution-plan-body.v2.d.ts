/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiExecutionplanbodyV2 = {
	schemaVersion: "libre-ai.execution-plan-body.v2";
	id: string;
	organizationId: string;
	missionId: string;
	handoffId: string;
	handoffDigest: string;
	specPackageDigest: string;
	executionGraph: { id: string; digest: string; mediaType: string };
	lineageMode: "initial" | "successor";
	successorLineage: null | {
		predecessorRunId: string;
		predecessorPlanDigest: string;
		sealedRevision: number;
		terminalEffectInventoryDigest: string;
		executionTransferId: string;
	};
	requestedGeneration: number;
	decisionSchemaRefs: Array<{ id: string; digest: string; mediaType: string }>;
	executorProfileRefs: Array<{ id: string; digest: string; mediaType: string }>;
	acceptanceCriteria: Array<string>;
	tools: Array<{
		name: string;
		access: "read" | "write" | "execute" | "network";
		argumentPolicyDigest: string;
		maxCalls: number;
	}>;
	filesystem: {
		readPaths: Array<string>;
		writePaths: Array<string>;
		denyPaths: Array<string>;
		copyIgnoredFiles: false;
	};
	budgets: {
		maxDurationSeconds: number;
		maxToolCalls: number;
		maxInputTokens: number;
		maxOutputTokens: number;
		maxProcesses: number;
		maxFilesChanged: number;
		maxChangedBytes: number;
		maxConcurrentAgents: number;
	};
	network: {
		workerMode: "none" | "private-gateway-only";
		gatewayOrigins: Array<{ scheme: "https"; host: string; port: number }>;
	};
	modelEgress: {
		purposeCode: string;
		authorizationBasis:
			| "contract"
			| "consent"
			| "legitimate-interest"
			| "public-task"
			| "not-applicable";
		maximumClassification:
			| "public"
			| "internal"
			| "tenant-private"
			| "personal";
		sourcePaths: Array<string>;
		maxBytesPerRequest: number;
		region: "local" | "france" | "eu";
		subprocessors: Array<string>;
		zeroDataRetention: true;
		trainingAllowed: false;
		reuseAllowed: false;
		policyDigest: string;
	};
	harnessProfile: { id: string; digest: string; mediaType: string };
	workerManifests: Array<{ id: string; digest: string; mediaType: string }>;
	evidenceDestinations: Array<{
		id: string;
		digest: string;
		mediaType: string;
	}>;
	createdAt: string;
	expiresAt: string;
	bodyDigest: string;
};

export type Relativepath = string;

export type Origin = { scheme: "https"; host: string; port: number };

export type Successorlineage = {
	predecessorRunId: string;
	predecessorPlanDigest: string;
	sealedRevision: number;
	terminalEffectInventoryDigest: string;
	executionTransferId: string;
};
