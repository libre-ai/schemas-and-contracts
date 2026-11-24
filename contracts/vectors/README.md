# Runner vectors

Vectors in the format of `tools/quality/conformance-runner.ts` (the format and the four states are
described in its header; the child protocol in `tools/quality/conformance-runner-process.ts`). An
implementing repository runs them against its own implementation, in its own CI, at a pinned
revision of this repository; this repository only exercises them against synthetic commands.

Every vector here is derived from a cataloged fixture by a generator, and is never edited by hand.
The fixture stays the source; the generator's `--check` and its test refuse a missing, extra or
diverging vector. A vector set has the catalog status of its contract: the `policy-core-v3` set
follows a candidate and changes with it.

| Directory | Source | Generator | Kind |
| --- | --- | --- | --- |
| `policy-core-v2/golden/` | `contracts/fixtures/policy-core-v2/golden.json` | `tools/quality/policy-core-v2-golden-vectors.ts` | `policy-core-v2.evaluate` |
| `policy-core-v3/golden/` | `contracts/fixtures/policy-core-v3/golden.json` | `tools/quality/policy-core-v3-vectors.ts` | `policy-core-v3.evaluate` |
| `policy-core-v3/raw-inputs/<argument>/` | `contracts/fixtures/policy-core-v3/raw-inputs/` (manifest and `.bin` files) | `tools/quality/policy-core-v3-vectors.ts` | `policy-core-v3.evaluate` |

## Byte members (`inputBytes`)

Some inputs are octets that no JSON value can carry: a byte order mark, invalid UTF-8, a
duplicate member name, a text outside the JSON grammar. A vector carries them in the optional
member `inputBytes`, an object whose every member is a byte string in canonical base64 (RFC 4648
section 4: standard alphabet, padded, zero padding bits). `input` is then an object that names
none of these members. The runner refuses (`blocked`) any other spelling, then forwards the
members as written, between `input` and `dir`:

```json
{ "kind": "…", "input": { … }, "inputBytes": { "<name>": "<base64>" }, "dir": "…" }
```

The adapter decodes each byte string and passes the octets unchanged; it never parses and
re-serializes them, which would erase the defect under test. A vector without `inputBytes` gets
the request of the JSON-only format unchanged, so the `policy-core-v2` vectors and their
adapters are not affected.

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

## Kind `policy-core-v3.evaluate`

Semantics: `contracts/wit/policy-core-v3/SEMANTICS.md` (candidate). Responses as for
`policy-core-v2.evaluate`. Each of `policy`, `snapshot` and `need` is in exactly one of `input`
(a JSON value, which the implementation serializes to the bytes `evaluate` takes) and
`inputBytes` (the octets `evaluate` takes, as is). `evaluatedAt` is always in `input`.

- `golden/<case id>`: one vector per golden case, the three JSON arguments in `input`.
- `raw-inputs/<argument>/<case id>`: one vector per refused raw input and argument it is passed
  as (SEMANTICS section 10). The raw octets are `inputBytes.<argument>`; the other two arguments
  and `evaluatedAt` are those of the golden case the manifest names (`goldenCase`, a carrier), or
  else of the first golden case that expects an evaluation, the input then being passed as each
  of the three arguments in turn. Example, `raw-inputs/policy/carrier-bom`:

  ```json
  {
    "dependsOn": ["policy-core-v3/golden/all-operators-eligible"],
    "input": { "snapshot": { … }, "need": { … }, "evaluatedAt": "…" },
    "inputBytes": { "policy": "77u/eyJzY2hlbWFWZXJzaW9uIjoi…" },
    "expected": { "outcome": "reject", "code": "input-invalid" }
  }
  ```

  The expectation is the WIT variant (`expectedErrors`) and nothing else: the `defect` class of
  the manifest binds the reference oracle only. Each raw vector depends on the golden vector
  whose arguments it borrows, so it is judged only for an implementation that evaluates those
  arguments when they are well formed: an implementation that refuses everything passes no raw
  vector. Run the runner over the whole `policy-core-v3` directory (a filter on `raw-inputs`
  alone leaves those dependencies unknown, hence `blocked`).

Not projected: the manifest's `acceptedCases`, which bind the reference oracle only, and
`contracts/fixtures/policy-core-v3/memory-qualification.v1.json`, whose inputs sit at the 8 MiB
input ceiling, above the runner's 1 MiB vector cap, and qualify a peak memory the runner does not
measure: they belong to the implementation's memory gate.
