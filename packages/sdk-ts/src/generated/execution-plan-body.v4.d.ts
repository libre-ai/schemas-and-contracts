/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiExecutionPlanBodyV4Candidate = {
	schemaVersion: "libre-ai.execution-plan-body.v4";
	id: string;
	organizationId: string;
	missionId: string;
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
	isolation: {
		realization: "plan-then-execute" | "action-selector";
		toolResultDelivery: "opaque-reference";
		argumentPolicyAuthority: "agent-harness";
		argumentPolicyEvaluation: "per-argument-with-implicit-dependencies";
		argumentPolicyRefusal: "fail-closed-terminal";
	};
	steps: Array<
		{
			stepId: string;
			role: "privileged" | "quarantine";
			tools: Array<{
				name: string;
				access: "read" | "write" | "execute" | "network";
				effectClass: "none" | "effect";
				argumentPolicyDigest: string;
				untrustedArgumentAdmissions: Array<{
					parameter: string;
					sourceStepId: string;
					sourceField: string;
				}>;
				maxCalls: number;
			}>;
			inputs: Array<{
				inputId: string;
				source:
					| { kind: "trusted-request" }
					| {
							kind: "untrusted-content";
							contentRef: { id: string; digest: string; mediaType: string };
					  }
					| { kind: "step-output"; stepId: string };
				provenance: "trusted" | "untrusted";
				delivery: "in-context" | "opaque-reference";
			}>;
			quarantineOutput?: {
				fields: Array<
					{
						name: string;
						kind: "enum" | "identifier" | "boolean" | "integer";
						values?: Array<string>;
						referential?: { id: string; digest: string; mediaType: string };
						minimum?: number;
						maximum?: number;
					} & (
						| {
								kind?: "enum";
								values: unknown;
								referential?: never;
								minimum?: never;
								maximum?: never;
								[key: string]: unknown;
						  }
						| {
								kind?: "identifier";
								referential: unknown;
								values?: never;
								minimum?: never;
								maximum?: never;
								[key: string]: unknown;
						  }
						| {
								kind?: "boolean";
								values?: never;
								referential?: never;
								minimum?: never;
								maximum?: never;
								[key: string]: unknown;
						  }
						| {
								kind?: "integer";
								minimum: unknown;
								maximum: unknown;
								values?: never;
								referential?: never;
								[key: string]: unknown;
						  }
					)
				>;
				failureCodes: Array<string>;
			};
		} & (
			| {
					role?: "privileged";
					quarantineOutput?: never;
					inputs?: Array<{ [key: string]: unknown }>;
					[key: string]: unknown;
			  }
			| {
					role?: "quarantine";
					tools?: Array<unknown>;
					quarantineOutput: unknown;
					[key: string]: unknown;
			  }
		)
	>;
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
	handoffBindingSchemaVersion: "libre-ai.mission-handoff-binding.v1";
	handoffBindingDigest: string;
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

export type Quarantineclosedfield = {
	name: string;
	kind: "enum" | "identifier" | "boolean" | "integer";
	values?: Array<string>;
	referential?: { id: string; digest: string; mediaType: string };
	minimum?: number;
	maximum?: number;
} & (
	| {
			kind?: "enum";
			values: unknown;
			referential?: never;
			minimum?: never;
			maximum?: never;
			[key: string]: unknown;
	  }
	| {
			kind?: "identifier";
			referential: unknown;
			values?: never;
			minimum?: never;
			maximum?: never;
			[key: string]: unknown;
	  }
	| {
			kind?: "boolean";
			values?: never;
			referential?: never;
			minimum?: never;
			maximum?: never;
			[key: string]: unknown;
	  }
	| {
			kind?: "integer";
			minimum: unknown;
			maximum: unknown;
			values?: never;
			referential?: never;
			[key: string]: unknown;
	  }
);

export type Quarantineoutput = {
	fields: Array<
		{
			name: string;
			kind: "enum" | "identifier" | "boolean" | "integer";
			values?: Array<string>;
			referential?: { id: string; digest: string; mediaType: string };
			minimum?: number;
			maximum?: number;
		} & (
			| {
					kind?: "enum";
					values: unknown;
					referential?: never;
					minimum?: never;
					maximum?: never;
					[key: string]: unknown;
			  }
			| {
					kind?: "identifier";
					referential: unknown;
					values?: never;
					minimum?: never;
					maximum?: never;
					[key: string]: unknown;
			  }
			| {
					kind?: "boolean";
					values?: never;
					referential?: never;
					minimum?: never;
					maximum?: never;
					[key: string]: unknown;
			  }
			| {
					kind?: "integer";
					minimum: unknown;
					maximum: unknown;
					values?: never;
					referential?: never;
					[key: string]: unknown;
			  }
		)
	>;
	failureCodes: Array<string>;
};

export type Untrustedargumentadmission = {
	parameter: string;
	sourceStepId: string;
	sourceField: string;
};

export type Plansteptool = {
	name: string;
	access: "read" | "write" | "execute" | "network";
	effectClass: "none" | "effect";
	argumentPolicyDigest: string;
	untrustedArgumentAdmissions: Array<{
		parameter: string;
		sourceStepId: string;
		sourceField: string;
	}>;
	maxCalls: number;
};

export type Stepinputorigin =
	| { kind: "trusted-request" }
	| {
			kind: "untrusted-content";
			contentRef: { id: string; digest: string; mediaType: string };
	  }
	| { kind: "step-output"; stepId: string };

export type Planstepinput = {
	inputId: string;
	source:
		| { kind: "trusted-request" }
		| {
				kind: "untrusted-content";
				contentRef: { id: string; digest: string; mediaType: string };
		  }
		| { kind: "step-output"; stepId: string };
	provenance: "trusted" | "untrusted";
	delivery: "in-context" | "opaque-reference";
};

export type Planstep = {
	stepId: string;
	role: "privileged" | "quarantine";
	tools: Array<{
		name: string;
		access: "read" | "write" | "execute" | "network";
		effectClass: "none" | "effect";
		argumentPolicyDigest: string;
		untrustedArgumentAdmissions: Array<{
			parameter: string;
			sourceStepId: string;
			sourceField: string;
		}>;
		maxCalls: number;
	}>;
	inputs: Array<{
		inputId: string;
		source:
			| { kind: "trusted-request" }
			| {
					kind: "untrusted-content";
					contentRef: { id: string; digest: string; mediaType: string };
			  }
			| { kind: "step-output"; stepId: string };
		provenance: "trusted" | "untrusted";
		delivery: "in-context" | "opaque-reference";
	}>;
	quarantineOutput?: {
		fields: Array<
			{
				name: string;
				kind: "enum" | "identifier" | "boolean" | "integer";
				values?: Array<string>;
				referential?: { id: string; digest: string; mediaType: string };
				minimum?: number;
				maximum?: number;
			} & (
				| {
						kind?: "enum";
						values: unknown;
						referential?: never;
						minimum?: never;
						maximum?: never;
						[key: string]: unknown;
				  }
				| {
						kind?: "identifier";
						referential: unknown;
						values?: never;
						minimum?: never;
						maximum?: never;
						[key: string]: unknown;
				  }
				| {
						kind?: "boolean";
						values?: never;
						referential?: never;
						minimum?: never;
						maximum?: never;
						[key: string]: unknown;
				  }
				| {
						kind?: "integer";
						minimum: unknown;
						maximum: unknown;
						values?: never;
						referential?: never;
						[key: string]: unknown;
				  }
			)
		>;
		failureCodes: Array<string>;
	};
} & (
	| {
			role?: "privileged";
			quarantineOutput?: never;
			inputs?: Array<{ [key: string]: unknown }>;
			[key: string]: unknown;
	  }
	| {
			role?: "quarantine";
			tools?: Array<unknown>;
			quarantineOutput: unknown;
			[key: string]: unknown;
	  }
);

export type Planisolation = {
	realization: "plan-then-execute" | "action-selector";
	toolResultDelivery: "opaque-reference";
	argumentPolicyAuthority: "agent-harness";
	argumentPolicyEvaluation: "per-argument-with-implicit-dependencies";
	argumentPolicyRefusal: "fail-closed-terminal";
};
