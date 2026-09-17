/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiBoussoleMethodV2 = {
	schemaVersion: "libre-ai.boussole-method.v2";
	id: string;
	version: string;
	responseScale: Array<number>;
	abstentionTreatment: "excluded-from-denominator" | "neutral";
	missingTreatment: "excluded-and-reported";
	formula: "normalized-agreement-v2";
	rounding: "decimal-6-half-even";
	approvedAt: string;
	digest: string;
	approvals: Array<{
		role: "methodological-review" | "legal-privacy-review";
		actorKind: "human";
		reviewerId: string;
		professionalCapacity: "methodology-expert" | "privacy-legal-expert";
		approvedAt: string;
		reference: string;
		subjectDigest: string;
		attestation: {
			uri: string;
			digest: string;
			publicationBasis: "explicit-publication-consent";
			identityBoundary: "professional-attestation-only";
		};
	}> &
		unknown &
		unknown;
};

export type Reviewapproval = {
	role: "methodological-review" | "legal-privacy-review";
	actorKind: "human";
	reviewerId: string;
	professionalCapacity: "methodology-expert" | "privacy-legal-expert";
	approvedAt: string;
	reference: string;
	subjectDigest: string;
	attestation: {
		uri: string;
		digest: string;
		publicationBasis: "explicit-publication-consent";
		identityBoundary: "professional-attestation-only";
	};
};
