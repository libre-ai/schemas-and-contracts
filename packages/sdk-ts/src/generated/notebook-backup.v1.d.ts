/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiNotebookBackupEnvelopeV1 = {
	schemaVersion: "libre-ai.notebook-backup.v1";
	id: string;
	createdAt: string;
	cipher: "aes-256-gcm";
	kdf: {
		algorithm: "argon2id";
		salt: string;
		memoryKiB: number;
		iterations: number;
		parallelism: number;
	};
	nonce: string;
	ciphertext: string;
	ciphertextDigest: string;
};
