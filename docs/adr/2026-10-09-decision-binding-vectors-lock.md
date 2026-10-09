# Lock of the decision-binding vectors

Decision identifier: `urn:libre-ai:decision:2026-10-09-decision-binding-vectors-lock`.
Status: accepted by the owner's merge of the pull request that adds this record (#22), which
is the lock; governance record ADR-0047 / D69 (`libre-ai/project-governance` #83).
Owner-arbitration: 2026-10-09 — preparation requested in chat; the merge is the signature

## Context

`decision-binding-vectors.v1` was merged as a candidate in `599cd8e` (#19). It vectorizes
what `agent-orchestration/SEMANTICS.md` already states: a human decision binds one
organization, run, step and closed choice set. In practice, a decision request must restate
exactly its step's policy (choice → outcome map, no-response outcome, required role) under the
graph and organization it names.

Its review dossier `docs/reviews/decision-binding-v1-review.md` records three rounds,
architecture and security, on immutable commits:

| Round | Architecture | Security |
| --- | --- | --- |
| 1 | accept-with-findings | accept-with-findings |
| 2 | accept-with-findings | accept-with-findings |
| 3 | **accept** | **accept-with-findings** (one wording finding, applied) |

No round had a blocking finding. `execution-continuity-evaluator` 0.3.0 (`3cf8d67`)
implements the binding.

The vector bytes locked here are the reviewed ones: SHA-256
`49328cae505b72e54275b1481ad8fc8b16547639ff02ceb49c68a6d911ab807e`, unchanged since the
round-3 commit `0b18606`. Only the path changes.

## Alternatives

| Alternative | Effect |
| --- | --- |
| A new catalog kind for vector files | The checker's managed roots and kind rules change. Whatever root the kind takes, the locked `semantic-vectors.v1` and `digest-vectors.v1` must either be catalogued too, or be the only uncatalogued vector files of the family. Every entry also goes through the pinned post-lock registry (`2026-10-09-catalog-post-lock-additions.md`), so the registry digest changes. The existing `vectors` adjunct (`check-contracts.ts`) does not apply: it is reserved to `kind: "wit"`. |
| The precedent of the locked family: reviewed hash plus checker gate | The same guard as `semantic-vectors.v1`. Its bytes are pinned by `reviewedAuthorityHashes` in `authorized-execution-lock.test.ts`, and `check-contracts.ts` validates and replays the document. No catalog change. |

The candidate dossier named the first alternative as the expected lock-time act. This record
selects the second, because it is the form the locked family already uses. The role reviewers
judged the vector content, not this choice of lock form; the owner's merge signs it. Cataloguing
vector files remains possible later, for every vector file at once.

## Decision

- The file moves to `contracts/fixtures/authorized-execution-v1/decision-binding-vectors.v1.json`,
  beside the locked semantic vectors.
- `authorized-execution-lock.test.ts` pins its reviewed SHA-256. Any byte change fails.
- `check-contracts.ts` gates it like `semantic-vectors.v1`:
  - strict UTF-8 JSON;
  - size and public-content bounds;
  - envelope, id, coverage and per-case replay through `tools/quality/decision-binding.ts`.
- Evolution follows `contracts/COMPATIBILITY.md`: a change of meaning is a new major
  (`decision-binding-vectors.v2`), never an edit in place.

This record locks the vectors; it grants no runtime admission. The unbound choice `label`
stays declared in the dossier, and closing it needs a new major of `execution-graph-v1`.
