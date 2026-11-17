// Test-material generator of the artifact-manifest-signatures-v1 corpus, never a signer for a
// deployment. Every key comes from a public label and every forgery from the formulas below, so
// the corpus is reproducible octet for octet: `--write` writes it, `--check` refuses any drift.
//
// The expected outcomes are written from the K and S rules of
// contracts/artifact-manifest-signatures-v1/SEMANTICS.md, never by running the fixture
// verifier: the corpus specifies the verifier, it does not record its output. The signed
// message is built here with the repository's `canonicalJson`; the verifier has its own
// RFC 8785 serializer, so the published messages compare two implementations.
//
// Every input a verifier receives is published as octets: `manifestOctets` for each manifest
// name, and `registryOctets` / `recordOctets` on the vectors whose defect lives in the octets
// (K0, S0). A vector without them is presented as the UTF-8 of `JSON.stringify` of its value.
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { ed25519 } from "@noble/curves/ed25519.js";
import { canonicalJson } from "./authorized-execution";

type JsonObject = Record<string, unknown>;
type ArtifactType = "build" | "dataset" | "export" | "release" | "evidence";
type ManifestName =
  | "release"
  | "dataset"
  | "release-unicode"
  | "release-path-traversal"
  | "release-file-digest-changed";
type HostileManifestName =
  | "release-duplicate-member"
  | "release-escaped-lone-surrogate"
  | "release-bom"
  | "release-invalid-utf8";

export const VECTORS_PATH = `${import.meta.dir}/../../contracts/fixtures/artifact-manifest-signatures-v1/vectors.json`;
const SCHEMA_FIXTURES_PATH = `${import.meta.dir}/../../contracts/fixtures/schema-fixtures.v1.json`;
const POINTS_PATH = `${import.meta.dir}/../../contracts/fixtures/build-brief-v2/strict-ed25519-vectors.json`;

const VECTORS_SCHEMA_VERSION = "libre-ai.artifact-manifest-signatures-vectors.v1";
const DOMAIN = "libre-ai.artifact-manifest.v1";
const BUILD_BRIEF_DOMAIN = "libre-ai.build-brief-acceptance-statement.v2";
const NEXT_MAJOR_DOMAIN = "libre-ai.artifact-manifest.v2";
const RECORD_SCHEMA_VERSION = "libre-ai.artifact-manifest-signatures.v1";
const REGISTRY_SCHEMA_VERSION = "libre-ai.signing-keys.v1";
const TEST_MATERIAL_WARNING =
  "Synthetic keys derived from public labels; their seeds are published. Never trust outside tests.";
const SIGNING_KEY_ID_PREFIX = "ed25519-";
const SEED_LABEL = "libre-ai.artifact-manifest-signatures-test-key.";
const NONCE_LABEL = "libre-ai.artifact-manifest-signatures-test-nonce.";
const SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const X25519_SPKI_PREFIX = Buffer.from("302a300506032b656e032100", "hex");

const NOW = "2026-10-15T12:00:00.000Z";
const KEY_2_ACTIVATED_AT = "2026-10-01T00:00:00.000Z";
const KEY_3_REVOKED_AT = "2026-09-01T00:00:00.000Z";

const Point = ed25519.Point;
const Fn = ed25519.Point.Fn;

type RegistryExpected =
  | { outcome: "admitted" }
  | { outcome: "refused"; refusal: "key-set-invalid" };
type SignatureExpected =
  | { outcome: "accepted"; verifiedKeyIds: string[]; ignoredUnknownKeyIds: number }
  | { outcome: "refused"; refusal: string };

interface RegistryVector {
  id: string;
  rule: string | null;
  description: string;
  registry: JsonObject | null;
  registryOctets?: string;
  expected: RegistryExpected;
}

interface SignatureVector {
  id: string;
  rule: string | null;
  description: string;
  manifest: string;
  registry: string;
  now: string;
  record: JsonObject | null;
  recordOctets?: string;
  expected: SignatureExpected;
}

export interface VectorCounts {
  registryValid: number;
  registryInvalid: number;
  signatureValid: number;
  signatureInvalid: number;
}

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function sha256(bytes: Uint8Array | string): Buffer {
  return createHash("sha256").update(bytes).digest();
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

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** K3 identifier, written out here rather than imported from the verifier. */
function keyIdOf(raw: Uint8Array): string {
  return `${SIGNING_KEY_ID_PREFIX}${sha256(raw).toString("hex")}`;
}

/** Replace the one occurrence of `needle` in `text`; a miss is a generator defect. */
function replaceOnce(text: string, needle: string, replacement: string): string {
  const at = text.indexOf(needle);
  if (at < 0 || text.indexOf(needle, at + 1) >= 0)
    throw new Error(`expected exactly one ${needle} in the text`);
  return `${text.slice(0, at)}${replacement}${text.slice(at + needle.length)}`;
}

/** Test seed n = SHA-256(UTF-8 label || n), as SEMANTICS "Vectors" states. */
function testSeed(n: number): Uint8Array {
  return new Uint8Array(sha256(`${SEED_LABEL}${n}`));
}

/** Nonce of a forgery: SHA-512 of a public label, reduced modulo L; never zero. */
function forgeryNonce(id: string): bigint {
  const digest = createHash("sha512").update(`${NONCE_LABEL}${id}`).digest();
  const nonce = Fn.create(littleEndian(new Uint8Array(digest)));
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

function pem(prefix: Buffer, raw: Uint8Array): string {
  const body = Buffer.concat([prefix, raw]).toString("base64");
  return `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----`;
}

/** The message of SEMANTICS S4, written out here rather than imported. */
function messageFor(domain: string, manifest: JsonObject): Uint8Array {
  return concat(
    new TextEncoder().encode(domain),
    Uint8Array.of(0),
    new Uint8Array(sha256(canonicalJson(manifest))),
  );
}

interface TestKey {
  n: number;
  seed: Uint8Array;
  raw: Uint8Array;
  scalar: bigint;
  point: InstanceType<typeof Point>;
  id: string;
}

function testKey(n: number): TestKey {
  const seed = testSeed(n);
  const extended = ed25519.utils.getExtendedPublicKey(seed);
  return {
    n,
    seed,
    raw: extended.pointBytes,
    scalar: extended.scalar,
    point: extended.point,
    id: keyIdOf(extended.pointBytes),
  };
}

function keyEntry(
  key: { raw: Uint8Array; id: string },
  artifactTypes: ArtifactType[],
  activatedAt: string,
  revokedAt: string | null,
  publicKey: string = pem(SPKI_PREFIX, key.raw),
): JsonObject {
  const entry: JsonObject = {
    signingKeyId: key.id,
    algorithm: "Ed25519",
    publicKey,
    purpose: "Test key: artifact manifest signatures",
    artifactTypes,
    activatedAt,
    revokedAt,
    witness: {
      signatory: "key-custodian",
      attestedAt: activatedAt,
      comment: "Synthetic test key; its seed is published.",
    },
  };
  // revokedAt is reserved for compromise (SEMANTICS "Key lifecycle"): a rotation removes the
  // entry instead.
  if (revokedAt !== null) {
    entry.revocationReason = "Key compromise (test)";
    entry.revocationWitness = { signatory: "key-custodian", discoveredAt: revokedAt };
  }
  return entry;
}

function registry(keys: JsonObject[]): JsonObject {
  return { schemaVersion: REGISTRY_SCHEMA_VERSION, keys };
}

function record(signatures: { signingKeyId: string; signature: string }[]): JsonObject {
  return { schemaVersion: RECORD_SCHEMA_VERSION, signatures };
}

function sign(key: TestKey, message: Uint8Array) {
  return { signingKeyId: key.id, signature: base64url(ed25519.sign(message, key.seed)) };
}

function without(entry: JsonObject, member: string): JsonObject {
  const copy = structuredClone(entry);
  delete copy[member];
  return copy;
}

function withEntry(base: JsonObject, patch: (entry: JsonObject) => void): JsonObject {
  const copy = structuredClone(base) as { keys: JsonObject[] } & JsonObject;
  const first = copy.keys[0];
  if (first === undefined) throw new Error("registry has no key");
  patch(first);
  return copy;
}

async function buildCorpus(): Promise<JsonObject> {
  const fixtures = (await Bun.file(SCHEMA_FIXTURES_PATH).json()) as {
    cases: { schema: string; valid: JsonObject }[];
  };
  const fixtureManifest = fixtures.cases.find(
    (fixture) => fixture.schema === "artifact-manifest.v1.schema.json",
  )?.valid;
  if (fixtureManifest === undefined) throw new Error("no artifact-manifest.v1 schema fixture");
  const points = (
    (await Bun.file(POINTS_PATH).json()) as { points: { id: string; point: string }[] }
  ).points;
  const pointBytes = (id: string): Uint8Array => {
    const found = points.find((point) => point.id === id);
    if (found === undefined) throw new Error(`no point ${id} in strict-ed25519-vectors.json`);
    return new Uint8Array(Buffer.from(found.point, "base64url"));
  };

  const keys = Array.from({ length: 65 }, (_, index) => testKey(index + 1));
  const key = (n: number): TestKey => {
    const found = keys[n - 1];
    if (found === undefined) throw new Error(`no test key ${n}`);
    return found;
  };
  const [k1, k2, k3, k4, k5, k6] = [key(1), key(2), key(3), key(4), key(5), key(6)];

  const release: JsonObject = structuredClone(fixtureManifest);
  const dataset: JsonObject = {
    ...structuredClone(fixtureManifest),
    id: "urn:libre-ai:artifact:dataset-1",
    artifactType: "dataset",
  };
  const releaseMessage = messageFor(DOMAIN, release);
  const datasetMessage = messageFor(DOMAIN, dataset);
  const releaseFiles = structuredClone(release.files) as {
    path: string;
    digest: string;
    mediaType: string;
  }[];
  const firstFile = releaseFiles[0];
  if (firstFile === undefined) throw new Error("manifest has no file");
  // Every string escape class of RFC 8785 3.2.2.2 in one path: a non-ASCII letter written raw,
  // a control written \u001f, a quotation mark written \", DEL written raw, and U+2028 written
  // raw (JSON.stringify and RFC 8785 agree on it; a JavaScript-source serializer would not).
  const unicode: JsonObject = {
    ...structuredClone(release),
    files: [{ ...firstFile, path: 'notes/\u{e9}\u001f"\u007f\u{2028}.txt' }],
  };
  const unicodeMessage = messageFor(DOMAIN, unicode);
  // Variants, each one change away from `release`.
  const manifests: Record<ManifestName, JsonObject> = {
    release,
    dataset,
    "release-unicode": unicode,
    "release-path-traversal": {
      ...structuredClone(release),
      files: [{ ...firstFile, path: "../secret" }],
    },
    "release-file-digest-changed": {
      ...structuredClone(release),
      files: [
        {
          ...firstFile,
          digest: `${firstFile.digest.startsWith("0") ? "1" : "0"}${firstFile.digest.slice(1)}`,
        },
      ],
    },
  };

  // S0: received manifest octets that are not strict I-JSON. Each one, parsed leniently, is a
  // document whose signatures would verify, so only the octet check refuses it.
  const releaseText = JSON.stringify(release, null, 2);
  // JSON.stringify writes a lone surrogate as the escape \ud800, so the text is ASCII and a
  // lenient parser rebuilds the same lone surrogate.
  const surrogateManifest: JsonObject = {
    ...structuredClone(release),
    files: [{ ...firstFile, mediaType: `${firstFile.mediaType}\u{d800}` }],
  };
  const surrogateMessage = messageFor(DOMAIN, surrogateManifest);
  const [beforeMediaType, afterMediaType] = replaceOnce(releaseText, '"text/html"', '"\t"').split(
    "\t",
  );
  const hostileManifestOctets: Record<HostileManifestName, Uint8Array> = {
    // A last-wins parser reads `release`, a first-wins parser reads `dataset`.
    "release-duplicate-member": utf8(`{"artifactType": "dataset",${releaseText.slice(1)}`),
    "release-escaped-lone-surrogate": utf8(JSON.stringify(surrogateManifest, null, 2)),
    "release-bom": concat(Uint8Array.of(0xef, 0xbb, 0xbf), utf8(releaseText)),
    // mediaType holds C3 28: a two-octet lead followed by an ASCII octet, not UTF-8.
    "release-invalid-utf8": concat(
      utf8(beforeMediaType ?? ""),
      Uint8Array.of(0xc3, 0x28),
      utf8(afterMediaType ?? ""),
    ),
  };
  const manifestOctets: Record<string, string> = {};
  for (const [name, manifest] of Object.entries(manifests))
    manifestOctets[name] = base64url(utf8(JSON.stringify(manifest, null, 2)));
  for (const [name, octets] of Object.entries(hostileManifestOctets))
    manifestOctets[name] = base64url(octets);

  const k1Entry = keyEntry(k1, ["build", "release"], "2026-01-01T00:00:00.000Z", null);
  const mainKeys = [
    k1Entry,
    keyEntry(k2, ["build", "release"], KEY_2_ACTIVATED_AT, null),
    keyEntry(k3, ["release"], "2026-01-01T00:00:00.000Z", KEY_3_REVOKED_AT),
    keyEntry(k4, ["release"], "2027-01-01T00:00:00.000Z", null),
    keyEntry(k5, ["dataset"], "2026-01-01T00:00:00.000Z", null),
  ];
  // Key 30 is outside the unknown-key range (6 to 21) of the signature vectors.
  const k30 = key(30);
  const registries: Record<string, JsonObject> = {
    main: registry(mainKeys),
    "main-reversed": registry([...mainKeys].reverse()),
    "main-with-key-authorizing-nothing": registry([
      ...mainKeys,
      keyEntry(k30, [], "2026-01-01T00:00:00.000Z", null),
    ]),
    // Rotation from key 1 to key 2 completed: key 1 retired by removal (SEMANTICS "Key lifecycle").
    "after-rotation": registry(mainKeys.slice(1)),
  };
  const single = registry([k1Entry]);
  const revokedEntry = mainKeys[2] as JsonObject;

  // Registry vectors: K rules.
  const registryVectors: RegistryVector[] = [];
  const admitted = (id: string, description: string, document: JsonObject) =>
    registryVectors.push({
      id,
      rule: null,
      description,
      registry: document,
      expected: { outcome: "admitted" },
    });
  const refused = (id: string, rule: string, description: string, document: JsonObject) =>
    registryVectors.push({
      id,
      rule,
      description,
      registry: document,
      expected: { outcome: "refused", refusal: "key-set-invalid" },
    });

  admitted("registry-main", "Keys 1 to 5 of the signature vectors.", registries.main as JsonObject);
  admitted(
    "registry-single-revoked",
    "One revoked key with its revocation reason and witness.",
    registry([mainKeys[2] as JsonObject]),
  );
  admitted(
    "registry-empty-artifact-types",
    "Key 1 authorizing no artifact type: admitted, signs no manifest (S7).",
    withEntry(single, (entry) => {
      entry.artifactTypes = [];
    }),
  );
  admitted(
    "registry-64-keys",
    "64 keys, the upper bound.",
    registry(
      keys.slice(0, 64).map((k) => keyEntry(k, ["release"], "2026-01-01T00:00:00.000Z", null)),
    ),
  );

  admitted(
    "registry-revoked-before-discovery",
    "Revoked key 3 whose revokedAt precedes discoveredAt: a compromise dated back (K6).",
    registry([
      {
        ...revokedEntry,
        revocationWitness: { signatory: "incident-responder", discoveredAt: NOW },
      },
    ]),
  );

  // K0: registry octets that are not strict I-JSON; each one, parsed leniently, is admissible.
  const octetsRefused = (id: string, description: string, octets: Uint8Array) =>
    registryVectors.push({
      id,
      rule: "K0",
      description,
      registry: null,
      registryOctets: base64url(octets),
      expected: { outcome: "refused", refusal: "key-set-invalid" },
    });
  {
    const singleText = JSON.stringify(single);
    octetsRefused(
      "registry-duplicate-member",
      "Key 1 entry naming signingKeyId twice, first the identifier of key 2, then its own.",
      utf8(
        replaceOnce(
          singleText,
          `"signingKeyId":"${k1.id}"`,
          `"signingKeyId":"${k2.id}","signingKeyId":"${k1.id}"`,
        ),
      ),
    );
    octetsRefused(
      "registry-escaped-lone-surrogate",
      "Key 1 purpose ending with the escape \\ud800, an unpaired surrogate (not I-JSON).",
      utf8(
        replaceOnce(
          singleText,
          '"purpose":"Test key: artifact manifest signatures"',
          '"purpose":"Test key\\ud800"',
        ),
      ),
    );
    octetsRefused(
      "registry-bom",
      "Single-key registry preceded by a UTF-8 byte order mark.",
      concat(Uint8Array.of(0xef, 0xbb, 0xbf), utf8(singleText)),
    );
  }

  refused("registry-no-keys", "K1", "Empty key list.", registry([]));
  refused(
    "registry-signatory-email",
    "K1",
    "witness.signatory is an e-mail address, not a role identifier (personal data, K7).",
    withEntry(single, (entry) => {
      entry.witness = { ...(entry.witness as JsonObject), signatory: "custodian@example.org" };
    }),
  );
  refused(
    "registry-identifier-bare-hex",
    "K1",
    "signingKeyId of key 1 without its ed25519- prefix (64 hex characters).",
    withEntry(single, (entry) => {
      entry.signingKeyId = k1.id.slice(SIGNING_KEY_ID_PREFIX.length);
    }),
  );
  refused(
    "registry-65-keys",
    "K1",
    "65 keys, one above the bound.",
    registry(keys.map((k) => keyEntry(k, ["release"], "2026-01-01T00:00:00.000Z", null))),
  );
  refused(
    "registry-unknown-key-member",
    "K1",
    "Key 1 with an extra member.",
    withEntry(single, (entry) => {
      entry.status = "active";
    }),
  );
  refused(
    "registry-algorithm-other",
    "K1",
    "algorithm Ed448.",
    withEntry(single, (entry) => {
      entry.algorithm = "Ed448";
    }),
  );
  refused(
    "registry-pem-x25519",
    "K1",
    "Key 1 octets under the X25519 SPKI prefix (OID 1.3.101.110), DER of 44 octets.",
    withEntry(single, (entry) => {
      entry.publicKey = pem(X25519_SPKI_PREFIX, k1.raw);
    }),
  );
  refused(
    "registry-pem-trailing-newline",
    "K1",
    "Key 1 PEM followed by a newline.",
    withEntry(single, (entry) => {
      entry.publicKey = `${String(entry.publicKey)}\n`;
    }),
  );
  {
    const canonical = pem(SPKI_PREFIX, k1.raw);
    const body = canonical.split("\n")[1] as string;
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const last = body.at(-2) as string;
    const aliasedBody = `${body.slice(0, -2)}${alphabet[alphabet.indexOf(last) + 1]}=`;
    if (!Buffer.from(aliasedBody, "base64").equals(Buffer.from(body, "base64")))
      throw new Error("PEM alias does not decode to the same octets");
    refused(
      "registry-pem-noncanonical-final-character",
      "K1",
      "Key 1 PEM whose last Base64 character has a non-zero unused bit (same octets).",
      withEntry(single, (entry) => {
        entry.publicKey = canonical.replace(body, aliasedBody);
      }),
    );
  }
  refused(
    "registry-instant-without-milliseconds",
    "K1",
    "activatedAt without its three fractional digits.",
    withEntry(single, (entry) => {
      entry.activatedAt = "2026-01-01T00:00:00Z";
    }),
  );
  refused(
    "registry-instant-offset",
    "K1",
    "activatedAt with +00:00 instead of Z.",
    withEntry(single, (entry) => {
      entry.activatedAt = "2026-01-01T00:00:00.000+00:00";
    }),
  );
  refused(
    "registry-instant-impossible-date",
    "K1",
    "activatedAt on February 30.",
    withEntry(single, (entry) => {
      entry.activatedAt = "2026-02-30T00:00:00.000Z";
    }),
  );
  refused(
    "registry-artifact-type-repeated",
    "K1",
    "artifactTypes lists release twice.",
    withEntry(single, (entry) => {
      entry.artifactTypes = ["release", "release"];
    }),
  );
  refused(
    "registry-artifact-type-unknown",
    "K1",
    "artifactTypes lists a value outside artifact-manifest.v1.",
    withEntry(single, (entry) => {
      entry.artifactTypes = ["image"];
    }),
  );
  refused(
    "registry-revocation-reason-on-key-in-force",
    "K1",
    "revocationReason on a key whose revokedAt is null.",
    withEntry(single, (entry) => {
      entry.revocationReason = "Scheduled rotation (test)";
    }),
  );
  refused(
    "registry-revocation-witness-on-key-in-force",
    "K1",
    "revocationWitness on a key whose revokedAt is null.",
    withEntry(single, (entry) => {
      entry.revocationWitness = {
        signatory: "key-custodian",
        discoveredAt: "2026-02-01T00:00:00.000Z",
      };
    }),
  );
  refused(
    "registry-revoked-at-omitted",
    "K1",
    "revokedAt omitted instead of null.",
    withEntry(single, (entry) => {
      delete entry.revokedAt;
    }),
  );
  refused(
    "registry-identifier-uppercase",
    "K1",
    "signingKeyId of key 1 in uppercase hex.",
    withEntry(single, (entry) => {
      entry.signingKeyId = k1.id.toUpperCase();
    }),
  );
  refused(
    "registry-witness-missing",
    "K1",
    "Key 1 without witness.",
    withEntry(single, (entry) => {
      delete entry.witness;
    }),
  );
  for (const pointId of [
    "torsion-0",
    "torsion-1",
    "mixed-order-1",
    "noncanonical-identity",
    "noncanonical-y-p",
    "negative-zero-identity",
    "invalid-point",
  ]) {
    const raw = pointBytes(pointId);
    refused(
      `registry-key-${pointId}`,
      "K2",
      `Public key is the ${pointId} point of the build-brief-v2 strict vectors; identifier derived from it.`,
      registry([
        keyEntry({ raw, id: keyIdOf(raw) }, ["release"], "2026-01-01T00:00:00.000Z", null),
      ]),
    );
  }
  refused(
    "registry-identifier-of-another-key",
    "K3",
    "Key 1 entry carrying the identifier of key 2.",
    withEntry(single, (entry) => {
      entry.signingKeyId = k2.id;
    }),
  );
  refused(
    "registry-identifier-of-pem-text",
    "K3",
    "Key 1 entry whose identifier is SHA-256 of its PEM text, not of the raw key.",
    withEntry(single, (entry) => {
      entry.signingKeyId = `${SIGNING_KEY_ID_PREFIX}${sha256(String(entry.publicKey)).toString("hex")}`;
    }),
  );
  refused(
    "registry-identifier-of-identifier-text",
    "K3",
    "Key 1 entry whose identifier hashes the prefixed text ed25519-<hex>, not the raw key.",
    withEntry(single, (entry) => {
      entry.signingKeyId = `${SIGNING_KEY_ID_PREFIX}${sha256(k1.id).toString("hex")}`;
    }),
  );
  refused("registry-duplicate-entry", "K4", "Key 1 listed twice.", registry([k1Entry, k1Entry]));
  refused(
    "registry-revoked-at-activation",
    "K5",
    "revokedAt equal to activatedAt.",
    registry([keyEntry(k3, ["release"], KEY_3_REVOKED_AT, KEY_3_REVOKED_AT)]),
  );
  refused(
    "registry-revoked-before-activation",
    "K5",
    "revokedAt one millisecond before activatedAt.",
    registry([keyEntry(k3, ["release"], KEY_3_REVOKED_AT, "2026-08-31T23:59:59.999Z")]),
  );
  refused(
    "registry-revoked-without-reason",
    "K6",
    "Revoked key 3 without revocationReason.",
    registry([without(revokedEntry, "revocationReason")]),
  );
  refused(
    "registry-revoked-without-witness",
    "K6",
    "Revoked key 3 without revocationWitness.",
    registry([without(revokedEntry, "revocationWitness")]),
  );
  refused(
    "registry-revoked-after-discovery",
    "K6",
    "Revoked key 3 whose revokedAt is one millisecond after its revocationWitness.discoveredAt.",
    registry([
      {
        ...revokedEntry,
        revocationWitness: {
          signatory: "incident-responder",
          discoveredAt: "2026-08-31T23:59:59.999Z",
        },
      },
    ]),
  );

  // Signature vectors: S rules, against the main registry unless stated.
  const signatureVectors: SignatureVector[] = [];
  const add = (
    id: string,
    rule: string | null,
    description: string,
    signed: JsonObject | Uint8Array,
    expected: SignatureExpected,
    options: {
      manifest?: ManifestName | HostileManifestName;
      now?: string;
      registry?: string;
    } = {},
  ) =>
    signatureVectors.push({
      id,
      rule,
      description,
      manifest: options.manifest ?? "release",
      registry: options.registry ?? "main",
      now: options.now ?? NOW,
      ...(signed instanceof Uint8Array
        ? { record: null, recordOctets: base64url(signed) }
        : { record: signed }),
      expected,
    });
  const accepted = (ids: string[], ignored: number): SignatureExpected => ({
    outcome: "accepted",
    verifiedKeyIds: [...ids].sort(),
    ignoredUnknownKeyIds: ignored,
  });
  const refusedWith = (refusal: string): SignatureExpected => ({ outcome: "refused", refusal });

  const s1 = sign(k1, releaseMessage);
  const s2 = sign(k2, releaseMessage);
  const unknownSignatures = (count: number) =>
    keys.slice(5, 5 + count).map((k) => sign(k, releaseMessage));

  add("valid-single-key", null, "Release signed by key 1.", record([s1]), accepted([k1.id], 0));
  add(
    "valid-two-keys",
    null,
    "Release signed by keys 1 and 2.",
    record([s1, s2]),
    accepted([k1.id, k2.id], 0),
  );
  add(
    "valid-two-keys-reversed",
    "S10",
    "valid-two-keys with its signatures in reverse order: same outcome.",
    record([s2, s1]),
    accepted([k1.id, k2.id], 0),
  );
  add(
    "valid-registry-reversed",
    "S10",
    "valid-two-keys against the main registry in reverse key order: same outcome.",
    record([s1, s2]),
    accepted([k1.id, k2.id], 0),
    { registry: "main-reversed" },
  );
  add(
    "valid-unknown-key-ignored",
    "S5",
    "Keys 1 and 6; key 6 is absent from the registry, ignored and counted.",
    record([s1, sign(k6, releaseMessage)]),
    accepted([k1.id], 1),
  );
  add(
    "valid-sixteen-signatures",
    "S1",
    "Key 1 and 15 unknown keys: 16 signatures, the upper bound.",
    record([s1, ...unknownSignatures(15)]),
    accepted([k1.id], 15),
  );
  add(
    "valid-now-at-activation",
    "S6",
    "Key 2 at now equal to its activatedAt (included).",
    record([s2]),
    accepted([k2.id], 0),
    { now: KEY_2_ACTIVATED_AT },
  );
  add(
    "valid-now-before-revocation",
    "S6",
    "Revoked key 3 one millisecond before its revokedAt.",
    record([sign(k3, releaseMessage)]),
    accepted([k3.id], 0),
    { now: "2026-08-31T23:59:59.999Z" },
  );
  add(
    "valid-dataset-key",
    "S7",
    "Dataset manifest signed by key 5, authorized for dataset only.",
    record([sign(k5, datasetMessage)]),
    accepted([k5.id], 0),
    { manifest: "dataset" },
  );
  add(
    "valid-unicode-manifest",
    "S4",
    "Release whose file path holds e-acute, U+001F, a quotation mark, U+007F and U+2028.",
    record([sign(k1, unicodeMessage)]),
    accepted([k1.id], 0),
    { manifest: "release-unicode" },
  );
  add(
    "rotation-retired-key-ignored",
    "S5",
    "Rotation from key 1 to key 2 done: key 1 removed from the registry, its signature ignored.",
    record([s1, s2]),
    accepted([k2.id], 1),
    { registry: "after-rotation" },
  );

  add("empty-signatures", "S1", "No signature.", record([]), refusedWith("signature-required"));
  add(
    "seventeen-signatures",
    "S1",
    "Key 1 and 16 unknown keys: 17 signatures.",
    record([s1, ...unknownSignatures(16)]),
    refusedWith("signature-malformed"),
  );
  add(
    "signature-short",
    "S1",
    "Key 1 signature without its last character (85 characters).",
    record([{ ...s1, signature: s1.signature.slice(0, -1) }]),
    refusedWith("signature-malformed"),
  );
  add(
    "signature-padded",
    "S1",
    "Key 1 signature followed by == padding.",
    record([{ ...s1, signature: `${s1.signature}==` }]),
    refusedWith("signature-malformed"),
  );
  {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const last = alphabet.indexOf(s1.signature.slice(-1));
    const aliased = `${s1.signature.slice(0, -1)}${alphabet[last + 1]}`;
    if (!Buffer.from(aliased, "base64url").equals(Buffer.from(s1.signature, "base64url")))
      throw new Error("signature alias does not decode to the same octets");
    add(
      "signature-noncanonical-final-character",
      "S1",
      "Key 1 signature whose last character has non-zero unused bits (same 64 octets).",
      record([{ ...s1, signature: aliased }]),
      refusedWith("signature-malformed"),
    );
  }
  add(
    "signature-outside-base64url-alphabet",
    "S1",
    "Key 1 signature whose first character is replaced by +, a standard Base64 character.",
    record([{ ...s1, signature: `+${s1.signature.slice(1)}` }]),
    refusedWith("signature-malformed"),
  );
  add(
    "key-identifier-uppercase",
    "S1",
    "Key 1 signature labeled with its identifier in uppercase hex.",
    record([{ ...s1, signingKeyId: k1.id.toUpperCase() }]),
    refusedWith("signature-malformed"),
  );
  add(
    "key-identifier-bare-hex",
    "S1",
    "Key 1 signature labeled with its identifier without the ed25519- prefix.",
    record([{ ...s1, signingKeyId: k1.id.slice(SIGNING_KEY_ID_PREFIX.length) }]),
    refusedWith("signature-malformed"),
  );
  add(
    "signature-entry-unknown-member",
    "S1",
    "Key 1 signature entry with an extra algorithm member.",
    record([{ ...s1, algorithm: "Ed25519" } as typeof s1]),
    refusedWith("signature-malformed"),
  );
  add(
    "record-unknown-member",
    "S1",
    "Record with an extra manifestDigest member.",
    { ...record([s1]), manifestDigest: sha256(canonicalJson(release)).toString("hex") },
    refusedWith("signature-malformed"),
  );
  add(
    "record-other-schema-version",
    "S1",
    "Record whose schemaVersion names a v2.",
    { ...record([s1]), schemaVersion: "libre-ai.artifact-manifest-signatures.v2" },
    refusedWith("signature-malformed"),
  );
  add(
    "duplicate-key-identifier",
    "S2",
    "Key 1 signature listed twice.",
    record([s1, s1]),
    refusedWith("signature-malformed"),
  );
  add(
    "manifest-schema-invalid",
    "S3",
    "Valid key 1 signature record, manifest file path rewritten to ../secret.",
    record([s1]),
    refusedWith("manifest-schema-invalid"),
    { manifest: "release-path-traversal" },
  );
  add(
    "manifest-duplicate-member",
    "S0",
    "Manifest octets naming artifactType twice (dataset, then release); key 1 signed release.",
    record([s1]),
    refusedWith("manifest-schema-invalid"),
    { manifest: "release-duplicate-member" },
  );
  add(
    "manifest-escaped-lone-surrogate",
    "S0",
    "Manifest octets whose mediaType ends with the escape \\ud800; key 1 signed that value.",
    record([sign(k1, surrogateMessage)]),
    refusedWith("manifest-schema-invalid"),
    { manifest: "release-escaped-lone-surrogate" },
  );
  add(
    "manifest-bom",
    "S0",
    "Release octets preceded by a UTF-8 byte order mark.",
    record([s1]),
    refusedWith("manifest-schema-invalid"),
    { manifest: "release-bom" },
  );
  add(
    "manifest-invalid-utf8",
    "S0",
    "Release octets whose mediaType is the two octets C3 28, not UTF-8.",
    record([s1]),
    refusedWith("manifest-schema-invalid"),
    { manifest: "release-invalid-utf8" },
  );
  {
    const recordText = JSON.stringify(record([s1]));
    add(
      "record-duplicate-member",
      "S0",
      "Record octets naming signingKeyId twice in one entry, key 6 then key 1.",
      utf8(
        replaceOnce(
          recordText,
          `"signingKeyId":"${k1.id}"`,
          `"signingKeyId":"${k6.id}","signingKeyId":"${k1.id}"`,
        ),
      ),
      refusedWith("signature-malformed"),
    );
    add(
      "record-trailing-comma",
      "S0",
      "Record octets with a comma after the last signature entry.",
      utf8(replaceOnce(recordText, "}]}", "},]}")),
      refusedWith("signature-malformed"),
    );
  }
  add(
    "signed-bare-jcs",
    "S4",
    "Key 1 signature over the RFC 8785 octets of the manifest, without domain or digest.",
    record([
      {
        signingKeyId: k1.id,
        signature: base64url(
          ed25519.sign(new TextEncoder().encode(canonicalJson(release)), k1.seed),
        ),
      },
    ]),
    refusedWith("signature-invalid"),
  );
  add(
    "signed-bare-digest",
    "S4",
    "Key 1 signature over the 32 raw octets of SHA-256(JCS(manifest)), without domain.",
    record([
      {
        signingKeyId: k1.id,
        signature: base64url(ed25519.sign(new Uint8Array(sha256(canonicalJson(release))), k1.seed)),
      },
    ]),
    refusedWith("signature-invalid"),
  );
  add(
    "signed-other-family-domain",
    "S4",
    `Key 1 signature over ${BUILD_BRIEF_DOMAIN}, 0x00 and the same digest.`,
    record([sign(k1, messageFor(BUILD_BRIEF_DOMAIN, release))]),
    refusedWith("signature-invalid"),
  );
  add(
    "signed-next-major-domain",
    "S4",
    `Key 1 signature over ${NEXT_MAJOR_DOMAIN}, 0x00 and the same digest.`,
    record([sign(k1, messageFor(NEXT_MAJOR_DOMAIN, release))]),
    refusedWith("signature-invalid"),
  );
  add(
    "signed-non-jcs-digest",
    "S4",
    "Key 1 signature over the domain, 0x00 and SHA-256 of JSON.stringify(manifest, null, 2).",
    record([
      {
        signingKeyId: k1.id,
        signature: base64url(
          ed25519.sign(
            concat(
              new TextEncoder().encode(DOMAIN),
              Uint8Array.of(0),
              new Uint8Array(sha256(JSON.stringify(release, null, 2))),
            ),
            k1.seed,
          ),
        ),
      },
    ]),
    refusedWith("signature-invalid"),
  );
  add(
    "manifest-changed-after-signing",
    "S4",
    "valid-single-key record; files[0].digest of the manifest changed after signing.",
    record([s1]),
    refusedWith("signature-invalid"),
    { manifest: "release-file-digest-changed" },
  );
  add(
    "unknown-key-only",
    "S5",
    "Release signed by key 6 only, absent from the registry.",
    record([sign(k6, releaseMessage)]),
    refusedWith("signature-key-unknown"),
  );
  add(
    "rotation-retired-key-only",
    "S5",
    "Release signed only by key 1, removed by rotation before the release was re-signed.",
    record([s1]),
    refusedWith("signature-key-unknown"),
    { registry: "after-rotation" },
  );
  add(
    "now-at-revocation",
    "S6",
    "Key 3 at now equal to its revokedAt (excluded).",
    record([sign(k3, releaseMessage)]),
    refusedWith("signature-key-not-active"),
    { now: KEY_3_REVOKED_AT },
  );
  add(
    "now-before-activation",
    "S6",
    "Key 4, activated in 2027.",
    record([sign(k4, releaseMessage)]),
    refusedWith("signature-key-not-active"),
  );
  for (const [id, now, what] of [
    ["now-hour-24", "2026-10-15T24:00:00.000Z", "hour 24"],
    ["now-impossible-date", "2026-02-30T12:00:00.000Z", "February 30"],
    ["now-offset", "2026-10-15T12:00:00.000+00:00", "offset +00:00 instead of Z"],
    ["now-without-milliseconds", "2026-10-15T12:00:00Z", "no fractional digits"],
  ] as const)
    add(
      id,
      "S6",
      `Key 1 signature, now malformed (${what}): no instant is established.`,
      record([s1]),
      refusedWith("signature-key-not-active"),
      { now },
    );
  add(
    "dataset-signed-by-release-key",
    "S7",
    "Dataset manifest signed by key 1, authorized for build and release.",
    record([sign(k1, datasetMessage)]),
    refusedWith("signature-key-not-authorized"),
    { manifest: "dataset" },
  );
  add(
    "release-signed-by-dataset-key",
    "S7",
    "Release signed by key 5, authorized for dataset only.",
    record([sign(k5, releaseMessage)]),
    refusedWith("signature-key-not-authorized"),
  );
  add(
    "key-authorizing-nothing-alone",
    "S7",
    "Release signed by key 30, admitted with artifactTypes [] (authorizes no manifest).",
    record([sign(k30, releaseMessage)]),
    refusedWith("signature-key-not-authorized"),
    { registry: "main-with-key-authorizing-nothing" },
  );
  add(
    "key-authorizing-nothing-cosigns",
    "S7",
    "Release signed by key 1 and by key 30, admitted with artifactTypes []: the cosignature refuses.",
    record([s1, sign(k30, releaseMessage)]),
    refusedWith("signature-key-not-authorized"),
    { registry: "main-with-key-authorizing-nothing" },
  );

  // Strict profile (S8): the valid key 1 signature with S + L, then forged R points.
  const s1Bytes = new Uint8Array(Buffer.from(s1.signature, "base64url"));
  add(
    "s-not-reduced",
    "S8",
    "Key 1 signature with S + L, which reduces to the same S.",
    record([
      {
        signingKeyId: k1.id,
        signature: base64url(
          concat(
            s1Bytes.subarray(0, 32),
            littleEndian32(littleEndian(s1Bytes.subarray(32)) + Fn.ORDER),
          ),
        ),
      },
    ]),
    refusedWith("signature-invalid"),
  );
  // R = T_i (small order), S = k a: R + kA - SB = T_i, cleared by a cofactored equation.
  for (let index = 0; index <= 7; index += 1) {
    const r = pointBytes(`torsion-${index}`);
    const s = Fn.create(challenge(r, k1.raw, releaseMessage) * k1.scalar);
    add(
      index === 0 ? "r-identity" : `r-torsion-${index}`,
      "S8",
      index === 0 ? "R is the identity, S = k a." : `R is torsion-${index} (small order), S = k a.`,
      record([{ signingKeyId: k1.id, signature: base64url(concat(r, littleEndian32(s))) }]),
      refusedWith("signature-invalid"),
    );
  }
  // R' = rB + T_i (mixed order), S = r + k' a: R' + k'A - SB = T_i.
  for (let index = 1; index <= 7; index += 1) {
    const id = `r-mixed-order-${index}`;
    const torsion = Point.fromBytes(pointBytes(`torsion-${index}`), false);
    const nonce = forgeryNonce(id);
    const r = Point.BASE.multiply(nonce).add(torsion).toBytes();
    const s = Fn.create(nonce + challenge(r, k1.raw, releaseMessage) * k1.scalar);
    add(
      id,
      "S8",
      `R is rB + torsion-${index} (mixed order), S = r + k a over that R.`,
      record([{ signingKeyId: k1.id, signature: base64url(concat(r, littleEndian32(s))) }]),
      refusedWith("signature-invalid"),
    );
  }
  {
    const r = pointBytes("noncanonical-identity");
    const s = Fn.create(challenge(r, k1.raw, releaseMessage) * k1.scalar);
    add(
      "r-noncanonical-identity",
      "S8",
      "R is the identity written with y = p + 1 (not canonical), S = k a.",
      record([{ signingKeyId: k1.id, signature: base64url(concat(r, littleEndian32(s))) }]),
      refusedWith("signature-invalid"),
    );
  }
  add(
    "signature-of-key-2-labeled-key-1",
    "S8",
    "Key 2 signature of the release labeled with the identifier of key 1.",
    record([{ signingKeyId: k1.id, signature: s2.signature }]),
    refusedWith("signature-invalid"),
  );
  add(
    "known-valid-and-known-invalid",
    "S9",
    "Valid key 1 signature and key 2 signature over the dataset manifest.",
    record([s1, sign(k2, datasetMessage)]),
    refusedWith("signature-invalid"),
  );
  add(
    "known-valid-and-known-revoked",
    "S9",
    "Valid key 1 signature and valid key 3 signature, key 3 revoked at now.",
    record([s1, sign(k3, releaseMessage)]),
    refusedWith("signature-key-not-active"),
  );
  add(
    "known-valid-and-known-unauthorized",
    "S9",
    "Dataset manifest: valid key 5 signature and valid key 1 signature, key 1 not authorized.",
    record([sign(k5, datasetMessage), sign(k1, datasetMessage)]),
    refusedWith("signature-key-not-authorized"),
    { manifest: "dataset" },
  );

  return {
    schemaVersion: VECTORS_SCHEMA_VERSION,
    testMaterialWarning: TEST_MATERIAL_WARNING,
    domain: DOMAIN,
    testKeys: [k1, k2, k3, k4, k5, k6, k30].map((k) => ({
      name: `key-${k.n}`,
      seed: base64url(k.seed),
      publicKey: base64url(k.raw),
      signingKeyId: k.id,
    })),
    manifests,
    manifestOctets,
    messages: {
      release: base64url(releaseMessage),
      dataset: base64url(datasetMessage),
      "release-unicode": base64url(unicodeMessage),
    },
    registries,
    registryVectors,
    signatureVectors,
  };
}

/** `formatter.lineWidth` of biome.json: `biome ci .` formats this corpus like any other file. */
const LINE_WIDTH = 100;

function isScalar(value: unknown): boolean {
  return value === null || typeof value !== "object";
}

/**
 * `JSON.stringify(value, null, 2)` except for one rule of the repository formatter: an array of
 * scalars is written on one line when that line fits in LINE_WIDTH columns, trailing comma
 * included. Same renderer as the signalement receipt corpus, so `biome ci` and `--check` agree.
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
    const members = entries.map(([name, member], index) => {
      const prefix = `${inner}${JSON.stringify(name)}: `;
      return `${prefix}${renderJson(member, inner, prefix.length, index < entries.length - 1 ? 1 : 0)}`;
    });
    return `{\n${members.join(",\n")}\n${indent}}`;
  }
  return JSON.stringify(value);
}

export async function generateArtifactManifestSignatureVectors(): Promise<string> {
  return `${renderJson(await buildCorpus(), "", 0, 0)}\n`;
}

/** Counts by family and outcome, read from a corpus document. */
export function countVectors(corpus: {
  registryVectors: { expected: { outcome: string } }[];
  signatureVectors: { expected: { outcome: string } }[];
}): VectorCounts {
  const count = (list: { expected: { outcome: string } }[], outcome: string) =>
    list.filter((vector) => vector.expected.outcome === outcome).length;
  return {
    registryValid: count(corpus.registryVectors, "admitted"),
    registryInvalid: count(corpus.registryVectors, "refused"),
    signatureValid: count(corpus.signatureVectors, "accepted"),
    signatureInvalid: count(corpus.signatureVectors, "refused"),
  };
}

/** Failures are empty when the written corpus is octet-identical to the generator output. */
export async function checkArtifactManifestSignatureVectors(
  path: string = VECTORS_PATH,
): Promise<string[]> {
  const generated = await generateArtifactManifestSignatureVectors();
  const file = Bun.file(path);
  if (!(await file.exists())) return [`${path}: absent`];
  return (await file.text()) === generated ? [] : [`${path}: differs from the generator output`];
}

if (import.meta.main) {
  const mode = Bun.argv[2];
  if (mode === "--write") {
    const text = await generateArtifactManifestSignatureVectors();
    await writeFile(VECTORS_PATH, text);
    const counts = countVectors(JSON.parse(text));
    console.log(
      `Artifact manifest signature corpus written: registry ${counts.registryValid} valid + ` +
        `${counts.registryInvalid} invalid, signatures ${counts.signatureValid} valid + ` +
        `${counts.signatureInvalid} invalid`,
    );
  } else if (mode === "--check") {
    const failures = await checkArtifactManifestSignatureVectors();
    if (failures.length > 0) {
      for (const failure of failures) console.error(failure);
      console.error("Artifact manifest signature corpus differs from its generator; run --write");
      process.exitCode = 1;
    } else {
      const counts = countVectors(await Bun.file(VECTORS_PATH).json());
      console.log(
        `Artifact manifest signature corpus verified: registry ${counts.registryValid} valid + ` +
          `${counts.registryInvalid} invalid, signatures ${counts.signatureValid} valid + ` +
          `${counts.signatureInvalid} invalid, identical to the generator output`,
      );
    }
  } else {
    console.error("Usage: artifact-manifest-signatures-vectors.ts --write | --check");
    process.exitCode = 2;
  }
}
