# ToolInvocationObservation v1 — semantics (candidate)

Status: **candidate**, machine-checkable only. `libre-ai/project-governance`
ADR-0046 is accepted (owner decisions of 2026-10-09). The contract itself stays a
candidate: nothing may implement it as an obligation before the review roles
named in `contracts/catalog.v1.json` have run and the owner promotes it. Schema:
`contracts/schemas/tool-invocation-observation.v1.schema.json`. Vectors:
`contracts/fixtures/tool-invocation-observation-v1/vectors.json`.

## Purpose

`maxToolCalls` bounds how many tool calls a run makes, and `cycle-forbidden` and
`maximum_attempts` bound how often a step is repeated. Neither bounds a worker
that calls the same tool with the same arguments and gets the same result N times
below `maxToolCalls`. This contract carries the minimum fact needed to see that:
which distinct `(tool, arguments, result, outcome)` couples occurred, how often,
and in which span of calls — without carrying any argument or result.

## Authorities

- The **harness** produces and signs every document. It sees each call because
  it revalidates every invocation (ADR-0032 D3). The worker never produces a
  document, and a worker-supplied count is never an input.
- The **orchestrator** and a **pure evaluator** (to be written in
  `libre-ai/execution-continuity-evaluator`) only compare documents. They hold
  no digest key, and they cannot recompute or reverse a digest.
- The document grants no capability and changes no plan. A `no-progress`
  verdict is an observed effect: what it triggers is decided by the authorized
  graph and the plan, not by this contract.

## Documents and windows

One document covers one **window** of consecutive calls of one worker invocation
(`workerInvocationId`, bound with `runId`, `attemptId`, `stepId`, `planDigest`,
`graphDigest`, `generation` and `organizationId`).

- `window.sequence` starts at 1 and increases by 1 per document of the same
  invocation. Sequence 1 has `previousObservationDigest: null`; every later
  document carries the `preimageDigest` of the previous one.
- `window.windowSize` is the window length `w`, from 2 to 1024, and
  `window.repeatThreshold` is the repetition threshold `k`, from 2 to 1024 and
  at most `w`. Both are declared by the **harness profile**, not by the plan
  (ADR-0046 decision 3). They reach the run through the effective profile digest
  of the harness attestation, which `harnessAttestationDigest` binds to every
  document. Each document repeats them, and they are constant over an
  invocation.
- Calls are numbered `1..100000` within the invocation (the bound of
  `maxToolCalls`). `window.firstCallSequence..window.lastCallSequence` is the
  covered span. The first window starts at call 1 (schema-enforced).
- A non-final window spans exactly `w` calls; the last window of an invocation
  may be shorter and has `window.final: true`.
- **Consecutive windows overlap by `k − 1` calls** (ADR-0046 decision 1):

  ```text
  firstCallSequence(n + 1) = lastCallSequence(n) − (k − 2)
  ```

  Any `k` consecutive calls therefore lie inside one window, so a repetition of
  `k` identical consecutive calls is visible to the evaluator even where two
  disjoint windows would split it. An overlapped call is counted in both windows
  that cover it.
- `entries` lists each distinct `(toolName, argsDigest, resultDigest, outcome)`
  of the window once, with its `count` and the first and last call sequence at
  which it occurred.

Volume: at most `ceil((100000 − (k − 1)) / (w − (k − 1)))` documents per
invocation. The volume grows as `k` approaches `w`, a cost carried by the harness
profile that declares them. An invocation that loops on one couple produces one
entry per window.

Why `k` is carried and not an overlap field: the overlap is `k − 1` by
definition, and a second field would only open a way for the two to disagree.

## Keyed digests

The harness draws one 256-bit key per run, `digestKey.scope: "run"`, identifies
it by `digestKey.keyId` and destroys it when the run ends. The key never leaves
the harness and never appears in a document. With `K` the key, `JCS` RFC 8785
and `\n` a line feed:

```text
argsDigest   = hex(HMAC-SHA-256(K, "libre-ai.tool-invocation-observation.v1:args\n"
                                   || toolName || "\n" || JCS(arguments)))
resultDigest = hex(HMAC-SHA-256(K, "libre-ai.tool-invocation-observation.v1:result\n"
                                   || toolName || "\n" || outcome || "\n" || JCS(result)))
```

- The domain labels separate argument and result digests, and binding
  `toolName` separates equal arguments of different tools.
- A non-JSON result is represented, before canonicalization, as
  `{"bytesSha256": "<hex>", "mediaType": "<type>"}`.
- `outcome` is closed: `ok` (a non-empty result), `empty` (a well-formed empty
  result), `error` (the tool failed). An error result is the closed error code
  object `{"code": "<code>"}`, never a message.
- An unkeyed hash would let anyone holding a document test guesses of a
  low-entropy argument (an email address, a short identifier) by dictionary.
  The run-scoped key prevents that outside the harness and makes digests of two
  runs unlinkable; destroying it makes them unlinkable forever.

The vectors publish one **test-only** key (`digestKeyTestOnlyHex`) so that any
implementation can reproduce the digests. It must never be used outside tests.

## Attestation

`preimageDigest` is the SHA-256 of the RFC 8785 serialization of the document
without `preimageDigest` and `signature`. `signature` is the harness Ed25519
signature over that preimage, under `signingKeyId`, the key bound by the run's
harness attestation, whose digest is `harnessAttestationDigest`. This is the
same shape as `effect-attestation.v1`.

## Content boundary

No argument, result, error message, per-call timestamp or business identifier
is carried (the boundary of `harness-profile.v2` telemetry:
`contentFieldsAllowed: false`). `closedAt` has minute precision, matching the
smallest `timestampPrecisionSeconds` of `harness-profile.v2`. Every object is
closed (`additionalProperties: false`), so a raw field is a schema failure.

## Evaluation (future pure evaluator)

Inputs: the ordered documents of one invocation and the plan's `tools[].name`.
`k` and `w` are read from the documents, not from the plan (ADR-0046 decision
3). A consumer that holds the effective harness profile may also check them
against it. The verdict is the first that applies, in this order:

| Verdict | Condition |
| --- | --- |
| `attestation-invalid` | `preimageDigest` differs from the recomputed preimage digest, or the signature does not verify |
| `observation-replayed` | a document is bound to another invocation, run, attempt, plan or organization than the stream, or repeats a `window.sequence` |
| `observation-chain-broken` | a `window.sequence` is skipped, or `previousObservationDigest` is not the previous document's `preimageDigest`, or a document follows a `final` one |
| `observation-incomplete` | the span exceeds `windowSize`, a non-final window spans fewer than `windowSize` calls, the counts do not sum to the span, an entry lies outside the span, `repeatThreshold` exceeds `windowSize`, `windowSize` or `repeatThreshold` changes within the stream, two consecutive windows do not overlap by exactly `repeatThreshold − 1` calls, or the stream ends without a `final` document |
| `tool-undeclared` | an entry's `toolName` is not in the plan's `tools[].name` |
| `no-progress` | an entry's `count` is at least `k` |
| `progress` | none of the above |

A polling tool whose result changes yields distinct `resultDigest` values and is
`progress`. Repetition is judged inside a window. Thanks to the `k − 1`
overlap, `k` identical consecutive calls always fall in one window. The limit
that remains (ADR-0046 decision 1): `k` occurrences spread over more than `k`
calls can still be split between two windows. The harness, which slides call by
call, sees them; this verdict does not.

Cross-check: the union of the windows' spans is exactly `1..n`, and `n` equals
the `toolCalls` the orchestrator receives for that invocation. Summed counts
exceed `n` by the overlapped calls, `(k − 1)` per window boundary. A difference
is an `observation-incomplete` in the stream, never a correction of the counter.

## What this contract does not do

It does not detect a worker that varies its arguments to evade the guard, nor a
tool whose results are nondeterministic: `maxToolCalls` and the other budgets
stay the hard bound. It does not carry the reaction. ADR-0046 decision 2 fixes it:
a typed stop only, with a signal at `k − 1` occurrences and the `no-progress`
stop at `k`, and no tool withdrawn mid-step.
