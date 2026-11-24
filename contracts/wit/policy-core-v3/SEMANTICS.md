# policy-core-v3 — normative semantics

Status: **cataloged candidate**. It defines conformance but authorizes no implementation
until independent architecture, security and privacy approval
(`docs/reviews/policy-core-v3-review.md`).

This document is normative for `libre-ai:policy-core@3.0.0`. It is complete: no other text
is needed to read it. The JSON Schemas and `world.wit` define the accepted bytes and
boundary; this document defines the only valid decoding, evaluation, ordering and hashing
behavior. The key words **MUST**, **MUST NOT**, **SHOULD** and **MAY** have the meaning
defined by RFC 2119. The last section, which is not normative, records how this text
derives from the locked policy-core-v2 one.

## 1. Scope and safety boundary

`PolicyEvaluation` is an advisory eligibility statement for one approved policy,
one sourced model snapshot, one declared need and one explicit instant. `eligible`
means only “all rules are satisfied for these exact inputs”. It is not a ranking,
purchase recommendation, authorization, approval or instruction to transact.
The evaluator MUST NOT buy, select, deploy or approve anything and MUST NOT create
or mutate a policy approval. It verifies approval separation and subject binding,
but the authorized caller MUST establish the authenticity and current validity of
`approval.reference` before invocation.

The world is pure. It receives no clock, network, storage, identity, authorization
or randomness capability. The caller authorizes access before invoking it. The
resolved WIT world exports one `api` interface and MUST have zero imports.

`engineVersion` MUST be an immutable SemVer constant embedded in the qualified
component, with major version 3. It MUST NOT be accepted from the caller or derived
from any input. The reference vectors use `3.0.0`; changing the embedded version
changes the evaluation content, ID and digest even when all policy inputs are
unchanged.

## 2. Accepted values and validation order

Inputs are UTF-8 JSON objects conforming respectively to:

1. `policy-definition.v2.schema.json` (maximum 8 MiB);
2. `model-snapshot.v2.schema.json` (maximum 8 MiB);
3. `policy-need.v2.schema.json` (maximum 8 MiB).

`evaluated-at` is exactly 20 UTF-8 bytes when valid and the successful JCS output is at most 2 MiB. A larger input or output returns `policy.input_invalid` without partial output.

Before any decode, the evaluator MUST check the byte lengths of all three JSON
inputs and `evaluated-at`; a value above its ceiling returns `policy.input_invalid`.
After producing successful JCS bytes, the evaluator MUST apply the output ceiling
before returning them, with the same refusal. Exact-ceiling values pass preflight.

Before implementation, `contracts/fixtures/policy-core-v2/resource-budgets.v1.json`
fixes the qualification ceilings and exact/+1 boundary cases derived from these schemas. At most 1,000 rules
and 1,000 facts in either namespace can produce 1,000,000 matched rule/occurrence
evaluations. A policy set has at most 100 members; set lookup MUST use sorted binary
search or an equivalent lookup with at most 7 scalar comparisons, never a linear
100-member scan for every occurrence. Duplicate detection MUST use canonical hashes
or ordered indexes, not pairwise deep comparison. Peak component linear memory,
including WIT input/output copies, decoded values, indexes, canonicalization/hashing scratch and
the result, MUST NOT exceed 256 MiB. Caller-owned buffers outside component linear
memory are excluded. A schema-valid input within all byte/cardinality ceilings MUST
NOT be refused merely because an implementation chose a less efficient algorithm;
such a component fails qualification. Wall-clock and WASM fuel thresholds are set
only in implementation Gate B against the exact component, runtime and documented
reference hardware; they cannot alter these deterministic work ceilings.

The decoder MUST reject, with `policy.input_invalid` (validation step 2), every input that
holds one of the following defects. Each defect has a class name, used only by the
conformance diagnostic below:

- `bom`: the input starts with the octets `EF BB BF`;
- `invalid-utf8`: the input is not UTF-8;
- `invalid-json`: the text is not one JSON text of the RFC 8259 grammar (its sections 2
  to 7: values, objects, arrays, numbers, strings and their escapes, insignificant
  whitespace) followed only by insignificant whitespace; a number literal outside that
  grammar (`01`, `+1`, `NaN`, `1.`) is such a defect;
- `duplicate-member`: a member name equal, once its escapes are decoded, to an earlier
  name of the same object;
- `unpaired-surrogate`: an escape `\uD800` to `\uDFFF` that is not part of a
  high-then-low escaped pair;
- `max-depth`: a value whose depth exceeds 64, the `decoderQualification.maximumJsonDepth`
  of the resource budgets;
- `invalid-number`: a grammatical number whose IEEE-754 binary64 value is not finite
  (`1e400`).

The top-level value has depth 0. An element of an array and the value of an object member
have the depth of that array or object plus 1, scalars included. Thus 64 nested arrays
around `0` are accepted and 65 are refused, while 65 nested empty arrays are accepted: the
innermost has depth 64 and holds no value.

Every JSON number is interpreted as an IEEE-754 binary64 value and is schema-bounded to the
inclusive safe-integer range `[-9007199254740991, 9007199254740991]`; fractional values in
that range are allowed. `-0` and `0` are equal. Strings are never case-folded, trimmed or
Unicode-normalized.

A component MAY detect these defects in any order and MAY stop at the first defect it
meets, `max-depth` included: every defect returns the same `input-invalid` variant, so the
order has no effect at the WIT boundary. The conformance of a component is judged on the
WIT variant only, and no defect class crosses the boundary.

The class of a refused input is a conformance diagnostic of the reference oracle
(`tools/quality/policy-core-raw-inputs.ts`, `decodeStrictJsonGrammarFirst`, run at the
budget depth) and of the `defect` field of the raw-input vectors; it binds no component.
The oracle gives the class by this precedence:

1. `bom`, then `invalid-utf8`;
2. `invalid-json`, whatever other defect the text also holds and wherever that defect
   stands: a defect earlier in the octets never takes precedence over a grammar defect
   later in them;
3. on a grammatical text, the first other defect in document order. A defect stands at
   the opening quotation mark of the repeated name (`duplicate-member`), at the backslash
   of the escape (`unpaired-surrogate`), and at the first octet of the value (`max-depth`,
   `invalid-number`). At the same octet, the earlier class of the defect list above is
   given: 65 nested arrays around `1e400` give `max-depth`.

A component MUST stay within the peak component linear memory budget
(`memoryQualification.peakComponentLinearMemoryBytes`, 256 MiB) on every input within the
8 MiB input ceilings, refused inputs included. Deciding the whole grammar before any other
defect is not required of a component and does not exempt it from that budget.

Every policy and fact source URI MUST be a sanitized public HTTPS citation with
a DNS-shaped host containing a public-style alphabetic top-level label, no IP
literal, `localhost`, userinfo, query, fragment or percent encoding, and at most
2,048 characters. It MUST NOT contain
credentials, tokens, email addresses or other personal data. `proposedBy` is an
opaque `usr_*` or `svc_*` principal ID; `approval.approverId` is an opaque `usr_*`
ID and never a name, email or external account identifier. `modelId` is an opaque
`mdl_*` identifier. String facts are bounded machine tokens without whitespace or
`@`; fact names/values and need facts MUST describe models and organizational
requirements only. They MUST NOT contain natural-person identifiers, free-form
personal content, credentials or secrets. The authorized caller owns identity mapping, data
minimization and source sanitization before invocation.

`evaluated-at`, every snapshot `source.retrievedAt` and every emitted `evaluatedAt`
MUST be a real Gregorian instant in the exact UTC-seconds form
`YYYY-MM-DDTHH:mm:ssZ`. Leap seconds and fractional seconds are rejected.

Validation occurs before rule evaluation, in this order:

1. apply input byte preflight, otherwise `policy.input_invalid`;
2. decode with depth at most 64 and validate all three schemas, otherwise `policy.input_invalid`;
3. validate `evaluated-at`, otherwise `policy.evaluated_at_invalid`;
4. reject repeated rule IDs, otherwise `policy.rule_id_duplicate`;
5. require `approval.actorKind = human` and `approval.approverId != proposedBy`, otherwise
   `policy.approval_invalid`;
6. verify the three input digests and `approval.subjectDigest`, otherwise
   `policy.digest_mismatch`;
7. require exact equality of policy, snapshot and need `tenantId`, otherwise
   `policy.tenant_mismatch`.

A failure returns only the closed WIT `error-code`, never a `PolicyEvaluation` or
free-form string. The host maps variants to the public code and optional static
label below; no input value, parser diagnostic, tenant, fact, reviewer identity or
library error crosses the component boundary.

| WIT variant | Public code | Optional host label |
| --- | --- | --- |
| `input-invalid` | `policy.input_invalid` | `input does not conform to policy-core-v3` |
| `evaluated-at-invalid` | `policy.evaluated_at_invalid` | `evaluated-at is not canonical UTC seconds` |
| `rule-id-duplicate` | `policy.rule_id_duplicate` | `policy contains duplicate rule ids` |
| `approval-invalid` | `policy.approval_invalid` | `policy approval separation is invalid` |
| `digest-mismatch` | `policy.digest_mismatch` | `input digest does not match canonical content` |
| `tenant-mismatch` | `policy.tenant_mismatch` | `policy, snapshot and need tenants differ` |

Every HTTP boundary that exposes a policy-core-v3 result exposes only a stable
`error.code` and opaque `requestId`. It MUST NOT serialize the optional host label, a
library error or any other free-form message. A UI MAY map the code to a local static
translation after receiving the refusal.

## 3. Fact namespaces, cardinality and duplicates

A rule resolves its `fact` by exact name only:

- `need.*` names are looked up only in `PolicyNeed.facts`;
- `model.*` names are looked up only in `ModelSnapshot.facts`.

There is no fallback, alias, path traversal, case folding or derived fact. A name
may occur zero, one or several times. Exact duplicate fact objects are rejected by
the schemas (`uniqueItems: true`). Equal name/value pairs with distinct snapshot
sources are not exact duplicates and remain distinct occurrences.

- zero occurrences produce `unknown / policy.fact_absent`;
- one occurrence is evaluated directly;
- several occurrences are all evaluated (universal, not existential semantics),
  then reduced with `failed > unknown > satisfied`.

Thus no implementation may cherry-pick a satisfying occurrence. Input array order
never affects a rule status.

## 4. Operator and type matrix

A fact occurrence is always one scalar. Arrays are policy sets and are legal only
as the right-hand value of `in` and `not-in`.

| operator | rule `value` | occurrence | predicate |
| --- | --- | --- | --- |
| `equals` | string, number or boolean | same scalar type | `occurrence = value` |
| `not-equals` | string, number or boolean | same scalar type | `occurrence ≠ value` |
| `in` | non-empty homogeneous set of strings, numbers or booleans | same type as set items | some set item equals occurrence |
| `not-in` | non-empty homogeneous set of strings, numbers or booleans | same type as set items | no set item equals occurrence |
| `at-least` | number | number | `occurrence ≥ value` |
| `at-most` | number | number | `occurrence ≤ value` |

String equality is exact Unicode scalar-sequence equality. Boolean equality is
exact. Number equality and ordering use IEEE-754 binary64 comparisons; schemas
exclude NaN and infinities. Set order has no meaning. No coercion is permitted:
`"1"`, `1` and `true` are three different types. An occurrence with a disallowed
type is `unknown / policy.fact_type_mismatch`; negated operators MUST NOT turn a
type mismatch into satisfaction. A rule with a disallowed operator/value
combination is schema-invalid and returns `policy.input_invalid`.

## 5. Freshness

`maxSourceAgeDays` is legal only for a `model.*` rule. For each matched model fact,
let:

```text
ageSeconds = instant(evaluated-at) - instant(fact.source.retrievedAt)
maximumAgeSeconds = maxSourceAgeDays × 86400
```

The multiplication is exact integer arithmetic. The occurrence is fresh iff
`0 ≤ ageSeconds ≤ maximumAgeSeconds`; the upper boundary is inclusive.

- `ageSeconds < 0` gives `unknown / policy.source_from_future`, whether or not a
  maximum age is configured;
- if a maximum is configured and `ageSeconds > maximumAgeSeconds`, the occurrence
  gives `unknown / policy.snapshot_stale`;
- without a maximum, any non-future source age is accepted.

Freshness is checked before type and operator evaluation. Need facts have no source
age. The policy rule's own source date and snapshot `capturedAt` are not substituted
for the matched fact's `retrievedAt`.

## 6. Occurrence and rule evaluation

For each occurrence, in order:

1. apply the freshness rules when it is a model fact;
2. require the operator's occurrence type;
3. evaluate the predicate in section 4;
4. emit `satisfied / policy.rule_satisfied` when true, otherwise
   `failed / policy.rule_failed`.

A rule reduces its occurrence outcomes by status priority:

1. any `failed` → `failed / policy.rule_failed`;
2. otherwise any `unknown` → `unknown`, choosing the first present reason in this
   fixed order: `policy.source_from_future`, `policy.snapshot_stale`,
   `policy.fact_type_mismatch`, `policy.fact_absent`;
3. otherwise → `satisfied / policy.rule_satisfied`.

Exactly one `ruleResult` is emitted per policy rule. `ruleResults` MUST be sorted by
ascending raw ASCII `rule.id`; IDs are unique and schema-limited to ASCII. Policy
rule order, fact order and set-item order MUST NOT affect this output order.

## 7. Verdict

After every rule has a result:

1. if any result is `failed`, verdict is `ineligible`;
2. otherwise, if any result is `unknown` and at least one corresponding rule has
   `unknown: ineligible`, verdict is `ineligible`;
3. otherwise, if any result is `unknown`, verdict is `indeterminate`;
4. otherwise every result is `satisfied` and verdict is `eligible`.

The result status remains `unknown` when its rule maps unknown to `ineligible`; the
verdict records the disposition without falsifying the evidence state. Therefore:

- `eligible` has only satisfied results;
- `indeterminate` has at least one unknown result and no failed result;
- `ineligible` has at least one failed result, or at least one unknown result whose
  policy disposition is `ineligible`.

A failed rule has priority over all unknown rules. Unknown can never yield
`eligible`, and no UI or caller may override it to `eligible`.

## 8. Origin is not jurisdiction

The evaluator MUST NOT derive, copy or approximate a jurisdiction from model,
provider or company origin; hosting country; headquarters; source URI; model ID;
or any other fact. In particular, `model.provider.origin` does not satisfy a rule
on `model.hosting.jurisdiction`. If the exact jurisdiction fact is absent, the rule
is unknown. If origin and jurisdiction are both present and differ, each remains
an independent fact and only the exact rule name is read.

A source adapter that labels origin-derived data as jurisdiction violates this
contract and MUST be refused upstream as `policy.origin_jurisdiction_conflated`.
The pure evaluator itself performs no inference and cannot repair provenance.

## 9. Canonicalization and digests

`JCS(x)` is RFC 8785 JSON Canonicalization Scheme over the validated IEEE-754 value.
`H(label, x)` is lowercase hexadecimal SHA-256 over these exact bytes:

```text
UTF8(label) || 0x00 || JCS(normalize(x))
```

Normalization changes only arrays declared unordered by this section:

- policy `rules`: sort by ascending rule `id`;
- `in`/`not-in` rule sets: sort by ascending JCS scalar bytes;
- need facts: sort by `(name, type-rank, JCS(value))`;
- snapshot facts: sort by `(name, type-rank, JCS(value), JCS(source))`;
- evaluation `ruleResults`: already sorted by rule ID.

The type rank is `boolean = 0`, `number = 1`, `string = 2`. All comparisons above
are bytewise unsigned lexicographic comparisons. No other array is reordered.

Input digests are:

- policy: `H("libre-ai.policy-definition.v2", {schemaVersion, id, tenantId,
  version, status, proposedBy, rules})`; both `policy.digest` and
  `policy.approval.subjectDigest` MUST equal it;
- snapshot: `H("libre-ai.model-snapshot.v2", snapshot without digest)`;
- need: `H("libre-ai.policy-need.v2", need without digest)`.

The digest labels name payload schemas, not the world version: they are the labels written
in this section, `libre-ai.policy-evaluation.v2` below included.

After verdict and sorted rule results are known, construct the unsigned evaluation
with these fields and no others, in any object-member order:

```text
schemaVersion, tenantId, policyId, policyDigest, snapshotId, snapshotDigest,
needDigest, engineVersion, verdict, ruleResults, evaluatedAt
```

Then:

```text
evaluationDigest = H("libre-ai.policy-evaluation.v2", unsignedEvaluation)
id = "urn:libre-ai:evaluation:" || evaluationDigest
digest = evaluationDigest
```

The final object is the unsigned evaluation plus `id` and `digest`. The digest does
not include either field, avoiding recursion; the ID is content-addressed by the
same digest. Given the same semantic inputs, engine version and evaluated instant,
TypeScript and Rust MUST emit byte-identical JCS output, ID, digest, verdict and
ordered trace.

## 10. Conformance vectors

- `contracts/fixtures/policy-core-v2/operators.json` is the atomic operator/type
  corpus;
- `contracts/fixtures/policy-core-v3/golden.json` contains complete cross-runtime
  evaluations under engine version `3.0.0` and closed WIT `error-code` vectors;
- `contracts/fixtures/policy-core-v2/resource-budgets.v1.json` fixes byte,
  cardinality, semantic-work, decoder-depth and peak-memory qualification ceilings;
- `contracts/fixtures/policy-core-v3/raw-inputs/manifest.json` contains decoder vectors:
  refused inputs, each with its WIT variant (`expectedErrors`) and its oracle class
  (`defect`), and accepted inputs (`acceptedCases`) that fix the depth bound;
- `contracts/fixtures/policy-core-v3/memory-qualification.v1.json` contains refused inputs
  of adversarial shape at the input ceilings, each generated from its segments, for the
  peak-memory qualification.

A refused raw input that names an `argument` and a `goldenCase` is a carrier: it is passed
to `evaluate` as that argument, with the other arguments and `evaluated-at` of that golden
case. Apart from its one decoder defect it is the golden argument itself, so a component
whose decoder lets that defect through evaluates it instead of refusing it. A refused raw
input that names no argument is passed in turn as each of `policy`, `snapshot` and `need`,
with the other arguments and `evaluated-at` of any golden case, and is refused each time. A
memory qualification input is passed as the argument it names, in the same way.

A component conforms only if it returns the expected result of every golden vector,
returns the expected WIT variant for every refused raw input and every memory
qualification input, and stays within every budget. The `defect` of a raw-input vector and
the accepted raw inputs bind the reference oracle only (section 2). Implementations MUST
NOT rewrite expected vectors from their own output.

## Changes from policy-core-v2 (not normative)

This text was derived from `contracts/wit/policy-core-v2/SEMANTICS.md`, the locked file
whose SHA-256 is
`3525078d3baeb452e146d766df2afb87a3836d69197a794ef82a641be1d055cc`, by the four changes
below. Every block of a numbered section of that file that no change names is kept here
verbatim. `tools/quality/policy-core-v3.test.ts` checks it: the policy-core-v2 blocks
missing from this text and the blocks this text adds are exactly the ones whose first line
is quoted below, and the sections that differ are exactly the ones named. The check reads
the policy-core-v2 file; the normative text above does not depend on it.

### C1. Version

Sections: 1, 2, 9.

The world is `libre-ai:policy-core@3.0.0` and the engine version has major 3 (section 1).
Given the same inputs, a policy-core-v3 evaluation has the verdict and rule results of a
policy-core-v2 evaluation and differs from it by `engineVersion`, `id` and `digest`; at the
WIT boundary nothing else distinguishes the two worlds. The host label of `input-invalid`
names policy-core-v3, and the HTTP boundary sentence binds every HTTP boundary that exposes
a policy-core-v3 result, where the policy-core-v2 text named "the v2 HTTP boundary"
(section 2). Section 9 now says that its digest labels name payload schemas; they are the
policy-core-v2 labels.

Replaced policy-core-v2 blocks:

> `engineVersion` MUST be an immutable SemVer constant embedded in the qualified
> | WIT variant | Public code | Optional host label |
> The v2 HTTP boundary exposes only a stable `error.code` and opaque `requestId`.

Added blocks:

> `engineVersion` MUST be an immutable SemVer constant embedded in the qualified
> | WIT variant | Public code | Optional host label |
> Every HTTP boundary that exposes a policy-core-v3 result exposes only a stable
> The digest labels name payload schemas, not the world version: they are the labels written

### C2. Decoder precedence and component freedom

Sections: 2.

policy-core-v2 lists the decoder defects in one sentence, files a number literal outside
the RFC 8259 grammar under its number defect, and fixes no precedence. policy-core-v3
files such a text under `invalid-json`, whatever semantic defect it also holds, in the
reference oracle; it lets a component stop at the first defect, since every defect returns
`input-invalid`, and it binds the component to the memory budget on every input within the
input ceilings. Owner arbitration of 2026-11-23, recorded in
`docs/adr/2026-11-23-policy-core-v3.md`: the classes are a diagnostic of the oracle.

Why the memory clause: at the security review of 2026-11-23
(`docs/reviews/policy-core-v3-review.md`), on 8,388,608 octets of `[`, the reference
oracle, which validates the grammar in full before classifying, peaked at 626 MiB resident,
against 24 MiB for the policy-core-v2 first-defect decoder, which stops at depth 65. These
are process measurements of the oracle under Bun, not of a component; the review on
`52801bf` measured 623 MiB on the same input.

Replaced policy-core-v2 block:

> The decoder MUST reject a BOM, invalid UTF-8, duplicate JSON object member names,

Added blocks:

> The decoder MUST reject, with `policy.input_invalid` (validation step 2), every input that
> - `bom`: the input starts with the octets `EF BB BF`;
> Every JSON number is interpreted as an IEEE-754 binary64 value and is schema-bounded to the
> A component MAY detect these defects in any order and MAY stop at the first defect it
> The class of a refused input is a conformance diagnostic of the reference oracle
> 1. `bom`, then `invalid-utf8`;
> A component MUST stay within the peak component linear memory budget

The candidate `canonicalize` semantics of `signalement-policy-receipt-v1` (its
`canonicalize` section, step 3) gives "the first defect met" left to right among its own
codes. On `{"value":"\uD800"}x` it gives `canonicalize.lone_surrogate` where the
policy-core-v3 oracle gives `invalid-json`. The two are different worlds with different
code sets; neither text reinterprets the other, and this record changes neither.

### C3. Conformance vectors

Sections: 10.

The golden file and the raw-input manifest of policy-core-v3 replace those of
policy-core-v2; the operator corpus and the resource budgets are kept, and a memory
qualification file is added. A component is judged on WIT variants and budgets, never on
the oracle class. Section 10 states the argument each raw input is passed as: carrier
vectors, schema-valid once their single defect is ignored, are the only refused inputs that
a component with a permissive decoder can fail; policy-core-v2 had none, and every one of
its raw inputs was refused by schema validation alone.

Replaced policy-core-v2 blocks:

> - `contracts/fixtures/policy-core-v2/operators.json` is the atomic operator/type
> An implementation conforms only if every vector and budget matches exactly.

Added blocks:

> - `contracts/fixtures/policy-core-v2/operators.json` is the atomic operator/type
> A refused raw input that names an `argument` and a `goldenCase` is a carrier: it is passed
> A component conforms only if it returns the expected result of every golden vector,

### C4. Nesting depth and equal positions

Sections: 2.

policy-core-v2 says "nesting deeper than 64 values" without saying how depth is counted.
policy-core-v3 counts the top-level value as depth 0 and refuses a value deeper than 64,
the count that the policy-core-v2 budget test executes
(`crates/sdk-rs/tests/policy_core_vectors.rs`), so policy-core-v3 accepts the nesting that
test accepts. It states where each defect stands and that, at the same octet, the earlier
class of the list is given. Raw-input vectors fix both sides of the bound.

Added block:

> The top-level value has depth 0. An element of an array and the value of an object member

Two other readers of this repository count differently, and neither qualifies
policy-core-v3: `crates/sdk-rs/src/strict_json.rs` gives the top-level value depth 1 with a
maximum of 64 (the rule of the candidate `signalement-policy-receipt-v1` semantics) and so
refuses 64 nested arrays around `0`; `tools/quality/strict-json-differential.test.ts` sets
`TYPESCRIPT_MAX_DEPTH = 63` to align `parseStrictJson` with it. This change modifies
neither. The Rust instrument that recomputes the raw-input classes reads with serde_json,
whose recursion limit of 128 containers fires before its depth check when the budget depth
exceeds 126; its test refuses such a budget.
