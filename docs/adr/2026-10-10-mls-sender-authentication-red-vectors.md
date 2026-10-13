# I-34 red vectors for MLS sender authentication, structural form

Decision identifier: `urn:libre-ai:decision:2026-10-10-mls-sender-authentication-red-vectors`.
Status: accepted — admits a **candidate** vector set; it is not a catalog contract and it
is not locked.
Owner-arbitration: 2026-10-10 — vecteurs I-34 arbitrés en chat

## Context

`libre-ai/project-governance` ADR-0048 (accepted 2026-10-10) corrects two signed
resolutions of the collaboration design. R5 claimed that a PrivateMessage has no
signature and that the AEAD binds the sender. R4 sealed deltas under a key from
`MLS-Exporter`. RFC 9420 says the opposite on both points: `PrivateMessageContent`
carries `FramedContentAuthData`, whose signature is the only thing that binds a message
to a particular member (§6.1, §6.3.1, §16.5), and an exported secret is for use outside
MLS (§8.5). The ADR states invariant I-34 and authorizes "l'écriture des vecteurs rouges
d'I-34 dans l'autorité des contrats". It does not authorize MLS code, the OpenMLS
integration, or a change to a locked contract, and the crypto review gate D4 of
ADR-0011 stays closed.

No collaboration or MLS contract exists in the catalog. The candidate
`decision-binding` vector set is the precedent for a semantic vector set with a
reference oracle and no catalog entry.

## Decision

1. **Location.** The vectors live here, the contract authority, as a candidate semantic
   set outside the catalog:
   `contracts/fixtures/mls-sender-authentication-candidate/red-vectors.v1.json`, with
   their semantics in `contracts/mls-sender-authentication-candidate/SEMANTICS.md` and
   their reference oracle and checker in `tools/quality/mls-sender-authentication.ts`.
   The implementing repository (`libre-ai/collaborative-data-sync`) will replay them
   against its receiver at a pinned revision of this authority, as with every other
   conformance set.
2. **Structural vectors, `cryptoMaterial: "to-generate"`.** Two options were open:
   - (A) generate real signatures and ciphertexts with a reference MLS library (OpenMLS
     or mls-rs) in an isolated, versioned generator;
   - (B, retained) describe each received message by the symbolic facts a receiver
     establishes (wire format, epoch, which key sealed the content, whether the AEAD
     opens, which leaf signed which content) and declare the material to generate.

   (B) is retained because it is the most verifiable option that adds no dependency and
   stays inside ADR-0048. Option (A) cannot produce the red half of the set with a
   library's public API: a PrivateMessage signed by leaf 3 but attributed to leaf 1, or
   content sealed under an exported key inside a PrivateMessage, is exactly what a
   conformant library refuses to build. Producing them means assembling the framing by
   hand from the key schedule, which is MLS code, and choosing and pinning OpenMLS here
   anticipates the integration ADR-0048 calls "un incrément cadré, non délégable".
   Under (B) every vector is checked here without cryptography: the checker replays each
   one on a symbolic receiver and proves that its declared violations are exact (see
   SEMANTICS.md). The material is generated later, by the implementing repository, in
   test code, against the same symbolic fields.
3. **Verdicts a real receiver can return.** The closed set has eight verdicts. A member
   forging another member's sender data is refused as `refused-signature-invalid`, not
   as a distinct "sender mismatch": a receiver verifies under the key of the leaf the
   sender data names and cannot know who actually signed. Content sealed under an
   exported or derived key inside a PrivateMessage is refused as
   `refused-group-authentication`, because it does not open under the sender's ratchet
   key.
4. **Clauses.** The five clauses of I-34 are covered, plus two more from the same
   invariant: application content outside a PrivateMessage (RFC 9420 §6) and a frame
   forged or altered by the relay. 17 red vectors, 2 green.
5. **`SealedFrame` is not corrected here.** Adding a sender and a signature field to
   `SealedFrame` would be a type-level change, but it would keep a framing outside RFC
   9420, which I-34 forbids: the conforming shape is an `MLSMessage` of wire format
   `mls_private_message`, whose production needs MLS code. ADR-0048 also assigns that
   replacement to the repository's own work package. The gap is recorded in the vectors
   (`knownGaps`), tied to the vector that will turn red on it.

## Consequences

- I-34's precondition ("aucun code MLS n'est fusionné avant des vecteurs rouges") is met
  in its structural form. The first MLS pull request must replay these vectors with
  generated material and obtain each verdict.
- The stale-epoch vector admits no window of past epochs for application messages.
  An MLS library that keeps past-epoch secrets to decrypt delayed messages must have
  that window set to zero for collaboration content. This is a reading of I-34
  ("époque périmée … refus"), to confirm at integration.
- Two protocol authorities of this repository, pinned by sha256 in
  `contracts/protocol-authorities.v1.json`, still describe the R4 form
  (`docs/protocols/sessions/sessions.md:35`, `docs/protocols/spec-studio/specifications.md:15`).
  Amending them is an amendment of a pinned protocol authority, outside ADR-0048's
  authorization; the gap is recorded in the vectors.
- This record admits no runtime capability and is not a cryptographic review. The roles
  a promotion would need are security and cryptography, under ADR-0011 D4.

## Sources

- RFC 9420, `https://www.rfc-editor.org/rfc/rfc9420.txt`, read 2026-10-10, sha256
  `251ab11076c43fd4b8dc080a068a8caaf55e2fc5e6aa61d4274961627f32624b`: §6, §6.1, §6.3,
  §6.3.1, §6.3.2, §8.5, §9.2, §15.2, §15.3, §16.5.
- `libre-ai/project-governance` ADR-0048 and I-34 (`docs/decisions/INVARIANTS.md`), and
  `docs/parity/design/DESIGN-collab-v2-signable.md` §11, R4′ and R5′.
- `libre-ai/collaborative-data-sync@8c50e51`: `packages/core/src/crypto-types.ts:33-38`,
  `packages/core/src/test-identity-provider.ts`, `packages/relay/src/relay-server.ts:51-52`,
  `packages/core/src/sealed-collab-document.test.ts`.
