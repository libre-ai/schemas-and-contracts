# sdk-ts Canonical Agent Rules

## Authority

TypeScript SDK projection (couche 4) of the Libre AI locked contracts —
fail-closed validators and generated types. Everything under `schemas/` and
`src/generated/` is a **verified projection** of the `contracts` authority
(https://raw.githubusercontent.com/libre-ai/contracts/main/AGENTS.md) at
the revision pinned in `package.json`/`bun.lock` (I-05): byte-exact under
`bun run generate:check`, never hand-edited, never canonical. The
`governance` repository
(https://raw.githubusercontent.com/libre-ai/governance/main/AGENTS.md)
owns doctrine and the fleet gate template, consumed here as pinned
reusable workflows and a pinned tooling git-dep.

## Boundaries

- Contract evolution happens in the `contracts` repository; this SDK
  re-generates against a new pin — a contract change here is a pin bump
  plus regeneration, never an edit.
- Conformance to the authority's vectors is proven here, against the
  pinned revision.

## Quality gates

Run `bun run check` (bun floor and toolchain from the pinned governance
git-dep, generation drift gate, secret scan, personal-data boundary, lint,
typecheck, tests). Never hide a red test.

## Agents

- Read actual state before editing. Stage files before tree-walking gates.
- Security > quality > performance > completeness.
