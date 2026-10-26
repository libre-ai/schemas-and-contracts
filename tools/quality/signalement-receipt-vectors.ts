// Test-material generator of the projection receipt signature corpus, never a signer for a
// deployment. Every key comes from a public label and every forgery from the formulas below, so
// the corpus is reproducible octet for octet: `--write` writes it, `--check` refuses any drift.
//
// The expected verdicts are written from the normative table of SEMANTICS "Signature
// verification", never by running the verifier: the corpus is the specification of the verifier,
// not a record of its output.
import { createHash } from "node:crypto";
import { readdir, writeFile } from "node:fs/promises";
import { ed25519 } from "@noble/curves/ed25519.js";
import { canonicalJson } from "./authorized-execution";
import {
  RECEIPT_SIGNATURE_DOMAIN,
  receiptSigningMessage,
} from "./signalement-projection-receipt-v1";
import { SIGNALEMENT_V1_FIXTURE_CODE_POINT_BUDGET } from "./signalement-v1-fixture-inventory";

type JsonObject = Record<string, unknown>;

export const SIGNATURE_CORPUS_ENTRY = "signature-vectors.v1.json";
const SIGNATURE_CORPUS_STEM = "signature-vectors.v1";
export const SIGNATURE_CORPUS_DIRECTORY = `${import.meta.dir}/../../contracts/fixtures/signalement-projection-receipt-v1`;
const POINTS_FILE = `${import.meta.dir}/../../contracts/fixtures/build-brief-v2/strict-ed25519-vectors.json`;

const SCHEMA_VERSION = "libre-ai.signalement-projection-receipt-signature-vectors.v1";
/** Domain of another family signed the same way (build-brief-v2 SEMANTICS, acceptance statement). */
const OTHER_FAMILY_DOMAIN = "libre-ai.build-brief-acceptance-statement.v2";
const TEST_MATERIAL_WARNING = "Synthetic keys derived from public labels. Never use outside tests.";

export interface GeneratedFile {
  name: string;
  text: string;
}

export interface CorpusCheck {
  files: number;
  vectors: number;
  signCases: number;
  failures: string[];
}

type Verdict = {
  signature: "valid" | "invalid" | "unknown-key" | "unreadable";
  keyId: string | null;
  keyStatus: "active" | "retired" | null;
  reason: string | null;
};

interface SignatureVector {
  id: string;
  description: string;
  keySet: JsonObject;
  signed: string;
  expected: Verdict | { refused: string };
}

interface SignCase {
  id: string;
  seed: string;
  unsigned: JsonObject;
  signed: string;
}

interface Corpus {
  vectors: SignatureVector[];
  signCases: SignCase[];
}

const Point = ed25519.Point;
const Fn = ed25519.Point.Fn;

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function littleEndian(bytes: Uint8Array): bigint {
  return BigInt(`0x${Buffer.from(bytes).reverse().toString("hex")}`);
}

/** 32 octets little-endian; S + L stays below 2^253, so every scalar written here fits. */
function littleEndian32(value: bigint): Uint8Array {
  return new Uint8Array(Buffer.from(value.toString(16).padStart(64, "0"), "hex").reverse());
}

function concat(...parts: Uint8Array[]): Uint8Array {
  return new Uint8Array(Buffer.concat(parts));
}

/** Test seed n = SHA-256(UTF-8 `libre-ai.signalement-receipt-test-key.<n>`), as SEMANTICS states. */
function testSeed(n: number): Uint8Array {
  return new Uint8Array(
    createHash("sha256").update(`libre-ai.signalement-receipt-test-key.${n}`).digest(),
  );
}

/** Nonce of a forgery: SHA-512 of a public label, reduced modulo L; never zero. */
function forgeryNonce(id: string): bigint {
  const digest = createHash("sha512").update(`libre-ai.signalement-receipt-test-nonce.${id}`);
  const nonce = Fn.create(littleEndian(new Uint8Array(digest.digest())));
  if (nonce === 0n) throw new Error(`zero nonce for ${id}`);
  return nonce;
}

/** k = SHA-512(R || A || M) modulo L, RFC 8032 section 5.1.7, over the exact encodings. */
function challenge(r: Uint8Array, publicKey: Uint8Array, message: Uint8Array): bigint {
  const digest = createHash("sha512")
    .update(concat(r, publicKey, message))
    .digest();
  return Fn.create(littleEndian(new Uint8Array(digest)));
}

function replaceOnce(text: string, from: string, to: string): string {
  const index = text.indexOf(from);
  if (index < 0 || text.indexOf(from, index + 1) >= 0)
    throw new Error(`expected exactly one ${JSON.stringify(from)}`);
  return `${text.slice(0, index)}${to}${text.slice(index + from.length)}`;
}

function changeFirstHexDigit(digest: string): string {
  return `${digest.startsWith("0") ? "1" : "0"}${digest.slice(1)}`;
}

function withSignature(unsigned: JsonObject, signature: Uint8Array): JsonObject {
  return { ...unsigned, signature: { algorithm: "ed25519", value: base64url(signature) } };
}

function signReceipt(unsigned: JsonObject, seed: Uint8Array): JsonObject {
  return withSignature(unsigned, ed25519.sign(receiptSigningMessage(unsigned), seed));
}

function octetsOf(text: string): string {
  return Buffer.from(text, "utf8").toString("base64url");
}

function verdict(
  signature: Verdict["signature"],
  keyId: string | null,
  keyStatus: Verdict["keyStatus"],
  reason: string | null,
): Verdict {
  return { signature, keyId, keyStatus, reason };
}

async function buildCorpus(): Promise<Corpus> {
  const schemaFixtures = (await Bun.file(
    `${SIGNATURE_CORPUS_DIRECTORY}/schema-fixtures.json`,
  ).json()) as { cases: { valid: JsonObject }[] };
  const fixtureReceipt = schemaFixtures.cases[0]?.valid;
  if (fixtureReceipt === undefined) throw new Error("schema-fixtures.json has no case");
  const points = (
    (await Bun.file(POINTS_FILE).json()) as { points: { id: string; point: string }[] }
  ).points;
  const pointBytes = (id: string): Uint8Array => {
    const found = points.find((point) => point.id === id);
    if (found === undefined) throw new Error(`no point ${id} in strict-ed25519-vectors.json`);
    return new Uint8Array(Buffer.from(found.point, "base64url"));
  };

  const seed1 = testSeed(1);
  const seed2 = testSeed(2);
  const seed3 = testSeed(3);
  const key1 = ed25519.utils.getExtendedPublicKey(seed1);
  const key2 = ed25519.utils.getExtendedPublicKey(seed2);

  // The structural fixture receipt, unsigned, with the remote under the synthetic tracker.
  const { signature: _placeholder, ...fixtureUnsigned } = structuredClone(fixtureReceipt);
  const active: JsonObject = {
    ...fixtureUnsigned,
    keyId: "test-key-1",
    remote: {
      ...(fixtureUnsigned.remote as JsonObject),
      url: "https://tracker.example.com/example-project/issues/42",
    },
  };
  const retired: JsonObject = {
    ...active,
    keyId: "test-key-2",
    issuedAt: "2026-08-15T10:00:05Z",
    deliveredAt: "2026-08-15T10:00:03Z",
  };
  // Issued exactly at the retired key's notAfter: the window is half-open.
  const outsideValidity: JsonObject = {
    ...active,
    keyId: "test-key-2",
    issuedAt: "2026-09-01T00:00:00Z",
    deliveredAt: "2026-08-31T23:59:58Z",
  };
  const unknownKey: JsonObject = { ...active, keyId: "test-key-3" };

  const keySet: JsonObject = {
    organization: "example-org",
    keys: [
      {
        keyId: "test-key-1",
        algorithm: "ed25519",
        publicKey: base64url(key1.pointBytes),
        status: "active",
        notBefore: "2026-09-01T00:00:00Z",
        notAfter: null,
      },
      {
        keyId: "test-key-2",
        algorithm: "ed25519",
        publicKey: base64url(key2.pointBytes),
        status: "retired",
        notBefore: "2026-01-01T00:00:00Z",
        notAfter: "2026-09-01T00:00:00Z",
      },
    ],
  };
  const keysWithFirstPublicKey = (publicKey: Uint8Array): JsonObject => {
    const copy = structuredClone(keySet) as { keys: JsonObject[] } & JsonObject;
    (copy.keys[0] as JsonObject).publicKey = base64url(publicKey);
    return copy;
  };

  const message = receiptSigningMessage(active);
  const signedActive = signReceipt(active, seed1);
  const signedActiveText = canonicalJson(signedActive);
  const signedRetired = signReceipt(retired, seed2);
  const vectors: SignatureVector[] = [];
  const add = (
    id: string,
    description: string,
    signedText: string,
    expected: SignatureVector["expected"],
    keys: JsonObject = keySet,
  ) => vectors.push({ id, description, keySet: keys, signed: octetsOf(signedText), expected });

  add(
    "valid-active",
    "Signed by the active test key 1 inside its window.",
    signedActiveText,
    verdict("valid", "test-key-1", "active", null),
  );
  add(
    "valid-retired",
    "Signed by the retired test key 2, issued inside its window.",
    canonicalJson(signedRetired),
    verdict("valid", "test-key-2", "retired", null),
  );
  add(
    "key-unknown",
    "Signed by test key 3, absent from the key set.",
    canonicalJson(signReceipt(unknownKey, seed3)),
    verdict("unknown-key", "test-key-3", null, "key.unknown"),
  );
  add(
    "key-outside-validity",
    "Signed by test key 2, issued exactly at its notAfter (excluded).",
    canonicalJson(signReceipt(outsideValidity, seed2)),
    verdict("invalid", "test-key-2", "retired", "key.outside_validity"),
  );

  // Point family: A is the identity, R the identity, S = 0 (accepted by a cofactored verifier).
  const identity = pointBytes("torsion-0");
  add(
    "key-identity",
    "Public key A and R are the identity point, S = 0.",
    canonicalJson(withSignature(active, concat(identity, littleEndian32(0n)))),
    verdict("invalid", "test-key-1", "active", "key.not_admissible"),
    keysWithFirstPublicKey(identity),
  );
  // A' = A + T_i: mixed order. R = rB, k = H(R || A' || M), S = r + k a.
  for (let index = 1; index <= 7; index += 1) {
    const id = `key-mixed-order-${index}`;
    const torsion = Point.fromBytes(pointBytes(`torsion-${index}`), false);
    const mixed = key1.point.add(torsion).toBytes();
    const nonce = forgeryNonce(id);
    const r = Point.BASE.multiply(nonce).toBytes();
    const s = Fn.create(nonce + challenge(r, mixed, message) * key1.scalar);
    add(
      id,
      `Public key A + torsion-${index} (mixed order), S = r + k a over that key.`,
      canonicalJson(withSignature(active, concat(r, littleEndian32(s)))),
      verdict("invalid", "test-key-1", "active", "key.not_admissible"),
      keysWithFirstPublicKey(mixed),
    );
  }
  // A written with y = p + 1: the identity, in an encoding that is not canonical (y >= p).
  // R is the identity and S = 0, so a verifier that decodes y modulo p and admits a small-order
  // A accepts it.
  add(
    "key-non-canonical-identity",
    "Public key A is the identity written with y = p + 1 (not canonical), R the identity, S = 0.",
    canonicalJson(withSignature(active, concat(identity, littleEndian32(0n)))),
    verdict("invalid", "test-key-1", "active", "key.not_admissible"),
    keysWithFirstPublicKey(pointBytes("noncanonical-identity")),
  );
  // R = T_i: small order. S = k a, so R + kA - SB = T_i, cleared by the cofactor.
  for (let index = 0; index <= 7; index += 1) {
    const id = index === 0 ? "r-identity" : `r-torsion-${index}`;
    const r = pointBytes(`torsion-${index}`);
    const s = Fn.create(challenge(r, key1.pointBytes, message) * key1.scalar);
    add(
      id,
      index === 0
        ? "R is the identity point, S = k a."
        : `R is torsion-${index} (small order), S = k a.`,
      canonicalJson(withSignature(active, concat(r, littleEndian32(s)))),
      verdict("invalid", "test-key-1", "active", "signature.r_not_admissible"),
    );
  }
  // R' = rB + T_i: mixed order, so neither small-order nor in the prime-order subgroup.
  // k' = H(R' || A || M), S = r + k' a: R' + k'A - SB = T_i, cleared by the cofactor. A verifier
  // that refuses only a small-order R accepts a second encoding of a signature.
  for (let index = 1; index <= 7; index += 1) {
    const id = `r-mixed-order-${index}`;
    const torsion = Point.fromBytes(pointBytes(`torsion-${index}`), false);
    const nonce = forgeryNonce(id);
    const r = Point.BASE.multiply(nonce).add(torsion).toBytes();
    const s = Fn.create(nonce + challenge(r, key1.pointBytes, message) * key1.scalar);
    add(
      id,
      `R is rB + torsion-${index} (mixed order), S = r + k a over that R.`,
      canonicalJson(withSignature(active, concat(r, littleEndian32(s)))),
      verdict("invalid", "test-key-1", "active", "signature.r_not_admissible"),
    );
  }
  // R written with y = p + 1: the identity, not canonical. S = k a, as for r-identity.
  {
    const r = pointBytes("noncanonical-identity");
    const s = Fn.create(challenge(r, key1.pointBytes, message) * key1.scalar);
    add(
      "r-non-canonical-identity",
      "R is the identity written with y = p + 1 (not canonical), S = k a.",
      canonicalJson(withSignature(active, concat(r, littleEndian32(s)))),
      verdict("invalid", "test-key-1", "active", "signature.r_not_admissible"),
    );
  }

  // Scalar family: the valid signature with S + L, which reduces to the same S.
  const activeSignature = new Uint8Array(
    Buffer.from((signedActive.signature as { value: string }).value, "base64url"),
  );
  const unreduced = littleEndian(activeSignature.subarray(32)) + Fn.ORDER;
  add(
    "s-non-canonical",
    "The valid signature of valid-active with S + L.",
    canonicalJson(
      withSignature(active, concat(activeSignature.subarray(0, 32), littleEndian32(unreduced))),
    ),
    verdict("invalid", "test-key-1", "active", "signature.s_non_canonical"),
  );

  // Content changed after signing: the document stays canonical and schema-valid.
  const changed = (patch: (draft: JsonObject) => void): string => {
    const draft = structuredClone(signedActive);
    patch(draft);
    return canonicalJson(draft);
  };
  add(
    "body-byte-modified",
    "One character of remote.url changed after signing.",
    changed((draft) => {
      const remote = draft.remote as { url: string };
      remote.url = replaceOnce(remote.url, "/42", "/43");
    }),
    verdict("invalid", "test-key-1", "active", "signature.mismatch"),
  );
  add(
    "transmitted-digest-modified",
    "transmitted[0].sha256 changed after signing.",
    changed((draft) => {
      const first = (draft.transmitted as { sha256: string }[])[0];
      if (first === undefined) throw new Error("no transmitted file");
      first.sha256 = changeFirstHexDigit(first.sha256);
    }),
    verdict("invalid", "test-key-1", "active", "signature.mismatch"),
  );
  add(
    "rendered-digest-modified",
    "rendered.bodyDigest changed after signing.",
    changed((draft) => {
      const rendered = draft.rendered as { bodyDigest: string };
      rendered.bodyDigest = changeFirstHexDigit(rendered.bodyDigest);
    }),
    verdict("invalid", "test-key-1", "active", "signature.mismatch"),
  );
  add(
    "revision-modified",
    "revision incremented after signing.",
    changed((draft) => {
      draft.revision = (draft.revision as number) + 1;
    }),
    verdict("invalid", "test-key-1", "active", "signature.mismatch"),
  );
  const prettyDigest = createHash("sha256")
    .update(JSON.stringify(active, null, 2))
    .digest();
  const prettyMessage = concat(
    new TextEncoder().encode(RECEIPT_SIGNATURE_DOMAIN),
    Uint8Array.of(0),
    new Uint8Array(prettyDigest),
  );
  add(
    "signed-over-non-jcs",
    "Signed over the domain, 0x00 and SHA-256 of JSON.stringify(unsigned, null, 2), not of JCS.",
    canonicalJson(withSignature(active, ed25519.sign(prettyMessage, seed1))),
    verdict("invalid", "test-key-1", "active", "signature.mismatch"),
  );
  // Domain separation: the same SHA-256(JCS(unsigned)), signed under the domain of the build
  // brief v2 acceptance statement, which builds its message the same way.
  const otherDomainMessage = concat(
    new TextEncoder().encode(OTHER_FAMILY_DOMAIN),
    Uint8Array.of(0),
    new Uint8Array(createHash("sha256").update(canonicalJson(active)).digest()),
  );
  add(
    "wrong-domain",
    `Signed by test key 1 over ${OTHER_FAMILY_DOMAIN}, 0x00 and SHA-256 of the JCS unsigned receipt.`,
    canonicalJson(withSignature(active, ed25519.sign(otherDomainMessage, seed1))),
    verdict("invalid", "test-key-1", "active", "signature.mismatch"),
  );

  // Signed documents that are not the JCS octets, or not strict JSON: unreadable.
  add(
    "document-whitespace",
    "valid-active with one space after its first comma.",
    replaceOnce(signedActiveText, ',"deliveredAt"', ', "deliveredAt"'),
    verdict("unreadable", null, null, "receipt.non_canonical"),
  );
  add(
    "document-key-order",
    "valid-active with its top-level members in reverse order.",
    JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(signedActiveText)).reverse())),
    verdict("unreadable", null, null, "receipt.non_canonical"),
  );
  add(
    "document-duplicate-member",
    "valid-active with its signature member repeated at the end.",
    `${signedActiveText.slice(0, -1)},"signature":${canonicalJson(signedActive.signature)}}`,
    verdict("unreadable", null, null, "receipt.raw_json"),
  );
  // A fractional number skips the canonical comparison: the schema refuses it (Task 5 rule).
  add(
    "document-fractional-revision-whitespace",
    "valid-active with revision 1.5 written after a space: schema, not non-canonical.",
    replaceOnce(signedActiveText, '"revision":1,', '"revision": 1.5,'),
    verdict("unreadable", null, null, "receipt.schema"),
  );
  // 86 characters carry 516 bits for 512: the last character's 4 low bits are unused.
  const value = (signedActive.signature as { value: string }).value;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const last = alphabet.indexOf(value.slice(-1));
  const aliased = `${value.slice(0, -1)}${alphabet[last + 1]}`;
  if (!Buffer.from(aliased, "base64url").equals(Buffer.from(value, "base64url")))
    throw new Error("signature-encoding alias does not decode to the same octets");
  add(
    "signature-encoding",
    "signature.value with a last character that decodes to the same 64 octets.",
    canonicalJson({ ...signedActive, signature: { algorithm: "ed25519", value: aliased } }),
    verdict("unreadable", null, null, "signature.encoding"),
  );

  // Key set refused or for another organization.
  const duplicate = structuredClone(keySet) as { keys: JsonObject[] } & JsonObject;
  (duplicate.keys[1] as JsonObject).keyId = "test-key-1";
  add(
    "keyset-duplicate-key-id",
    "valid-active against a key set whose two keys share keyId test-key-1.",
    signedActiveText,
    { refused: "keys.duplicate_key_id" },
    duplicate,
  );
  add(
    "keyset-other-organization",
    "valid-active against the same keys published for another organization.",
    signedActiveText,
    verdict("invalid", "test-key-1", null, "key.organization_mismatch"),
    { ...keySet, organization: "other-org" },
  );

  const signCases: SignCase[] = [
    {
      id: "valid-active",
      seed: base64url(seed1),
      unsigned: active,
      signed: octetsOf(signedActiveText),
    },
    {
      id: "valid-retired",
      seed: base64url(seed2),
      unsigned: retired,
      signed: octetsOf(canonicalJson(signedRetired)),
    },
  ];
  return { vectors, signCases };
}

/** `formatter.lineWidth` of biome.json: `biome ci .` formats this corpus like any other file. */
const LINE_WIDTH = 100;

function isScalar(value: unknown): boolean {
  return value === null || typeof value !== "object";
}

/**
 * `JSON.stringify(value, null, 2)` except for one rule of the repository formatter: an array of
 * scalars is written on one line when that line fits in LINE_WIDTH columns, trailing comma
 * included. Without it, `biome ci` would rewrite the entry's `parts` and `--check` would then
 * refuse the file, so the two gates could never both be green.
 */
function renderJson(value: unknown, indent: string, column: number, trailing: number): string {
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.every(isScalar)) {
      const inline = `[${value.map((element) => JSON.stringify(element)).join(", ")}]`;
      if (column + inline.length + trailing <= LINE_WIDTH) return inline;
    }
    const elements = value.map(
      (element, index) =>
        `${inner}${renderJson(element, inner, inner.length, index < value.length - 1 ? 1 : 0)}`,
    );
    return `[\n${elements.join(",\n")}\n${indent}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    const members = entries.map(([key, member], index) => {
      const prefix = `${inner}${JSON.stringify(key)}: `;
      return `${prefix}${renderJson(member, inner, prefix.length, index < entries.length - 1 ? 1 : 0)}`;
    });
    return `{\n${members.join(",\n")}\n${indent}}`;
  }
  return JSON.stringify(value);
}

function render(document: JsonObject): string {
  return `${renderJson(document, "", 0, 0)}\n`;
}

function codePoints(text: string): number {
  let count = 0;
  for (const _codePoint of text) count += 1;
  return count;
}

function partName(index: number): string {
  return `${SIGNATURE_CORPUS_STEM}.part-${index + 2}.json`;
}

/**
 * Packs the vectors in order: the entry first (header, sign cases, then vectors), then
 * continuation files, each filled while it stays within the fixture budget. The entry declares
 * as many parts as the packing uses; the loop finds that fixed point.
 */
function pack(corpus: Corpus, budget: number): GeneratedFile[] {
  for (let declared = 0; declared <= corpus.vectors.length; declared += 1) {
    const parts = Array.from({ length: declared }, (_, index) => partName(index));
    const entry: JsonObject = {
      schemaVersion: SCHEMA_VERSION,
      testMaterialWarning: TEST_MATERIAL_WARNING,
      domain: RECEIPT_SIGNATURE_DOMAIN,
      ...(declared > 0 ? { parts } : {}),
      vectors: [] as SignatureVector[],
      signCases: corpus.signCases,
    };
    const documents: { vectors: SignatureVector[]; document: JsonObject }[] = [
      { vectors: entry.vectors as SignatureVector[], document: entry },
    ];
    for (const vector of corpus.vectors) {
      let current = documents.at(-1) as { vectors: SignatureVector[]; document: JsonObject };
      current.vectors.push(vector);
      if (codePoints(render(current.document)) <= budget) continue;
      current.vectors.pop();
      const vectors = [vector];
      current = { vectors, document: { schemaVersion: SCHEMA_VERSION, vectors } };
      if (codePoints(render(current.document)) > budget)
        throw new Error(`vector ${vector.id} alone exceeds the fixture budget`);
      documents.push(current);
    }
    if (documents.length - 1 !== declared) continue;
    return documents.map(({ document }, index) => ({
      name: index === 0 ? SIGNATURE_CORPUS_ENTRY : partName(index - 1),
      text: render(document),
    }));
  }
  throw new Error("no packing of the signature corpus declares its own parts");
}

export async function generateReceiptVectors(): Promise<GeneratedFile[]> {
  return pack(await buildCorpus(), SIGNALEMENT_V1_FIXTURE_CODE_POINT_BUDGET);
}

export async function checkReceiptVectors(
  directory: string = SIGNATURE_CORPUS_DIRECTORY,
): Promise<CorpusCheck> {
  const corpus = await buildCorpus();
  const generated = pack(corpus, SIGNALEMENT_V1_FIXTURE_CODE_POINT_BUDGET);
  const failures: string[] = [];
  for (const file of generated) {
    let written: string;
    try {
      written = await Bun.file(`${directory}/${file.name}`).text();
    } catch {
      failures.push(`${file.name}: absent or unreadable`);
      continue;
    }
    if (written !== file.text) failures.push(`${file.name}: differs from the generator output`);
  }
  const names = new Set(generated.map((file) => file.name));
  for (const name of (await readdir(directory)).sort()) {
    if (name.startsWith(SIGNATURE_CORPUS_STEM) && name.endsWith(".json") && !names.has(name))
      failures.push(`${name}: not produced by the generator`);
  }
  return {
    files: generated.length,
    vectors: corpus.vectors.length,
    signCases: corpus.signCases.length,
    failures,
  };
}

if (import.meta.main) {
  const mode = Bun.argv[2];
  if (mode === "--write") {
    const files = await generateReceiptVectors();
    for (const file of files)
      await writeFile(`${SIGNATURE_CORPUS_DIRECTORY}/${file.name}`, file.text);
    console.log(`Receipt signature corpus written: ${files.map((file) => file.name).join(", ")}`);
  } else if (mode === "--check") {
    const check = await checkReceiptVectors();
    if (check.failures.length > 0) {
      for (const failure of check.failures) console.error(failure);
      console.error("Receipt signature corpus differs from its generator; run --write");
      process.exitCode = 1;
    } else {
      console.log(
        `Receipt signature corpus verified: ${check.files} file(s), ${check.vectors} vectors, ` +
          `${check.signCases} sign cases, identical to the generator output`,
      );
    }
  } else {
    console.error("Usage: signalement-receipt-vectors.ts --write | --check");
    process.exitCode = 2;
  }
}
