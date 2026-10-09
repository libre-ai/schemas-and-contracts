# Review dossier — ExecutionPlanBody v4 (candidate)

- **Candidate contract:** `execution-plan-body-v4`
  (`contracts/schemas/execution-plan-body.v4.schema.json`).
- **Status:** `pending-independent-agent-review` (catalog `review.state`), authored solo.
- **Required roles (catalog `review.required`):** architecture, security.
- **Decision:** `libre-ai/project-governance` ADR-0045 (accepted), INV-a to INV-c,
  decisions 2, 5 and 6; decision record `docs/adr/2026-10-09-execution-plan-body-v4.md`.
  Owner-arbitration: 2026-10-09.
- **Semantics:** `contracts/execution-plan-body-v4/SEMANTICS.md`.

## What this dossier is, and is not

It satisfies the catalog's mechanical requirement that a `candidate` entry name a
dossier under `docs/reviews/` bound to the independent agent review protocol
(`contracts/COMPATIBILITY.md` "Evidence"). The protocol lives in the governance
authority, `docs/reviews/AGENT-REVIEW-PROTOCOL.md`; the local pointer file is still
missing from this repository, the gap already recorded by
`docs/reviews/harness-profile-v2-review.md`.

It is **not** a completed review. No role pass has run. Each role requires a
review-only pass on an immutable commit before promotion; promotion to `locked` is an
owner act.

## Questions for each role

| Role | Questions the pass must answer |
| --- | --- |
| architecture | Is attaching tools to steps (and dropping the plan-wide list) the right reading of ADR-0045's "étape sans outil ou rattacher les outils à l'étape"? Is the step binding ↔ graph coverage rule (worker steps only) sufficient without a schema link to `execution-graph.v1`? What does the missing `execution-authorization` successor cost? Does `agent-harness` as consumer keep one authority per subject (I-03)? |
| security | Can a schema-valid plan put an untrusted string in a privileged context (inputs, tool results, compaction)? Are the admission rules (enum and identifier fields only, implicit dependencies always counted) the most restrictive form that still expresses ADR-0045's email example? Is the 8-byte window of the capture oracle an acceptable backstop to provenance labels? |

## Evidence available to the passes

- `bun run check:execution-plan-body-v4`: the canonical fixture accepted with its
  `bodyDigest` recomputed over RFC 8785; 29 schema mutations refused; an
  action-selector variant accepted; 33 ADR-0045 vectors (7 plan, 10 call, 6 capture,
  10 quarantine output), each verdict of the closed set of 8 exercised, each
  contract vector of the ADR (1 to 3) with a red and a green case.
- Schema discrimination and the neutralization of each oracle control are reported in
  the pull request that introduced this candidate.
