# Review dossier — ToolInvocationObservation v1 (candidate)

- **Candidate contract:** `tool-invocation-observation-v1`
  (`contracts/schemas/tool-invocation-observation.v1.schema.json`).
- **Status:** `pending-independent-agent-review` (catalog `review.state`), authored solo.
- **Required roles (catalog `review.required`):** architecture, security, privacy,
  cryptography.
- **Decision:** `libre-ai/project-governance` ADR-0046 (accepted). Owner-arbitration:
  2026-10-09 — the owner chose, in chat, an observation contract in this authority over
  a guard inside the worker loop, then settled the design sub-decisions Q1–Q6 the same
  day: `k` and `w` declared by the harness profile, windows overlapping by `k − 1`
  calls, option B, per-run key, typed stop only, I-33 distinct. The contract stays a
  candidate.
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
| architecture | Does the harness-as-producer, evaluator-as-comparator split keep one authority per subject (I-03)? Is the window binding (`workerInvocationId` + `attemptId` + `runId` + `generation`) sufficient to order and attribute a stream? `windowSize` and `repeatThreshold` come from the harness profile (ADR-0046 Q1): is their binding through `harnessAttestationDigest` to the effective profile digest sufficient, given `harness-profile.v2` does not declare them yet? |
| security | Can a worker influence a document? Does the preimage chain detect omission, reordering and replay across invocations? The `k − 1` overlap (ADR-0046 Q2) puts any `k` consecutive calls in one window: what does the remaining limit cost, namely `k` occurrences spread over more than `k` calls? Is evasion by varying arguments acceptable given `maxToolCalls` stays the hard bound? |
| privacy | Does any field carry content, a business identifier or a timing side channel finer than `harness-profile.v2` allows? Does destroying the run-scoped key make digests unlinkable for erasure purposes? |
| cryptography | Domain separation of the two HMAC inputs; key size and per-run derivation; the published test-only key; RFC 8785 canonicalization limits (safe integers only, as `canonicalJson` enforces). |

## Evidence available to the passes

- `bun run check:tool-invocation-observation`: schema acceptance and refusal on every
  vector, preimage digests recomputed with `canonicalJson`, keyed digests recomputed
  with HMAC-SHA-256 under the test-only key, permuted-key invariance, every closed
  verdict exercised by a schema-valid semantic vector.
- The `k − 1` overlap rule is checked structurally on every stream expected to reach
  `progress` or `no-progress`. One pair of semantic vectors replays the same six calls
  under two window layouts: with the overlap, `k` consecutive identical calls reach
  `k` inside one window; with disjoint windows, they do not.
- Schema discrimination (2026-10-09, on scratch copies of the schema). Each weakening
  makes exactly one invalid vector accepted:
  - dropping `repeatThreshold` from `required` → "missing repeat threshold";
  - removing the first-window `firstCallSequence: 1` rule → "first window not starting at call one";
  - lowering the `repeatThreshold` minimum to 1 → "repeat threshold of one".
- One argument digest was cross-checked by a second instrument at authoring time:
  `jq -cS` plus `openssl dgst -sha256 -mac HMAC` gives the vector's value
  (`841b721b…6628093`).
- The semantic vectors' expected verdicts are not executed by any evaluator yet: the
  pure evaluator is a consequence of ADR-0046, to be written in
  `libre-ai/execution-continuity-evaluator`.
