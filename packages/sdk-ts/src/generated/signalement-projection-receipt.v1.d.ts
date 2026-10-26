/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiSignalementProjectionReceiptV1 = {
	schemaVersion: "libre-ai.signalement-projection-receipt.v1";
	organization: string;
	keyId: string;
	issuedAt: string;
	deliveredAt: string;
	exportDigest: string;
	projectionId: string;
	mappingVersion: string;
	operation: "create" | "comment";
	revision: number;
	destinationId: string;
	profileId: string;
	remote: { id: string; url: string };
	transmitted: Array<{
		path: string;
		sha256: string;
		via: "body" | "attachment" | "link";
	}>;
	withheld: Array<{
		path: string;
		reason:
			| "default-withhold"
			| "public-destination"
			| "residency"
			| "attachment-unsupported"
			| "visibility-unknown"
			| "user-withheld";
	}>;
	rendered: {
		rendererVersion: string;
		bodyDigest: string;
		mediaLinks: Array<{ path: string; url: string }>;
	};
	requestBodyDigests: Array<string>;
	policy: { version: string; digest: string };
	approval: { reference: string };
	signature: { algorithm: "ed25519"; value: string };
};

export type Organization = string;

export type Keyid = string;

export type Id = string;

export type Digest = string;

export type Timestamp = string;

export type Path = string;

export type Httpsurl = string;

export type Mediaurl = string;

export type Signingkeyset = {
	organization: string;
	keys: Array<{
		keyId: string;
		algorithm: "ed25519";
		publicKey: string;
		status: "active" | "retired";
		notBefore: string;
		notAfter: null | string;
	}>;
};

export type Signingkey = {
	keyId: string;
	algorithm: "ed25519";
	publicKey: string;
	status: "active" | "retired";
	notBefore: string;
	notAfter: null | string;
};
