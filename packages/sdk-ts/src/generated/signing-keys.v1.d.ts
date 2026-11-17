/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiSigningKeysV1 = {
	schemaVersion: "libre-ai.signing-keys.v1";
	keys: Array<{
		signingKeyId: string;
		algorithm: "Ed25519";
		publicKey: string;
		purpose: string;
		artifactTypes: Array<
			"build" | "dataset" | "export" | "release" | "evidence"
		>;
		activatedAt: string;
		revokedAt: string | null;
		witness: { signatory: string; attestedAt: string; comment: string };
		revocationReason?: string;
		revocationWitness?: { signatory: string; discoveredAt: string };
	}>;
};

export type Signingkeyid = string;

export type Instant = string;

export type Signatory = string;

export type Key = {
	signingKeyId: string;
	algorithm: "Ed25519";
	publicKey: string;
	purpose: string;
	artifactTypes: Array<"build" | "dataset" | "export" | "release" | "evidence">;
	activatedAt: string;
	revokedAt: string | null;
	witness: { signatory: string; attestedAt: string; comment: string };
	revocationReason?: string;
	revocationWitness?: { signatory: string; discoveredAt: string };
};
