# Export digests for I-10: curated-item-export v3 and practice-progress-export v2 candidates

Decision identifier: `urn:libre-ai:decision:2026-10-10-export-digests-i10`.
Status: accepted — admits two contracts as **candidates**; neither is locked.
Owner-arbitration: 2026-10-10 — conformité I-10 des exports arbitrée en chat

## Context

`libre-ai/project-governance` ADR-0049 (accepted 2026-10-10) widens I-10
(`docs/decisions/INVARIANTS.md`, row I-10):

- every export carries a canonical digest of its content (SHA-256 of its
  canonical form, RFC 8785 for a JSON export), verified at import with a closed
  refusal;
- outside the trust context that produced it (handed to a third party, another
  device or another service), it is authenticated by AEAD or by signature,
  never by a bare digest;
- a falsification of an export by its own holder is an accepted, documented risk
  (risk register R9).

ADR-0049 measured that `curated-item-export` and `practice-progress-export`
carry no export digest, and stated that adding one is a new major and a separate
decision (ADR-0049, "N'autorise pas" and decision 4, "Écarts mesurés"). The owner
took that separate decision in chat on 2026-10-10.

## Inventory of the export contracts

Measured on `schemas-and-contracts@489702c` and the served branch of each
consumer. "Import verifies" was never measured before this record.

| Contract | Status | Export digest | Producer | Importer | Import verifies the digest |
| --- | --- | --- | --- | --- | --- |
| `curated-item-export-v1` | locked | none (per-item `normalizedDigest` only, schema `:32`) | none | none | not applicable |
| `curated-item-export-v2` | locked | none (per-item `normalizedDigest` only, schema `:47`) | none: `information-feed-filter@1434e70` (archived) has no export code | none | not applicable |
| `practice-progress-export-v1` | locked | none | none: `ai-practice-workbench@b5c46b3` (archived) exports a bare `activity-outcome` (`apps/practices/src/ui/data-ownership.tsx:46`, `src/domain/activity-outcome.ts:215`), not this contract | none | not applicable |
| `session-export-v1` | locked | bare SHA-256 `digest` (schema `:52`); **no preimage is defined** anywhere in this authority | none: `learning-session-facilitation@6e01cb2` only names a `session-exported` event (`apps/sessions/src/domain/session-event.ts:34`) | none | not measurable: no importer, and no defined preimage to recompute |
| `signalement-local-export-v1` | locked | bare SHA-256 `approval.payloadDigest` over RFC 8785 `payload` (schema `:23`, `SEMANTICS.md` step 4) | `signalement@ed96d1b` `packages/domain/export.ts:212` | `signalement` `tools/contracts/verify-export.ts:5`, through the vendored authority verifier `tools/quality/signalement-local-export-v1.ts:69` | **yes**: mismatch yields `approval.digest_mismatch`; per-file `sha256` checked at `:138` |
| `notebook-backup-v1` | locked | `ciphertextDigest`, inside an AEAD envelope | none: `personal-knowledge-workspace@4f1ee72` references only v2 | none | not applicable |
| `notebook-backup-v2` | locked | `digest` over the sealed body, AES-256-GCM / Argon2id | `personal-knowledge-workspace@4f1ee72` `crates/notebook-core/src/crypto.rs:138` | `crates/notebook-core/src/lib.rs:136` | **yes**: refused at `lib.rs:160` together with the AEAD tag and the secret check |

## Decision

1. **Two new major candidates.** `curated-item-export-v3` (v2 plus a required
   `digest`) and `practice-progress-export-v2` (v1 plus a required `digest`).
   The locked majors stay byte-identical: `COMPATIBILITY.md`, "Pre-implementation
   candidates", forbids completing a locked contract in place when the accepted
   payload changes, and ADR-0049 keeps the export contracts identical to the
   byte.
2. **Digest convention.** `digest` = lowercase hex SHA-256 of the RFC 8785 form
   of the export without its `digest` member. `session-export.v1` was the
   convention the mandate pointed to; it defines no preimage, so it cannot be
   one. The convention reused is this authority's documented one for a digest
   carried inside the object it covers (`harness-profile.v3` `profileDigest`,
   `contracts/harness-profile-v3/SEMANTICS.md`), with the canonicalizer already
   used by `signalement-local-export-v1` (`tools/quality/authorized-execution.ts`
   `canonicalJson`).
3. **Import refuses closed**, in order: strict JSON (no BOM, valid UTF-8, no
   duplicate member, no lone surrogate, depth ≤ 16), schema, digest equality.
   Reference oracle `tools/quality/export-digest.ts`.
4. **Both exports leave their trust context** by purpose: Radar's export is a
   portable set downloaded by the person (`docs/protocols/feed-radar/radar.md:17`,
   `:73`), Practices' is "a portable progress bundle" (`docs/protocols/ai-practices/practices.md:16`).
   I-10 therefore requires AEAD or a signature beyond the producing context.

## Authentication form outside the trust context: not decided by ADR-0049

ADR-0049 admits AEAD **or** signature. The most restrictive option compatible
with the doctrine was taken:

- **AEAD, not signature.** Both exports are classified `personal`. AEAD keeps
  them confidential on another device or at a third party; a signature leaves
  them in clear. AEAD needs no public-key distribution, rotation or revocation,
  none of which is decided for these products; this authority already locks an
  AEAD envelope for personal data leaving a device (`notebook-backup-v2`,
  AES-256-GCM with an Argon2id-derived key). A signature authenticates the
  producer's key, which the holder controls anyway, so it adds nothing against
  the accepted holder-falsification risk.
- **No sealed form is invented here.** Defining one is a cryptographic contract
  of its own (cipher, KDF bounds, nonce, AAD binding of `schemaVersion` and
  `digest`) that needs its cryptography pass. Until a sealed-export contract is
  qualified, the candidates admit the bare digested form **only inside the
  producing context**: a producer does not hand it across, and an importer that
  cannot establish the bytes were produced in its own context refuses them as
  foreign. Radar's portable download is therefore not admitted by
  `curated-item-export-v3` alone.

A later decision may select a signature instead; it would be a new decision,
not a reinterpretation of this one.

## Gaps reported, not corrected here

- `session-export-v1` (`tenant-private`) is handed to an "authorized actor"
  (`docs/protocols/sessions/sessions.md:17`), which leaves the service, yet
  carries a bare digest with no defined preimage. It conforms to neither the
  digest clause (no canonical form defined) nor the authentication clause.
  Correcting it is a new major, outside this arbitration.
- `signalement-local-export-v1` is "portable independently of any Signalement
  service" and states "No new signing/authentication service is introduced"
  (`contracts/signalement-local-export-v1/SEMANTICS.md:9`, `:50`). Its digest is
  verified at import, but a dossier handed to a third party is authenticated by
  a bare digest only, which I-10 forbids outside the producing context.
  Correcting it is a new major, outside this arbitration.
- No consumer of `session-export-v1` exists to verify its digest. Consumers are
  not modified here: the products are at stage `idea` and conformance is proved
  in the implementing repository.

## Scope

`curated-item-export-v3` and `practice-progress-export-v2` are registered as
post-lock catalog additions with status **candidate**
(`contracts/catalog-post-lock-additions.v1.json`, digest re-pinned in
`tools/quality/specification-lock.ts`), classified `personal`, major-versioned,
owners and consumers unchanged from the previous major. Semantics:
`contracts/curated-item-export-v3/SEMANTICS.md`,
`contracts/practice-progress-export-v2/SEMANTICS.md`. Review dossier:
`docs/reviews/export-digests-i10-review.md`.

This record admits candidate entries. It is not a role verdict and grants no
runtime admission. Promotion to `locked` is a separate owner act, after the role
passes named in the review dossier.
