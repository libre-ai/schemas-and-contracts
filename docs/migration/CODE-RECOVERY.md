<!-- SPDX-FileCopyrightText: 2026 Libre AI contributors -->
<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Code recovery and placement

The documentary landing and its material remain present. The implementation was recovered from contracts `6c42dfb8c8f11d252e1d28b65b21a1beba5ac374`, sdk-ts `7067049b2adbf39b37a9fa71dc6fdb7e6b6fd7f1`, sdk-rs `ac9f2020425733183839a58fc2c3928a4de5c066`, and envelope `14c55a609175a967206bb92ca6882393ec354885`.

Canonical contracts stay at the root; TypeScript SDK and envelope occupy `packages/`, Rust SDK occupies `crates/sdk-rs`. Existing import names and versions are retained. Both SDKs are regenerated from all 81 canonical schemas; the separately maintained HTTP v2 fixtures are included in their conformance suites without changing candidate admission.

Rust static projection compatibility uses the preserved sdk87-integration/rs87 snapshot's build.rs and schema_projection tests, bound in the private recovery inventory. It supports declaration-only root reference siblings while still rejecting validation siblings and embedded resource scopes; duplicate identical declarations use Typify's existing deduplication interface. No dependency version upgrade accompanies that recovery.

The source CC-BY text is preserved under source-readmes/LICENSES alongside the existing documentary license text. Nested REUSE manifests and per-file SPDX notices retain source licensing. No historical license is withdrawn and no uniform relicensing is implied.

The original repository agent instructions and workflow references are historical inputs requiring migration review; they do not authorize contacting old remotes or removing quality checks. Development tooling is explicitly local project-governance. Publication and release of packages are separate from this local integration.

## Protocol documents

`contracts/protocol-authorities.v1.json` maps each OpenAPI domain explicitly to
its historical repository, source commit/path, adopted local target and SHA-256.
Seven historical application documents are preserved byte-for-byte under
`docs/protocols/`; identity doctrine is adopted in the sibling
`project-governance/docs/specifications/IDENTITY-AUTHORIZATION.md` from commit
`496cd`. These CC-BY-4.0 documents preserve their original attribution.
They do not assign historical applications to the current twenty-repository
portfolio. The gate reads only these local pinned bytes, including in CI, and
rejects missing, ambiguous, changed or unexpected entries. It never consults
retired GitHub endpoints and has no offline-success fallback.
