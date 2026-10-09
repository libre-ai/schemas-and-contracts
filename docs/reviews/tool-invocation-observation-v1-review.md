# Review dossier — ToolInvocationObservation v1 (candidate)

- **Candidate contract:** `tool-invocation-observation-v1`
  (`contracts/schemas/tool-invocation-observation.v1.schema.json`).
- **Status:** `pending-independent-agent-review` (catalog `review.state`), authored solo.
- **Required roles (catalog `review.required`):** architecture, security, privacy,
  cryptography.
- **Decision:** `libre-ai/project-governance` ADR-0046 (proposed). Owner-arbitration:
  2026-10-09 — the owner chose, in chat, an observation contract in this authority over
  a guard inside the worker loop; the design sub-decisions remain open in ADR-0046 and
  take effect at the owner's signature.
- **Semantics:** `contracts/tool-invocation-observation-v1/SEMANTICS.md`.

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
| architecture | Does the harness-as-producer, evaluator-as-comparator split keep one authority per subject (I-03)? Is the window binding (`workerInvocationId` + `attemptId` + `runId` + `generation`) sufficient to order and attribute a stream? Is `windowSize` a fact of the document or a parameter of the plan? |
| security | Can a worker influence a document? Does the preimage chain detect omission, reordering and replay across invocations? What does the in-window limit (a repetition straddling two windows) cost? Is evasion by varying arguments acceptable given `maxToolCalls` stays the hard bound? |
| privacy | Does any field carry content, a business identifier or a timing side channel finer than `harness-profile.v2` allows? Does destroying the run-scoped key make digests unlinkable for erasure purposes? |
| cryptography | Domain separation of the two HMAC inputs; key size and per-run derivation; the published test-only key; RFC 8785 canonicalization limits (safe integers only, as `canonicalJson` enforces). |

## Evidence available to the passes

- `bun run check:tool-invocation-observation`: schema acceptance and refusal on every
  vector, preimage digests recomputed with `canonicalJson`, keyed digests recomputed
  with HMAC-SHA-256 under the test-only key, permuted-key invariance, every closed
  verdict exercised by a schema-valid semantic vector.
- One argument digest was cross-checked by a second instrument at authoring time:
  `jq -cS` plus `openssl dgst -sha256 -mac HMAC` gives the vector's value
  (`841b721b…6628093`).
- The semantic vectors' expected verdicts are not executed by any evaluator yet: the
  pure evaluator is a consequence of ADR-0046, to be written in
  `libre-ai/execution-continuity-evaluator`.
