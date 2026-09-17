/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiHarnessattestationV1 = {
	schemaVersion: "libre-ai.harness-attestation.v1";
	id: string;
	tenantId: string;
	missionId: string;
	runId: string;
	planDigest: string;
	requestedProfileDigest: string;
	effectiveProfileDigest: string;
	workerManifestDigests: Array<string>;
	sandboxEngineManifest: { id: string; digest: string; mediaType: string };
	platform: "linux-x86_64" | "linux-aarch64" | "macos-x86_64" | "macos-aarch64";
	effectiveControls: Array<string>;
	networkMode: "none" | "private-gateway-only";
	generatedAt: string;
	signingKeyId: string;
	attestationDigest: string;
	signature: string;
};
