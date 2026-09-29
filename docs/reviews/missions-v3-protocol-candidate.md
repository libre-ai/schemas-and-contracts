# Missions v3 protocol candidate — owner reconciliation note

Candidate only. This note records the new version without modifying the pinned
historical protocol archive `docs/protocols/missions/missions.md`. The owner source
is `libre-ai/ai-work-supervision` commit
`276ac5db8d2bc904ab2bfa4d26620267c37a7092`, path
`docs/apps/missions-v3-candidate.md`. Its exact bytes are projected to
`docs/protocols/candidates/missions.v3.md`; SHA-256:
`8bc739670fbf7a8a1b52097e1c5321e091498bdb03fc4851cfbafd5e4af35ce3`.

`contracts/candidate-protocol-authorities.v1.json` records this proposed source
separately from historical authority pins. The resolver selects `(missions, 3)`
only while its catalog contract is candidate, checks the pinned local bytes and
requires explicit v3 candidate command/query declarations. Historical majors 1/2
keep their original source and hash. An unknown successor cannot fall back to a
historical list. This versioned provenance is not ratification, promotion or
consumer admission; all dedicated reviews and owner controls remain required.

**Commands v3 candidate:** `ProposeMission`, `AssessMissionRisk`, `SubmitExecutionPlan`, `SubmitAgentReview`, `StartMission`, `PauseMission`, `ResumeMission`, `CancelMission`, `RecordOrchestratorEvent`, `AnswerDecisionRequest`, `SubmitMissionResult`, `AbandonMission`, `ExportMissionRecord`.

**Queries v3 candidate:** `GetMission`, `ListMissions`, `GetMissionEvents`, `GetOpenDecisionRequests`, `GetResultEvidence`, `GetReviewQuorum`, `GetMissionExport`.

The command/query names equal v2. Their v3 payloads and verification are defined
by `contracts/openapi/missions.v3.yaml`, the new candidate schemas and
`contracts/missions-v3/SEMANTICS.md`. ProposeMission resolves an actual canonical
Build Brief v2 handoff through trusted Specifications ownership and archive ports,
then persists only a derived binding and reference. It cannot accept an `accepted`
assertion or confer execution. All plan/result quorums, harness, current authority,
revocation, generation and uncertain-effect gates remain prerequisites.
