/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiCommonContractDefinitionsV1 = unknown;

export type Schemaversion = string;

export type Identifier = string;

export type Urn = string;

export type Tenantid = string;

export type Servicetenantid = "public" | string;

export type Timestamp = string;

export type Sha256 = string;

export type Revision = number;

export type Sourcereference = {
	uri: string;
	retrievedAt: string;
	digest: string;
	licence: string;
};

export type Artifactreference = {
	id: string;
	digest: string;
	mediaType: string;
};

export type Approvalreference = {
	role: string;
	approvedAt: string;
	reference: string;
	subjectDigest: string;
};
