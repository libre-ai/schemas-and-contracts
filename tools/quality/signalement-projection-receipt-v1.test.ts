import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import fixtureFile from "../../contracts/fixtures/signalement-projection-receipt-v1/schema-fixtures.json";
import vectorFile from "../../contracts/fixtures/signalement-projection-receipt-v1/vectors.json";
import schema from "../../contracts/schemas/signalement-projection-receipt.v1.schema.json";
import { canonicalJson } from "./authorized-execution";
import {
  PROJECTION_RECEIPT_MAX_BYTES,
  RECEIPT_SIGNATURE_DOMAIN,
  rawProjectionReceiptFailures,
  rawSigningKeySetFailures,
  receiptSigningMessage,
  SIGNING_KEY_SET_MAX_BYTES,
} from "./signalement-projection-receipt-v1";

type JsonObject = Record<string, unknown>;

interface Mutation {
  name: string;
  path: string;
  value?: unknown;
  remove?: boolean;
}

interface Vector {
  name: string;
  document?: unknown;
  raw?: string;
  failures?: string[];
}

interface VectorFamily {
  valid: Vector[];
  invalid: Vector[];
}

interface SigningKey extends JsonObject {
  keyId: string;
  publicKey: string;
  status: string;
  notBefore: string;
  notAfter: string | null;
}

interface KeySet extends JsonObject {
  organization: string;
  keys: SigningKey[];
}

const encoder = new TextEncoder();

/**
 * Independent RFC 8785 serializer for the ASCII documents of this contract: members sorted by
 * UTF-16 code units, ECMAScript number form (`JSON.stringify`), no whitespace. Unlike the
 * authority canonicalizer it also writes non-integer numbers, so a vector can carry `1.5` in
 * JCS form and reach the schema check.
 */
function jcs(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(jcs).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const record = value as JsonObject;
    const members = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${jcs(record[key])}`);
    return `{${members.join(",")}}`;
  }
  return JSON.stringify(value);
}

/** `raw` is base64url for octets that are not JCS or not JSON; a document is written in JCS form. */
function bytesOf(vector: Vector): Uint8Array {
  if (vector.raw !== undefined) return new Uint8Array(Buffer.from(vector.raw, "base64url"));
  return encoder.encode(jcs(vector.document));
}

function encode(document: unknown): Uint8Array {
  return encoder.encode(jcs(document));
}

/** Same path semantics as the contracts gate: JSON Pointer with `~1` and `~0` escapes. */
function mutate(input: JsonObject, mutation: Mutation): JsonObject {
  const output = structuredClone(input);
  const segments = mutation.path
    .split("/")
    .slice(1)
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
  const key = segments.at(-1);
  if (key === undefined) throw new Error(`invalid mutation path: ${mutation.path}`);
  let target: unknown = output;
  for (const segment of segments.slice(0, -1)) {
    if (typeof target !== "object" || target === null || !(segment in target)) {
      throw new Error(`mutation path does not exist: ${mutation.path}`);
    }
    target = (target as JsonObject)[segment];
  }
  if (typeof target !== "object" || target === null) {
    throw new Error(`invalid mutation path: ${mutation.path}`);
  }
  if (mutation.remove) delete (target as JsonObject)[key];
  else (target as JsonObject)[key] = mutation.value;
  return output;
}

const fixture = fixtureFile.cases[0] as {
  schema: string;
  valid: JsonObject;
  invalidMutations: Mutation[];
};
const valid = fixture.valid;
const receipts = vectorFile as unknown as VectorFamily;
const keySets = vectorFile.keySetVectors as unknown as VectorFamily;
const validKeySet = keySets.valid[0]?.document as KeySet;

function keySet(patch: (draft: KeySet) => void): KeySet {
  const draft = structuredClone(validKeySet);
  patch(draft);
  return draft;
}

function generatedKeys(count: number): SigningKey[] {
  const template = validKeySet.keys[0] as SigningKey;
  return Array.from({ length: count }, (_, index) => ({ ...template, keyId: `k-${index}` }));
}

describe("vector files", () => {
  test("declare a version, both polarities in both families, and unique names", () => {
    expect(vectorFile.schemaVersion).toBe("libre-ai.signalement-projection-receipt-vectors.v1");
    for (const family of [receipts, keySets]) {
      expect(family.valid.length).toBeGreaterThanOrEqual(1);
      expect(family.invalid.length).toBeGreaterThanOrEqual(1);
      const names = [...family.valid, ...family.invalid].map((vector) => vector.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  test("the first valid receipt vector is the schema fixture document", () => {
    expect(receipts.valid[0]?.document).toEqual(valid);
  });

  test("the independent serializer agrees with the authority canonicalizer on integers", () => {
    for (const vector of receipts.valid)
      expect(jcs(vector.document)).toBe(canonicalJson(vector.document));
  });

  test("every invalid vector declares its exact failures", () => {
    // An invalid vector without an exact expected list would silently expect acceptance.
    for (const vector of [...receipts.invalid, ...keySets.invalid]) {
      expect(vector.failures, `${vector.name} must declare its failures`).toBeDefined();
      expect(vector.failures?.length, vector.name).toBe(1);
    }
  });
});

describe("rawProjectionReceiptFailures", () => {
  for (const vector of receipts.valid) {
    test(`accepts ${vector.name}`, () =>
      expect(rawProjectionReceiptFailures(bytesOf(vector))).toEqual([]));
  }
  for (const vector of receipts.invalid) {
    test(`refuses ${vector.name}`, () =>
      expect(rawProjectionReceiptFailures(bytesOf(vector))).toEqual(vector.failures as string[]));
  }
});

describe("rawSigningKeySetFailures", () => {
  for (const vector of keySets.valid) {
    test(`accepts ${vector.name}`, () =>
      expect(rawSigningKeySetFailures(bytesOf(vector))).toEqual([]));
  }
  for (const vector of keySets.invalid) {
    test(`refuses ${vector.name}`, () =>
      expect(rawSigningKeySetFailures(bytesOf(vector))).toEqual(vector.failures as string[]));
  }

  test("a key set of 1024 keys passes and 1025 is a schema failure", () => {
    const at1024 = keySet((draft) => {
      draft.keys = generatedKeys(1024);
    });
    expect(rawSigningKeySetFailures(encode(at1024))).toEqual([]);
    const at1025 = keySet((draft) => {
      draft.keys = generatedKeys(1025);
    });
    expect(rawSigningKeySetFailures(encode(at1025))).toEqual(["keys.schema"]);
  });

  test("only the 16 final characters whose two unused bits are zero are canonical", () => {
    // RFC 4648 section 3.5: 43 characters carry 258 bits for 256, the last 2 bits must be zero.
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const prefix = (validKeySet.keys[0] as SigningKey).publicKey.slice(0, 42);
    const accepted = [...alphabet].filter(
      (last) =>
        rawSigningKeySetFailures(
          encode(
            keySet((draft) => {
              (draft.keys[0] as SigningKey).publicKey = `${prefix}${last}`;
            }),
          ),
        ).length === 0,
    );
    expect(accepted.join("")).toBe("AEIMQUYcgkosw048");
  });

  test("a key set need not be in JCS form", () => {
    const spaced = encoder.encode(JSON.stringify(validKeySet, null, 2));
    expect(rawSigningKeySetFailures(spaced)).toEqual([]);
  });

  test("a receipt is not a key set and a key set is not a receipt", () => {
    expect(rawSigningKeySetFailures(encode(valid))).toEqual(["keys.schema"]);
    expect(rawProjectionReceiptFailures(encode(validKeySet))).toEqual(["receipt.schema"]);
  });
});

describe("schema fixture", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  test("the valid document passes the schema and the verifier", () => {
    expect(validate(valid)).toBe(true);
    expect(rawProjectionReceiptFailures(encode(valid))).toEqual([]);
  });

  for (const mutation of fixture.invalidMutations) {
    test(`every mutation fails: ${mutation.name}`, () => {
      const mutated = mutate(valid, mutation);
      expect(validate(mutated)).toBe(false);
      expect(rawProjectionReceiptFailures(encode(mutated))).toEqual(["receipt.schema"]);
    });
  }

  test("the key set definition is the registry PublicKeySet", () => {
    const validateKeySet = ajv.getSchema(`${schema.$id}#/$defs/signingKeySet`);
    expect(validateKeySet?.(validKeySet)).toBe(true);
    expect(Object.keys(schema.$defs.signingKey.properties)).toEqual([
      "keyId",
      "algorithm",
      "publicKey",
      "status",
      "notBefore",
      "notAfter",
    ]);
  });
});

describe("receiptSigningMessage", () => {
  test("the domain is the constant of the registry", () => {
    expect(RECEIPT_SIGNATURE_DOMAIN).toBe("libre-ai.signalement-projection-receipt.v1");
  });

  test("the signing message is the domain, a zero byte and the raw SHA-256 of the JCS unsigned receipt", () => {
    const first = receipts.valid[0] as { document: JsonObject };
    const { signature: _, ...unsigned } = first.document;
    const message = receiptSigningMessage(unsigned);
    const domain = new TextEncoder().encode("libre-ai.signalement-projection-receipt.v1");
    expect(message.length).toBe(domain.length + 33);
    expect(message.subarray(0, domain.length)).toEqual(domain);
    expect(message[domain.length]).toBe(0);
    expect(Buffer.from(message.subarray(domain.length + 1)).toString("hex")).toBe(
      createHash("sha256").update(canonicalJson(unsigned)).digest("hex"),
    );
  });

  test("known answer, hashed outside the code under test", () => {
    // printf '%s' '{"a":"x","b":1}' | shasum -a 256
    const domainHex = Buffer.from("libre-ai.signalement-projection-receipt.v1").toString("hex");
    expect(Buffer.from(receiptSigningMessage({ b: 1, a: "x" })).toString("hex")).toBe(
      `${domainHex}00cdab067e9f3beb32d1252cfd63e492592fecbf591b0d08cadb24bb17f3864246`,
    );
  });

  test("an object that still carries signature is refused", () => {
    expect(() => receiptSigningMessage(valid)).toThrow(TypeError);
    expect(() => receiptSigningMessage({ ...valid, signature: null })).toThrow(TypeError);
  });

  test("member order does not change the message; any member value does", () => {
    const { signature: _, ...unsigned } = valid;
    const message = Buffer.from(receiptSigningMessage(unsigned)).toString("hex");
    const reversed = Object.fromEntries(Object.entries(unsigned).reverse());
    expect(Buffer.from(receiptSigningMessage(reversed)).toString("hex")).toBe(message);
    for (const [key, value] of Object.entries(unsigned)) {
      const changed = { ...unsigned, [key]: typeof value === "number" ? value + 1 : `${key}-x` };
      expect(Buffer.from(receiptSigningMessage(changed)).toString("hex"), key).not.toBe(message);
    }
  });
});

describe("bounds", () => {
  test("the receipt cap is 65536 octets and the key set cap 262144", () => {
    expect(PROJECTION_RECEIPT_MAX_BYTES).toBe(65536);
    expect(SIGNING_KEY_SET_MAX_BYTES).toBe(262144);
  });

  test("exactly 65536 octets are analysed, 65537 are refused before any parsing", () => {
    // Trailing spaces make the document non-canonical: reaching that check proves it was analysed.
    const atCap = encoder.encode(jcs(valid).padEnd(PROJECTION_RECEIPT_MAX_BYTES, " "));
    expect(atCap.byteLength).toBe(65536);
    expect(rawProjectionReceiptFailures(atCap)).toEqual(["receipt.non_canonical"]);
    // Not JSON at all: only a size check that precedes parsing yields size_limit here.
    const garbage = new Uint8Array(PROJECTION_RECEIPT_MAX_BYTES + 1).fill(0xff);
    expect(rawProjectionReceiptFailures(garbage)).toEqual(["receipt.size_limit"]);
  });

  test("exactly 262144 octets of key set are analysed, 262145 are refused before any parsing", () => {
    const atCap = encoder.encode(
      JSON.stringify(validKeySet).padEnd(SIGNING_KEY_SET_MAX_BYTES, " "),
    );
    expect(atCap.byteLength).toBe(262144);
    expect(rawSigningKeySetFailures(atCap)).toEqual([]);
    const garbage = new Uint8Array(SIGNING_KEY_SET_MAX_BYTES + 1).fill(0xff);
    expect(rawSigningKeySetFailures(garbage)).toEqual(["keys.size_limit"]);
  });

  test("a maximal key set of 1024 keys fits under the key set cap", () => {
    const maximal = keySet((draft) => {
      draft.keys = generatedKeys(1024).map((key, index) => ({
        ...key,
        keyId: `${String(index).padStart(4, "0")}${"k".repeat(60)}`,
        notAfter: "2027-09-01T00:00:00Z",
      }));
    });
    const bytes = encode(maximal);
    expect(bytes.byteLength).toBeLessThanOrEqual(SIGNING_KEY_SET_MAX_BYTES);
    expect(rawSigningKeySetFailures(bytes)).toEqual([]);
  });

  test("the size is counted in octets, not characters", () => {
    // 21846 three-octet characters (65538 octets, plus two quotes) are only 21848 UTF-16 units.
    const multibyte = encoder.encode(`"${"€".repeat(21846)}"`);
    expect(multibyte.byteLength).toBeGreaterThan(PROJECTION_RECEIPT_MAX_BYTES);
    expect(rawProjectionReceiptFailures(multibyte)).toEqual(["receipt.size_limit"]);
  });

  test("33 media links and 33 withheld files are accepted, 34 refused", () => {
    const linked = (count: number): JsonObject => {
      const draft = structuredClone(valid) as JsonObject & {
        transmitted: JsonObject[];
        withheld: JsonObject[];
        rendered: { mediaLinks: JsonObject[] };
      };
      const paths = Array.from({ length: count }, (_, index) => `media/link-${index}.webm`);
      draft.transmitted = paths.map((path) => ({ path, sha256: "a".repeat(64), via: "link" }));
      draft.withheld = paths.map((path) => ({
        path: path.replace("link", "kept"),
        reason: "residency",
      }));
      draft.rendered.mediaLinks = paths.map((path) => ({
        path,
        url: `https://media.example.com/${path}`,
      }));
      return draft;
    };
    expect(rawProjectionReceiptFailures(encode(linked(33)))).toEqual([]);
    expect(rawProjectionReceiptFailures(encode(linked(34)))).toEqual(["receipt.schema"]);
  });

  test("the maximal schema-valid receipt fits under the octet cap", () => {
    // Every string at its schema maximum, every array full, and `"` or `\` wherever the schema
    // admits them, since JCS writes each of them on two octets. The URL lengths and the media
    // link character are read from the schema, so loosening either bound turns this test red.
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    const remoteUrlLength = schema.$defs.httpsUrl.maxLength - "https://".length;
    const mediaUrlLength = schema.$defs.mediaUrl.maxLength - "https://".length;
    const mediaUrlAdmits = (character: string) =>
      new RegExp(schema.$defs.mediaUrl.pattern).test(`https://${character}`);
    const mediaCharacter = ['"', "\\"].find(mediaUrlAdmits) ?? "~";
    const longestPath = (prefix: string, index: number) =>
      `media/${prefix.repeat(61)}${index + 100}.webm`;
    const digest = "a".repeat(64);
    const version = `${"1".repeat(14)}.${"1".repeat(8)}.${"1".repeat(8)}`;
    const maximal = {
      schemaVersion: "libre-ai.signalement-projection-receipt.v1",
      organization: `o${"a".repeat(63)}`,
      keyId: `k${"a".repeat(63)}`,
      issuedAt: "2026-10-24T10:00:05Z",
      deliveredAt: "2026-10-24T10:00:05Z",
      exportDigest: digest,
      projectionId: digest,
      mappingVersion: version,
      operation: "comment",
      revision: 2147483647,
      destinationId: `d${"a".repeat(63)}`,
      profileId: `${"a".repeat(34)}/${"a".repeat(35)}/${"a".repeat(35)}`,
      remote: { id: '"'.repeat(256), url: `https://${"\\".repeat(remoteUrlLength)}` },
      transmitted: Array.from({ length: 33 }, (_, index) => ({
        path: longestPath("m", index),
        sha256: digest,
        via: "attachment",
      })),
      withheld: Array.from({ length: 33 }, (_, index) => ({
        path: longestPath("w", index),
        reason: "attachment-unsupported",
      })),
      rendered: {
        rendererVersion: version,
        bodyDigest: digest,
        mediaLinks: Array.from({ length: 33 }, (_, index) => ({
          path: longestPath("m", index),
          url: `https://${mediaCharacter.repeat(mediaUrlLength)}`,
        })),
      },
      requestBodyDigests: Array.from({ length: 64 }, () => digest),
      policy: { version: "9".repeat(10), digest },
      approval: { reference: `r${"a".repeat(63)}` },
      signature: { algorithm: "ed25519", value: "A".repeat(86) },
    };
    expect(validate(maximal)).toBe(true);
    // One character more where a length is bounded is a schema failure.
    expect(validate({ ...maximal, remote: { ...maximal.remote, id: '"'.repeat(257) } })).toBe(
      false,
    );
    const longerLink = structuredClone(maximal);
    (longerLink.rendered.mediaLinks[0] as { url: string }).url =
      `https://${mediaCharacter.repeat(mediaUrlLength + 1)}`;
    expect(validate(longerLink)).toBe(false);
    expect(canonicalJson(maximal).length).toBe(jcs(maximal).length);
    const bytes = encode(maximal);
    expect(bytes.byteLength).toBeLessThan(PROJECTION_RECEIPT_MAX_BYTES);
    // The figure stated in SEMANTICS "Bounds"; any change of a bound must restate it there.
    expect(bytes.byteLength).toBe(57177);
    expect(rawProjectionReceiptFailures(bytes)).not.toContain("receipt.size_limit");
  });

  test("a media link URL excludes the two characters JCS escapes; the remote URL does not", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    const withLink = (url: string) => {
      const draft = structuredClone(valid) as JsonObject & {
        rendered: { mediaLinks: { url: string }[] };
      };
      (draft.rendered.mediaLinks[0] as { url: string }).url = url;
      return draft;
    };
    expect(validate(withLink(`https://${"~".repeat(1016)}`))).toBe(true);
    expect(validate(withLink('https://media.example.com/"x'))).toBe(false);
    expect(validate(withLink("https://media.example.com/\\x"))).toBe(false);
    const remote = structuredClone(valid) as JsonObject & { remote: { url: string } };
    remote.remote.url = 'https://gitlab.com/"x\\y';
    expect(validate(remote)).toBe(true);
  });

  test("failure codes carry no document data", () => {
    const codes = [...receipts.invalid, ...keySets.invalid].flatMap(
      (vector) => vector.failures ?? [],
    );
    for (const code of codes) expect(code).toMatch(/^(receipt|keys)\.[a-z_]+$/);
  });
});
