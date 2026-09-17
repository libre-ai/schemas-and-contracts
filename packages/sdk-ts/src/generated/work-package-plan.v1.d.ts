/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiWorkPackagePlanV1 = {
	schemaVersion: "libre-ai.work-package-plan.v1";
	authority: string;
	globalConstraints: Array<string>;
	packages: Array<{
		id: string;
		phase: "G2" | "G3" | "G4" | "G5";
		name: string;
		objective: string;
		owners: Array<string>;
		integrator: string;
		writePaths: Array<string>;
		readAuthorities: Array<string>;
		dependsOn: Array<string>;
		parallelGroup: string;
		risk: "medium" | "high" | "critical";
		humanGates: Array<string>;
		acceptance: Array<string>;
		definitionStatus: "locked";
	}>;
};

export type Path = string;

export type Package = {
	id: string;
	phase: "G2" | "G3" | "G4" | "G5";
	name: string;
	objective: string;
	owners: Array<string>;
	integrator: string;
	writePaths: Array<string>;
	readAuthorities: Array<string>;
	dependsOn: Array<string>;
	parallelGroup: string;
	risk: "medium" | "high" | "critical";
	humanGates: Array<string>;
	acceptance: Array<string>;
	definitionStatus: "locked";
};
