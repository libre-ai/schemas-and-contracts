# Review dossier — ExecutionAuthorization v4 (candidate)

- **Candidate contract:** `execution-authorization-v4`
  (`contracts/schemas/execution-authorization.v4.schema.json`).
- **Status:** `pending-independent-agent-review` (catalog `review.state`), authored solo.
- **Required roles (catalog `review.required`):** architecture, security.
- **Decision:** `docs/adr/2026-10-10-execution-authorization-v4.md`, under
  `libre-ai/project-governance` ADR-0045 decision 4 (activation condition).
  Owner-arbitration: 2026-10-10.
- **Semantics:** `contracts/execution-authorization-v4/SEMANTICS.md`.

## What this dossier is, and is not

It satisfies the catalog's mechanical requirement that a `candidate` entry name a
dossier under `docs/reviews/` bound to the independent agent review protocol
(`contracts/COMPATIBILITY.md` "Evidence"). The protocol lives in the governance
authority, `docs/reviews/AGENT-REVIEW-PROTOCOL.md`; the local pointer file is still
missing from this repository, the gap already recorded by
`docs/reviews/harness-profile-v2-review.md`.

It is **not** a completed review. No role pass has run. Promotion to `locked` is an
owner act; activation is a further act, after the condition of the decision
record holds.

## Questions for each role

| Role | Questions the pass must answer |
| --- | --- |
| architecture | Is binding the harness profile by major and digest the right place, given that `harness-attestation.v1` already carries the effective profile digest? Is relying on `planDigest` for `isolation` and `steps`, without a separate digest, sufficient? Should `agent-harness` consume the authorization? Is the activation condition better carried as text (chosen) or as a constant field? |
| security | Can a schema-valid v4 authorization pair a v4 plan with a profile that declares no k and w, or with a plan whose isolation changed after authorization? Does anything in this contract let a runtime treat `authorization-bound` as an execution admission before the ADR-0045 red vectors pass? |

## Evidence available to the passes

- `bun run check:execution-authorization-v4`: the schema reverted by its three
  changes equals the locked v3 schema; v3's bytes match its projected digest; the
  canonical fixture accepted and 10 schema mutations refused; one bound chain
  (mission v3, plan v4, profile v3, authorization v4) and 10 refusal vectors, each
  with the exact failures it must produce; the activation condition checked in the
  catalog, the schema, the semantics and the decision record.
- Schema discrimination and the neutralization of each oracle control are reported
  in the pull request that introduced this candidate.
