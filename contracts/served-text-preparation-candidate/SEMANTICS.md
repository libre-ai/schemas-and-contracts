# Served-text preparation — vectors, semantics (candidate)

Vectors: `contracts/fixtures/served-text-preparation-candidate/vectors.v1.json`
(`libre-ai.served-text-preparation-vectors.v1`). Decision record:
`docs/adr/2026-11-17-served-text-preparation-vectors.md`. Reference oracle and document
checker: `tools/quality/served-text-preparation.ts`, replayed by
`tools/quality/served-text-preparation.test.ts`.

This is not a schema contract and is not in the catalog. It is a candidate semantic
vector set: it is not locked, and it may change until a distinct decision promotes it.

## Scope

The set fixes how an untrusted text is prepared before it is served to an agent: which
code points are removed, how a text is cut to a bound, and how the characters an agent
may read as a delimiter are replaced. It is a text-to-text transformation with three
flags. It defines no document, no signature, no field and no rendering.

Nothing here makes an agent obey or ignore a text. Preparation makes the boundary of a
served text reliable; the policy on the agent side is still needed.

The tables of the vector document (`removedRanges`, `keptNeighbours`, `delimiters`) are
the single source for any repository that removes, shows or detects hidden characters.
Such a repository consumes them as a pinned, verified projection, or states in one line
why its class differs.

## Steps

`prepare(text, bound)` applies three steps, in this order:

1. **Sanitize.** Remove every code point of the removed ranges, then apply NFC.
2. **Truncate.** Cut the sanitized text to `bound` code points.
3. **Neutralize.** Replace each delimiter form by its counterpart.

The order is part of the semantics. Sanitizing first keeps invisible padding from
pushing visible text past the bound. Truncating before neutralizing makes `neutralized`
count the delimiters of the served text, not those of the part that was cut.

Lengths and bounds are counted in code points, never in UTF-16 code units or bytes. An
ill-formed text (a lone surrogate) is refused, not repaired: the reference oracle throws
`TypeError`. A bound that is not a non-negative integer is refused: the oracle throws
`RangeError`.

## Removed ranges

The removed set is the union of `Default_Ignorable_Code_Point`, `Cc`, `Cf`, `Zl` and
`Zp` of Unicode 17.0, minus U+0009 (TAB) and U+000A (LF). Merged and sorted, it is 28
inclusive ranges, written as literals in `removedRanges`:

| # | Range | # | Range | # | Range | # | Range |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | U+0000–0008 | 8 | U+06DD | 15 | U+200B–200F | 22 | U+FFF0–FFFB |
| 2 | U+000B–001F | 9 | U+070F | 16 | U+2028–202E | 23 | U+110BD |
| 3 | U+007F–009F | 10 | U+0890–0891 | 17 | U+2060–206F | 24 | U+110CD |
| 4 | U+00AD | 11 | U+08E2 | 18 | U+3164 | 25 | U+13430–1343F |
| 5 | U+034F | 12 | U+115F–1160 | 19 | U+FE00–FE0F | 26 | U+1BCA0–1BCA3 |
| 6 | U+0600–0605 | 13 | U+17B4–17B5 | 20 | U+FEFF | 27 | U+1D173–1D17A |
| 7 | U+061C | 14 | U+180B–180F | 21 | U+FFA0 | 28 | U+E0000–E0FFF |

The table is a literal, not a property lookup: an implementation on another Unicode
version must still remove exactly these ranges. `unicodeVersion` names the version the
table was derived from. The reference test compares the table with that version's
Unicode Character Database files, vendored with pinned digests under
`third_party/unicode-ucd-17.0.0/`, never with the tables of the runtime it runs on.

White space is not removed: TAB, LF, U+0020, U+00A0 and the other `Zs` spaces stay.
`keptNeighbours` lists the 55 code points that sit on the outer edge of a range; each
must come out unchanged.

Removing U+200C and U+200D is an accepted loss for the scripts and emoji sequences that
depend on them. The loss is reported by `altered`.

## Delimiters

Fourteen code points have an NFC, NFD, NFKC or NFKD form that contains `[`, `]`, `<` or
`>`. Each is replaced by a counterpart that is stable under the four forms, one code
point for one, so the number of code points does not change:

| Counterpart | Forms replaced |
| --- | --- |
| U+27E6 | U+005B, U+FF3B, U+FE47 |
| U+27E7 | U+005D, U+FF3D, U+FE48 |
| U+2039 | U+003C, U+FF1C, U+FE64, U+226E |
| U+203A | U+003E, U+FF1E, U+FE65, U+226F |

A counterpart already present in the source is left as it is and is not counted.

## Truncation

A sanitized text of at most `bound` code points is kept whole. A longer one keeps its
first `max(bound - 12, 0)` code points, followed by the truncation marker: U+2026,
U+27E6, the nine letters `truncated`, U+27E7 (12 code points). A truncated text therefore
counts `max(bound, 12)` code points: a bound below 12 yields the marker alone.

The brackets of the marker are counterparts, added after the cut: they are never counted
in `neutralized`.

A source text may itself end with the marker. Only the `truncated` flag proves a cut.

## Flags

| Flag | Meaning |
| --- | --- |
| `altered` | the sanitized text differs from NFC(source): at least one code point was removed. NFC alone does not set it. |
| `truncated` | the sanitized text was longer than the bound and was cut. |
| `neutralized` | the number of delimiter forms replaced in the served text. |

## Coexistence with envelope v1

This set neither changes nor replaces `libre-ai.envelope.v1`
(`contracts/schemas/envelope.v1.schema.json`). The two coexist: the envelope
authenticates an untrusted content and frames it with fixed delimiters; preparation
transforms a text. A prepared text that is then rendered by the envelope guard has its
U+27E6 and U+27E7 escaped as `%u27E6` and `%u27E7`, which stays safe.

## Replaying the vectors

A vector has an `id`, a `family`, an `input` and an `expected`.

- `input` is `{ text, bound }`, or `{ repeat: { unit, count }, prefix?, suffix?, bound }`
  for a long input, whose text is `prefix`, then `unit` repeated `count` times, then
  `suffix`.
- `expected` carries `altered`, `truncated`, `neutralized` and either `text`, or, for a
  long output, `textSha256` (SHA-256 of the UTF-8 encoding, lowercase hexadecimal) and
  `codePoints`.
- A vector of the `range` family also carries `range`, one of the 28 removed ranges. Its
  text is `x`, the first code point of the range, an interior one when the range holds at
  least three, the last one when it holds at least two, then `y`; it expects `xy`.

The six families are `range` (one vector per removed range), `sanitize`, `truncate`,
`neutralize`, `order` (the three steps in their order) and `tool-call` (tag-like forms an
agent runtime may read as a tool call).

The file holds ASCII bytes only: every other code point is written as a `\uXXXX` escape,
with a surrogate pair above U+FFFF. An implementation replays each vector with its own
`prepare` and compares the four expected members. It does so in its own repository,
against this authority at a revision pinned by full SHA, and proves its parity there.
The reference oracle is exported by no package: it is the checker of the vectors, not a
production library.
