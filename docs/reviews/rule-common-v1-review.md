# Review dossier — rule common forms v1 (candidate)

- **Candidate contract:** `rule-common-v1` (catalog entry after the post-lock baseline).
- **Status:** `pending-independent-agent-review` (catalog `review.state`). Authored solo;
  the architecture and security passes ran and their findings are answered below; a
  role verdict on the corrected commit is still required before the state changes.
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

## Passes run and answers

An architecture pass and a security pass ran, each review-only, on the authoring commit.
Their findings were answered by a separate correction pass, after the owner's decisions
of 2026-11-17; the catalog `review.state` is left unchanged by that correction pass,
which is not a role verdict.

| Finding, as restated by the owner's decisions | Answer in this candidate |
| --- | --- |
| Security: the locator admitted percent-encoded control octets, `/`, `\` and any octet `80`–`FF` (so encoded NBSP, BOM and bidirectional controls), and `%2E` alone or followed by `.` decoded to `.`, `..` or a leading `..` | Decision A, rule R7: printable reserved ASCII escapes only; `.`/`..`/leading `..` refused in the pattern; vectors and fixtures per class, plus all 256 escapes in four positions against an oracle written from R7 |
| Security: "the pattern is tested on the whole value" left `$` open to a match before a final line feed under some engines | Decision B, rules R2 and R3: whole-value match required, no class admits `\n`, excerpt digest bounded 64/64; trailing-LF vectors and fixtures |
| Architecture: two authorities could define the same forms (L011 describes schemas of its own) | Decision C: the ADR states that L011 and L013 project this schema; the L011 definition text is outside this repository and stays open |
| Architecture: six choices were "provisional" in the ADR and "open" in the semantics | Decision D: closed before merge, written in the semantics "Decisions of 2026-11-17" and the ADR; vectors for D2, D3 and D4 |
| Architecture: `LibreAiRuleCommonFormsV1` reads like a message type | Decision E: rule R4 states it is the specimen projection, not a message |
| Both: closed-list tests could be updated as ordinary tests | Decision F: they are named decision locks |

## Points given to the passes (authoring pass)

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
