# Served-text preparation: candidate vectors outside the catalog

Decision identifier: `urn:libre-ai:decision:2026-11-17-served-text-preparation-vectors`.
Status: proposed — would admit a **candidate** vector set; it is not a catalog contract
and it is not locked.
Owner-arbitration: pending — the owner has not yet arbitrated the two questions listed
under "Open questions"; this line takes the date of that arbitration before merge.

## Context

Nothing in this authority defines what makes an untrusted text servable to an agent. The
only guard is `libre-ai.envelope.v1` (`contracts/schemas/envelope.v1.schema.json`,
locked): it authenticates an envelope and escapes two fixed delimiters. It lets every
invisible, control and bidirectional character through, does not bound a length in code
points, and does not handle `[`, `]`, `<`, `>` or their compatibility forms. Without a
common oracle, each repository that processes content would copy its own table of hidden
characters.

A locked contract never changes in place, and preparation is not a version of the
envelope document: it has no schema, no MAC and no field. It is a text transformation.
The precedent for a semantic vector set with a reference oracle and no catalog entry is
`docs/adr/2026-10-10-mls-sender-authentication-red-vectors.md`.

## Decision

1. **Location.** The vectors live here as a candidate semantic set outside the catalog:
   `contracts/fixtures/served-text-preparation-candidate/vectors.v1.json`, with their
   semantics in `contracts/served-text-preparation-candidate/SEMANTICS.md` and their
   reference oracle and checker in `tools/quality/served-text-preparation.ts`.
2. **Three steps in a fixed order**: sanitize (remove 28 ranges of code points, then
   NFC), truncate (to a bound in code points, with a 12-code-point marker), neutralize
   (14 delimiter forms replaced one for one). The result carries three flags: `altered`,
   `truncated`, `neutralized`.
3. **Tables as literals, tied to Unicode 17.0.** The removed ranges are the union of
   `Default_Ignorable_Code_Point`, `Cc`, `Cf`, `Zl` and `Zp`, minus TAB and LF. They are
   written out, not looked up, so that two implementations on two Unicode versions
   cannot diverge silently. The reference test fails when the runtime does not report
   Unicode 17.0, and otherwise proves the literals equal the runtime's property classes.
4. **No catalog entry, no schema, no package export.** A catalog entry would change
   `contracts/catalog-post-lock-additions.v1.json`, whose digest is pinned by the
   specification lock. The oracle stays under `tools/quality`; it is the checker of the
   vectors, not a production library.
5. **The envelope is untouched.** `packages/envelope` and `libre-ai.envelope.v1` are not
   modified; the semantics state how the two coexist.

## Consequences

- Each repository that processes content replays the vectors against its own
  implementation, at a revision of this authority pinned by full SHA, and proves its
  parity there.
- Repositories that display or detect hidden characters consume the removed-range table
  as a pinned projection, or state in one line why their class differs.
- Removing U+200C and U+200D degrades the scripts and emoji sequences that depend on
  them. The loss is accepted and reported by `altered`.
- Promotion to a cataloged contract needs role-separated review (security at least) and
  an entry in the post-lock additions register, by a distinct decision.
- This record admits no runtime capability. Rendering a response, its nonce and its
  verifier are outside this set.

## Open questions

1. Is a candidate vector set outside the catalog admitted for served-text preparation,
   on the model of the MLS sender-authentication set? The other route is a cataloged
   candidate entry, which changes the post-lock additions register and the digest pinned
   in `tools/quality/specification-lock.ts`.
2. If the Bun revision pinned by `toolchains/bun.json` reports a Unicode version other
   than 17.0 (`bun -e 'console.log(process.versions.unicode)'`), is the pin raised before
   this set merges, or is the table restricted to the pinned version? The second option
   makes the table differ from the one an implementation on Unicode 17.0 computes.
