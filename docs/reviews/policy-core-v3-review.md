# Review dossier — policy-core v3 (candidate)

- **Candidate contract:** `policy-core-v3` (catalog entry after the post-lock baseline).
- **Status:** `pending-independent-agent-review` (catalog `review.state`). Role passes on
  `133ba2b`: architecture `reject`, security `reject`, privacy
  `approve-with-minor-reservations`; on `52801bf`: architecture
  `approve-with-minor-reservations`, security `approve-with-minor-reservations`, privacy
  `approve`; on `475c8b4`: architecture `approve-with-minor-reservations`, security
  `approve-with-minor-reservations`, privacy `approve`. The candidate stays pending until
  the promotion pass and the owner's control.
- **Required roles (catalog `review.required`):** architecture, security, privacy — the
  roles policy-core-v2 names before implementation.
- **Decision:** `docs/adr/2026-11-23-policy-core-v3.md`, status proposed.
- **Semantics:** `contracts/wit/policy-core-v3/SEMANTICS.md`, a complete text since the
  commit after `133ba2b` (at `133ba2b` it was changes C1 to C4 to the locked policy-core-v2
  text).

## What this dossier is, and is not

It satisfies the catalog's mechanical requirement that a `candidate` entry name a
dossier under `docs/reviews/` bound to the independent agent review protocol
(`contracts/COMPATIBILITY.md` "Evidence"). The protocol lives in the governance
authority, `docs/reviews/AGENT-REVIEW-PROTOCOL.md`, which this repository does not
vendor; the reviewer uses the governance copy.

It is **not** a completed review. Each required role must run as a separate review-only
pass on an immutable commit, with its own findings, and each finding must be answered
before the contract leaves `candidate`. The authoring pass simulated none of them and
records no verdict.

## Material under review

| Artifact | Path |
| --- | --- |
| World | `contracts/wit/policy-core-v3/world.wit` (the v2 world under package `3.0.0`) |
| Semantics | `contracts/wit/policy-core-v3/SEMANTICS.md` |
| Golden vectors | `contracts/fixtures/policy-core-v3/golden.json` |
| Raw-input vectors | `contracts/fixtures/policy-core-v3/raw-inputs/` |
| Reused vectors | `contracts/fixtures/policy-core-v2/operators.json`, `resource-budgets.v1.json` |
| Oracle and checks | `tools/quality/policy-core-raw-inputs.ts` (`decodeStrictJsonGrammarFirst`), `tools/quality/policy-core-v3.ts`, `tools/quality/policy-core-v3.test.ts`, `crates/sdk-rs/tests/policy_core_vectors.rs` |

## Points given to the passes on `133ba2b`

1. **Architecture.** The semantics is a set of changes to the locked v2 text, named by
   digest, rather than a full copy. Review whether an implementer can read it without
   ambiguity, and whether a full text should replace it before the contract is locked.
2. **Architecture.** The observable WIT result differs from v2 only by the engine version:
   every decoder defect is `input-invalid` in both. The defect classes are conformance
   diagnostics. Review whether a major is proportionate for that change, as against a
   vector set outside the contract (the owner chose the major on 2026-11-23).
3. **Security.** The grammar is judged in full before any semantic class. Review the
   two-pass cost against the 8 MiB input ceiling and the resource budgets, which are
   unchanged.
4. **Security.** Depth counting is left as in v2 ("deeper than 64 values", change C4) and
   no vector fixes the boundary. Review whether v3 should close it before lock.
5. **Privacy.** No payload, field or error text changes; the host label of `input-invalid`
   names v3. Review that no defect class or parser diagnostic can cross the boundary.
6. **All.** The v3 golden vectors are derived from the v2 ones by recomputing the section 9
   digest under engine `3.0.0`; they are not the output of an evaluator. The TypeScript
   and Rust checks recompute the digests independently.

## Role passes

Each pass below is an immutable record: its verdict stands until a new pass of the same
role on a later commit replaces it. A finding marked **treated by the commit after
`133ba2b`** was answered by the authoring commit that adds this section; that answer does
not change the verdict, which a new pass must re-examine.

Contract and vector SHA-256 at `133ba2bd6bb6998cb2cc75dd359eddc2109bd9b1`, recomputed by
the passes:

| File | SHA-256 |
| --- | --- |
| `contracts/wit/policy-core-v3/world.wit` | `4056f02278e3c27b6fce114f011cfaceb58810abb07540fef4727919980ce825` |
| `contracts/wit/policy-core-v3/SEMANTICS.md` | `24a36d3ce9d59ebe12764447d6a51de0bfeed557026b123f5179ac86cb4cdca6` |
| `contracts/wit/policy-core-v2/SEMANTICS.md` (base text) | `3525078d3baeb452e146d766df2afb87a3836d69197a794ef82a641be1d055cc` |
| `contracts/fixtures/policy-core-v3/golden.json` | `0aa7755df2a5509aa840d7139b7967e77c392714f9a11c326f4c2a44a112b5e8` |
| `contracts/fixtures/policy-core-v3/raw-inputs/manifest.json` | `f116ca3b1e23b7cbbdce010f99f566875f41b9fd1578fcd80dfd358ca4fd0c0b` |
| `contracts/fixtures/policy-core-v2/operators.json` | `cb4c4d1929e01cfc6cd87d5f4386e54b9f3294ef6789c562f556d1b0c5db5bc2` |
| `contracts/fixtures/policy-core-v2/resource-budgets.v1.json` | `6f7ed86b5c84c9d29588d871908251370038dcabe90ebc646f2a9c1b620d8f77` |

### Architecture — `133ba2b` — verdict `reject`

- **reviewPassId:** none assigned by a runner, none proposed by the pass. Mode: specialized
  role `architecture`. Model: `claude-opus-5-5`. Protocol read in `project-governance` at
  `70fb8fa`.
- **Verdict:** `reject`. ADR-0056 D2 forbids `approve-with-minor-reservations` while
  required evidence is open (M1). The pass states that the verdict does not question the
  owner's choice of a major.
- **Evidence reproduced:** 14 of 14 v3 evaluation digests recomputed with `jq -S -c` and
  `shasum -a 256` (calibrated on v2, 14 of 14); `JSON.parse` against the RFC 8259 grammar,
  56 of 56 rows agree under Bun 1.4.4-canary.1; neutralization of `JSON.parse`: 15 pass,
  8 fail.
- **Limits:** Bun 1.4.4-canary.1 locally against `bun@1.4.0-canary.1` declared; the CI
  engine not checked; `ai-model-policy` read as a shallow clone at its served head, its
  tests not run.

| Finding | Severity | Disposition | Answer |
| --- | --- | --- | --- |
| M1. The class order of C2 cannot be checked at the component boundary: every raw vector expects `input-invalid`, and a v2 component under engine `3.0.0` would pass every v3 vector (the pass's inferred scenario, not a measurement on a component; measured: `cases=14 rejectedByV2Decoder=14 classDiffers=7`) | major | required evidence | **Treated by the commit after `133ba2b`.** Owner answer of 2026-11-23, "Classes = diagnostic d'oracle (Recommandé)": section 2 and section 10 now say that a component is judged on the WIT variant only and that the class binds the reference oracle only; ADR consequences updated |
| M2. The delta text is ambiguous: (a) "v2" sentences such as the HTTP boundary, (b) contradictory scope rules, (c) loss of the RFC 2119 MUST in the decoder sentence, (d) normative dependency on the v2 bytes | major | blocking for lock, not for `candidate` | **Treated by the commit after `133ba2b`.** The semantics is now a complete text: (a) the HTTP boundary sentence binds every boundary exposing a v3 result, and no normative sentence names the v2 world (a test greps for it); (b) no scope rule remains; (c) "The decoder MUST reject" is restored; (d) the v2 file is read only by the derivation test, not by the normative text |
| m1. `unpaired-surrogate`, read literally, covers the low half of a valid pair | minor | suggestion | **Treated by the commit after `133ba2b`:** "not part of a high-then-low escaped pair" |
| m2. No tie-break at equal position in step 4 | minor | suggestion | **Treated by the commit after `133ba2b`:** each defect's position is defined; at the same octet the earlier class of the list wins; vector `depth-65-non-finite-number` |
| m3. The oracle, as wired, never produces `max-depth` | minor | suggestion | **Treated by the commit after `133ba2b`:** `max-depth` is a v3 class, the oracle runs at `decoderQualification.maximumJsonDepth` |
| m4. No Rust check of the v3 raw-input vectors | minor | suggestion | **Treated by the commit after `133ba2b`:** `policy_core_v3_raw_inputs_follow_the_grammar_first_classes` in `crates/sdk-rs/tests/policy_core_vectors.rs` |

Consequences reported without finding: `ai-model-policy` vendors only `policy-core-v1` and
replays only the v2 golden; `project-governance` asserts 9 vendored worlds
(`crates/ecosystem-engine/tests/wit_contracts.rs:17`) and would need 10 and a `matches!`
entry if v3 is vendored; no catalog field says that v3 succeeds v2; evaluation IDs change
for the same inputs (14 of 14); `ai-model-policy` depends on `file:../schemas-and-contracts`
(how its CI produces that checkout not verified: hypothesis), its
`verifyPolicyCoreRawInputVectors` has no caller, and its decoder `serde_json::from_slice`
accepts a duplicate member (measured by the v2 sdk-rs test); `policy-evaluation.v2`
accepts `engineVersion` `3.0.0`.

Transcription completed after the architecture pass on `52801bf`: the "suggestion"
disposition of m2 to m4 was not stated by the `133ba2b` pass; that pass assigns it on
`52801bf`.

### Security — `133ba2b` — verdict `reject`

- **reviewPassId:** `policy-core-v3/security/133ba2b/2026-11-23`, proposed by the pass (no
  runner). Mode: specialized role `security`. Model: `claude-opus-5-5`.
- **Verdict:** `reject` under ADR-0056 D2 clause 3: M1 and M2 open as required evidence.
  The pass found no leak or bypass and states that the verdict only blocks the move from
  `candidate` to `locked`.
- **Evidence reproduced:** 2,100,000 fuzz inputs (3 seeds × 700,000): 0 acceptance
  difference between v2 and v3, 0 grammatical text filed `invalid-json`, 0 non-grammatical
  text filed in a semantic class, 0 exception; `cargo test --test policy_core_vectors`
  7 pass; neutralization of `JSON.parse`: 8 fail, 15 pass.

| Finding | Severity | Disposition | Answer |
| --- | --- | --- | --- |
| M1. The depth bound is open; the oracle cannot produce `max-depth`; two green tests of the repository disagree on 64 nested arrays around `0` | major | required evidence | **Treated by the commit after `133ba2b`:** top-level value at depth 0, refusal above 64, the count the v2 budget test executes; the eight vectors of the pass's table added byte-identical (refused cases and `acceptedCases`), plus `depth-65-non-finite-number` and `depth-64-non-finite-number`; the other counts of `strict_json.rs` and of the differential test named in the change record |
| M2. The grammar-first order removes the early stop at depth 65 and bounds neither stack nor memory (measured on 8 MiB of `[`: v2 `max-depth` in 1 ms at 24 MiB, v3 `invalid-json` in 127 to 137 ms at 626 MiB) | major | required evidence | **Treated by the commit after `133ba2b`.** With the owner answer on architecture M1: a component MAY stop at the first defect, `max-depth` included; the grammar-first order binds only the oracle; a component MUST stay within `peakComponentLinearMemoryBytes` on every input within the 8 MiB ceilings, with the pass's measurement cited as dated |
| m1. One verification chain for the v3 raw-input classes | minor | suggestion | **Treated by the commit after `133ba2b`:** second instrument in Rust, an iterative RFC 8259 recognizer then the v2 test seed, without `JSON.parse` |
| m2. The comment of `policy-core-raw-inputs.ts` attributes the reachable exception to the grammar pass; it is the `RangeError` of the recursive second pass | minor | suggestion | **Treated by the commit after `133ba2b`** |
| m3. `invalid-json-surrogate-bad-escape` does not tell v2 from v3; no vector fixes grammar against depth | minor | suggestion | **Treated by the commit after `133ba2b`:** the case carries a `note` saying so; vector `depth-65-then-trailing-octet` |

Leftovers reported by the pass, outside the repository: `$TMPDIR/cargohome` and
`$TMPDIR/ghcache`, refused by `scratch-clean`.

### Privacy — `133ba2b` — verdict `approve-with-minor-reservations`

- **reviewPassId:** `policy-core-v3@133ba2b/privacy/2026-11-23`, proposed by the pass (no
  runner). Mode: specialized role `privacy`. Model: `claude-opus-5-5`.
- **Verdict:** `approve-with-minor-reservations`; no required evidence open. It does not
  stand for the architecture or security roles.
- **Evidence reproduced:** the 14 fixture SHA-256 match the manifest; v2 against v3
  acceptance on 300,000 random inputs, 0 divergence; 14 of 14 v2 and v3 digests
  recomputed; the `invalid-json` message of the oracle carries no offset and no excerpt.

| Finding | Severity | Disposition | Answer |
| --- | --- | --- | --- |
| The HTTP boundary sentence has "the v2 HTTP boundary" as subject; nothing binds it to a boundary exposing a v3 result | minor | suggestion | **Treated by the commit after `133ba2b`:** section 2 binds every HTTP boundary exposing a policy-core-v3 result and names library errors |

Residual risk, prior to this candidate: input digests are unkeyed SHA-256 over
low-entropy content, so a guessed input can be confirmed; the base text forbids personal
data in facts.

### Architecture — `52801bf` — verdict `approve-with-minor-reservations`

- **reviewPassId:** none assigned by a runner, none proposed by the pass. Mode: specialized
  role `architecture`. Model: `claude-opus-5-5`. Protocol read in `project-governance` at
  `70fb8fa`. Starting point: the architecture pass on `133ba2b`; fresh pass on the whole
  normative text.
- **Verdict:** `approve-with-minor-reservations`. M1 settled by the owner answer of
  2026-11-23; M2 and m1 to m4 treated; no required evidence open (ADR-0056 D2). It does not
  stand for the security or privacy roles and does not authorize the lock.
- **Contract and vector SHA-256 at `52801bf0667f114dcb2d06032bc043bb826f0f6b`:**
  `world.wit` `4056f02278e3c27b6fce114f011cfaceb58810abb07540fef4727919980ce825`;
  `SEMANTICS.md` `d3774eef304fc3d1033dd99ba87e118d3f84d41b4e6024c3dd71f2e48f8800fd`;
  `golden.json` `0aa7755df2a5509aa840d7139b7967e77c392714f9a11c326f4c2a44a112b5e8`
  (unchanged); `raw-inputs/manifest.json`
  `d8fa4719bac69e1f32e5a73951f9942f89d929c1f6fe1f6622fb579e16ff4be9`; `operators.json` and
  `resource-budgets.v1.json` unchanged.
- **Evidence reproduced:** v2 decoder against v3 manifest at depth 64: `cases=21
  rejectedByV2Decoder=21 classDiffers=8 v3MatchesDeclared=21 accepted=3`; the ten depth
  fixtures rebuilt by `printf` and `shasum -a 256`, 10 of 10 match; `bun test
  tools/quality/policy-core-v3.test.ts` 36 pass; `cargo test --test policy_core_vectors`
  9 pass; derivation test mutated three times: section 5 changed, red; section 2 kept block
  changed, red; block added to section 2, green.

| Finding | Severity | Disposition | Answer |
| --- | --- | --- | --- |
| m-a. The derivation test does not see a block added to a declared section (measured: an added "A component MAY accept duplicate member names" passes 36 of 36) | minor | suggestion | |
| m-b. No raw-input vector carries `schemaVersion` (measured 0 of 24), so every refused input is schema-invalid and a component without a strict decoder passes every refused case; the argument slot of a raw input is not stated (prior to this candidate, same in v2) | minor | suggestion | |
| m-c. Informative text in normative sections: lines 89-91 tie the depth count to a test file, lines 121-126 carry a dated measurement | minor | suggestion | |

Transcription of the `133ba2b` pass: faithful; the pass adds that M1 also measured
`rejectedByV2Decoder=14`, that it assigns the "suggestion" disposition to m2 to m4 now, and
that its limits were Bun 1.4.4-canary.1 locally against `bun@1.4.0-canary.1` declared.

### Security — `52801bf` — verdict `approve-with-minor-reservations`

- **reviewPassId:** `policy-core-v3/security/52801bf/2026-11-23`, proposed by the pass (no
  runner). Mode: specialized role `security`. Model: `claude-opus-5-5`. Replaces the
  security pass on `133ba2b`.
- **Verdict:** `approve-with-minor-reservations`. No blocking finding and no required
  evidence open (ADR-0056 D2). It is not a promotion approval and does not stand for the
  architecture or privacy roles.
- **Evidence reproduced:** depth table replayed: at the budget depth the oracle accepts 64
  nested arrays around `0`, 65 nested empty arrays and 64 nested `{"a":`, and refuses 65
  and 66 levels with `max-depth`; on 8 MiB of `[` the oracle still peaks at 623 MiB
  (v2: 24 MiB), within the text since a component may stop at the first defect; fuzz at
  depth 64 read from the budgets, 3 seeds × 700,000 inputs with a nesting generator: 0
  acceptance difference v2/v3, 0 precedence break, 0 exception; the same 2,100,000 inputs
  through the Rust instrument: 0 class difference with the TypeScript oracle, 0 panic; Rust
  instrument on 8 MiB adversarial inputs (open, balanced, balanced then `x`, open objects,
  long number, `[{},…]`): no stack overflow; neutralizing its grammar recognizer turns its
  test red (0 pass, 1 fail); `bun test tools/quality/policy-core-v3.test.ts` 36 pass;
  `cargo test --test policy_core_vectors` 9 pass; no dependency, lock or workflow change
  since `133ba2b`.

| File at `52801bf` | SHA-256 |
| --- | --- |
| `contracts/wit/policy-core-v3/world.wit` | `4056f02278e3c27b6fce114f011cfaceb58810abb07540fef4727919980ce825` |
| `contracts/wit/policy-core-v3/SEMANTICS.md` | `d3774eef304fc3d1033dd99ba87e118d3f84d41b4e6024c3dd71f2e48f8800fd` |
| `contracts/wit/policy-core-v2/SEMANTICS.md` | `3525078d3baeb452e146d766df2afb87a3836d69197a794ef82a641be1d055cc` |
| `contracts/fixtures/policy-core-v3/golden.json` | `0aa7755df2a5509aa840d7139b7967e77c392714f9a11c326f4c2a44a112b5e8` |
| `contracts/fixtures/policy-core-v3/raw-inputs/manifest.json` | `d8fa4719bac69e1f32e5a73951f9942f89d929c1f6fe1f6622fb579e16ff4be9` |
| `contracts/fixtures/policy-core-v2/operators.json` | `cb4c4d1929e01cfc6cd87d5f4386e54b9f3294ef6789c562f556d1b0c5db5bc2` |
| `contracts/fixtures/policy-core-v2/resource-budgets.v1.json` | `6f7ed86b5c84c9d29588d871908251370038dcabe90ebc646f2a9c1b620d8f77` |

| Finding | Severity | Disposition |
| --- | --- | --- |
| M1, M2, m1, m2, m3 of the `133ba2b` pass | — | treated, verified on `52801bf` |
| r1. The memory bound of section 2 is a MUST with no qualification case: `resource-budgets.v1.json` lists byte-length boundaries only. Gate B should measure peak linear memory on refused 8 MiB inputs of adversarial shape (8,388,608 `[`; 4 Mi balanced levels; `[{},…]`) | minor | suggestion |
| r2. The Rust instrument classes by serde_json message substrings (`surrogate`, `hex escape`, `number out of range`). Fails closed on an unknown message (panic); a substring collision after a version bump could misclass a diagnostic, with no WIT effect; pinned `=1.0.151`; a budget depth above ~127 would hit serde_json's recursion limit (128) first and panic | minor | suggestion |

Note: the depth bound has no WIT effect, since the three input schemas are closed (no
recursive `$ref`, `additionalProperties: false`), so an input at depth 64 or 65 is refused
by schema validation in any case; the bound matters for the oracle and for resources.

### Privacy — `52801bf` — verdict `approve`

- **reviewPassId:** `policy-core-v3@52801bf/privacy/2026-11-23`, proposed by the pass (no
  runner). Mode: specialized role `privacy`. Model: `claude-opus-5-5`. Fresh pass on
  `52801bf0667f114dcb2d06032bc043bb826f0f6b`, starting point `133ba2b` (ADR-0056 D2).
- **Verdict:** `approve`; no finding, no required evidence open. It replaces the privacy
  verdict on `133ba2b` and does not stand for the architecture or security roles.
- **Evidence reproduced:** v2 lines 97-100 byte-identical to v3 lines 158-161 (`cmp`);
  v2 lines 111-113 replaced by v3 lines 172-175, scope widened to every HTTP boundary
  exposing a v3 result and "a library error" added, MUST NOT kept; block comparison of
  v2 against the normative part of v3: 68 blocks, 59 verbatim, 9 not (3 header blocks and
  the 6 blocks C1 to C3 quote); host-label table differs only in the `input-invalid` row;
  24 of 24 raw-input SHA-256 match the manifest; the 10 `depth-*.bin` use only structural
  octets, `a`, `0`, `1e400`, `\uD800` and `x`; the 3 `acceptedCases` and the 14 earlier
  cases (identical apart from `note`) carry no personal data or real identifier; oracle
  error messages unchanged (comment-only diff); `bun test tools/quality/policy-core-v3.test.ts`
  36 pass, 0 fail.
- **Earlier finding:** HTTP boundary subject — closed by section 2, lines 172-175.
- **Limits:** `cargo test` not run; security and architecture matters (memory clause,
  depth count, component order freedom) not reviewed by this role.

Contract and vector SHA-256 at `52801bf0667f114dcb2d06032bc043bb826f0f6b`:

| File | SHA-256 |
| --- | --- |
| `contracts/wit/policy-core-v3/world.wit` | `4056f02278e3c27b6fce114f011cfaceb58810abb07540fef4727919980ce825` |
| `contracts/wit/policy-core-v3/SEMANTICS.md` | `d3774eef304fc3d1033dd99ba87e118d3f84d41b4e6024c3dd71f2e48f8800fd` |
| `contracts/wit/policy-core-v2/SEMANTICS.md` (derivation source) | `3525078d3baeb452e146d766df2afb87a3836d69197a794ef82a641be1d055cc` |
| `contracts/fixtures/policy-core-v3/golden.json` | `0aa7755df2a5509aa840d7139b7967e77c392714f9a11c326f4c2a44a112b5e8` |
| `contracts/fixtures/policy-core-v3/raw-inputs/manifest.json` | `d8fa4719bac69e1f32e5a73951f9942f89d929c1f6fe1f6622fb579e16ff4be9` |
| `contracts/fixtures/policy-core-v2/operators.json` | `cb4c4d1929e01cfc6cd87d5f4386e54b9f3294ef6789c562f556d1b0c5db5bc2` |
| `contracts/fixtures/policy-core-v2/resource-budgets.v1.json` | `6f7ed86b5c84c9d29588d871908251370038dcabe90ebc646f2a9c1b620d8f77` |

Residual risk, unchanged and prior to this candidate: input digests are unkeyed SHA-256
over low-entropy content, so a guessed input can be confirmed; section 2 forbids personal
data in facts.

### Answers to the `52801bf` passes (commit after `3dad272`)

Answered by the authoring commit that follows the one recording the passes above; the
verdicts on `52801bf` stand as recorded.

| Finding | Answer |
| --- | --- |
| Architecture m-a | The change record now quotes the first line of every added block as well as every replaced one, and the derivation test refuses an added block it does not quote. The pass's mutation (a block "A component MAY accept duplicate member names and keep the last value." added to section 2) turns the test red; with the new assertion replaced by a no-op it passes again |
| Architecture m-b | Five carrier vectors (`carrier-*`): the `policy` of golden case `all-operators-eligible` with one decoder defect each (`bom`, `invalid-json`, `duplicate-member`, `unpaired-surrogate`, `invalid-number`). Section 10 states the argument each raw input is passed as. Measured by the tests: `JSON.parse` over a non-fatal UTF-8 decode returns the exact golden policy on the `bom`, `duplicate-member`, `unpaired-surrogate` and `invalid-number` carriers; `serde_json::from_slice` on `duplicate-member`; a serde_json first-value reader without an end check on `duplicate-member` and `invalid-json`. A component built on any of them evaluates these inputs instead of returning `input-invalid` |
| Architecture m-c | The comparison with v2 (section 1), the link to the budget test (section 2) and the dated measurement (section 2) moved to the change record; a test refuses a test path, a date or a measurement in the normative text |
| Security r1 | `contracts/fixtures/policy-core-v3/memory-qualification.v1.json`, a v3 vector beside the reused v2 budgets (unchanged): three refused inputs at the 8 MiB ceiling (8,388,608 `[`; 4 Mi balanced levels; `[{},…]`), generated from segments, digests checked in TypeScript and Rust, oracle classes checked by the Rust instrument. Measuring peak linear memory on them stays an implementation gate (Gate B): no component exists here |
| Security r2 | The Rust instrument refuses a budget depth above 126, not 127: measured, at depth 126 an empty array at that depth is accepted, at 127 serde_json's limit of 128 containers fires before the seed. A test proves both sides and that the guard refuses 127 |

### Architecture — `475c8b4` — verdict `approve-with-minor-reservations`

- **reviewPassId:** none assigned by a runner, none proposed by the pass. Mode: specialized
  role `architecture`. Model: `claude-opus-5-5`. Protocol read in `project-governance` at
  `034ca75` (`AGENT-REVIEW-PROTOCOL.md` and ADR-0056 unchanged since `70fb8fa`). Starting
  point: the architecture pass on `52801bf`; fresh pass on sections 1, 2, 9, 10, the change
  record, the raw-input manifest and the memory qualification file.
- **Verdict:** `approve-with-minor-reservations`. m-a, m-b and m-c treated; no required
  evidence open (ADR-0056 D2). It does not stand for the security or privacy roles and does
  not authorize the lock.
- **Contract and vector SHA-256 at `475c8b4ed45359715b231edf310afde707273359`:**
  `world.wit` `4056f02278e3c27b6fce114f011cfaceb58810abb07540fef4727919980ce825`;
  `SEMANTICS.md` `43d8916572017e7050ff4ea7f085ee7645ff9daee5d48d78c525269bc2906345`;
  `golden.json` `0aa7755df2a5509aa840d7139b7967e77c392714f9a11c326f4c2a44a112b5e8`;
  `raw-inputs/manifest.json`
  `458de33ac992522cfaf4334dff8094031e7eba7fb5684190a4ce98e7b4a6b422`;
  `memory-qualification.v1.json`
  `7f6fd813d4e2f5a63f3f7181e197944663c2987f6dcc4d1b69a965785288b003`;
  `catalog-post-lock-additions.v1.json`
  `865888d0b01a21a87a269da5125401294ac1eb48359bac0cd4a53af5e8b994ae` (equals the pin);
  `operators.json` and `resource-budgets.v1.json` unchanged.
- **Evidence reproduced:** m-a mutation replayed (block added to section 2): red, 39 pass
  1 fail; `bun test tools/quality/policy-core-v3.test.ts` 40 pass; `cargo test --test
  policy_core_vectors` 11 pass; `check-specification-lock.ts` verified, 141 entries;
  carriers decoded independently with `jq` (last duplicate kept, BOM or final `x` removed):
  `duplicate-member`, `invalid-number`, `bom`, `invalid-json` equal the golden policy (`jq`
  refuses lone surrogates, so `unpaired-surrogate` rests on the `JSON.parse` test); body of
  an added block changed (256 to 512 MiB): green, 40 pass.

| Finding | Severity | Disposition | Answer |
| --- | --- | --- | --- |
| n1. Section 10 says a carrier holds one decoder defect; `carrier-unpaired-surrogate` and `carrier-invalid-number` also hold a duplicate member (measured: `status` twice, `version` twice), so they test their class only on a decoder that also keeps the last duplicate; the manifest notes say so, the normative sentence does not | minor | suggestion | |
| n2. "A memory qualification input is passed as the argument it names, in the same way": these cases name no golden case, so the source of the other arguments and `evaluated-at` is not stated | minor | suggestion | |
| n3. The change record pins the first line of an added block, not its body (measured: 256 to 512 MiB inside an added block stays green) | minor | suggestion | |

Residual risk: every carrier is a `policy`; a component that decodes `snapshot` or `need`
through another path is not reached (hypothesis, not measured).

### Security — `475c8b4` — verdict `approve-with-minor-reservations`

- **reviewPassId:** `policy-core-v3/security/475c8b4/2026-11-23`, proposed by the pass (no
  runner). Mode: specialized role `security`. Model: `claude-opus-5-5`. Replaces the
  security pass on `52801bf`.
- **Verdict:** `approve-with-minor-reservations`. No blocking finding, no required evidence
  open (ADR-0056 D2). Not a promotion approval; does not stand for other roles.
- **Evidence reproduced:** the three memory qualification inputs regenerated with
  `head`/`tr`/`yes`, independently of the repository generators: 8,388,608 bytes each, at
  the `policyInput` ceiling, SHA-256 equal to the file; oracle classes `invalid-json`,
  `max-depth`, accepted (null), as declared; TypeScript verifier peak 68 MiB resident
  (oracle alone on 8 MiB of `[`: 656 MiB); serde_json threshold replayed: budgets 125 and
  126 accept the deepest admitted arrays and objects and give `max-depth` one level
  deeper, budget 127 already panics with "recursion limit exceeded", so the guard at 126 is
  exact; fuzz at depth 64 from the budgets, 3 seeds × 700,000 inputs of which about 140,000
  per seed mutate the five carriers: 0 acceptance difference v2/v3, 0 precedence break,
  0 exception; 1,722,830 corpus inputs through the Rust instrument: 0 class difference,
  0 panic; `bun test tools/quality/policy-core-v3.test.ts` 40 pass;
  `cargo test --test policy_core_vectors` 11 pass.

The pass could not compute the SHA-256 table below (its last tool calls failed). The
coordinator of the passes filled it at `475c8b4` with `git show 475c8b4:<file> | shasum -a
256` for each file; the authoring commit recomputed the same eight values with the same
command.

| File at `475c8b4` | SHA-256 |
| --- | --- |
| `contracts/wit/policy-core-v3/world.wit` | `4056f02278e3c27b6fce114f011cfaceb58810abb07540fef4727919980ce825` |
| `contracts/wit/policy-core-v3/SEMANTICS.md` | `43d8916572017e7050ff4ea7f085ee7645ff9daee5d48d78c525269bc2906345` |
| `contracts/wit/policy-core-v2/SEMANTICS.md` | `3525078d3baeb452e146d766df2afb87a3836d69197a794ef82a641be1d055cc` |
| `contracts/fixtures/policy-core-v3/golden.json` | `0aa7755df2a5509aa840d7139b7967e77c392714f9a11c326f4c2a44a112b5e8` |
| `contracts/fixtures/policy-core-v3/raw-inputs/manifest.json` | `458de33ac992522cfaf4334dff8094031e7eba7fb5684190a4ce98e7b4a6b422` |
| `contracts/fixtures/policy-core-v3/memory-qualification.v1.json` | `7f6fd813d4e2f5a63f3f7181e197944663c2987f6dcc4d1b69a965785288b003` |
| `contracts/fixtures/policy-core-v2/operators.json` | `cb4c4d1929e01cfc6cd87d5f4386e54b9f3294ef6789c562f556d1b0c5db5bc2` |
| `contracts/fixtures/policy-core-v2/resource-budgets.v1.json` | `6f7ed86b5c84c9d29588d871908251370038dcabe90ebc646f2a9c1b620d8f77` |

| Finding | Severity | Disposition |
| --- | --- | --- |
| r1, r2 of the `52801bf` pass | — | treated, verified on `475c8b4` |
| r3. No `invalid-utf8` carrier, although a common permissive decoder (`new TextDecoder()` without `fatal`) admits it; the free `licence` string of `policySource` lets an invalid octet survive a lossy decode and pass the schema. A carrier `"licence":"CC-BY-4.0\xff"` on the golden policy would catch decoders that drop or replace the octet | minor | suggestion |
| r4. The TypeScript and Rust generators of `memory-qualification.v1.json` call `repeat(count)` before comparing the length with the ceiling; an absurd `count` allocates up to the engine limit instead of failing by name. The fixture is committed and reviewed: no security boundary | minor | suggestion |

### Privacy — `475c8b4` — verdict `approve`

- **reviewPassId:** `policy-core-v3@475c8b4/privacy/2026-11-23`, proposed by the pass (no
  runner). Mode: specialized role `privacy`. Model: `claude-opus-5-5`. Fresh pass on
  `475c8b4ed45359715b231edf310afde707273359`, starting point `52801bf` (ADR-0056 D2).
- **Verdict:** `approve`; no finding, no required evidence open. It replaces the privacy
  verdict on `52801bf` and does not stand for the architecture or security roles.
- **Evidence reproduced:** each of the five `carrier-*.bin`, its single defect removed,
  equals the `policy` of golden case `all-operators-eligible` (`jq -cS`, `cmp`; the
  surrogate carrier after removing its leading `"status":"\uD800"` member, which `jq`
  refuses); the only carrier string absent from `golden.json` is `"\uD800"`; the memory
  segments are only `[`, `]`, `[{}`, `,{}` and `] `, and the three regenerated inputs are
  8,388,608 octets with matching SHA-256; 29 of 29 raw-input SHA-256 and lengths match the
  manifest; the 21 earlier refused cases and 3 accepted cases are unchanged since
  `52801bf`; v2 lines 97-100 byte-identical in the normative text (line 149); "no defect
  class crosses the boundary", "binds no component", the HTTP boundary sentence and "with
  these fields and no others" each present once in the normative text; block comparison
  68 / 59 verbatim / 9 not; the sentence moved from section 1 to C1 ("nothing else
  distinguishes the two worlds") is a consequence of normative rules that stay (closed
  `error-code`, section 9 field list, constant `engineVersion`); the injection contract of
  section 10 adds no output, field, log or import and injects only published synthetic
  vectors; new checker messages quote no input octet;
  `bun test tools/quality/policy-core-v3.test.ts` 40 pass, 0 fail.
- **Transcription check:** the privacy record on `52801bf` matches the pass verbatim and is
  identical in `3dad272` and `475c8b4`.
- **Limits:** `cargo test` not run; memory measurement (Gate B) and the reading of "in the
  same way" for memory inputs are security and architecture matters.

Contract and vector SHA-256 at `475c8b4ed45359715b231edf310afde707273359`:

| File | SHA-256 |
| --- | --- |
| `contracts/wit/policy-core-v3/world.wit` | `4056f02278e3c27b6fce114f011cfaceb58810abb07540fef4727919980ce825` |
| `contracts/wit/policy-core-v3/SEMANTICS.md` | `43d8916572017e7050ff4ea7f085ee7645ff9daee5d48d78c525269bc2906345` |
| `contracts/wit/policy-core-v2/SEMANTICS.md` (derivation source) | `3525078d3baeb452e146d766df2afb87a3836d69197a794ef82a641be1d055cc` |
| `contracts/fixtures/policy-core-v3/golden.json` | `0aa7755df2a5509aa840d7139b7967e77c392714f9a11c326f4c2a44a112b5e8` |
| `contracts/fixtures/policy-core-v3/raw-inputs/manifest.json` | `458de33ac992522cfaf4334dff8094031e7eba7fb5684190a4ce98e7b4a6b422` |
| `contracts/fixtures/policy-core-v3/memory-qualification.v1.json` | `7f6fd813d4e2f5a63f3f7181e197944663c2987f6dcc4d1b69a965785288b003` |
| `contracts/fixtures/policy-core-v2/operators.json` | `cb4c4d1929e01cfc6cd87d5f4386e54b9f3294ef6789c562f556d1b0c5db5bc2` |
| `contracts/fixtures/policy-core-v2/resource-budgets.v1.json` | `6f7ed86b5c84c9d29588d871908251370038dcabe90ebc646f2a9c1b620d8f77` |

Residual risk, unchanged and prior to this candidate: input digests are unkeyed SHA-256
over low-entropy content, so a guessed input can be confirmed; section 2 forbids personal
data in facts.

## Before the lock: open minor suggestions

The three passes on `475c8b4` leave these minor suggestions open. None is required
evidence and none is treated by the commit that records the passes; they are to be
treated before the entry moves to `locked`, which requires a new review in any case.

| Id | Role | Suggestion |
| --- | --- | --- |
| n1 | architecture | Reword the section 10 sentence "Apart from its one decoder defect it is the golden argument itself": the surrogate and number carriers also hold a duplicate member, which schema patterns in ASCII make unavoidable |
| n2 | architecture | State which golden case supplies the other arguments and `evaluated-at` for a memory qualification input |
| n3 | architecture | Pin the body of each added block (a digest per block), or state that its content rests on review |
| r3 | security | Add an `invalid-utf8` carrier, for example `"licence":"CC-BY-4.0\xff"` on the golden policy |
| r4 | security | Check `text.length × count` against the ceiling before `repeat` in both memory qualification generators |

## Before the contract can be locked

- The three role verdicts on `475c8b4` are the current ones and replace those on
  `52801bf` and `133ba2b`, which stay as audit records. The commit that records them
  touches only this dossier: no verdict is stale.
- The consolidated text (architecture M2) is a prerequisite of the lock; it exists from
  the commit after `133ba2b` and is checked against policy-core-v2 by
  `tools/quality/policy-core-v3.test.ts`.
- A separate promotion pass verifying the collected records, and the owner's control.
