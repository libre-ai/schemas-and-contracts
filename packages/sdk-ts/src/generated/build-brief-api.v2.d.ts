/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiSpecificationsHttpV2Candidate = {
	data: {
		schemaVersion: "libre-ai.spec-package.v2";
		body: {
			schemaVersion: "libre-ai.build-brief-body.v2";
			id: string;
			tenantId: string;
			version: number;
			problem: string;
			actors: Array<string>;
			requirements: Array<{
				id: string;
				text: string;
				priority: "must" | "should" | "could";
			}>;
			decisions: Array<{ id: string; status: "accepted"; decision: string }>;
			contracts: Array<string>;
			risks: Array<{
				id: string;
				severity: "low" | "medium" | "high" | "critical";
				control: string;
			}>;
			acceptanceCriteria: Array<{
				id: string;
				observable: string;
				evidenceRule: string;
			}>;
			contributors: Array<string>;
		};
		bodyDigest: string;
		acceptances: Array<{
			schemaVersion: "libre-ai.build-brief-acceptance.v2";
			statement: {
				schemaVersion: "libre-ai.build-brief-acceptance-statement.v2";
				id: string;
				tenantId: string;
				specPackageId: string;
				specPackageVersion: number;
				subjectDigest: string;
				approverId: string;
				role: "build-brief-approver";
				acceptedAt: string;
				membershipRevision: number;
				policyDigest: string;
				signingKeyId: string;
			};
			signature: string;
		}>;
	};
	meta: { requestId: string; revision: number };
};

export type Meta = { requestId: string; revision: number };

export type Workspace = {
	tenantId: string;
	problem: string;
	actors: Array<string>;
	requirements: Array<{
		id: string;
		text: string;
		priority: "must" | "should" | "could";
	}>;
	decisions: Array<{
		id: string;
		status: "open" | "accepted" | "rejected";
		decision: string;
	}>;
	contracts: Array<string>;
	risks: Array<{
		id: string;
		severity: "low" | "medium" | "high" | "critical";
		control: string;
	}>;
	acceptanceCriteria: Array<{
		id: string;
		observable: string;
		evidenceRule: string;
	}>;
	contributors: Array<string>;
	id: string;
	revision: number;
	status: "draft" | "submitted" | "accepted" | "superseded";
};

export type Createrequest = { problem: string; actors: Array<string> };

export type Acceptrequest = {
	body: {
		schemaVersion: "libre-ai.build-brief-body.v2";
		id: string;
		tenantId: string;
		version: number;
		problem: string;
		actors: Array<string>;
		requirements: Array<{
			id: string;
			text: string;
			priority: "must" | "should" | "could";
		}>;
		decisions: Array<{ id: string; status: "accepted"; decision: string }>;
		contracts: Array<string>;
		risks: Array<{
			id: string;
			severity: "low" | "medium" | "high" | "critical";
			control: string;
		}>;
		acceptanceCriteria: Array<{
			id: string;
			observable: string;
			evidenceRule: string;
		}>;
		contributors: Array<string>;
	};
	acceptance: {
		schemaVersion: "libre-ai.build-brief-acceptance.v2";
		statement: {
			schemaVersion: "libre-ai.build-brief-acceptance-statement.v2";
			id: string;
			tenantId: string;
			specPackageId: string;
			specPackageVersion: number;
			subjectDigest: string;
			approverId: string;
			role: "build-brief-approver";
			acceptedAt: string;
			membershipRevision: number;
			policyDigest: string;
			signingKeyId: string;
		};
		signature: string;
	};
};

export type Commandrequest =
	| {
			command: "add-requirement";
			id: string;
			text: string;
			priority: "must" | "should" | "could";
	  }
	| { command: "record-decision"; id: string; decision: string }
	| { command: "resolve-decision"; id: string; status: "accepted" | "rejected" }
	| { command: "attach-contract"; contractId: string }
	| {
			command: "define-acceptance";
			id: string;
			observable: string;
			evidenceRule: string;
	  }
	| { command: "submit-review" }
	| { command: "review"; status: "accepted" | "rejected" }
	| {
			command: "supersede";
			successorPackageId: string;
			successorPackageVersion: number;
			successorBodyDigest: string;
	  };

export type Exportrequest = { command: "export" };

export type Handoffrequest = {
	handoff: {
		schemaVersion: "libre-ai.agent-handoff.v2";
		id: string;
		tenantId: string;
		specPackageId: string;
		specPackageDigest: string;
		capabilities: Array<"plan">;
		acceptanceCriteria: Array<string>;
		evidenceReports?: Array<{ id: string; digest: string; mediaType: string }>;
		createdAt: string;
		expiresAt: string;
		specPackageVersion: number;
		acceptanceDigest: string;
	};
};

export type Workspaceresponse = {
	data: {
		tenantId: string;
		problem: string;
		actors: Array<string>;
		requirements: Array<{
			id: string;
			text: string;
			priority: "must" | "should" | "could";
		}>;
		decisions: Array<{
			id: string;
			status: "open" | "accepted" | "rejected";
			decision: string;
		}>;
		contracts: Array<string>;
		risks: Array<{
			id: string;
			severity: "low" | "medium" | "high" | "critical";
			control: string;
		}>;
		acceptanceCriteria: Array<{
			id: string;
			observable: string;
			evidenceRule: string;
		}>;
		contributors: Array<string>;
		id: string;
		revision: number;
		status: "draft" | "submitted" | "accepted" | "superseded";
	};
	meta: { requestId: string; revision: number };
};

export type Packageresponse = {
	data: {
		schemaVersion: "libre-ai.spec-package.v2";
		body: {
			schemaVersion: "libre-ai.build-brief-body.v2";
			id: string;
			tenantId: string;
			version: number;
			problem: string;
			actors: Array<string>;
			requirements: Array<{
				id: string;
				text: string;
				priority: "must" | "should" | "could";
			}>;
			decisions: Array<{ id: string; status: "accepted"; decision: string }>;
			contracts: Array<string>;
			risks: Array<{
				id: string;
				severity: "low" | "medium" | "high" | "critical";
				control: string;
			}>;
			acceptanceCriteria: Array<{
				id: string;
				observable: string;
				evidenceRule: string;
			}>;
			contributors: Array<string>;
		};
		bodyDigest: string;
		acceptances: Array<{
			schemaVersion: "libre-ai.build-brief-acceptance.v2";
			statement: {
				schemaVersion: "libre-ai.build-brief-acceptance-statement.v2";
				id: string;
				tenantId: string;
				specPackageId: string;
				specPackageVersion: number;
				subjectDigest: string;
				approverId: string;
				role: "build-brief-approver";
				acceptedAt: string;
				membershipRevision: number;
				policyDigest: string;
				signingKeyId: string;
			};
			signature: string;
		}>;
	};
	meta: { requestId: string; revision: number };
};

export type Handoffresponse = {
	data: {
		schemaVersion: "libre-ai.agent-handoff.v2";
		id: string;
		tenantId: string;
		specPackageId: string;
		specPackageDigest: string;
		capabilities: Array<"plan">;
		acceptanceCriteria: Array<string>;
		evidenceReports?: Array<{ id: string; digest: string; mediaType: string }>;
		createdAt: string;
		expiresAt: string;
		specPackageVersion: number;
		acceptanceDigest: string;
	};
	meta: { requestId: string; revision: number };
};

export type Cursor = string;

export type Pagemeta = {
	requestId: string;
	revision: number;
	nextCursor: string | null;
};

export type Viewresponse =
	| {
			data: {
				view: "open-decisions";
				items: Array<{ id: string; status: "open"; decision: string }>;
			};
			meta: { requestId: string; revision: number; nextCursor: string | null };
	  }
	| {
			data: {
				view: "validation";
				items: Array<{
					valid: boolean;
					refusals: Array<
						| "build-brief.schema-invalid"
						| "build-brief.digest-invalid"
						| "build-brief.signature-invalid"
						| "build-brief.acceptance-invalid"
						| "build-brief.context-invalid"
						| "build-brief.semantic-invalid"
					>;
				}>;
			};
			meta: {
				requestId: string;
				revision: number;
				nextCursor: string | null;
			} & { nextCursor?: null; [key: string]: unknown };
	  }
	| {
			data: {
				view: "version-diff";
				items: Array<{ path: string; change: "added" | "removed" | "changed" }>;
			};
			meta: { requestId: string; revision: number; nextCursor: string | null };
	  }
	| {
			data: {
				view: "approvals";
				items: Array<{
					schemaVersion: "libre-ai.build-brief-acceptance.v2";
					statement: {
						schemaVersion: "libre-ai.build-brief-acceptance-statement.v2";
						id: string;
						tenantId: string;
						specPackageId: string;
						specPackageVersion: number;
						subjectDigest: string;
						approverId: string;
						role: "build-brief-approver";
						acceptedAt: string;
						membershipRevision: number;
						policyDigest: string;
						signingKeyId: string;
					};
					signature: string;
				}>;
			};
			meta: { requestId: string; revision: number; nextCursor: string | null };
	  };

export type Problem400 = {
	data: null;
	meta: {
		requestId: string;
		code: "build-brief.http_400";
		message: "Request refused";
	};
};

export type Problem401 = {
	data: null;
	meta: {
		requestId: string;
		code: "build-brief.http_401";
		message: "Request refused";
	};
};

export type Problem403 = {
	data: null;
	meta: {
		requestId: string;
		code: "build-brief.http_403";
		message: "Request refused";
	};
};

export type Problem404 = {
	data: null;
	meta: {
		requestId: string;
		code: "build-brief.http_404";
		message: "Request refused";
	};
};

export type Problem405 = {
	data: null;
	meta: {
		requestId: string;
		code: "build-brief.http_405";
		message: "Request refused";
	};
};

export type Problem409 = {
	data: null;
	meta: {
		requestId: string;
		code: "build-brief.http_409";
		message: "Request refused";
	};
};

export type Problem412 = {
	data: null;
	meta: {
		requestId: string;
		code: "build-brief.http_412";
		message: "Request refused";
	};
};

export type Problem413 = {
	data: null;
	meta: {
		requestId: string;
		code: "build-brief.http_413";
		message: "Request refused";
	};
};

export type Problem415 = {
	data: null;
	meta: {
		requestId: string;
		code: "build-brief.http_415";
		message: "Request refused";
	};
};

export type Problem422 = {
	data: null;
	meta: {
		requestId: string;
		code: "build-brief.http_422";
		message: "Request refused";
	};
};

export type Problem503 = {
	data: null;
	meta: {
		requestId: string;
		code: "build-brief.http_503";
		message: "Request refused";
	};
};

export type Acceptancesubjectresponse = {
	data: {
		body: {
			schemaVersion: "libre-ai.build-brief-body.v2";
			id: string;
			tenantId: string;
			version: number;
			problem: string;
			actors: Array<string>;
			requirements: Array<{
				id: string;
				text: string;
				priority: "must" | "should" | "could";
			}>;
			decisions: Array<{ id: string; status: "accepted"; decision: string }>;
			contracts: Array<string>;
			risks: Array<{
				id: string;
				severity: "low" | "medium" | "high" | "critical";
				control: string;
			}>;
			acceptanceCriteria: Array<{
				id: string;
				observable: string;
				evidenceRule: string;
			}>;
			contributors: Array<string>;
		};
		bodyDigest: string;
	};
	meta: { requestId: string; revision: number };
};
