/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type SignalementLocalExportV1Candidate = {
	schemaVersion: "libre-ai.signalement-local-export.v1";
	payload: {
		dossierId: string;
		dossierRevision: number;
		createdAt: string;
		reviewedAt: string;
		statements: { expected: string; observed: string };
		context: {
			provenance: "user-statement";
			application: string;
			environment: string;
			steps: Array<string>;
		};
		observations: Array<{
			id: string;
			provenance: "user-statement" | "capture-observation";
			text: string;
			capturedAt: string;
			mediaIds: Array<string>;
		}>;
		hypotheses: Array<{ id: string; text: string }>;
		document: { text: string; observationIds: Array<string> };
		files: Array<{
			path: string;
			role: "document" | "screenshot" | "video";
			mimeType: "text/markdown" | "image/png" | "video/webm" | "video/mp4";
			byteLength: number;
			sha256: string;
			media: null | {
				id: string;
				kind: "screenshot" | "video";
				capturedAt: string;
				derivation: {
					sourceId: string;
					operations: Array<
						| "metadata-removal"
						| "redaction"
						| "crop"
						| "transcode"
						| "audio-removal"
					>;
				};
				audioIncluded: boolean;
				audioReviewed: boolean;
				sanitation: "reviewed-with-limitations";
			};
		}>;
	};
	approval: {
		target: "local-export";
		payloadDigest: string;
		approvedAt: string;
	};
	exportedAt: string;
};

export type Id = string;

export type Digest = string;

export type Timestamp = string;

export type Payload = {
	dossierId: string;
	dossierRevision: number;
	createdAt: string;
	reviewedAt: string;
	statements: { expected: string; observed: string };
	context: {
		provenance: "user-statement";
		application: string;
		environment: string;
		steps: Array<string>;
	};
	observations: Array<{
		id: string;
		provenance: "user-statement" | "capture-observation";
		text: string;
		capturedAt: string;
		mediaIds: Array<string>;
	}>;
	hypotheses: Array<{ id: string; text: string }>;
	document: { text: string; observationIds: Array<string> };
	files: Array<{
		path: string;
		role: "document" | "screenshot" | "video";
		mimeType: "text/markdown" | "image/png" | "video/webm" | "video/mp4";
		byteLength: number;
		sha256: string;
		media: null | {
			id: string;
			kind: "screenshot" | "video";
			capturedAt: string;
			derivation: {
				sourceId: string;
				operations: Array<
					| "metadata-removal"
					| "redaction"
					| "crop"
					| "transcode"
					| "audio-removal"
				>;
			};
			audioIncluded: boolean;
			audioReviewed: boolean;
			sanitation: "reviewed-with-limitations";
		};
	}>;
};

export type Observation = {
	id: string;
	provenance: "user-statement" | "capture-observation";
	text: string;
	capturedAt: string;
	mediaIds: Array<string>;
};

export type File = {
	path: string;
	role: "document" | "screenshot" | "video";
	mimeType: "text/markdown" | "image/png" | "video/webm" | "video/mp4";
	byteLength: number;
	sha256: string;
	media: null | {
		id: string;
		kind: "screenshot" | "video";
		capturedAt: string;
		derivation: {
			sourceId: string;
			operations: Array<
				| "metadata-removal"
				| "redaction"
				| "crop"
				| "transcode"
				| "audio-removal"
			>;
		};
		audioIncluded: boolean;
		audioReviewed: boolean;
		sanitation: "reviewed-with-limitations";
	};
};

export type Media = {
	id: string;
	kind: "screenshot" | "video";
	capturedAt: string;
	derivation: {
		sourceId: string;
		operations: Array<
			"metadata-removal" | "redaction" | "crop" | "transcode" | "audio-removal"
		>;
	};
	audioIncluded: boolean;
	audioReviewed: boolean;
	sanitation: "reviewed-with-limitations";
};
