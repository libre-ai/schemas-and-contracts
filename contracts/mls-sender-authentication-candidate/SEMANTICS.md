# MLS sender authentication — I-34 red vectors, semantics (candidate)

Vectors: `contracts/fixtures/mls-sender-authentication-candidate/red-vectors.v1.json`
(`libre-ai.mls-sender-authentication-red-vectors.v1`). Decision record:
`docs/adr/2026-10-10-mls-sender-authentication-red-vectors.md`. Reference oracle and
document checker: `tools/quality/mls-sender-authentication.ts`.

`libre-ai/project-governance` ADR-0048 (accepted 2026-10-10) and invariant I-34 require,
before any MLS code is merged, red vectors for: sender forgery by a member, an absent or
invalid signature, content sealed under an exported or derived key, a stale or future
epoch, and replay. Each must turn red against an implementation deprived of the property
it targets. This set adds two clauses from the same invariant: application content
outside a PrivateMessage, and a frame forged or altered by the relay.

This is not a schema contract and is not in the catalog. No MLS wire format is defined
here: the wire format is RFC 9420's, and the implementing repository will consume it
through an MLS library.

## What a vector describes

A vector is a received application message described by the facts a receiver
establishes while processing it, not by its bytes. Every vector carries
`cryptoMaterial: "to-generate"` (see "Generating the material" below).

| Field | Closed values | RFC 9420 |
| --- | --- | --- |
| `transport` | `mls-message`, `application-sealed-frame` (an application frame that is not an `MLSMessage`) | §6 |
| `wireFormat` | `mls_private_message`, `mls_public_message`, `null` | §6 |
| `groupId`, `epoch` | the receiver's group; an integer epoch | §6, §6.3 |
| `contentType` | `application` | §6 |
| `contentProtection` | the key the content was sealed under: `secret-tree-application-ratchet`, `mls-exporter-derived-key`, `epoch-secret-hkdf`, `application-hkdf` | §6.3.1, §8.5, §9 |
| `aeadSealedBy` | `member-holding-epoch-secrets`, `relay-without-group-secrets` | §16.5 |
| `inTransitAlteration` | `none`, `authenticated-data-rewritten` | §6.3.1 (`PrivateContentAAD`) |
| `senderData` | `leafIndex`, `generation`, `reuseGuard` (`fresh` or `repeated`) | §6.3.2 |
| `signature` | `encoding` (`complete`, `truncated`, `absent`), `signerLeafIndex`, `signedContent` (`this-framed-content`, `other-framed-content`, `other-epoch-group-context`) | §6.1 |

`signedContent` is relative to the message: `this-framed-content` means the signature
covers this message's `FramedContentTBS`, including the `GroupContext` of its epoch.

The receiver (`receiver`) is leaf 0 of a group at epoch 7 with members at leaves 0, 1
and 3, a blank leaf 2 (a member removed by the commit to epoch 7), and one consumed
application key: leaf 1, generation 4. Each vector is evaluated against this initial
state on its own; applying one consumes nothing for the next.

## Verdicts, in processing order

The verdict set is closed. Each refusal is one a real receiver can actually return:
in particular, a receiver cannot tell "signed by another member" from "invalid
signature", because it verifies under the key of the leaf the sender data names.

| Order | Verdict | Property refused | RFC 9420 |
| --- | --- | --- | --- |
| 1 | `refused-not-mls-private-message` | `native-private-message-framing`: application data travels only as an `MLSMessage` of wire format `mls_private_message` | §6 ("Applications MUST use PrivateMessage to encrypt application messages") |
| 2 | `refused-stale-epoch` | `epoch-not-stale` | §6.1, §15.2 |
| 3 | `refused-future-epoch` | `epoch-not-future` | §6.1, §15.2 |
| 4 | `refused-group-authentication` | `content-key-from-secret-tree`: the content opens only under the sender's application ratchet key; a key from `MLS-Exporter`, from `epoch_secret` or from an application HKDF does not | §6.3.1, §8.5, §9 |
| 4 | `refused-group-authentication` | `group-authentication`: an AEAD produced without the epoch secrets, or whose AAD was altered, does not open | §16.5 (first form) |
| 5 | `refused-unknown-sender-leaf` | `sender-leaf-non-blank` | §6.3.2 |
| 6 | `refused-replay` | `generation-not-consumed`: replay is keyed on (leaf, generation); a fresh reuse guard, hence a new nonce, does not make a consumed generation fresh | §6.3.1, §9.2 |
| 7 | `refused-signature-invalid` | `sender-signature`: `FramedContentAuthData.signature` present, complete, verified under the signature key of the leaf named by the sender data, over this `FramedContentTBS` | §6.1, §6.3.1, §16.5 (second form) |
| — | `applied` | every property holds | |

Every refusal leaves the document unchanged (`documentMutated: false`).

## Pairs and exact violations

Every red vector names a `pairedGreen` and the JSON pointers (`differsAt`) at which its
message differs from that green's; the checker recomputes the difference and refuses any
other. Every green is paired with at least one red.

Every red vector declares the properties it violates (`violatedProperties`). The checker
replays it on the symbolic receiver three ways: with every check, it returns its
`expected` verdict; with its declared properties disabled, it returns `applied` (it
violates nothing undeclared); with all but one of them disabled, it is still refused
(each declared property is really violated). The second replay is I-34's requirement,
"rougit contre une implémentation privée de la propriété qu'il vise", stated on the
symbolic model.

## Generating the material

`cryptoMaterial: "to-generate"` means no byte string is admitted here yet. The
implementing repository, when ADR-0011's D4 gate opens and an MLS library is integrated,
generates for each vector an `MLSMessage` realizing its symbolic fields from a group in
the receiver's state, replays it against its receiver, and must obtain the vector's
verdict. Material produced that way may be added here later, beside the symbolic fields,
which remain the expectation. Several vectors require constructing a message no
conformant sender produces (a signature under another leaf, content sealed under an
exported key): the generator does so on purpose, in test code only.

## Known gaps

The document lists the places that today contradict I-34 (`knownGaps`), each tied to the
vectors that will turn red on them:

- `cds-sealed-frame-without-sender` — `libre-ai/collaborative-data-sync`
  `SealedFrame` (`packages/core/src/crypto-types.ts:33-38`) carries no sender and no
  signature, and the relay documentation (`packages/relay/src/relay-server.ts:51-52`)
  says recipients trust the AEAD tag for identity.
- `sc-protocol-per-epoch-group-key` — two protocol authorities pinned by sha256 in this
  repository describe deltas sealed under a per-epoch group key derived through MLS.
