# Runner vectors

Vectors in the format of `tools/quality/conformance-runner.ts` (the format and the four states are
described in its header; the child protocol in `tools/quality/conformance-runner-process.ts`). An
implementing repository runs them against its own implementation, in its own CI, at a pinned
revision of this repository; this repository only exercises them against synthetic commands.

Every vector here is derived from a locked fixture by a generator, and is never edited by hand.
The fixture stays the source; the generator's `--check` and its test refuse a missing, extra or
diverging vector.

| Directory | Source | Generator | Kind |
| --- | --- | --- | --- |
| `policy-core-v2/golden/` | `contracts/fixtures/policy-core-v2/golden.json` | `tools/quality/policy-core-v2-golden-vectors.ts` | `policy-core-v2.evaluate` |

## Kind `policy-core-v2.evaluate`

Semantics: `contracts/wit/policy-core-v2/SEMANTICS.md`. One vector per golden case.

Request on the implementation's stdin (runner protocol):

```json
{ "kind": "policy-core-v2.evaluate", "input": { "policy": …, "snapshot": …, "need": …, "evaluatedAt": "…" }, "dir": "…" }
```

`policy`, `snapshot` and `need` are JSON values; the implementation serializes them to the bytes
its `evaluate` takes. `evaluatedAt` is the string argument as is.

Response on stdout, one JSON object:

| Outcome of `evaluate` | Response |
| --- | --- |
| success | `{"outcome": "accept", "evaluation": <evaluation>, "canonicalOutput": "<text>"}` |
| WIT `error-code` | `{"outcome": "reject", "code": "<variant>"}`, the variant name as written in the WIT (`input-invalid`, `evaluated-at-invalid`, `rule-id-duplicate`, `approval-invalid`, `digest-mismatch`, `tenant-mismatch`) |
| kind not implemented | `{"outcome": "unsupported"}` (state `unavailable`, never a pass) |

- `evaluation` is the parsed evaluation; the runner compares it as a value.
- `canonicalOutput` is **the engine's own output bytes, decoded as UTF-8, unchanged**: the text
  `evaluate` returned, never the adapter's re-serialization of `evaluation`. The expected text is
  the evaluation in RFC 8785 (JCS), which the document declares as its canonicalization; it judges
  the bytes, not only their value.
- The runner cannot tell an engine's bytes from an adapter that re-serializes the parsed value in
  JCS: both give the same text. An adapter that re-serializes makes the byte check vacuous for
  that implementation. This is a rule on the adapter, checked by reading it, not by the runner.
