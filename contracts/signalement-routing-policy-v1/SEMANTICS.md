# Signalement routing policy v1 — candidate semantics

Precedence among matched rules is the union below (DL8), decided by the owner on 2026-10-24.

Status: candidate, pending architecture, security and privacy review (catalog
`review.state` `pending-independent-agent-review`; reviews follow
`https://github.com/libre-ai/project-governance/blob/HEAD/docs/reviews/AGENT-REVIEW-PROTOCOL.md`).
Schema: `contracts/schemas/signalement-routing-policy.v1.schema.json`. Vectors:
`contracts/fixtures/signalement-routing-policy-v1/vectors.json`. Authority-fixture
verifier: `tools/quality/signalement-routing-policy-v1.ts`. Owner and only producer:
`signalement`. No consumer is qualified by this document.

The key words MUST, MUST NOT, SHOULD and MAY are used as in RFC 2119.

## Scope

A routing policy is one version of an organization's rules for projecting a Dossier to issue
trackers: which destinations exist, which of them a delivery is routed to according to the
origin the sender observed, which are refused, and which files of the export each
destination receives. The document is data; its evaluation is the pure function fixed in
"Evaluation" below, implemented by the `signalement-policy-receipt-v1` component and
reproduced byte for byte by every implementation.

The document names internal systems of a tenant (repositories, projects, sites, origins):
catalog classification `tenant-private`. It MUST NOT be published, and a consumer MUST NOT
copy its members into a log beyond the identifiers, the version and the digest.

A policy does **not** prove that a destination exists, that its declared residency or
visibility is true, that a connector honours the decisions, or that the observed origin is
the real origin of the page (the sender chooses it, see the delivery envelope semantics). It
does not carry its approval state (see "Lifecycle").

## Lifecycle (DL4)

The state of a policy version lives **beside** the document, in an organization record of the
consumer that references `policyId`, `version` and the digest of the document; it is never a
member of the document. Approving or retiring a version therefore never changes its bytes,
and the digest that was approved, the digest that is evaluated and the digest cited by a
receipt are the same value.

- A document is immutable by (`policyId`, `version`). A consumer MUST refuse to record a
  second document with the same pair and a different digest. A change is a new `version`.
- States: `draft`, `approved`, `retired`. Transitions: `draft → approved` and
  `approved → retired`, and no other. A retired version is never approved again.
- Only an `approved` version is evaluated. The evaluation function sees the document, not
  its state: the refusal to evaluate a version that is not `approved` is carried by the
  caller, which MUST check the record, and the digest it names, before evaluating.
- Approval requires by default a policy administrator distinct from the author of the draft.
  The organization MAY relax this separation; the relaxation is itself a modification that
  is approved and recorded in the audit log, under the same rule.
- Each evaluation SHOULD be recorded in the consumer's audit log with `policyVersion`,
  `policyDigest`, `matchedRuleIds` and the verdict produced (design section 5.3).

## Members

Every object is closed (no other member) and every member is required unless stated
otherwise.

| Member | Form | Rule |
| --- | --- | --- |
| `schemaVersion` | constant | exactly `libre-ai.signalement-routing-policy.v1` |
| `organization` | string | `^[a-z][a-z0-9-]{0,63}$` |
| `policyId` | id | `^[a-z][a-z0-9-]*$`, 1 to 64 characters (the same id form as below) |
| `version` | string | `^[1-9][0-9]{0,9}$`: a decimal integer from 1, no leading zero, written as a string |
| `destinations` | array | 1 to 64 destinations |
| `routingRules` | array | 0 to 256 routing rules |
| `disclosureRules` | array | 0 to 256 disclosure rules |

A **destination** has:

| Member | Form | Rule |
| --- | --- | --- |
| `id` | id | |
| `profileId` | string | `^[a-z0-9-]+/[a-z0-9.-]+/[a-z0-9.-]+$`, at most 106 characters: the id of a connector profile (`signalement-connector-profile-v1`) |
| `target` | object | one of the four kinds below |
| `residency` | enum | `eu` or `non-eu`; declared, never discovered |
| `visibilitySource` | enum | `discovered` (the connector reads the visibility from the tracker) or `declared` |
| `declaredVisibility` | enum, conditional | `public` or `private`; **required** when `visibilitySource` is `declared`, **refused** when it is `discovered` |
| `mediaFallback` | enum, optional | `link` or `withhold`; absent means `withhold` |

`target` is one of:

| `kind` | Other members |
| --- | --- |
| `github-repository` | `owner` `^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$`; `repository` `^(?!\.\.?$)[A-Za-z0-9._-]{1,100}$` |
| `gitlab-project` | `projectPath`: two or more segments `[A-Za-z0-9_][A-Za-z0-9_.-]*` joined by `/`, at most 255 characters |
| `jira-project` | `siteUrl` `^https://[a-z0-9-]+\.atlassian\.net$`, at most 85 characters; `projectKey` `^[A-Z][A-Z0-9_]{1,9}$` |
| `plane-project` | `baseUrl`: an `https` origin (the origin pattern below, scheme `https` only), at most 267 characters; `workspaceSlug` `^[a-z0-9][a-z0-9_-]{0,47}$`; `projectId`: a lowercase UUID |

The family of `profileId` (its first segment) fixes the only admissible target kind:
`github-issues` → `github-repository`, `gitlab-issues` → `gitlab-project`, `jira-cloud` →
`jira-project`, `plane` → `plane-project`. Any other family addresses no target kind of this
version, so a destination of another family is refused.

A **routing rule** has an `id`, a `match`, the four destination lists `imposed`, `optional`,
`selectable` and `denied` (each a set of 0 to 64 destination ids, all four present, empty
allowed), and an optional `override` `allowed` or `denied` (absent means `denied`). Every id in
a list MUST name a destination of the same document, and one destination MUST NOT appear in
two lists of the same rule. The same destination MAY appear in lists of different rules; the
union below decides.

`match` is exactly one of:

- `{ "origin": <origin> }` — an origin `^https?://(?:[a-z0-9-]+(?:\.[a-z0-9-]+)*|\[[0-9a-f:.]+\])(?::[1-9][0-9]{0,4})?$`,
  at most 267 characters, the same form as `observedOrigin` of the delivery envelope;
- `{ "scheme": "https" | "http", "hostPattern": <pattern>, "port": <integer 1..65535> | null }` —
  `hostPattern` is `^\*\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$`, at most 255
  characters: a wildcard label followed by a name of at least two labels whose last label is
  alphabetic. `*.com` is refused; an IP address can never be named by a pattern. `port: null`
  stands for an origin without an explicit port;
- `{ "absent": true }` — the sender observed no origin.

The observed origin is in the canonical form of the URL serializer (delivery envelope
semantics): lowercase, no default port. A rule `origin` that is not in that form, and a
`port` equal to the default port of its `scheme` (443 for `https`, 80 for `http`), therefore
never match. The verifier does not refuse them; a producer SHOULD NOT write them.

A **disclosure rule** has an `id`, `roles` (a set of 1 to 3 of `document`, `screenshot`,
`video`, the file roles of the local export v1), a condition `when` that is exactly one of
`{ "always": true }`, `{ "visibility": "public" | "private" }`, `{ "residency": "eu" | "non-eu" }`,
and a `decision`, `transmit` or `withhold`.

Destinations, routing rules and disclosure rules share **one** identifier space: no two of
them carry the same `id`.

## Evaluation (DL8)

This section is normative for every implementation of `evaluate`. The policy MUST have been
accepted by the verifier (`rawRoutingPolicyFailures` returns `[]`) and approved (see
"Lifecycle"). The validation of the input and the error codes of `evaluate` are fixed by
`signalement-policy-receipt-v1`; this section fixes the verdict for a valid input.

Input `EvaluationInput`:

```ts
{
  observedOrigin: string | null;
  files: { path: string; role: "document" | "screenshot" | "video"; sha256: string }[];
  discovered: Record<string, DiscoveredAttributes>; // keyed by destination id
}
DiscoveredAttributes = { visibility: "public" | "internal" | "private" | "unknown"; attachmentUpload: boolean }
```

A destination id absent from `discovered` reads as `{ visibility: "unknown", attachmentUpload:
false }`. Entries of `discovered` for a `declared` destination, or for an id that names no
destination, are ignored. `evaluate` never reads `attachmentUpload`: that capability is
applied after evaluation, when the delivery plan is built, with the reason
`attachment-unsupported`.

Output `PolicyVerdict`:

```ts
{
  policyVersion: string;
  policyDigest: string;
  matchedRuleIds: string[];
  destinations: {
    destinationId: string;
    profileId: string;
    routing: "imposed" | "optional" | "selectable";
    files: { path: string; decision: "transmit" | "withhold"; reason: WithholdReason | null }[];
    media: "link" | "withhold";
  }[];
  override: "allowed" | "denied";
  deniedCount: number;
}
WithholdReason = "default-withhold" | "public-destination" | "residency"
               | "attachment-unsupported" | "visibility-unknown" | "user-withheld"
```

1. **Matching.** A routing rule matches when its `match` is:
   - `origin`, and `origin` is equal, octet for octet, to `observedOrigin`;
   - `scheme`, `hostPattern`, `port`, and `observedOrigin` is not `null`, its scheme equals
     `scheme`, its port (the integer after the host, or `null` when none is written) equals
     `port`, and its host `H` matches `hostPattern` = `*.S`: `H` ends with `.S` and `H` is not
     `S`. Every subdomain of `S`, at any depth, matches; the apex `S` never does;
   - `absent`, and `observedOrigin` is `null`.

   `matchedRuleIds` lists the ids of the matching rules in document order.
2. **Union.** Over the matching rules, `D` = the union of their `denied` lists; `I` = the union
   of their `imposed` lists minus `D`; `O` = the union of their `optional` lists minus `I` and
   `D`; `S` = the union of their `selectable` lists minus `I`, `O` and `D`. A refusal by any
   matching rule therefore dominates every other list, and a stronger routing class dominates a
   weaker one. `deniedCount` is the number of distinct ids in `D`. `override` is `allowed` only
   when at least one rule matches and **every** matching rule declares `override: "allowed"`;
   otherwise `denied` (the most restrictive override applies). When no rule matches:
   `matchedRuleIds: []`, `destinations: []`, `deniedCount: 0`, `override: "denied"`. There is
   no implicit destination.
3. **Destinations of the verdict.** Each destination of `I` with `routing: "imposed"`, each of
   `O` with `routing: "optional"`, and, **only when `override` is `allowed`**, each of `S` with
   `routing: "selectable"`; sorted by `destinationId` in UTF-16 code unit order. A destination
   of `D`, or one no matching rule names, never appears. Each entry carries the destination's
   `profileId`, its `files` (step 5) and `media` = its `mediaFallback`, `withhold` when absent.
   A selectable destination carries files computed by the same rules as the others, so a
   destination added by override is never without a plan.
4. **Effective visibility.** `declaredVisibility` when `visibilitySource` is `declared`;
   otherwise the `visibility` of the destination's entry in `discovered`. `internal` counts as
   `public`.
5. **Decision per file.** For each verdict destination, one entry per input file, sorted by
   `path` in UTF-16 code unit order. A disclosure rule applies to a file for a destination when
   the file's `role` is in `roles` and `when` holds: `always`; `visibility` equal to the
   effective visibility; `residency` equal to the destination's `residency`. Then, in this
   order:
   1. effective visibility `unknown` → `withhold`, reason `visibility-unknown`, for **every**
      file of the destination (closed failure: a visibility read that failed or never ran
      withholds everything, which is stricter than counting it as public);
   2. at least one applicable rule decides `withhold` → `withhold`, with the reason of the
      first such rule in document order: `visibility` → `public-destination`, `residency` →
      `residency`, `always` → `default-withhold`;
   3. no applicable rule decides `transmit` → `withhold`, reason `default-withhold`;
   4. otherwise `transmit`, `reason: null`.

   A withholding rule dominates a transmitting one, and nothing is transmitted without an
   explicit applicable `transmit` rule.
6. `policyVersion` is the document's `version`; `policyDigest` is `routingPolicyDigest(document)`,
   the SHA-256, lowercase hexadecimal, of the RFC 8785 (JCS) form of the document. The verdict
   is serialized in JCS form.

`evaluate` never produces `attachment-unsupported` (a profile capability) nor `user-withheld`
(a person's selection): both are set later, when the delivery plan is built from the verdict.

**Purity and order.** The same document, the same `observedOrigin`, the same set of files and
the same discovered attributes produce the same verdict, byte for byte. The order of `files`
in the input does not change the output. The order of rules in the document changes no
destination, no routing class, no `override`, no `deniedCount` and no decision; it fixes only
the order of `matchedRuleIds` and which withholding rule names the reason in step 5.2. A
reordered document is another document, with another digest.

**Staleness.** A verdict holds only for the discovered attributes it was computed on. A
consumer MUST read them again just before sending; if any changed, or if the version was
retired, the delivery MUST NOT be sent under the old verdict (design section 5.5).

## Bounds

| Bound | Value |
| --- | --- |
| Policy document, in octets | 1048576 (1 MiB) |
| `destinations` | 1 to 64 |
| `routingRules`, `disclosureRules` | 0 to 256 each |
| Each destination list of a rule | 0 to 64, no duplicate |
| `roles` | 1 to 3, no duplicate |
| Identifier, in characters | 1 to 64 |
| `version` | 1 to 9999999999, as a string of at most 10 digits |
| JSON nesting depth | 8 |

The size is measured on the octets received, before any decoding or parsing. An input above
the ceiling is refused without being decoded. Raising a bound changes the contract and is a
compatibility decision.

## Verifier failure codes

`rawRoutingPolicyFailures(bytes)` returns exactly one code for a refused policy, the first in
this order, and `[]` for an accepted one. When a code names an offender, it names the first in
document order; the only document data a code carries is that identifier, already constrained
to `^[a-z][a-z0-9-]*$`.

1. `policy.size_limit` — more than 1048576 octets.
2. `policy.raw_json` — the octets are not strict JSON: byte order mark, invalid UTF-8, a
   duplicate member name, an unpaired surrogate, an invalid number, a syntax error, or nesting
   deeper than 8.
3. `policy.schema` — the document does not satisfy the schema (missing, unknown or malformed
   member, a `declaredVisibility` missing on a `declared` destination or present on a
   `discovered` one, a host pattern on a top-level domain, an override other than `allowed`
   or `denied`, a duplicate entry inside one list, bound exceeded, root that is not an object).
4. `policy.duplicate_id:<id>` — two of the destinations, routing rules and disclosure rules
   carry `<id>` (scanned destinations first, then routing rules, then disclosure rules).
5. `policy.unknown_destination:<ruleId>` — routing rule `<ruleId>` names an id that is not a
   destination of the document.
6. `policy.routing_overlap:<ruleId>` — routing rule `<ruleId>` names one destination in two of
   its four lists.
7. `policy.target_profile_mismatch:<destId>` — the target kind of destination `<destId>` is not
   the one its profile family addresses.

A consumer MUST refuse the policy on any code. It MUST NOT repair a policy (drop an unknown
id, pick one list for an overlapping destination, rewrite a target) and then accept it.

## Test material

Every value in the fixtures is synthetic: the organization, owners, groups, keys, slugs and
the UUID are arbitrary, the origins and hosts use reserved example names (`example.com`,
`example.org`, `example.test`), `localhost` and an IPv6 documentation address, and the Jira
site uses the name `example`. No fixture contains a credential, a token or personal data.
`vectors.json` holds valid policies (all target kinds, the three match forms, the three
disclosure conditions, a destination imposed by one rule and denied by another, a policy
without any rule) and refused ones (unknown destination, overlap, target and profile
mismatch, duplicate identifiers across the shared space, conditional `declaredVisibility`,
host patterns on a top-level domain or an apex, an override `maybe`, a duplicate member, a
truncated document, a byte order mark). The oversized document and the documents at the
array bounds are built in the test at run time rather than stored; an origin carrying
userinfo is assembled at run time so that no credential-shaped literal is stored.
