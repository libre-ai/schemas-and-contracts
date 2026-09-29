# Missions v3 dependency and locked-version audit

Base: `4f3d53c3ecd96e7064057afd1587de41b66f13c1`.
All inherited contract source hashes and existing catalog records are captured in
`contracts/fixtures/missions-v3/inherited.json` and checked without rewriting them.
`contracts/COMPATIBILITY.md` forbids changing required payload fields or digest
meaning in place. A candidate is not consumer admission.

| Authority | Decision and reason |
| --- | --- |
| MissionRecord v1/v2 | Preserve. v3 replaces ambiguous handoffId/handoffDigest with complete typed binding, external digest and lifecycle reference. All v2 states/prerequisites remain exact. |
| Missions API v1/v2 | Preserve. New v3 uses resolver-derived binding, typed controls, bounded envelopes/cursors and exact refusal sets; no old request is silently reinterpreted. |
| Agent Handoff/SpecPackage v1 | Preserve and exclude from new proposal admission; no unsigned-to-signed migration or v2-to-v1 adapter. |
| Build Brief body/acceptance/package/handoff/policy v2 | Preserve exact bytes. New whole-document handoff digest does not replace bodyDigest or full-receipt acceptanceDigest. |
| ExecutionPlanBody v1/v2 | Preserve. v3 adds explicit binding schema/digest while retaining every graph, capability, budget, harness and generation restriction. Necessary major change. |
| ExecutionAuthorization v1/v2 | Preserve. v3 fixes MissionRecord/plan source versions and bindingDigest; authorization hashes the exact pre-authorization mission snapshot, not a cyclic later projection. Necessary major change. |
| AgentReview, review-session, contributor lineage and quorum v1 | Reuse unchanged digest-opaque subject framing. They bind the resolved new plan digest and retain two distinct agents/runs/nonces, blind signed harness evidence, contributors, replay and key checks. No threshold/signature change or new review subject type. |
| HarnessProfile/Attestation and worker manifests | Reuse exact inputs; no weakened effective control, isolation, signing-key or actual evidence requirements. New source versions cannot bypass their preflight. |
| OrchestratorControl v1 | Reuse unchanged exact mission/run/plan/authorization target; v3 API transports the full control. Monotone authorized cancel remains the sole revision exception, not a permission or target exception. |
| OrchestratorEvent v2 | Reuse as Missions domain projection only, its own causal cursor. Exact digests resolve to v3 sources; schemas/fields retain meaning. It never substitutes for D40/D42 execution evidence. |
| OrchestratorEvent v3, ExecutionGraph v1, ExecutionTransfer v1, step invocation, executor profile, effect attestation | Reuse exact digest/identity/generation semantics. Separate graph event stream remains authoritative for checked budgets, generation transfer, one emission, fencing/idempotency and unknown-effect barrier. No changed fields, enum or digest preimage requires another major. |
| Human decision request/response v1 | Reuse exact closed choices and full request/run/step/attempt/revision; API wraps the original response, no free-text or resourceId shortcut. |
| Missions/agent-run Biscuit policies | Preserve exact operation/role rights. A new endpoint major does not issue capabilities or relax issuer/current-context requirements; actual policy composition and token/handler conformance remain consumer qualification gates. |
| Retention v1/v2 and auth-retention v3 | Preserve. MissionRecord retains its mission rule. Separate coordinated retention v4 classifies the Specifications-owned handoff archive; no arbitrary TTL or general membership history is introduced here. |
| SDKs and protocol owner | New schemas require generated projections; existing output/authority hashes remain protected. Product protocol update and canonical resolver provenance require coordinated integration; the historical pinned archive stays untouched. |

No schema-only acceptance proves semantic eligibility, current membership,
authenticated historical observation, cross-owner commit, physical deletion or
runtime confinement. A reviewed immutable composition must include the independent
storage mapping and its privacy gates before any persistent consumer admission.
