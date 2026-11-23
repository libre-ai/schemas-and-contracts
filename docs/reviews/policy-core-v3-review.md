# Review dossier — policy-core v3 (candidate)

- **Candidate contract:** `policy-core-v3` (catalog entry after the post-lock baseline).
- **Status:** `pending-independent-agent-review` (catalog `review.state`). Authored solo;
  no role pass has run.
- **Required roles (catalog `review.required`):** architecture, security, privacy — the
  roles policy-core-v2 names before implementation.
- **Decision:** `docs/adr/2026-11-23-policy-core-v3.md`, status proposed.
- **Semantics:** `contracts/wit/policy-core-v3/SEMANTICS.md` (changes C1 to C4 to the locked
  policy-core-v2 text).

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

## Points given to the passes

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
