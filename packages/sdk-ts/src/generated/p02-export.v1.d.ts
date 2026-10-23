/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiP02ExportV1 = {
	schemaVersion: "libre-ai.p02-export.v1";
	organizationId: string;
	exportedAt: string;
	digest: string;
	signature?: { kid: string; signature: string };
	sources: Array<{
		id: string;
		url: string;
		displayName: string;
		folderId: string | null;
		createdAt: string;
	}>;
	folders: Array<{ id: string; name: string; createdAt: string }>;
	items: Array<{
		id: string;
		sourceId: string;
		title: string;
		provenance: {
			feedUrl: string;
			fetchId: string;
			httpStatus: number;
			etag: string | null;
			lastModified: string | null;
			collectedAt: string;
			declaredPublishedAt:
				| { state: "present"; value: string }
				| { state: "absent" }
				| { state: "malformed" };
			guid: string | null;
			canonicalUrl: string;
			canonicalizationRule: string;
		};
		versions: Array<{
			number: number;
			blake3: string;
			recordedAt: string;
			contentOrigin: "feed" | "extracted";
			sanitizerVersion: string;
			extractorVersion?: string;
		}>;
	}>;
	states: Array<{
		itemId: string;
		read: boolean;
		favorite: boolean;
		followed: boolean;
		toRead: boolean;
		tags: Array<string>;
		updatedAt: string;
	}>;
	annotations: Array<{
		id: string;
		itemId: string;
		body: string;
		createdAt: string;
		updatedAt: string;
	}>;
	ruleSets: Array<{
		schemaVersion: "libre-ai.curation-rule-set.v3";
		id: string;
		organizationId: string;
		version: number;
		status: "draft" | "active" | "retired";
		rules: Array<{
			id: string;
			name: string;
			when:
				| {
						field:
							| "title"
							| "content"
							| "author"
							| "url"
							| "sourceHost"
							| "language"
							| "categories"
							| "publishedAt"
							| "collectedAt";
						operator:
							| "equals"
							| "contains"
							| "prefix"
							| "suffix"
							| "after"
							| "before";
						value: string;
				  }
				| {
						all: Array<
							| {
									field:
										| "title"
										| "content"
										| "author"
										| "url"
										| "sourceHost"
										| "language"
										| "categories"
										| "publishedAt"
										| "collectedAt";
									operator:
										| "equals"
										| "contains"
										| "prefix"
										| "suffix"
										| "after"
										| "before";
									value: string;
							  }
							| {
									all: Array<
										| {
												field:
													| "title"
													| "content"
													| "author"
													| "url"
													| "sourceHost"
													| "language"
													| "categories"
													| "publishedAt"
													| "collectedAt";
												operator:
													| "equals"
													| "contains"
													| "prefix"
													| "suffix"
													| "after"
													| "before";
												value: string;
										  }
										| {
												all: Array<{
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												}>;
										  }
										| {
												any: Array<{
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												}>;
										  }
										| {
												not: {
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												};
										  }
									>;
							  }
							| {
									any: Array<
										| {
												field:
													| "title"
													| "content"
													| "author"
													| "url"
													| "sourceHost"
													| "language"
													| "categories"
													| "publishedAt"
													| "collectedAt";
												operator:
													| "equals"
													| "contains"
													| "prefix"
													| "suffix"
													| "after"
													| "before";
												value: string;
										  }
										| {
												all: Array<{
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												}>;
										  }
										| {
												any: Array<{
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												}>;
										  }
										| {
												not: {
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												};
										  }
									>;
							  }
							| {
									not:
										| {
												field:
													| "title"
													| "content"
													| "author"
													| "url"
													| "sourceHost"
													| "language"
													| "categories"
													| "publishedAt"
													| "collectedAt";
												operator:
													| "equals"
													| "contains"
													| "prefix"
													| "suffix"
													| "after"
													| "before";
												value: string;
										  }
										| {
												all: Array<{
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												}>;
										  }
										| {
												any: Array<{
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												}>;
										  }
										| {
												not: {
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												};
										  };
							  }
						>;
				  }
				| {
						any: Array<
							| {
									field:
										| "title"
										| "content"
										| "author"
										| "url"
										| "sourceHost"
										| "language"
										| "categories"
										| "publishedAt"
										| "collectedAt";
									operator:
										| "equals"
										| "contains"
										| "prefix"
										| "suffix"
										| "after"
										| "before";
									value: string;
							  }
							| {
									all: Array<
										| {
												field:
													| "title"
													| "content"
													| "author"
													| "url"
													| "sourceHost"
													| "language"
													| "categories"
													| "publishedAt"
													| "collectedAt";
												operator:
													| "equals"
													| "contains"
													| "prefix"
													| "suffix"
													| "after"
													| "before";
												value: string;
										  }
										| {
												all: Array<{
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												}>;
										  }
										| {
												any: Array<{
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												}>;
										  }
										| {
												not: {
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												};
										  }
									>;
							  }
							| {
									any: Array<
										| {
												field:
													| "title"
													| "content"
													| "author"
													| "url"
													| "sourceHost"
													| "language"
													| "categories"
													| "publishedAt"
													| "collectedAt";
												operator:
													| "equals"
													| "contains"
													| "prefix"
													| "suffix"
													| "after"
													| "before";
												value: string;
										  }
										| {
												all: Array<{
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												}>;
										  }
										| {
												any: Array<{
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												}>;
										  }
										| {
												not: {
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												};
										  }
									>;
							  }
							| {
									not:
										| {
												field:
													| "title"
													| "content"
													| "author"
													| "url"
													| "sourceHost"
													| "language"
													| "categories"
													| "publishedAt"
													| "collectedAt";
												operator:
													| "equals"
													| "contains"
													| "prefix"
													| "suffix"
													| "after"
													| "before";
												value: string;
										  }
										| {
												all: Array<{
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												}>;
										  }
										| {
												any: Array<{
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												}>;
										  }
										| {
												not: {
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												};
										  };
							  }
						>;
				  }
				| {
						not:
							| {
									field:
										| "title"
										| "content"
										| "author"
										| "url"
										| "sourceHost"
										| "language"
										| "categories"
										| "publishedAt"
										| "collectedAt";
									operator:
										| "equals"
										| "contains"
										| "prefix"
										| "suffix"
										| "after"
										| "before";
									value: string;
							  }
							| {
									all: Array<
										| {
												field:
													| "title"
													| "content"
													| "author"
													| "url"
													| "sourceHost"
													| "language"
													| "categories"
													| "publishedAt"
													| "collectedAt";
												operator:
													| "equals"
													| "contains"
													| "prefix"
													| "suffix"
													| "after"
													| "before";
												value: string;
										  }
										| {
												all: Array<{
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												}>;
										  }
										| {
												any: Array<{
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												}>;
										  }
										| {
												not: {
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												};
										  }
									>;
							  }
							| {
									any: Array<
										| {
												field:
													| "title"
													| "content"
													| "author"
													| "url"
													| "sourceHost"
													| "language"
													| "categories"
													| "publishedAt"
													| "collectedAt";
												operator:
													| "equals"
													| "contains"
													| "prefix"
													| "suffix"
													| "after"
													| "before";
												value: string;
										  }
										| {
												all: Array<{
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												}>;
										  }
										| {
												any: Array<{
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												}>;
										  }
										| {
												not: {
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												};
										  }
									>;
							  }
							| {
									not:
										| {
												field:
													| "title"
													| "content"
													| "author"
													| "url"
													| "sourceHost"
													| "language"
													| "categories"
													| "publishedAt"
													| "collectedAt";
												operator:
													| "equals"
													| "contains"
													| "prefix"
													| "suffix"
													| "after"
													| "before";
												value: string;
										  }
										| {
												all: Array<{
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												}>;
										  }
										| {
												any: Array<{
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												}>;
										  }
										| {
												not: {
													field:
														| "title"
														| "content"
														| "author"
														| "url"
														| "sourceHost"
														| "language"
														| "categories"
														| "publishedAt"
														| "collectedAt";
													operator:
														| "equals"
														| "contains"
														| "prefix"
														| "suffix"
														| "after"
														| "before";
													value: string;
												};
										  };
							  };
				  };
			then: Array<
				| { hide: true }
				| { keep: true }
				| { tag: string }
				| { markRead: true }
				| { follow: true }
				| { toRead: true }
				| { alert: true }
			>;
			explanation: string;
		}>;
		createdAt: string;
	}>;
	decisions: Array<{
		itemId: string;
		ruleSetId: string;
		ruleSetVersion: number;
		visibility: "visible" | "hidden";
		decidingRuleId: string | null;
		decidedAt: string;
	}>;
	preferences: { theme: "system" | "light" | "dark" };
};

export type Urn = string;

export type Timestamp = string;

export type Uri = string;

export type Source = {
	id: string;
	url: string;
	displayName: string;
	folderId: string | null;
	createdAt: string;
};

export type Folder = { id: string; name: string; createdAt: string };

export type Declaredpublishedat =
	| { state: "present"; value: string }
	| { state: "absent" }
	| { state: "malformed" };

export type Provenance = {
	feedUrl: string;
	fetchId: string;
	httpStatus: number;
	etag: string | null;
	lastModified: string | null;
	collectedAt: string;
	declaredPublishedAt:
		| { state: "present"; value: string }
		| { state: "absent" }
		| { state: "malformed" };
	guid: string | null;
	canonicalUrl: string;
	canonicalizationRule: string;
};

export type Version = {
	number: number;
	blake3: string;
	recordedAt: string;
	contentOrigin: "feed" | "extracted";
	sanitizerVersion: string;
	extractorVersion?: string;
};

export type Item = {
	id: string;
	sourceId: string;
	title: string;
	provenance: {
		feedUrl: string;
		fetchId: string;
		httpStatus: number;
		etag: string | null;
		lastModified: string | null;
		collectedAt: string;
		declaredPublishedAt:
			| { state: "present"; value: string }
			| { state: "absent" }
			| { state: "malformed" };
		guid: string | null;
		canonicalUrl: string;
		canonicalizationRule: string;
	};
	versions: Array<{
		number: number;
		blake3: string;
		recordedAt: string;
		contentOrigin: "feed" | "extracted";
		sanitizerVersion: string;
		extractorVersion?: string;
	}>;
};

export type State = {
	itemId: string;
	read: boolean;
	favorite: boolean;
	followed: boolean;
	toRead: boolean;
	tags: Array<string>;
	updatedAt: string;
};

export type Annotation = {
	id: string;
	itemId: string;
	body: string;
	createdAt: string;
	updatedAt: string;
};

export type Decision = {
	itemId: string;
	ruleSetId: string;
	ruleSetVersion: number;
	visibility: "visible" | "hidden";
	decidingRuleId: string | null;
	decidedAt: string;
};

export type Preferences = { theme: "system" | "light" | "dark" };

export type Signature = { kid: string; signature: string };
