/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiPublicVoteDatasetV3 = {
	schemaVersion: "libre-ai.public-vote-dataset.v3";
	id: string;
	version: string;
	scope: string;
	methodId: string;
	methodDigest: string;
	statements: Array<{
		id: string;
		subjectKind: "public-policy-proposal";
		personTargeting: "prohibited";
		wording: string;
		polarity: -1 | 1;
		source: {
			uri: string;
			retrievedAt: string;
			digest: string;
			licence: string;
		};
		votesFor: number;
		votesAgainst: number;
		abstentions: number;
		absent: number;
	}>;
	publishedAt: string;
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
	publicationPolicy: {
		sourceMode: "aggregate-only" | "public-roll-call-aggregated";
		minimumGroupSize: number;
		smallGroupAction: "exclude-statement";
		identityExposure: "prohibited";
		publicationReviewExpiresAt: string;
	};
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

export type Publicaggregatesource = {
	uri: string;
	retrievedAt: string;
	digest: string;
	licence: string;
};
