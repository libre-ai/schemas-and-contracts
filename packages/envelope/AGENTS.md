# envelope Canonical Agent Rules

## Authority

Integrity envelope for untrusted content, couche 3 kernel (K3) of the
constellation: content that reaches a model from outside is wrapped as data,
tagged `trusted:false`, and verified offline via a length-prefixed
HMAC-SHA256 before it is ever rendered as instruction.
Doctrine lives upstream: https://raw.githubusercontent.com/libre-ai/governance/main/AGENTS.md

## Boundaries

- Asymmetric signing, key management/rotation/storage, and document-schema
  validation (`envelope.v1.schema.json`, owned by `contracts`) are out of
  scope here — see this repo's `project.v1.yaml` for current exposure and
  exit criteria.
- Product code and product specifications live in their own repositories.
- The governance gate template is consumed pinned (reusable workflows and a
  pinned tooling git-dep), never duplicated in this repository.

## Quality gates

Run `bun run check` before pushing (Bun floor, toolchain, secret scan,
personal-data boundary, lint, typecheck, tests); never hide a red test.

## Agents

- Read actual state before editing.
- Stage files before running tree-walking gates (`git ls-files`-based
  scanners do not see untracked files).
- Security > quality > performance > completeness.
