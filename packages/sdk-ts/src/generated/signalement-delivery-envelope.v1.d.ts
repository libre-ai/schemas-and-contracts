/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiSignalementDeliveryEnvelopeV1 = {
	schemaVersion: "libre-ai.signalement-delivery-envelope.v1";
	deliveryId: string;
	exportSha256: string;
	exportByteLength: number;
	observedOrigin: string | null;
};

export type Deliveryid = string;

export type Digest = string;

export type Origin = string;
