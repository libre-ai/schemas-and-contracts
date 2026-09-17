/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiHarnessprofileV2 = {
	schemaVersion: "libre-ai.harness-profile.v2";
	id: string;
	version: string;
	enforcement: "required";
	supportedPlatforms: Array<
		"linux-x86_64" | "linux-aarch64" | "macos-x86_64" | "macos-aarch64"
	>;
	filesystem: {
		workspaceRoot: "/workspace";
		canonicalizePaths: true;
		resolveSymlinks: true;
		symlinkPolicy: "deny-outside-workspace";
		readOnly: Array<string>;
		writable: Array<string>;
		denied: Array<string>;
		copyIgnoredFiles: false;
	};
	process: {
		dedicatedIdentity: true;
		denyPrivilegeEscalation: true;
		dropAmbientCapabilities: true;
		killProcessGroup: true;
		maxProcesses: number;
		maxDurationSeconds: number;
	};
	sandboxEngine: {
		manifest: { id: string; digest: string; mediaType: string };
		requiredCapabilities: Array<string>;
		denyOnMissing: true;
	};
	workerTransport: {
		kind: "private-unix-socket" | "private-network-namespace";
		verifyOsPeer?: boolean;
		runBoundToken: true;
		hostLoopbackAllowed: false;
	};
	providerGateway: {
		upstreamSecretInWorker: false;
		bindExactOrigins: true;
		pinResolvedAddress: true;
		revalidateRedirects: true;
		denySpecialUseAddresses: true;
		allowLoopbackUpstream: false;
	};
	privilegedToolBroker: {
		secretsInWorker: false;
		oneShotCapabilities: true;
		revalidatePlan: true;
		revalidateBudget: true;
		revalidateExpiry: true;
		structuredArguments: true;
		resolveExecutable: true;
		rejectShellSyntax: true;
		allowGenericShell: false;
		failClosedOutputScan: true;
	};
	outputs: {
		maxBytesPerTool: number;
		maxTotalBytes: number;
		privateByDefault: true;
	};
	operationalLogs: {
		closedCategoriesAndCountersOnly: true;
		contentFieldsAllowed: false;
		stableBusinessIdentifiersAllowed: false;
		externalOtelEnabled: false;
		maxRetentionHours: number;
		timestampPrecisionSeconds: number;
	};
	attestation: {
		bindRequestedProfile: true;
		bindEffectiveControls: true;
		bindWorkerManifests: true;
		bindKernelCapabilities: true;
		signed: true;
	};
	profileDigest: string;
};

export type Relativepath = string;
