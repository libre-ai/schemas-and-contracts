# Unicode Character Database 17.0.0 (excerpt of two files)

Two files of the Unicode Character Database, vendored byte for byte. They are the
fixed oracle against which `tools/quality/served-text-preparation.test.ts` checks the
removed-range table of the served-text preparation vectors
(`contracts/fixtures/served-text-preparation-candidate/vectors.v1.json`).

| File | Source | SHA-256 |
| --- | --- | --- |
| `DerivedCoreProperties.txt` | <https://www.unicode.org/Public/17.0.0/ucd/DerivedCoreProperties.txt> | `24c7fed1195c482faaefd5c1e7eb821c5ee1fb6de07ecdbaa64b56a99da22c08` |
| `DerivedGeneralCategory.txt` | <https://www.unicode.org/Public/17.0.0/ucd/extracted/DerivedGeneralCategory.txt> | `d62e5bab70ca74f099343f71224fa051cb1fdd61a1ab45c0488c44cfc0b6102e` |

The files are distributed under the Unicode License v3 (`LICENSES/Unicode-3.0.txt`).

## Why vendored

The runtime's own Unicode tables follow its ICU build, not the Bun pin: the revision
pinned by `toolchains/bun.json` reports Unicode 17.0 (ICU 78.1) on darwin-arm64 and
Unicode 15.1 (ICU 75.1) on linux-x64 (measured 2026-11-17). A test whose expected
classes come from the runtime is therefore true on one platform and false on the other.
These files fix the expectation outside the runtime.

## Update rule

Replace both files together with the release named by the vectors' `unicodeVersion`,
from `https://www.unicode.org/Public/<version>/ucd/`, rename this directory, and update
the digests in this file and in the test. The test checks the digest and the first
line (`# <File>-<version>.txt`) of each file before parsing it.
