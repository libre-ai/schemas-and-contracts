# policy-core-v3 — normative semantics

Status: **cataloged candidate**. It defines conformance but authorizes no implementation
until independent architecture, security and privacy approval
(`docs/reviews/policy-core-v3-review.md`).

This document is normative for `libre-ai:policy-core@3.0.0`. The key words **MUST**,
**MUST NOT**, **SHOULD** and **MAY** have the meaning defined by RFC 2119.

## Base text

policy-core-v3 is the locked policy-core-v2 world with a different decoder precedence.
Its normative text is `contracts/wit/policy-core-v2/SEMANTICS.md`, the file whose SHA-256 is
`3525078d3baeb452e146d766df2afb87a3836d69197a794ef82a641be1d055cc`, read with changes C1 to
C4 below. That file is locked and never changes in place; where it and this document
disagree, this document prevails. Every section of the base text that no change names
applies to policy-core-v3 unchanged, in particular: the scope and the zero-import world
(section 1), the input ceilings, the validation order and the error mapping (section 2,
except its decoder paragraph), fact namespaces (3), operators (4), freshness (5), rule
evaluation (6), verdict (7), origin and jurisdiction (8), and canonicalization and digests
(9).

The WIT boundary (`world.wit`) is the one of policy-core-v2 under package version `3.0.0`:
same function, same arguments, same closed `error-code`. The payloads are unchanged: the
inputs are `policy-definition.v2`, `model-snapshot.v2` and `policy-need.v2`, the output is
`policy-evaluation.v2`.

## C1. Version

- The base text's `libre-ai:policy-core@2.0.0` reads `libre-ai:policy-core@3.0.0`.
- The embedded `engineVersion` of a policy-core-v3 component is a SemVer constant whose
  major is 3; the reference vectors use `3.0.0`. As the base text states (section 1), the
  engine version enters the evaluation content, ID and digest: a v3 evaluation of the same
  inputs has a different `id` and `digest` from the v2 one, and its verdict and rule results
  are the same.
- The digest labels of section 9 name payload schemas, not the world, and are unchanged:
  `libre-ai.policy-definition.v2`, `libre-ai.model-snapshot.v2`, `libre-ai.policy-need.v2`
  and `libre-ai.policy-evaluation.v2`.
- The optional host label of `input-invalid` (section 2 table) reads
  `input does not conform to policy-core-v3`. The public code stays `policy.input_invalid`.

## C2. Decoder precedence

This change replaces the first sentence of the base text's decoder paragraph (section 2,
"The decoder MUST reject a BOM, …"). The rest of that paragraph (numbers as binary64,
schema-bounded to the safe-integer range, fractions allowed, `-0` equal to `0`, strings
never folded) applies unchanged.

The decoder reads each JSON input in these steps; the first step that refuses gives the
defect:

1. `bom` — the input starts with `EF BB BF`.
2. `invalid-utf8` — the input is not UTF-8.
3. `invalid-json` — the text is not one JSON text of the RFC 8259 grammar (sections 2 to 7:
   values, objects, arrays, numbers, strings and their escapes, insignificant whitespace),
   followed only by insignificant whitespace. This defect is given whatever defect of step 4
   the text also holds, wherever that defect stands in the text: a semantic defect earlier
   in the octets never takes precedence over a grammar defect later in them.
4. On a text that conforms to that grammar, the first of these defects in document order:
   - `duplicate-member` — a member name equal, once its escapes are decoded, to an earlier
     name of the same object;
   - `unpaired-surrogate` — an escape `\uD800` to `\uDFFF` that is not a high surrogate
     immediately followed by an escaped low surrogate;
   - `max-depth` — nesting deeper than 64 values;
   - `invalid-number` — a number whose IEEE-754 binary64 value is not finite (`1e400`).

Consequences, each fixed by a raw-input vector:

- the base text refused "non-JSON numbers" with the number defect; under policy-core-v3 a
  number literal outside the RFC 8259 grammar (`01`, `+1`, `NaN`, `1.`) makes the text
  non-grammatical and gives `invalid-json`; `invalid-number` is left to a grammatical
  literal outside the finite binary64 domain;
- `[1x]`, `"\ud800\uZZZZ"`, `{"value":"\uD800"}x` and `{"key":1,"key":2,}` give
  `invalid-json`.

The defect is a conformance diagnostic. At the component boundary every defect of the four
steps returns `input-invalid` (base text, validation step 2), as in policy-core-v2: for
every input, the WIT result of policy-core-v3 differs from the one of policy-core-v2 only by
the engine version of change C1.

Cost. Step 3 can be decided by validating the whole grammar before classifying (two passes
over the input) or in one pass that records the first semantic defect and returns it only if
the text ends grammatical. Both conform; the reference oracle
(`tools/quality/policy-core-raw-inputs.ts`, `decodeStrictJsonGrammarFirst`) uses two passes.

### Difference from the candidate `canonicalize` semantics

`contracts/wit/signalement-policy-receipt-v1/SEMANTICS.md` (its `canonicalize` section,
step 3) gives "the first defect met" left to right among its codes. On
`{"value":"\uD800"}x` that semantics gives `canonicalize.lone_surrogate` where
policy-core-v3 gives `invalid-json`. The two are different worlds with different code sets;
neither text reinterprets the other, and this record changes neither.

## C3. Conformance vectors

This change replaces section 10 of the base text.

- `contracts/fixtures/policy-core-v2/operators.json` remains the atomic operator/type
  corpus: section 4 is unchanged.
- `contracts/fixtures/policy-core-v2/resource-budgets.v1.json` remains the qualification
  ceilings: no ceiling changes.
- `contracts/fixtures/policy-core-v3/golden.json` holds the twenty cases of the
  policy-core-v2 golden file with the same inputs, verdicts, rule results and error
  variants; each expected evaluation carries `engineVersion` `3.0.0` and the `id` and
  `digest` recomputed by section 9.
- `contracts/fixtures/policy-core-v3/raw-inputs/manifest.json` holds the decoder refusals:
  the nine policy-core-v2 raw inputs, byte-identical (`carriedFrom`), the four of them that
  are not grammatical now filed `invalid-json`, and the precedence cases of change C2.

An implementation conforms only if every vector and budget matches exactly.
Implementations MUST NOT rewrite expected vectors from their own output.

## C4. Points left to review

- The base text does not say how nesting depth is counted (whether the top-level value has
  depth 0 or 1); this change keeps its wording, "deeper than 64 values", and no raw-input
  vector fixes the boundary, as in policy-core-v2.
- Whether a defect class should ever cross the component boundary is unchanged: it does
  not.
