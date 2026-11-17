# Home of the strict integer-only JSON reader and canonicalizer

Decision identifier: `urn:libre-ai:decision:2026-11-17-strict-json-reader-home`.
Status: proposed.
The three choices below are reversible and wait for the owner's answer; none is a
contract change, and nothing under `contracts/` is touched by this record.

## Context

This authority already carries the normative material of a strict JSON reader:

- the decoder rules of the locked `policy-core-v2` world
  (`contracts/wit/policy-core-v2/SEMANTICS.md`): byte order mark, invalid UTF-8,
  duplicate member names, unpaired surrogates and nesting deeper than 64 are refused;
  fractions are admitted;
- the `canonicalize` function of the candidate `signalement-policy-receipt-v1` world
  (`contracts/wit/signalement-policy-receipt-v1/SEMANTICS.md`): RFC 8785 restricted to
  safe integers, judged on the binary64 value of each number, with its golden cases;
- the raw refusal vectors of `contracts/fixtures/policy-core-invalid-json/`, and a
  TypeScript oracle under `tools/quality/`.

What it did not carry is an exported Rust reader. `crates/sdk-rs` validated values
that were already parsed: a Rust consumer starting from octets went through a standard
reader, where the last duplicate member wins silently, fractions and exponents are
admitted and the depth bound is the library's. The only strict Rust readers and
canonicalizers were private to two test files, and differed from each other.

## Decision

`crates/sdk-rs` exports a module, `crates/sdk-rs/src/strict_json.rs`, with two pure
functions: `parse` (octets to a value, or a defect from a closed list and its byte
offset) and `canonicalize` (a value to its RFC 8785 octets, numbers restricted to
integers of magnitude at most 2^53 - 1). No dependency is added.

1. **Home.** The reader lives in `crates/sdk-rs`, beside the two existing behavior
   modules (`event_chain`, `quorum`) and the registry whose `validate` already takes
   the value type `parse` returns.
2. **Number rule.** The reader judges the literal: `1.0`, `1e2` and `10E-1` are
   refused. It is therefore a strict subset of the reader of the candidate
   `canonicalize` semantics, which reads those literals as integers. On every document
   it accepts, its canonical form is, octet for octet, the one of that semantics and
   the one of the locked digest vectors. Relaxing the rule later keeps every document
   already accepted; tightening it would not.
3. **Normative status.** The module is an SDK function proved against existing
   vectors. It adds no normative text, no vector directory and no catalog entry. It is
   not an implementation of the `signalement-policy-receipt-v1` world and qualifies
   none; it does not replace the policy-core decoder, which admits fractions. Its depth
   rule is the one of the candidate semantics (the top-level value has depth 1).

## Alternatives

| Alternative | Consequence |
| --- | --- |
| Keep the readers private to the test files | Every Rust consumer writes its own reader; the two existing ones already disagree on key order, numbers and depth |
| Judge the binary64 value, as the candidate `canonicalize` semantics does | Two literals of one integer are accepted; a later restriction would refuse documents already signed |
| Add a third-party canonicalizer | A dependency for a form that has no floating-point number to format |
| Publish the profile as a cataloged contract now | The catalog has no kind for a profile without a WIT world; it needs a world or a new kind in the contracts gate, then the role reviews, before any consumer |

## Consequences

- Proof lives in `crates/sdk-rs/tests/strict_json_vectors.rs`: the raw refusal
  manifest, the golden `canonicalize` cases (with the one intended gap,
  `canonicalize-integral-forms`), the locked digest vectors of
  `authorized-execution-v1` and `agent-orchestration-v1`, and a table of gap cases.
- The private readers and canonicalizers of the existing test files stay as they are:
  their function differs (fractions admitted, depth counted from 0).
- A consumer pins this repository by full revision, and the size ceiling of an input
  stays with the caller, before `parse`.
- Open to the owner: confirm the home (question 1), confirm the refusal of the literal
  (question 2), and decide whether the profile becomes a cataloged contract
  (question 3). Rollback of the home: remove the module before a consumer pins it.
