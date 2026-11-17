# Review dossier — rule common forms v1 (candidate)

- **Candidate contract:** `rule-common-v1` (catalog entry after the post-lock baseline).
- **Status:** `pending-independent-agent-review` (catalog `review.state`). Authored solo;
  no role pass has run.
- **Required roles (catalog `review.required`):** architecture, security.
- **Decision:** `docs/adr/2026-11-17-rule-common-v1.md`, status proposed.
- **Semantics:** `contracts/rule-common-v1/SEMANTICS.md`.

## What this dossier is, and is not

It satisfies the catalog's mechanical requirement that a `candidate` entry name a
dossier under `docs/reviews/` bound to the independent agent review protocol
(`contracts/COMPATIBILITY.md` "Evidence"). The protocol lives in the governance
authority, `docs/reviews/AGENT-REVIEW-PROTOCOL.md`, which this repository does not
vendor; the reviewer uses the governance copy.

It is **not** a completed review. Each required role must run as a separate
review-only pass on an immutable commit, with its own findings, and each finding must
be answered before the contract leaves `candidate`. The authoring pass did not simulate
any of them.

## Points for the passes

1. **Architecture.** The root is a specimen record (R4) so that the existing fixture
   gate covers every form. Review whether a `$defs`-only schema with a gate exemption
   would be clearer for consumers.
2. **Architecture.** Five forms carry choices no source fixed (semantics, "Open
   points"): source, key and slug alphabets; edition as one to three decimal
   components; overlay reference structure; the fifth level; `keyword`.
3. **Architecture.** The rule identifier pattern decides syntax only; native versus
   anchored locators and `.<n>` admissibility stay with the identifier code. Review
   whether a consumer could take the pattern for the full validity check.
4. **Security.** Patterns are anchored and free of lookaround and backreference (R3);
   lengths are bounded except the excerpt digest, whose pattern fixes 64 characters.
   Review the bounded-cost claim for the rule identifier pattern under backtracking
   engines.
5. **Security.** The locator admits percent-encoded control octets (`%00` to `%1F`).
   Review whether a consumer that decodes and prints a locator needs them refused here.
