/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiStepinvocationV1 = {
	schemaVersion: "libre-ai.step-invocation.v1";
	id: string;
	organizationId: string;
	missionId: string;
	planDigest: string;
	graphDigest: string;
	runId: string;
	generation: number;
	stepId: string;
	attemptId: string;
	workerInvocationId: string;
	causeEventDigest: string;
	selectedEdgeId: null | string;
	harnessProfile: { id: string; digest: string; mediaType: string };
	workerManifest: { id: string; digest: string; mediaType: string };
	remainingBudgets: {
		durationSeconds: number;
		toolCalls: number;
		inputTokens: number;
		outputTokens: number;
		processesStarted: number;
		filesChanged: number;
		changedBytes: number;
	};
	inputArtifactRef: { id: string; digest: string; mediaType: string };
	createdAt: string;
	invocationDigest: string;
};

export type Remainingbudgets = {
	durationSeconds: number;
	toolCalls: number;
	inputTokens: number;
	outputTokens: number;
	processesStarted: number;
	filesChanged: number;
	changedBytes: number;
};
