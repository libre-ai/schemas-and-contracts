# Review dossier — policy-core v3 (candidate)

- **Candidate contract:** `policy-core-v3` (catalog entry after the post-lock baseline).
- **Status:** `pending-independent-agent-review` (catalog `review.state`). Three role
  passes ran on `133ba2b` (recorded below): architecture `reject`, security `reject`,
  privacy `approve-with-minor-reservations`. The candidate stays pending.
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

| Finding | Severity | Disposition | Answer |
| --- | --- | --- | --- |
| M1. The class order of C2 cannot be checked at the component boundary: every raw vector expects `input-invalid`, and a v2 component under engine `3.0.0` passes every v3 vector (measured: 7 of 14 cases differ in class) | major | required evidence | **Treated by the commit after `133ba2b`.** Owner answer of 2026-11-23, "Classes = diagnostic d'oracle (Recommandé)": section 2 and section 10 now say that a component is judged on the WIT variant only and that the class binds the reference oracle only; ADR consequences updated |
| M2. The delta text is ambiguous: (a) "v2" sentences such as the HTTP boundary, (b) contradictory scope rules, (c) loss of the RFC 2119 MUST in the decoder sentence, (d) normative dependency on the v2 bytes | major | blocking for lock, not for `candidate` | **Treated by the commit after `133ba2b`.** The semantics is now a complete text: (a) the HTTP boundary sentence binds every boundary exposing a v3 result, and no normative sentence names the v2 world (a test greps for it); (b) no scope rule remains; (c) "The decoder MUST reject" is restored; (d) the v2 file is read only by the derivation test, not by the normative text |
| m1. `unpaired-surrogate`, read literally, covers the low half of a valid pair | minor | suggestion | **Treated by the commit after `133ba2b`:** "not part of a high-then-low escaped pair" |
| m2. No tie-break at equal position in step 4 | minor | suggestion | **Treated by the commit after `133ba2b`:** each defect's position is defined; at the same octet the earlier class of the list wins; vector `depth-65-non-finite-number` |
| m3. The oracle, as wired, never produces `max-depth` | minor | suggestion | **Treated by the commit after `133ba2b`:** `max-depth` is a v3 class, the oracle runs at `decoderQualification.maximumJsonDepth` |
| m4. No Rust check of the v3 raw-input vectors | minor | suggestion | **Treated by the commit after `133ba2b`:** `policy_core_v3_raw_inputs_follow_the_grammar_first_classes` in `crates/sdk-rs/tests/policy_core_vectors.rs` |

Consequences reported without finding: `ai-model-policy` vendors only `policy-core-v1` and
replays only the v2 golden; `project-governance` asserts 9 vendored worlds
(`crates/ecosystem-engine/tests/wit_contracts.rs:17`) and would need 10 and a `matches!`
entry if v3 is vendored; no catalog field says that v3 succeeds v2; evaluation IDs change
for the same inputs (14 of 14).

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

## Before the contract can be locked

- New architecture and security passes on a commit after `133ba2b`; their `reject`
  verdicts stand until then. Every normative change since `133ba2b` (sections 1, 2, 9 and
  10 of the semantics, the raw-input manifest) makes the privacy approval stale for those
  parts.
- The consolidated text (architecture M2) is a prerequisite of the lock; it exists from
  the commit after `133ba2b` and is checked against policy-core-v2 by
  `tools/quality/policy-core-v3.test.ts`.
- A separate promotion pass verifying the collected records, and the owner's control.
