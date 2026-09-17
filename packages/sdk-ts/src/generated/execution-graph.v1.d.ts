/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiExecutiongraphV1 = {
	schemaVersion: "libre-ai.execution-graph.v1";
	id: string;
	organizationId: string;
	entryStepId: string;
	steps: Array<
		{
			stepId: string;
			kind: "calculation" | "human-decision" | "external-effect" | "terminal";
			outcomeCodes: Array<string>;
			retryPolicy?: {
				maximumAttempts: number;
				retryableOutcomeCodes: Array<string>;
			};
			decisionPolicy?: {
				choices: Array<{ choiceId: string; outcomeCode: string }>;
				requiredRole: string;
				expiresAfterSeconds: number;
				noResponseOutcomeCode: string;
				requestSchemaRef: { id: string; digest: string; mediaType: string };
				responseSchemaRef: { id: string; digest: string; mediaType: string };
			};
			effectPolicy?: {
				executorProfileDigest: string;
				reEmissionMode:
					| "retry-with-executor-idempotency"
					| "retry-after-terminal-status-with-fencing"
					| "no-retry";
			};
		} & (
			| {
					kind?: "calculation";
					outcomeCodes?: Array<unknown>;
					retryPolicy: unknown;
					decisionPolicy?: never;
					effectPolicy?: never;
					[key: string]: unknown;
			  }
			| {
					kind?: "human-decision";
					outcomeCodes?: Array<unknown>;
					retryPolicy: unknown;
					decisionPolicy: unknown;
					effectPolicy?: never;
					[key: string]: unknown;
			  }
			| {
					kind?: "external-effect";
					outcomeCodes?: Array<unknown>;
					retryPolicy: unknown;
					effectPolicy: unknown;
					decisionPolicy?: never;
					[key: string]: unknown;
			  }
			| {
					kind?: "terminal";
					outcomeCodes?: Array<unknown>;
					retryPolicy?: never;
					decisionPolicy?: never;
					effectPolicy?: never;
					[key: string]: unknown;
			  }
		)
	>;
	edges: Array<{
		edgeId: string;
		fromStepId: string;
		outcomeCode: string;
		toStepId: string;
	}>;
	createdAt: string;
	graphDigest: string;
};

export type Retrypolicy = {
	maximumAttempts: number;
	retryableOutcomeCodes: Array<string>;
};

export type Decisionpolicy = {
	choices: Array<{ choiceId: string; outcomeCode: string }>;
	requiredRole: string;
	expiresAfterSeconds: number;
	noResponseOutcomeCode: string;
	requestSchemaRef: { id: string; digest: string; mediaType: string };
	responseSchemaRef: { id: string; digest: string; mediaType: string };
};

export type Effectpolicy = {
	executorProfileDigest: string;
	reEmissionMode:
		| "retry-with-executor-idempotency"
		| "retry-after-terminal-status-with-fencing"
		| "no-retry";
};

export type Step = {
	stepId: string;
	kind: "calculation" | "human-decision" | "external-effect" | "terminal";
	outcomeCodes: Array<string>;
	retryPolicy?: {
		maximumAttempts: number;
		retryableOutcomeCodes: Array<string>;
	};
	decisionPolicy?: {
		choices: Array<{ choiceId: string; outcomeCode: string }>;
		requiredRole: string;
		expiresAfterSeconds: number;
		noResponseOutcomeCode: string;
		requestSchemaRef: { id: string; digest: string; mediaType: string };
		responseSchemaRef: { id: string; digest: string; mediaType: string };
	};
	effectPolicy?: {
		executorProfileDigest: string;
		reEmissionMode:
			| "retry-with-executor-idempotency"
			| "retry-after-terminal-status-with-fencing"
			| "no-retry";
	};
} & (
	| {
			kind?: "calculation";
			outcomeCodes?: Array<unknown>;
			retryPolicy: unknown;
			decisionPolicy?: never;
			effectPolicy?: never;
			[key: string]: unknown;
	  }
	| {
			kind?: "human-decision";
			outcomeCodes?: Array<unknown>;
			retryPolicy: unknown;
			decisionPolicy: unknown;
			effectPolicy?: never;
			[key: string]: unknown;
	  }
	| {
			kind?: "external-effect";
			outcomeCodes?: Array<unknown>;
			retryPolicy: unknown;
			effectPolicy: unknown;
			decisionPolicy?: never;
			[key: string]: unknown;
	  }
	| {
			kind?: "terminal";
			outcomeCodes?: Array<unknown>;
			retryPolicy?: never;
			decisionPolicy?: never;
			effectPolicy?: never;
			[key: string]: unknown;
	  }
);

export type Edge = {
	edgeId: string;
	fromStepId: string;
	outcomeCode: string;
	toStepId: string;
};
