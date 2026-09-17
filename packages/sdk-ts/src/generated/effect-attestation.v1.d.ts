/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiEffectattestationV1 = {
	schemaVersion: "libre-ai.effect-attestation.v1";
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
	effectId: string;
	effectEmissionId: string;
	effectRequestDigest: string;
	destinationRef: { id: string; digest: string; mediaType: string };
	executorProfileRef: { id: string; digest: string; mediaType: string };
	fencingValue: null | number;
	executorIdempotencyEvidence: null | {
		id: string;
		digest: string;
		mediaType: string;
	};
	status:
		| "reserved"
		| "started"
		| "committed"
		| "rejected-final"
		| "not-committed-final"
		| "state-unknown";
	observationRef: null | { id: string; digest: string; mediaType: string };
	reservedAt: string;
	observedAt: null | string;
	signingKeyId: string;
	preimageDigest: string;
	signature: string;
} & (
	| {
			fencingValue?: number;
			executorIdempotencyEvidence?: null;
			[key: string]: unknown;
	  }
	| {
			fencingValue?: null;
			executorIdempotencyEvidence?: {
				id: string;
				digest: string;
				mediaType: string;
			};
			[key: string]: unknown;
	  }
);
