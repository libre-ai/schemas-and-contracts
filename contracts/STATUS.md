<!-- Generated from contracts/catalog.v1.json by tools/quality/catalog-status-page.ts. Do not edit. -->

# Contract status

Generated from [`catalog.v1.json`](catalog.v1.json) by
`bun tools/quality/catalog-status-page.ts --write`. Do not edit this page by hand:
`bun run check:catalog-status` fails whenever it differs from the catalog.

`catalog.v1.json` is the sole status authority. Status statements in `contracts/README.md`,
`contracts/CATALOG.md`, `contracts/COMPATIBILITY.md` and `docs/protocols/` are frozen snapshots:
their exact bytes are bound by review evidence (inherited-authority fixtures, the specification
lock and the protocol-authority maps), so they are not edited to follow catalog changes. Where
they disagree with this page, this page states the current catalog.

## Counts by status

| Status | Entries |
| --- | ---: |
| locked | 116 |
| candidate | 12 |
| total | 128 |

## Counts by family

| Family | Entries | locked | candidate |
| --- | ---: | ---: | ---: |
| biscuit-authority | 2 | 2 | 0 |
| biscuit-policy | 5 | 5 | 0 |
| data-policy | 4 | 3 | 1 |
| json-schema | 95 | 84 | 11 |
| openapi | 13 | 13 | 0 |
| wit | 9 | 9 | 0 |

## Contracts by family

### biscuit-authority (2)

| Contract | Status | Review | Path |
| --- | --- | --- | --- |
| `authority-v1` | locked | none | `contracts/authz/authority-v1.datalog` |
| `authority-v2` | locked | none | `contracts/authz/authority-v2.datalog` |

### biscuit-policy (5)

| Contract | Status | Review | Path |
| --- | --- | --- | --- |
| `agent-runs-authz-v1` | locked | none | `contracts/authz/agent-runs-v1.datalog` |
| `agent-runs-authz-v2` | locked | none | `contracts/authz/agent-runs-v2.datalog` |
| `build-brief-policy-v2` | locked | none | `contracts/authz/build-brief-v2.datalog` |
| `missions-authz-v1` | locked | none | `contracts/authz/missions-v1.datalog` |
| `sessions-authz-v1` | locked | none | `contracts/authz/sessions-v1.datalog` |

### data-policy (4)

| Contract | Status | Review | Path |
| --- | --- | --- | --- |
| `retention-policy-v1` | locked | none | `contracts/data/retention.v1.json` |
| `retention-policy-v2` | locked | none | `contracts/data/retention.v2.json` |
| `retention-policy-v3` | candidate | pending-independent-agent-review | `contracts/data/retention.v3.json` |
| `retention-policy-v4` | locked | none | `contracts/data/retention.v4.json` |

### json-schema (95)

| Contract | Status | Review | Path |
| --- | --- | --- | --- |
| `activity-definition-v1` | locked | none | `contracts/schemas/activity-definition.v1.schema.json` |
| `activity-outcome-v1` | locked | none | `contracts/schemas/activity-outcome.v1.schema.json` |
| `agent-contributor-lineage-v1` | locked | none | `contracts/schemas/agent-contributor-lineage.v1.schema.json` |
| `agent-handoff-v1` | locked | none | `contracts/schemas/agent-handoff.v1.schema.json` |
| `agent-handoff-v2` | locked | none | `contracts/schemas/agent-handoff.v2.schema.json` |
| `agent-review-quorum-v1` | locked | none | `contracts/schemas/agent-review-quorum.v1.schema.json` |
| `agent-review-quorum-view-v1` | locked | none | `contracts/schemas/agent-review-quorum-view.v1.schema.json` |
| `agent-review-session-attestation-v1` | locked | none | `contracts/schemas/agent-review-session-attestation.v1.schema.json` |
| `agent-review-v1` | locked | none | `contracts/schemas/agent-review.v1.schema.json` |
| `artifact-manifest-v1` | locked | none | `contracts/schemas/artifact-manifest.v1.schema.json` |
| `boussole-method-v1` | locked | none | `contracts/schemas/boussole-method.v1.schema.json` |
| `boussole-method-v2` | locked | none | `contracts/schemas/boussole-method.v2.schema.json` |
| `boussole-method-v3` | candidate | pending-independent-agent-review | `contracts/schemas/boussole-method.v3.schema.json` |
| `boussole-response-set-v2` | locked | none | `contracts/schemas/boussole-response-set.v2.schema.json` |
| `browser-session-v1` | locked | none | `contracts/schemas/browser-session.v1.schema.json` |
| `build-brief-acceptance-v2` | locked | none | `contracts/schemas/build-brief-acceptance.v2.schema.json` |
| `build-brief-api-v2` | locked | none | `contracts/schemas/build-brief-api.v2.schema.json` |
| `build-brief-body-v2` | locked | none | `contracts/schemas/build-brief-body.v2.schema.json` |
| `common-v1` | locked | none | `contracts/schemas/common.v1.schema.json` |
| `context-document-v1` | locked | none | `contracts/schemas/context-document.v1.schema.json` |
| `context-document-v2` | locked | none | `contracts/schemas/context-document.v2.schema.json` |
| `correction-record-v1` | locked | none | `contracts/schemas/correction-record.v1.schema.json` |
| `curated-item-export-v1` | locked | none | `contracts/schemas/curated-item-export.v1.schema.json` |
| `curated-item-export-v2` | locked | none | `contracts/schemas/curated-item-export.v2.schema.json` |
| `curated-item-export-v3` | candidate | pending-independent-agent-review | `contracts/schemas/curated-item-export.v3.schema.json` |
| `curation-rule-set-v1` | locked | none | `contracts/schemas/curation-rule-set.v1.schema.json` |
| `curation-rule-set-v2` | locked | none | `contracts/schemas/curation-rule-set.v2.schema.json` |
| `deletion-receipt-v1` | locked | none | `contracts/schemas/deletion-receipt.v1.schema.json` |
| `effect-attestation-v1` | locked | none | `contracts/schemas/effect-attestation.v1.schema.json` |
| `engine-golden-vectors-v1` | locked | none | `contracts/schemas/engine-golden-vectors.v1.schema.json` |
| `envelope-v1` | locked | none | `contracts/schemas/envelope.v1.schema.json` |
| `evidence-report-v1` | locked | none | `contracts/schemas/evidence-report.v1.schema.json` |
| `execution-authorization-v1` | locked | none | `contracts/schemas/execution-authorization.v1.schema.json` |
| `execution-authorization-v2` | locked | none | `contracts/schemas/execution-authorization.v2.schema.json` |
| `execution-authorization-v3` | locked | none | `contracts/schemas/execution-authorization.v3.schema.json` |
| `execution-authorization-v4` | candidate | pending-independent-agent-review | `contracts/schemas/execution-authorization.v4.schema.json` |
| `execution-graph-v1` | locked | none | `contracts/schemas/execution-graph.v1.schema.json` |
| `execution-plan-body-v1` | locked | none | `contracts/schemas/execution-plan-body.v1.schema.json` |
| `execution-plan-body-v2` | locked | none | `contracts/schemas/execution-plan-body.v2.schema.json` |
| `execution-plan-body-v3` | locked | none | `contracts/schemas/execution-plan-body.v3.schema.json` |
| `execution-plan-body-v4` | candidate | pending-independent-agent-review | `contracts/schemas/execution-plan-body.v4.schema.json` |
| `execution-transfer-v1` | locked | none | `contracts/schemas/execution-transfer.v1.schema.json` |
| `feed-fetch-v1` | locked | none | `contracts/schemas/feed-fetch.v1.schema.json` |
| `harness-attestation-v1` | locked | none | `contracts/schemas/harness-attestation.v1.schema.json` |
| `harness-profile-v1` | locked | none | `contracts/schemas/harness-profile.v1.schema.json` |
| `harness-profile-v2` | candidate | pending-independent-agent-review | `contracts/schemas/harness-profile.v2.schema.json` |
| `harness-profile-v3` | candidate | pending-independent-agent-review | `contracts/schemas/harness-profile.v3.schema.json` |
| `human-decision-request-v1` | locked | none | `contracts/schemas/human-decision-request.v1.schema.json` |
| `human-decision-response-v1` | locked | none | `contracts/schemas/human-decision-response.v1.schema.json` |
| `local-comparison-v1` | locked | none | `contracts/schemas/local-comparison.v1.schema.json` |
| `local-comparison-v2` | locked | none | `contracts/schemas/local-comparison.v2.schema.json` |
| `local-comparison-v3` | candidate | pending-independent-agent-review | `contracts/schemas/local-comparison.v3.schema.json` |
| `mission-handoff-binding-v1` | locked | none | `contracts/schemas/mission-handoff-binding.v1.schema.json` |
| `mission-record-v1` | locked | none | `contracts/schemas/mission-record.v1.schema.json` |
| `mission-record-v2` | locked | none | `contracts/schemas/mission-record.v2.schema.json` |
| `mission-record-v3` | locked | none | `contracts/schemas/mission-record.v3.schema.json` |
| `missions-api-schema-v3` | locked | none | `contracts/schemas/missions-api.v3.schema.json` |
| `model-snapshot-v1` | locked | none | `contracts/schemas/model-snapshot.v1.schema.json` |
| `model-snapshot-v2` | locked | none | `contracts/schemas/model-snapshot.v2.schema.json` |
| `notebook-backup-seal-request-v2` | locked | none | `contracts/schemas/notebook-backup-seal-request.v2.schema.json` |
| `notebook-backup-v1` | locked | none | `contracts/schemas/notebook-backup.v1.schema.json` |
| `notebook-backup-v2` | locked | none | `contracts/schemas/notebook-backup.v2.schema.json` |
| `orchestrator-control-v1` | locked | none | `contracts/schemas/orchestrator-control.v1.schema.json` |
| `orchestrator-event-v1` | locked | none | `contracts/schemas/orchestrator-event.v1.schema.json` |
| `orchestrator-event-v2` | locked | none | `contracts/schemas/orchestrator-event.v2.schema.json` |
| `orchestrator-event-v3` | locked | none | `contracts/schemas/orchestrator-event.v3.schema.json` |
| `p02-job-v1` | locked | none | `contracts/schemas/p02-job.v1.schema.json` |
| `policy-definition-v1` | locked | none | `contracts/schemas/policy-definition.v1.schema.json` |
| `policy-definition-v2` | locked | none | `contracts/schemas/policy-definition.v2.schema.json` |
| `policy-evaluation-v1` | locked | none | `contracts/schemas/policy-evaluation.v1.schema.json` |
| `policy-evaluation-v2` | locked | none | `contracts/schemas/policy-evaluation.v2.schema.json` |
| `policy-need-v1` | locked | none | `contracts/schemas/policy-need.v1.schema.json` |
| `policy-need-v2` | locked | none | `contracts/schemas/policy-need.v2.schema.json` |
| `practice-progress-export-v1` | locked | none | `contracts/schemas/practice-progress-export.v1.schema.json` |
| `practice-progress-export-v2` | candidate | pending-independent-agent-review | `contracts/schemas/practice-progress-export.v2.schema.json` |
| `problem-details-v1` | locked | none | `contracts/schemas/problem-details.v1.schema.json` |
| `public-projection-v1` | locked | none | `contracts/schemas/public-projection.v1.schema.json` |
| `public-vote-dataset-v1` | locked | none | `contracts/schemas/public-vote-dataset.v1.schema.json` |
| `public-vote-dataset-v2` | locked | none | `contracts/schemas/public-vote-dataset.v2.schema.json` |
| `public-vote-dataset-v3` | candidate | pending-independent-agent-review | `contracts/schemas/public-vote-dataset.v3.schema.json` |
| `radar-normalized-feed-v1` | locked | none | `contracts/schemas/radar-normalized-feed.v1.schema.json` |
| `radar-normalized-item-v1` | locked | none | `contracts/schemas/radar-normalized-item.v1.schema.json` |
| `radar-rule-evaluation-v1` | locked | none | `contracts/schemas/radar-rule-evaluation.v1.schema.json` |
| `retention-policy-schema-v1` | locked | none | `contracts/schemas/retention-policy.v1.schema.json` |
| `retention-policy-schema-v2` | locked | none | `contracts/schemas/retention-policy.v2.schema.json` |
| `retention-policy-schema-v3` | candidate | pending-independent-agent-review | `contracts/schemas/retention-policy.v3.schema.json` |
| `retention-policy-schema-v4` | locked | none | `contracts/schemas/retention-policy.v4.schema.json` |
| `session-event-v1` | locked | none | `contracts/schemas/session-event.v1.schema.json` |
| `session-export-v1` | locked | none | `contracts/schemas/session-export.v1.schema.json` |
| `signalement-local-export-v1` | locked | none | `contracts/schemas/signalement-local-export.v1.schema.json` |
| `spec-package-v1` | locked | none | `contracts/schemas/spec-package.v1.schema.json` |
| `spec-package-v2` | locked | none | `contracts/schemas/spec-package.v2.schema.json` |
| `step-invocation-v1` | locked | none | `contracts/schemas/step-invocation.v1.schema.json` |
| `tool-invocation-observation-v1` | candidate | pending-independent-agent-review | `contracts/schemas/tool-invocation-observation.v1.schema.json` |
| `work-package-plan-v1` | locked | none | `contracts/schemas/work-package-plan.v1.schema.json` |

### openapi (13)

| Contract | Status | Review | Path |
| --- | --- | --- | --- |
| `auth-api-v1` | locked | none | `contracts/openapi/auth.v1.yaml` |
| `missions-api-v1` | locked | none | `contracts/openapi/missions.v1.yaml` |
| `missions-api-v2` | locked | none | `contracts/openapi/missions.v2.yaml` |
| `missions-api-v3` | locked | none | `contracts/openapi/missions.v3.yaml` |
| `model-policy-api-v1` | locked | none | `contracts/openapi/model-policy.v1.yaml` |
| `model-policy-api-v2` | locked | none | `contracts/openapi/model-policy.v2.yaml` |
| `practices-api-v1` | locked | none | `contracts/openapi/practices.v1.yaml` |
| `radar-api-v1` | locked | none | `contracts/openapi/radar.v1.yaml` |
| `radar-api-v2` | locked | none | `contracts/openapi/radar.v2.yaml` |
| `sessions-api-v1` | locked | none | `contracts/openapi/sessions.v1.yaml` |
| `specifications-api-v1` | locked | none | `contracts/openapi/specifications.v1.yaml` |
| `specifications-api-v2` | locked | none | `contracts/openapi/specifications.v2.yaml` |
| `website-api-v1` | locked | none | `contracts/openapi/website.v1.yaml` |

### wit (9)

| Contract | Status | Review | Path |
| --- | --- | --- | --- |
| `boussole-scoring-v1` | locked | none | `contracts/wit/boussole-scoring-v1/world.wit` |
| `boussole-scoring-v2` | locked | none | `contracts/wit/boussole-scoring-v2/world.wit` |
| `notebook-core-v1` | locked | none | `contracts/wit/notebook-core-v1/world.wit` |
| `notebook-core-v2` | locked | none | `contracts/wit/notebook-core-v2/world.wit` |
| `policy-core-v1` | locked | none | `contracts/wit/policy-core-v1/world.wit` |
| `policy-core-v2` | locked | none | `contracts/wit/policy-core-v2/world.wit` |
| `practice-scoring-v1` | locked | none | `contracts/wit/practice-scoring-v1/world.wit` |
| `radar-engine-v1` | locked | none | `contracts/wit/radar-engine-v1/world.wit` |
| `radar-engine-v2` | locked | none | `contracts/wit/radar-engine-v2/world.wit` |
