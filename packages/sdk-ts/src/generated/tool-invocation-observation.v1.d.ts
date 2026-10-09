/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiToolinvocationobservationV1 = {
	schemaVersion: "libre-ai.tool-invocation-observation.v1";
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
	harnessAttestationDigest: string;
	digestKey: {
		keyId: string;
		scope: "run";
		algorithm: "hmac-sha-256";
		canonicalization: "rfc8785-jcs";
	};
	window: {
		sequence: number;
		windowSize: number;
		firstCallSequence: number;
		lastCallSequence: number;
		final: boolean;
	};
	previousObservationDigest: null | string;
	entries: Array<{
		toolName: string;
		argsDigest: string;
		resultDigest: string;
		outcome: "ok" | "empty" | "error";
		count: number;
		firstCallSequence: number;
		lastCallSequence: number;
	}>;
	closedAt: string;
	signingKeyId: string;
	preimageDigest: string;
	signature: string;
};

export type Callsequence = number;

export type Minutetimestamp = string;

export type Digestkey = {
	keyId: string;
	scope: "run";
	algorithm: "hmac-sha-256";
	canonicalization: "rfc8785-jcs";
};

export type Window = {
	sequence: number;
	windowSize: number;
	firstCallSequence: number;
	lastCallSequence: number;
	final: boolean;
};

export type Entry = {
	toolName: string;
	argsDigest: string;
	resultDigest: string;
	outcome: "ok" | "empty" | "error";
	count: number;
	firstCallSequence: number;
	lastCallSequence: number;
};
