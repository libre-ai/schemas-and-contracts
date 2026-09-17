/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiArtifactManifestV1 = {
	schemaVersion: "libre-ai.artifact-manifest.v1";
	id: string;
	artifactType: "build" | "dataset" | "export" | "release" | "evidence";
	createdAt: string;
	digest: string;
	files: Array<{
		path: string;
		size: number;
		digest: string;
		mediaType: string;
	}>;
	evidenceReport?: { id: string; digest: string; mediaType: string };
};
