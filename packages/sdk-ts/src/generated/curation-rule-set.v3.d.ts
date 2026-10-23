/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run `bun run generate` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */

export type LibreAiCurationRuleSetV3 = {
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
};

export type Rule = {
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
};

export type Leaf = {
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
	operator: "equals" | "contains" | "prefix" | "suffix" | "after" | "before";
	value: string;
};

export type Condition2 =
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

export type Condition3 =
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

export type Condition4 =
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

export type Action =
	| { hide: true }
	| { keep: true }
	| { tag: string }
	| { markRead: true }
	| { follow: true }
	| { toRead: true }
	| { alert: true };
