/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiSignalementRoutingPolicyV1 = {
	schemaVersion: "libre-ai.signalement-routing-policy.v1";
	organization: string;
	policyId: string;
	version: string;
	destinations: Array<{
		id: string;
		profileId: string;
		target:
			| { kind: "github-repository"; owner: string; repository: string }
			| { kind: "gitlab-project"; projectPath: string }
			| { kind: "jira-project"; siteUrl: string; projectKey: string }
			| {
					kind: "plane-project";
					baseUrl: string;
					workspaceSlug: string;
					projectId: string;
			  };
		residency: "eu" | "non-eu";
		visibilitySource: "discovered" | "declared";
		declaredVisibility?: "public" | "private";
		mediaFallback?: "link" | "withhold";
	}>;
	routingRules: Array<{
		id: string;
		match:
			| { origin: string }
			| { scheme: "https" | "http"; hostPattern: string; port: number | null }
			| { absent: true };
		imposed: Array<string>;
		optional: Array<string>;
		selectable: Array<string>;
		denied: Array<string>;
		override?: "allowed" | "denied";
	}>;
	disclosureRules: Array<{
		id: string;
		roles: Array<"document" | "screenshot" | "video">;
		when:
			| { always: true }
			| { visibility: "public" | "private" }
			| { residency: "eu" | "non-eu" };
		decision: "transmit" | "withhold";
	}>;
};

export type Id = string;

export type Destinationlist = Array<string>;

export type Destination = {
	id: string;
	profileId: string;
	target:
		| { kind: "github-repository"; owner: string; repository: string }
		| { kind: "gitlab-project"; projectPath: string }
		| { kind: "jira-project"; siteUrl: string; projectKey: string }
		| {
				kind: "plane-project";
				baseUrl: string;
				workspaceSlug: string;
				projectId: string;
		  };
	residency: "eu" | "non-eu";
	visibilitySource: "discovered" | "declared";
	declaredVisibility?: "public" | "private";
	mediaFallback?: "link" | "withhold";
};

export type Target =
	| { kind: "github-repository"; owner: string; repository: string }
	| { kind: "gitlab-project"; projectPath: string }
	| { kind: "jira-project"; siteUrl: string; projectKey: string }
	| {
			kind: "plane-project";
			baseUrl: string;
			workspaceSlug: string;
			projectId: string;
	  };

export type Githubrepository = {
	kind: "github-repository";
	owner: string;
	repository: string;
};

export type Gitlabproject = { kind: "gitlab-project"; projectPath: string };

export type Jiraproject = {
	kind: "jira-project";
	siteUrl: string;
	projectKey: string;
};

export type Planeproject = {
	kind: "plane-project";
	baseUrl: string;
	workspaceSlug: string;
	projectId: string;
};

export type Routingrule = {
	id: string;
	match:
		| { origin: string }
		| { scheme: "https" | "http"; hostPattern: string; port: number | null }
		| { absent: true };
	imposed: Array<string>;
	optional: Array<string>;
	selectable: Array<string>;
	denied: Array<string>;
	override?: "allowed" | "denied";
};

export type Match =
	| { origin: string }
	| { scheme: "https" | "http"; hostPattern: string; port: number | null }
	| { absent: true };

export type Disclosurerule = {
	id: string;
	roles: Array<"document" | "screenshot" | "video">;
	when:
		| { always: true }
		| { visibility: "public" | "private" }
		| { residency: "eu" | "non-eu" };
	decision: "transmit" | "withhold";
};

export type When =
	| { always: true }
	| { visibility: "public" | "private" }
	| { residency: "eu" | "non-eu" };
