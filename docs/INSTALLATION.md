<!-- SPDX-FileCopyrightText: 2026 Libre AI contributors -->
<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Local installation and verification

This repository contains separate packages; installing one does not require using the others. Package names and versions remain independent. No registry release is asserted by this migration.

| Package | Path | Use |
| --- | --- | --- |
| `@libre-ai/contracts` 0.1.0 | `packages/sdk-ts` | TypeScript projections and runtime validation |
| `libre-ai-contract-types` 0.1.0 | `crates/sdk-rs` | Rust projections and runtime validation |
| `@libre-ai/envelope` 0.1.0 (private) | `packages/envelope` | HMAC integrity and guarded rendering of untrusted content |

For a TypeScript consumer, use a local dependency on the selected package directory, then import its existing package name. For Cargo, use `libre-ai-contract-types = { path = "../schemas-and-contracts/crates/sdk-rs" }`, adjusting the relative path from your consumer. The SDK embeds its schemas; installing the TypeScript package does not require the canonical repository at runtime. Static generated types never replace runtime validation. Envelope HMAC verifies integrity with a shared key; it does not prove an asymmetric signer identity or manage keys.

## Working on this repository

Use Bun `1.4.0-canary.1+57f349f63` and Rust 1.97 with Cargo. Clone the migration's `project-governance` tooling checkout as a sibling; package manifests explicitly declare this local development dependency. Its revision must be supplied by the reviewed composition, not silently fetched from an old repository.

```sh
bun install --ignore-scripts
bun run test
bun run check:auth-retention
bun run check:build-brief
bun run --cwd packages/sdk-ts generate:check
bun run --cwd packages/sdk-ts test
bun run --cwd packages/envelope test
cargo test --locked --manifest-path crates/sdk-rs/Cargo.toml
```

`bun run check` retains toolchain, contract, security, privacy, formatting, type, generation and package checks. The protocol-authority gate also requires the explicit `contracts/protocol-authorities.v1.json` migration map and its pinned local protocol documents; missing authorities are not a successful full check. Public CI for the new multi-repository composition must pin its sibling checkout and runtime distribution before publication.

## Updating schemas

Edit only the canonical `contracts/` authority according to `contracts/COMPATIBILITY.md`. Locked schemas remain immutable; candidate status is not promoted by regeneration. Run the existing TypeScript generation/sync commands and Rust `scripts/check-vendored-schemas.ts --write`, then their drift gates and tests. Generated schema copies remain noncanonical.

## Licenses

Keep nested REUSE manifests, file notices and full license texts. Contract interoperability, SDK code, runtime envelope and editorial documents do not all share one license. See the recovered source provenance in [migration notes](migration/CODE-RECOVERY.md).
