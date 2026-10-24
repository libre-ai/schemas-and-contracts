# Signalement connector profile v1 — candidate semantics

Status: candidate, pending architecture and security review (catalog `review.state`
`pending-independent-agent-review`; reviews follow
`https://github.com/libre-ai/project-governance/blob/HEAD/docs/reviews/AGENT-REVIEW-PROTOCOL.md`).
Schema: `contracts/schemas/signalement-connector-profile.v1.schema.json`. Vectors:
`contracts/fixtures/signalement-connector-profile-v1/vectors.json`. Published profiles:
`contracts/fixtures/signalement-connector-profile-v1/profiles.v1.json`. Authority-fixture
verifier: `tools/quality/signalement-connector-profile-v1.ts`. Owner and only producer:
`signalement`. No consumer is qualified by this document.

The key words MUST, MUST NOT, SHOULD and MAY are used as in RFC 2119.

## Scope

A connector profile is the public, data-only description of one way of talking to one
issue tracker: which API and edition, how a connector authenticates, how the body is
written, what the tracker can do, what it is known not to be able to do, and who wins a
disagreement on each part of an item. A profile carries no credential, no URL of a tenant,
no secret and no text written by a person (catalog classification `public`).

A profile is a **declaration**, not a proof. It does **not** prove that the tracker behaves
as declared, that a connector is correct, or that a given version of the tracker was ever
tried. It carries no qualification status: the only authority on whether a profile is
`qualified` is `qualification/provider-matrix.yaml` of `signalement`. A profile whose
`providerVersion` is `null` (a self-hosted edition not pinned to a version) can never be
recorded as `qualified`; that rule is enforced where the status lives, not in this document.

## Members

All members are required and every object is closed (no other member). A member the
document does not know is a failure, never ignored; in particular a `qualification` member
is refused.

| Member | Form | Rule |
| --- | --- | --- |
| `schemaVersion` | constant | exactly `libre-ai.signalement-connector-profile.v1` |
| `profileId` | string | `^[a-z0-9-]{1,32}/[a-z0-9.-]{1,32}/(?:rest\|graphql)-[a-z0-9.-]{1,32}$`, at most 106 characters |
| `family` | string | `^[a-z0-9-]{1,32}$`; a pattern, not an enumeration: a later tracker family is added without a major version |
| `edition` | string | `^[a-z0-9.-]{1,32}$`: `github.com`, `gitlab.com`, `cloud`, `self-hosted` |
| `api` | object | `style` is `rest` or `graphql`; `version` matches `^[a-z0-9.-]{1,32}$` |
| `providerVersion` | string or `null` | 1 to 64 characters, or `null` when the tracker version is unknown or not pinned |
| `auth` | object | `mode` is one of `fine-grained-token`, `project-access-token`, `personal-access-token`, `api-token`, `api-key`; `scopes` is a set (no duplicate) of at most 32 strings of 1 to 64 characters |
| `bodyFormat` | enum | `markdown-gfm`, `markdown-glfm`, `adf`, `html` |
| `capabilities` | object | see below |
| `limits` | object | `maxBodyBytes` and `maxAttachmentBytes`: integer from 1, or `null`; `maxAttachmentsPerItem`: integer from 0, or `null`; every integer is at most 9007199254740991 |
| `conflictPolicy` | object | `title`, `body`, `attachments`, `comments`, `status`, `closure`, each `dossier-owned`, `provider-owned`, `merge-set` or `human-resolution` |

`capabilities` has the members `discovery`, `mappingValidation`, `idempotentCreate`,
`attachExisting`, `attachmentUpload`, `comment`, `cursorRead`, each `supported`,
`unsupported` or `unproven`; `visibility`, `discovered` or `declared`; and
`consistentLookup`, an object `{ method, status }` where `method` is one of `issue-list`,
`filtered-list`, `jql`, `entity-property`, `external-id`, `none` and `status` is a capability
value.

- A capability is one of exactly three values. `unproven` means "not yet shown on the
  qualified version"; a consumer MUST treat `unproven` as absent in production and MAY
  exercise it only as a hypothesis in a test or a qualification run. `unsupported` means the
  tracker is known not to offer it; a capability MUST NOT go from `unsupported` to
  `supported` without a new profile version. A value such as `partial` is refused: a
  capability that holds only in part is split into members, never blurred.
- `profileId` is the registry key of the profile and MUST equal
  `` `${family}/${edition}/${api.style}-${api.version}` ``. The id is derived, not chosen: a
  document whose id disagrees with its own members describes a different profile than it
  names, and a consumer that indexes by id would load the wrong one.
- `auth.scopes` names permissions, never values. `auth.mode` is part of the contract:
  GitLab.com reserves project access tokens to the Premium and Ultimate tiers (GitLab
  documentation read on 2026-10-24), so the published GitLab profile declares a **personal
  access token with scope `api`**, held by a dedicated service account that is a member of
  the target projects only. That scope extends to every project the account belongs to, so
  the account MUST NOT be a member of any other project. No published profile declares
  `project-access-token`; the schema still admits the value for a later profile of a tracker
  that offers the mode.
- `consistentLookup` answers one question: can a connector, after an ambiguous create (the
  request may or may not have reached the tracker), find the item it may have created and
  read it back **consistently**, without creating a duplicate? `method: "none"` states that
  no lookup exists; it is consistent only with `status: "unsupported"`. A `status` other than
  `supported` is read as "no consistent lookup": the ambiguous creation ends in a state a
  person resolves, never in a second creation. Jira Cloud publishes `jql` with `unsupported`
  because Atlassian documents no strongly consistent read after write.
- `limits` set to `null` means unknown; the limit is fixed at qualification and a consumer
  MUST NOT assume a value.
- `conflictPolicy` states who wins when the dossier and the tracker disagree on one part of
  an item. It names an owner per part and carries no conflict-resolution algorithm.

## Published profiles

`profiles.v1.json` is `{ schemaVersion: "libre-ai.signalement-connector-profiles.v1",
profiles: [...] }` with exactly four profiles, in this order. Cells the design does not fix
are `unproven`. Every profile declares `providerVersion: null` and every limit `null`; the
conflict policy is `dossier-owned` for `title`, `body`, `attachments` and `comments`, and
`provider-owned` for `status` and `closure`.

| Profile | `auth` | `attachmentUpload` | `visibility` | `consistentLookup` | `bodyFormat` |
| --- | --- | --- | --- | --- | --- |
| `github-issues/github.com/rest-2022-11-28` | `fine-grained-token`: `issues:write`, `metadata:read` | `unsupported` | `discovered` | `issue-list`, `unproven` | `markdown-gfm` |
| `gitlab-issues/gitlab.com/rest-v4` | `personal-access-token`: `api` | `supported` | `discovered` | `filtered-list`, `unproven` | `markdown-glfm` |
| `jira-cloud/cloud/rest-v3` | `api-token`, no scope | `supported` | `declared` | `jql`, `unsupported` | `adf` |
| `plane/self-hosted/rest-v1` | `api-key`, no scope | `unproven` | `declared` | `external-id`, `unproven` | `html` |

A later qualification run MAY resolve an `unproven` cell to `supported` or `unsupported` by
publishing a new profile document; it MUST NOT change any other cell silently.

## Bounds

| Bound | Value |
| --- | --- |
| Profile document, in octets | 65536 |
| `profileId`, in characters | 106 = 32 + `/` + 32 + `/` + `graphql` (7) + `-` + 32 |
| `scopes`, entries | 32, each 1 to 64 characters |
| `providerVersion`, in characters | 64 |
| JSON nesting depth | 8 |

The size is measured on the octets received, before any decoding or parsing. An input above
the ceiling is refused without being decoded. Raising a bound changes the contract and is a
compatibility decision.

## Verifier failure codes

`rawConnectorProfileFailures(bytes)` returns exactly one code for a refused profile, the
first in this order, and `[]` for an accepted one. Codes contain no data from the profile.

1. `profile.size_limit` — more than 65536 octets.
2. `profile.raw_json` — the octets are not strict JSON: byte order mark, invalid UTF-8, a
   duplicate member name, an unpaired surrogate, an invalid number, a syntax error, or nesting
   deeper than 8.
3. `profile.schema` — the document does not satisfy the schema (missing, unknown or malformed
   member, unknown capability or policy value, bound exceeded, root that is not an object).
4. `profile.id_mismatch` — the schema is satisfied and `profileId` is not
   `` `${family}/${edition}/${api.style}-${api.version}` ``.
5. `profile.lookup_inconsistent` — the schema is satisfied, `consistentLookup.method` is
   `none` and `consistentLookup.status` is not `unsupported`.

A consumer MUST refuse the profile on any code. It MUST NOT repair a profile (rewrite the id
from the members, or the status from the method) and then accept it.

## Test material

Every value in the fixtures is synthetic or public documentation: the four profiles name the
public API editions of the trackers and carry no tenant URL, token, account or person.
`vectors.json` holds the four published profiles plus variants, and refused documents
(inconsistent id, `none` lookup with a status other than `unsupported`, a capability value
`partial`, a `qualification` member, a duplicate member, a truncated document). The
oversized document of 65537 octets is built in the test at run time rather than stored.
