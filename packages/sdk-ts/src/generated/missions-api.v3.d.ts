/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiMissionsApiV3Candidate =
	| {
			handoff: { id: string; documentDigest: string };
			budgets: {
				maxDurationSeconds: number;
				maxToolCalls: number;
				maxInputTokens: number;
				maxOutputTokens: number;
				network: "none" | "private-gateway-only";
			};
	  }
	| (
			| {
					command: "assess-risk";
					reasonCode: string;
					riskLevel: "low" | "medium" | "high" | "critical";
			  }
			| {
					command: "answer-decision";
					reasonCode: string;
					response: {
						schemaVersion: "libre-ai.human-decision-response.v1";
						id: string;
						organizationId: string;
						missionId: string;
						runId: string;
						stepId: string;
						attemptId: string;
						requestId: string;
						requestDigest: string;
						choiceId: string;
						actorAuthorization: {
							role: string;
							approvedAt: string;
							reference: string;
							subjectDigest: string;
						};
						expectedRevision: number;
						idempotencyKey: string;
						commentArtifactRef: null | {
							id: string;
							digest: string;
							mediaType: string;
						};
						submittedAt: string;
						responseDigest: string;
					};
			  }
			| { command: "abandon"; reasonCode: string }
			| { command: "export"; reasonCode: string }
			| {
					command: "start";
					reasonCode: string;
					control: {
						schemaVersion: "libre-ai.orchestrator-control.v1";
						id: string;
						tenantId: string;
						missionId: string;
						runId?: string;
						planDigest: string;
						authorizationDigest: string;
						action: "start" | "pause" | "resume" | "cancel";
						expectedRevision: number;
						idempotencyKey: string;
						reasonCode: string;
						issuedAt: string;
						expiresAt: string;
					} & { action: "start"; [key: string]: unknown };
			  }
			| {
					command: "pause";
					reasonCode: string;
					control: {
						schemaVersion: "libre-ai.orchestrator-control.v1";
						id: string;
						tenantId: string;
						missionId: string;
						runId?: string;
						planDigest: string;
						authorizationDigest: string;
						action: "start" | "pause" | "resume" | "cancel";
						expectedRevision: number;
						idempotencyKey: string;
						reasonCode: string;
						issuedAt: string;
						expiresAt: string;
					} & { action: "pause"; [key: string]: unknown };
			  }
			| {
					command: "resume";
					reasonCode: string;
					control: {
						schemaVersion: "libre-ai.orchestrator-control.v1";
						id: string;
						tenantId: string;
						missionId: string;
						runId?: string;
						planDigest: string;
						authorizationDigest: string;
						action: "start" | "pause" | "resume" | "cancel";
						expectedRevision: number;
						idempotencyKey: string;
						reasonCode: string;
						issuedAt: string;
						expiresAt: string;
					} & { action: "resume"; [key: string]: unknown };
			  }
			| {
					command: "cancel";
					reasonCode: string;
					control: {
						schemaVersion: "libre-ai.orchestrator-control.v1";
						id: string;
						tenantId: string;
						missionId: string;
						runId?: string;
						planDigest: string;
						authorizationDigest: string;
						action: "start" | "pause" | "resume" | "cancel";
						expectedRevision: number;
						idempotencyKey: string;
						reasonCode: string;
						issuedAt: string;
						expiresAt: string;
					} & { action: "cancel"; [key: string]: unknown };
			  }
	  )
	| {
			data: {
				schemaVersion: "libre-ai.mission-record.v3";
				id: string;
				tenantId: string;
				revision: number;
				state:
					| "proposed"
					| "assessed"
					| "plan-review"
					| "plan-rejected"
					| "authorized"
					| "running"
					| "blocked"
					| "paused"
					| "cancelled"
					| "result-submitted"
					| "result-review"
					| "validated"
					| "rejected"
					| "failed"
					| "abandoned";
				risk?: {
					level: "low" | "medium" | "high" | "critical";
					policyVersion: string;
				};
				budgets: {
					maxDurationSeconds: number;
					maxToolCalls: number;
					maxInputTokens: number;
					maxOutputTokens: number;
					network: "none" | "private-gateway-only";
				};
				acceptanceCriteria: Array<string>;
				plan?: { id: string; digest: string; mediaType: string };
				planQuorum?: { id: string; digest: string; mediaType: string };
				executionAuthorization?: {
					id: string;
					digest: string;
					mediaType: string;
				};
				planReviewOutcome?: {
					status: "rejected";
					rejectionReview: { id: string; digest: string; mediaType: string };
					reasonCode: string;
					decidedAt: string;
				};
				protectedHumanGate?: {
					role: string;
					approvedAt: string;
					reference: string;
					subjectDigest: string;
				};
				runId?: string;
				runHarnessAttestation?: {
					id: string;
					digest: string;
					mediaType: string;
				};
				reviews: Array<{ id: string; digest: string; mediaType: string }>;
				eventCursor: number;
				result?: {
					artifact: { id: string; digest: string; mediaType: string };
					evidence: { id: string; digest: string; mediaType: string };
					contributorLineage: { id: string; digest: string; mediaType: string };
					submittedAt: string;
				};
				resultQuorum?: { id: string; digest: string; mediaType: string };
				validation?: {
					status: "validated" | "rejected" | "abandoned";
					rejectionReview?: { id: string; digest: string; mediaType: string };
					reasonCode: string;
					decidedAt: string;
				};
				createdAt: string;
				handoffBinding: {
					schemaVersion: "libre-ai.mission-handoff-binding.v1";
					tenantId: string;
					handoff: {
						schemaVersion: "libre-ai.agent-handoff.v2";
						id: string;
						documentDigest: string;
						archiveReference: {
							id: string;
							digest: string;
							mediaType: "application/json";
						};
					};
					specPackage: {
						schemaVersion: "libre-ai.spec-package.v2";
						id: string;
						version: number;
						bodyDigest: string;
					};
					acceptanceDigest: string;
					acceptanceCriteria: Array<string>;
				};
				handoffBindingDigest: string;
				handoffReferenceId: string;
			};
			meta: { requestId: string; revision: number };
	  }
	| {
			data: Array<{
				schemaVersion: "libre-ai.mission-record.v3";
				id: string;
				tenantId: string;
				revision: number;
				state:
					| "proposed"
					| "assessed"
					| "plan-review"
					| "plan-rejected"
					| "authorized"
					| "running"
					| "blocked"
					| "paused"
					| "cancelled"
					| "result-submitted"
					| "result-review"
					| "validated"
					| "rejected"
					| "failed"
					| "abandoned";
				risk?: {
					level: "low" | "medium" | "high" | "critical";
					policyVersion: string;
				};
				budgets: {
					maxDurationSeconds: number;
					maxToolCalls: number;
					maxInputTokens: number;
					maxOutputTokens: number;
					network: "none" | "private-gateway-only";
				};
				acceptanceCriteria: Array<string>;
				plan?: { id: string; digest: string; mediaType: string };
				planQuorum?: { id: string; digest: string; mediaType: string };
				executionAuthorization?: {
					id: string;
					digest: string;
					mediaType: string;
				};
				planReviewOutcome?: {
					status: "rejected";
					rejectionReview: { id: string; digest: string; mediaType: string };
					reasonCode: string;
					decidedAt: string;
				};
				protectedHumanGate?: {
					role: string;
					approvedAt: string;
					reference: string;
					subjectDigest: string;
				};
				runId?: string;
				runHarnessAttestation?: {
					id: string;
					digest: string;
					mediaType: string;
				};
				reviews: Array<{ id: string; digest: string; mediaType: string }>;
				eventCursor: number;
				result?: {
					artifact: { id: string; digest: string; mediaType: string };
					evidence: { id: string; digest: string; mediaType: string };
					contributorLineage: { id: string; digest: string; mediaType: string };
					submittedAt: string;
				};
				resultQuorum?: { id: string; digest: string; mediaType: string };
				validation?: {
					status: "validated" | "rejected" | "abandoned";
					rejectionReview?: { id: string; digest: string; mediaType: string };
					reasonCode: string;
					decidedAt: string;
				};
				createdAt: string;
				handoffBinding: {
					schemaVersion: "libre-ai.mission-handoff-binding.v1";
					tenantId: string;
					handoff: {
						schemaVersion: "libre-ai.agent-handoff.v2";
						id: string;
						documentDigest: string;
						archiveReference: {
							id: string;
							digest: string;
							mediaType: "application/json";
						};
					};
					specPackage: {
						schemaVersion: "libre-ai.spec-package.v2";
						id: string;
						version: number;
						bodyDigest: string;
					};
					acceptanceDigest: string;
					acceptanceCriteria: Array<string>;
				};
				handoffBindingDigest: string;
				handoffReferenceId: string;
			}>;
			meta: { requestId: string; revision: number; nextCursor: null | string };
	  }
	| {
			data: Array<{
				schemaVersion: "libre-ai.orchestrator-event.v2";
				id: string;
				tenantId: string;
				missionId: string;
				runId: string;
				orchestratorId: string;
				planDigest: string;
				authorizationDigest: string;
				sequence: number;
				previousEventDigest: null | string;
				causationId: null | string;
				commandId?: string;
				attempt: number;
				type:
					| "started"
					| "progressed"
					| "blocked"
					| "decision-requested"
					| "paused"
					| "resumed"
					| "budget-exceeded"
					| "cancelled"
					| "result-submitted"
					| "failed";
				budgetDelta: {
					durationSeconds: number;
					toolCalls: number;
					inputTokens: number;
					outputTokens: number;
					processesStarted: number;
					filesChanged: number;
					changedBytes: number;
				};
				budgetTotal: {
					durationSeconds: number;
					toolCalls: number;
					inputTokens: number;
					outputTokens: number;
					processesStarted: number;
					filesChanged: number;
					changedBytes: number;
				};
				occurredAt: string;
				data: {
					reasonCode?: string;
					progressPermille?: number;
					decisionRequestId?: string;
					artifact?: { id: string; digest: string; mediaType: string };
					evidence?: { id: string; digest: string; mediaType: string };
					contributorLineage?: {
						id: string;
						digest: string;
						mediaType: string;
					};
					harnessAttestation?: {
						id: string;
						digest: string;
						mediaType: string;
					};
				};
				eventDigest: string;
			}>;
			meta: { requestId: string; revision: number; nextCursor: null | string };
	  }
	| {
			data: {
				schemaVersion: "libre-ai.agent-review-quorum-view.v1";
				tenantId: string;
				missionId: string;
				subjectType: "execution-plan" | "mission-result";
				subjectDigest: string;
				quorumDigest: string;
				identityMode: "redacted" | "need-to-know";
				reviewers: Array<{
					reviewDigest: string;
					reviewerAgentId?: string;
					verdict: "approve";
					summary: Array<{
						code: string;
						severity: "minor" | "info";
						count: number;
					}>;
				}>;
				contributorCount: number;
				contributorAgentIds?: Array<string>;
				retentionPolicyId: "mission-record";
				retentionExpiresAt: string;
			};
			meta: { requestId: string; revision: number };
	  }
	| {
			data:
				| {
						view: "open-decisions";
						items: Array<{
							schemaVersion: "libre-ai.human-decision-request.v1";
							id: string;
							organizationId: string;
							missionId: string;
							runId: string;
							planDigest: string;
							graphDigest: string;
							stepId: string;
							attemptId: string;
							choices: Array<{
								choiceId: string;
								label: string;
								consequenceCode: string;
							}>;
							requiredRole: string;
							expectedRevision: number;
							expiresAt: string;
							noResponseOutcomeCode: string;
							evidenceRefs: Array<{
								id: string;
								digest: string;
								mediaType: string;
							}>;
							requestDigest: string;
						}>;
				  }
				| {
						view: "result-evidence";
						items: Array<{ id: string; digest: string; mediaType: string }>;
				  }
				| {
						view: "export";
						items: Array<{
							schemaVersion: "libre-ai.mission-record.v3";
							id: string;
							tenantId: string;
							revision: number;
							state:
								| "proposed"
								| "assessed"
								| "plan-review"
								| "plan-rejected"
								| "authorized"
								| "running"
								| "blocked"
								| "paused"
								| "cancelled"
								| "result-submitted"
								| "result-review"
								| "validated"
								| "rejected"
								| "failed"
								| "abandoned";
							risk?: {
								level: "low" | "medium" | "high" | "critical";
								policyVersion: string;
							};
							budgets: {
								maxDurationSeconds: number;
								maxToolCalls: number;
								maxInputTokens: number;
								maxOutputTokens: number;
								network: "none" | "private-gateway-only";
							};
							acceptanceCriteria: Array<string>;
							plan?: { id: string; digest: string; mediaType: string };
							planQuorum?: { id: string; digest: string; mediaType: string };
							executionAuthorization?: {
								id: string;
								digest: string;
								mediaType: string;
							};
							planReviewOutcome?: {
								status: "rejected";
								rejectionReview: {
									id: string;
									digest: string;
									mediaType: string;
								};
								reasonCode: string;
								decidedAt: string;
							};
							protectedHumanGate?: {
								role: string;
								approvedAt: string;
								reference: string;
								subjectDigest: string;
							};
							runId?: string;
							runHarnessAttestation?: {
								id: string;
								digest: string;
								mediaType: string;
							};
							reviews: Array<{ id: string; digest: string; mediaType: string }>;
							eventCursor: number;
							result?: {
								artifact: { id: string; digest: string; mediaType: string };
								evidence: { id: string; digest: string; mediaType: string };
								contributorLineage: {
									id: string;
									digest: string;
									mediaType: string;
								};
								submittedAt: string;
							};
							resultQuorum?: { id: string; digest: string; mediaType: string };
							validation?: {
								status: "validated" | "rejected" | "abandoned";
								rejectionReview?: {
									id: string;
									digest: string;
									mediaType: string;
								};
								reasonCode: string;
								decidedAt: string;
							};
							createdAt: string;
							handoffBinding: {
								schemaVersion: "libre-ai.mission-handoff-binding.v1";
								tenantId: string;
								handoff: {
									schemaVersion: "libre-ai.agent-handoff.v2";
									id: string;
									documentDigest: string;
									archiveReference: {
										id: string;
										digest: string;
										mediaType: "application/json";
									};
								};
								specPackage: {
									schemaVersion: "libre-ai.spec-package.v2";
									id: string;
									version: number;
									bodyDigest: string;
								};
								acceptanceDigest: string;
								acceptanceCriteria: Array<string>;
							};
							handoffBindingDigest: string;
							handoffReferenceId: string;
						}>;
				  };
			meta: { requestId: string; revision: number; nextCursor: null | string };
	  }
	| {
			data: null;
			meta: {
				requestId: string;
				code: "mission.http_400";
				message: "Request refused";
			};
	  }
	| {
			data: null;
			meta: {
				requestId: string;
				code: "mission.http_401";
				message: "Request refused";
			};
	  }
	| {
			data: null;
			meta: {
				requestId: string;
				code: "mission.http_403";
				message: "Request refused";
			};
	  }
	| {
			data: null;
			meta: {
				requestId: string;
				code: "mission.http_404";
				message: "Request refused";
			};
	  }
	| {
			data: null;
			meta: {
				requestId: string;
				code: "mission.http_405";
				message: "Request refused";
			};
	  }
	| {
			data: null;
			meta: {
				requestId: string;
				code: "mission.http_409";
				message: "Request refused";
			};
	  }
	| {
			data: null;
			meta: {
				requestId: string;
				code: "mission.http_412";
				message: "Request refused";
			};
	  }
	| {
			data: null;
			meta: {
				requestId: string;
				code: "mission.http_413";
				message: "Request refused";
			};
	  }
	| {
			data: null;
			meta: {
				requestId: string;
				code: "mission.http_415";
				message: "Request refused";
			};
	  }
	| {
			data: null;
			meta: {
				requestId: string;
				code: "mission.http_422";
				message: "Request refused";
			};
	  }
	| {
			data: null;
			meta: {
				requestId: string;
				code: "mission.http_503";
				message: "Request refused";
			};
	  };

export type Proposerequest = {
	handoff: { id: string; documentDigest: string };
	budgets: {
		maxDurationSeconds: number;
		maxToolCalls: number;
		maxInputTokens: number;
		maxOutputTokens: number;
		network: "none" | "private-gateway-only";
	};
};

export type Commandrequest =
	| {
			command: "assess-risk";
			reasonCode: string;
			riskLevel: "low" | "medium" | "high" | "critical";
	  }
	| {
			command: "answer-decision";
			reasonCode: string;
			response: {
				schemaVersion: "libre-ai.human-decision-response.v1";
				id: string;
				organizationId: string;
				missionId: string;
				runId: string;
				stepId: string;
				attemptId: string;
				requestId: string;
				requestDigest: string;
				choiceId: string;
				actorAuthorization: {
					role: string;
					approvedAt: string;
					reference: string;
					subjectDigest: string;
				};
				expectedRevision: number;
				idempotencyKey: string;
				commentArtifactRef: null | {
					id: string;
					digest: string;
					mediaType: string;
				};
				submittedAt: string;
				responseDigest: string;
			};
	  }
	| { command: "abandon"; reasonCode: string }
	| { command: "export"; reasonCode: string }
	| {
			command: "start";
			reasonCode: string;
			control: {
				schemaVersion: "libre-ai.orchestrator-control.v1";
				id: string;
				tenantId: string;
				missionId: string;
				runId?: string;
				planDigest: string;
				authorizationDigest: string;
				action: "start" | "pause" | "resume" | "cancel";
				expectedRevision: number;
				idempotencyKey: string;
				reasonCode: string;
				issuedAt: string;
				expiresAt: string;
			} & { action: "start"; [key: string]: unknown };
	  }
	| {
			command: "pause";
			reasonCode: string;
			control: {
				schemaVersion: "libre-ai.orchestrator-control.v1";
				id: string;
				tenantId: string;
				missionId: string;
				runId?: string;
				planDigest: string;
				authorizationDigest: string;
				action: "start" | "pause" | "resume" | "cancel";
				expectedRevision: number;
				idempotencyKey: string;
				reasonCode: string;
				issuedAt: string;
				expiresAt: string;
			} & { action: "pause"; [key: string]: unknown };
	  }
	| {
			command: "resume";
			reasonCode: string;
			control: {
				schemaVersion: "libre-ai.orchestrator-control.v1";
				id: string;
				tenantId: string;
				missionId: string;
				runId?: string;
				planDigest: string;
				authorizationDigest: string;
				action: "start" | "pause" | "resume" | "cancel";
				expectedRevision: number;
				idempotencyKey: string;
				reasonCode: string;
				issuedAt: string;
				expiresAt: string;
			} & { action: "resume"; [key: string]: unknown };
	  }
	| {
			command: "cancel";
			reasonCode: string;
			control: {
				schemaVersion: "libre-ai.orchestrator-control.v1";
				id: string;
				tenantId: string;
				missionId: string;
				runId?: string;
				planDigest: string;
				authorizationDigest: string;
				action: "start" | "pause" | "resume" | "cancel";
				expectedRevision: number;
				idempotencyKey: string;
				reasonCode: string;
				issuedAt: string;
				expiresAt: string;
			} & { action: "cancel"; [key: string]: unknown };
	  };

export type Missionresponse = {
	data: {
		schemaVersion: "libre-ai.mission-record.v3";
		id: string;
		tenantId: string;
		revision: number;
		state:
			| "proposed"
			| "assessed"
			| "plan-review"
			| "plan-rejected"
			| "authorized"
			| "running"
			| "blocked"
			| "paused"
			| "cancelled"
			| "result-submitted"
			| "result-review"
			| "validated"
			| "rejected"
			| "failed"
			| "abandoned";
		risk?: {
			level: "low" | "medium" | "high" | "critical";
			policyVersion: string;
		};
		budgets: {
			maxDurationSeconds: number;
			maxToolCalls: number;
			maxInputTokens: number;
			maxOutputTokens: number;
			network: "none" | "private-gateway-only";
		};
		acceptanceCriteria: Array<string>;
		plan?: { id: string; digest: string; mediaType: string };
		planQuorum?: { id: string; digest: string; mediaType: string };
		executionAuthorization?: { id: string; digest: string; mediaType: string };
		planReviewOutcome?: {
			status: "rejected";
			rejectionReview: { id: string; digest: string; mediaType: string };
			reasonCode: string;
			decidedAt: string;
		};
		protectedHumanGate?: {
			role: string;
			approvedAt: string;
			reference: string;
			subjectDigest: string;
		};
		runId?: string;
		runHarnessAttestation?: { id: string; digest: string; mediaType: string };
		reviews: Array<{ id: string; digest: string; mediaType: string }>;
		eventCursor: number;
		result?: {
			artifact: { id: string; digest: string; mediaType: string };
			evidence: { id: string; digest: string; mediaType: string };
			contributorLineage: { id: string; digest: string; mediaType: string };
			submittedAt: string;
		};
		resultQuorum?: { id: string; digest: string; mediaType: string };
		validation?: {
			status: "validated" | "rejected" | "abandoned";
			rejectionReview?: { id: string; digest: string; mediaType: string };
			reasonCode: string;
			decidedAt: string;
		};
		createdAt: string;
		handoffBinding: {
			schemaVersion: "libre-ai.mission-handoff-binding.v1";
			tenantId: string;
			handoff: {
				schemaVersion: "libre-ai.agent-handoff.v2";
				id: string;
				documentDigest: string;
				archiveReference: {
					id: string;
					digest: string;
					mediaType: "application/json";
				};
			};
			specPackage: {
				schemaVersion: "libre-ai.spec-package.v2";
				id: string;
				version: number;
				bodyDigest: string;
			};
			acceptanceDigest: string;
			acceptanceCriteria: Array<string>;
		};
		handoffBindingDigest: string;
		handoffReferenceId: string;
	};
	meta: { requestId: string; revision: number };
};

export type Missionpageresponse = {
	data: Array<{
		schemaVersion: "libre-ai.mission-record.v3";
		id: string;
		tenantId: string;
		revision: number;
		state:
			| "proposed"
			| "assessed"
			| "plan-review"
			| "plan-rejected"
			| "authorized"
			| "running"
			| "blocked"
			| "paused"
			| "cancelled"
			| "result-submitted"
			| "result-review"
			| "validated"
			| "rejected"
			| "failed"
			| "abandoned";
		risk?: {
			level: "low" | "medium" | "high" | "critical";
			policyVersion: string;
		};
		budgets: {
			maxDurationSeconds: number;
			maxToolCalls: number;
			maxInputTokens: number;
			maxOutputTokens: number;
			network: "none" | "private-gateway-only";
		};
		acceptanceCriteria: Array<string>;
		plan?: { id: string; digest: string; mediaType: string };
		planQuorum?: { id: string; digest: string; mediaType: string };
		executionAuthorization?: { id: string; digest: string; mediaType: string };
		planReviewOutcome?: {
			status: "rejected";
			rejectionReview: { id: string; digest: string; mediaType: string };
			reasonCode: string;
			decidedAt: string;
		};
		protectedHumanGate?: {
			role: string;
			approvedAt: string;
			reference: string;
			subjectDigest: string;
		};
		runId?: string;
		runHarnessAttestation?: { id: string; digest: string; mediaType: string };
		reviews: Array<{ id: string; digest: string; mediaType: string }>;
		eventCursor: number;
		result?: {
			artifact: { id: string; digest: string; mediaType: string };
			evidence: { id: string; digest: string; mediaType: string };
			contributorLineage: { id: string; digest: string; mediaType: string };
			submittedAt: string;
		};
		resultQuorum?: { id: string; digest: string; mediaType: string };
		validation?: {
			status: "validated" | "rejected" | "abandoned";
			rejectionReview?: { id: string; digest: string; mediaType: string };
			reasonCode: string;
			decidedAt: string;
		};
		createdAt: string;
		handoffBinding: {
			schemaVersion: "libre-ai.mission-handoff-binding.v1";
			tenantId: string;
			handoff: {
				schemaVersion: "libre-ai.agent-handoff.v2";
				id: string;
				documentDigest: string;
				archiveReference: {
					id: string;
					digest: string;
					mediaType: "application/json";
				};
			};
			specPackage: {
				schemaVersion: "libre-ai.spec-package.v2";
				id: string;
				version: number;
				bodyDigest: string;
			};
			acceptanceDigest: string;
			acceptanceCriteria: Array<string>;
		};
		handoffBindingDigest: string;
		handoffReferenceId: string;
	}>;
	meta: { requestId: string; revision: number; nextCursor: null | string };
};

export type Eventpageresponse = {
	data: Array<{
		schemaVersion: "libre-ai.orchestrator-event.v2";
		id: string;
		tenantId: string;
		missionId: string;
		runId: string;
		orchestratorId: string;
		planDigest: string;
		authorizationDigest: string;
		sequence: number;
		previousEventDigest: null | string;
		causationId: null | string;
		commandId?: string;
		attempt: number;
		type:
			| "started"
			| "progressed"
			| "blocked"
			| "decision-requested"
			| "paused"
			| "resumed"
			| "budget-exceeded"
			| "cancelled"
			| "result-submitted"
			| "failed";
		budgetDelta: {
			durationSeconds: number;
			toolCalls: number;
			inputTokens: number;
			outputTokens: number;
			processesStarted: number;
			filesChanged: number;
			changedBytes: number;
		};
		budgetTotal: {
			durationSeconds: number;
			toolCalls: number;
			inputTokens: number;
			outputTokens: number;
			processesStarted: number;
			filesChanged: number;
			changedBytes: number;
		};
		occurredAt: string;
		data: {
			reasonCode?: string;
			progressPermille?: number;
			decisionRequestId?: string;
			artifact?: { id: string; digest: string; mediaType: string };
			evidence?: { id: string; digest: string; mediaType: string };
			contributorLineage?: { id: string; digest: string; mediaType: string };
			harnessAttestation?: { id: string; digest: string; mediaType: string };
		};
		eventDigest: string;
	}>;
	meta: { requestId: string; revision: number; nextCursor: null | string };
};

export type Quorumresponse = {
	data: {
		schemaVersion: "libre-ai.agent-review-quorum-view.v1";
		tenantId: string;
		missionId: string;
		subjectType: "execution-plan" | "mission-result";
		subjectDigest: string;
		quorumDigest: string;
		identityMode: "redacted" | "need-to-know";
		reviewers: Array<{
			reviewDigest: string;
			reviewerAgentId?: string;
			verdict: "approve";
			summary: Array<{
				code: string;
				severity: "minor" | "info";
				count: number;
			}>;
		}>;
		contributorCount: number;
		contributorAgentIds?: Array<string>;
		retentionPolicyId: "mission-record";
		retentionExpiresAt: string;
	};
	meta: { requestId: string; revision: number };
};

export type Viewresponse = {
	data:
		| {
				view: "open-decisions";
				items: Array<{
					schemaVersion: "libre-ai.human-decision-request.v1";
					id: string;
					organizationId: string;
					missionId: string;
					runId: string;
					planDigest: string;
					graphDigest: string;
					stepId: string;
					attemptId: string;
					choices: Array<{
						choiceId: string;
						label: string;
						consequenceCode: string;
					}>;
					requiredRole: string;
					expectedRevision: number;
					expiresAt: string;
					noResponseOutcomeCode: string;
					evidenceRefs: Array<{
						id: string;
						digest: string;
						mediaType: string;
					}>;
					requestDigest: string;
				}>;
		  }
		| {
				view: "result-evidence";
				items: Array<{ id: string; digest: string; mediaType: string }>;
		  }
		| {
				view: "export";
				items: Array<{
					schemaVersion: "libre-ai.mission-record.v3";
					id: string;
					tenantId: string;
					revision: number;
					state:
						| "proposed"
						| "assessed"
						| "plan-review"
						| "plan-rejected"
						| "authorized"
						| "running"
						| "blocked"
						| "paused"
						| "cancelled"
						| "result-submitted"
						| "result-review"
						| "validated"
						| "rejected"
						| "failed"
						| "abandoned";
					risk?: {
						level: "low" | "medium" | "high" | "critical";
						policyVersion: string;
					};
					budgets: {
						maxDurationSeconds: number;
						maxToolCalls: number;
						maxInputTokens: number;
						maxOutputTokens: number;
						network: "none" | "private-gateway-only";
					};
					acceptanceCriteria: Array<string>;
					plan?: { id: string; digest: string; mediaType: string };
					planQuorum?: { id: string; digest: string; mediaType: string };
					executionAuthorization?: {
						id: string;
						digest: string;
						mediaType: string;
					};
					planReviewOutcome?: {
						status: "rejected";
						rejectionReview: { id: string; digest: string; mediaType: string };
						reasonCode: string;
						decidedAt: string;
					};
					protectedHumanGate?: {
						role: string;
						approvedAt: string;
						reference: string;
						subjectDigest: string;
					};
					runId?: string;
					runHarnessAttestation?: {
						id: string;
						digest: string;
						mediaType: string;
					};
					reviews: Array<{ id: string; digest: string; mediaType: string }>;
					eventCursor: number;
					result?: {
						artifact: { id: string; digest: string; mediaType: string };
						evidence: { id: string; digest: string; mediaType: string };
						contributorLineage: {
							id: string;
							digest: string;
							mediaType: string;
						};
						submittedAt: string;
					};
					resultQuorum?: { id: string; digest: string; mediaType: string };
					validation?: {
						status: "validated" | "rejected" | "abandoned";
						rejectionReview?: { id: string; digest: string; mediaType: string };
						reasonCode: string;
						decidedAt: string;
					};
					createdAt: string;
					handoffBinding: {
						schemaVersion: "libre-ai.mission-handoff-binding.v1";
						tenantId: string;
						handoff: {
							schemaVersion: "libre-ai.agent-handoff.v2";
							id: string;
							documentDigest: string;
							archiveReference: {
								id: string;
								digest: string;
								mediaType: "application/json";
							};
						};
						specPackage: {
							schemaVersion: "libre-ai.spec-package.v2";
							id: string;
							version: number;
							bodyDigest: string;
						};
						acceptanceDigest: string;
						acceptanceCriteria: Array<string>;
					};
					handoffBindingDigest: string;
					handoffReferenceId: string;
				}>;
		  };
	meta: { requestId: string; revision: number; nextCursor: null | string };
};

export type Problem400 = {
	data: null;
	meta: {
		requestId: string;
		code: "mission.http_400";
		message: "Request refused";
	};
};

export type Problem401 = {
	data: null;
	meta: {
		requestId: string;
		code: "mission.http_401";
		message: "Request refused";
	};
};

export type Problem403 = {
	data: null;
	meta: {
		requestId: string;
		code: "mission.http_403";
		message: "Request refused";
	};
};

export type Problem404 = {
	data: null;
	meta: {
		requestId: string;
		code: "mission.http_404";
		message: "Request refused";
	};
};

export type Problem405 = {
	data: null;
	meta: {
		requestId: string;
		code: "mission.http_405";
		message: "Request refused";
	};
};

export type Problem409 = {
	data: null;
	meta: {
		requestId: string;
		code: "mission.http_409";
		message: "Request refused";
	};
};

export type Problem412 = {
	data: null;
	meta: {
		requestId: string;
		code: "mission.http_412";
		message: "Request refused";
	};
};

export type Problem413 = {
	data: null;
	meta: {
		requestId: string;
		code: "mission.http_413";
		message: "Request refused";
	};
};

export type Problem415 = {
	data: null;
	meta: {
		requestId: string;
		code: "mission.http_415";
		message: "Request refused";
	};
};

export type Problem422 = {
	data: null;
	meta: {
		requestId: string;
		code: "mission.http_422";
		message: "Request refused";
	};
};

export type Problem503 = {
	data: null;
	meta: {
		requestId: string;
		code: "mission.http_503";
		message: "Request refused";
	};
};
