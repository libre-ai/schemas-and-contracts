/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiNotebookBackupEnvelopeV2 = {
	schemaVersion: "libre-ai.notebook-backup.v2";
	id: string;
	cipher: "aes-256-gcm";
	kdf: {
		algorithm: "argon2id";
		version: 19;
		memoryKiB: number;
		iterations: number;
		parallelism: 1 | 2 | 4;
		outputLengthBytes: 32;
		salt: string;
	};
	nonce: string;
	ciphertext: string;
	digest: string;
};
