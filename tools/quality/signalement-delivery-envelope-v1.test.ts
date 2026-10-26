import { describe, expect, test } from "bun:test";
import Ajv2020 from "ajv/dist/2020";
import fixtureFile from "../../contracts/fixtures/signalement-delivery-envelope-v1/schema-fixtures.json";
import schema from "../../contracts/schemas/signalement-delivery-envelope.v1.schema.json";
import {
  DELIVERY_ENVELOPE_MAX_BYTES,
  EXPORT_MAX_BYTES,
  rawDeliveryEnvelopeFailures,
} from "./signalement-delivery-envelope-v1";
import { loadSignalementV1Vectors } from "./signalement-v1-vector-loader";

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

const encoder = new TextEncoder();

// Through the shared loader, so a continuation file is read and an orphan refused, never
// ignored; a refused file stops the suite. The default refuses any recipe: none is defined here.
const loaded = await loadSignalementV1Vectors(
  `${import.meta.dir}/../../contracts/fixtures/signalement-delivery-envelope-v1`,
);
if (loaded.vectors === null) {
  throw new Error(`delivery envelope vector files refused: ${loaded.failures.join("; ")}`);
}
const vectorFile = loaded.vectors as unknown as {
  schemaVersion: string;
  valid: Vector[];
  invalid: Vector[];
};

/** `raw` is base64url for octets that are not JSON; otherwise the document is serialized. */
function bytesOf(vector: Vector): Uint8Array {
  if (vector.raw !== undefined) return new Uint8Array(Buffer.from(vector.raw, "base64url"));
  return encoder.encode(JSON.stringify(vector.document));
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

function envelope(patch: JsonObject): Uint8Array {
  return encoder.encode(JSON.stringify({ ...valid, ...patch }));
}

describe("vector files", () => {
  test("declare a version, both polarities, and unique names", () => {
    expect(vectorFile.schemaVersion).toBe("libre-ai.signalement-delivery-envelope-vectors.v1");
    expect(vectorFile.valid.length).toBeGreaterThanOrEqual(1);
    expect(vectorFile.invalid.length).toBeGreaterThanOrEqual(1);
    const names = [...vectorFile.valid, ...vectorFile.invalid].map((vector) => vector.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("rawDeliveryEnvelopeFailures", () => {
  for (const vector of vectorFile.valid as Vector[]) {
    test(`accepts ${vector.name}`, () =>
      expect(rawDeliveryEnvelopeFailures(bytesOf(vector))).toEqual([]));
  }
  for (const vector of vectorFile.invalid as Vector[]) {
    test(`refuses ${vector.name}`, () => {
      // An invalid vector without an exact expected list would silently expect acceptance.
      expect(vector.failures, `${vector.name} must declare its failures`).toBeDefined();
      expect(vector.failures?.length).toBeGreaterThanOrEqual(1);
      expect(rawDeliveryEnvelopeFailures(bytesOf(vector))).toEqual(vector.failures as string[]);
    });
  }
});

describe("schema fixture", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);

  test("the valid document passes the schema and the verifier", () => {
    expect(validate(valid)).toBe(true);
    expect(rawDeliveryEnvelopeFailures(encoder.encode(JSON.stringify(valid)))).toEqual([]);
  });

  for (const mutation of fixture.invalidMutations) {
    test(`every mutation fails: ${mutation.name}`, () => {
      const mutated = mutate(valid, mutation);
      expect(validate(mutated)).toBe(false);
      expect(rawDeliveryEnvelopeFailures(encoder.encode(JSON.stringify(mutated)))).toEqual([
        "envelope.schema",
      ]);
    });
  }
});

describe("bounds", () => {
  test("the header cap is 4096 and the export cap is content + manifest + container margin", () => {
    expect(DELIVERY_ENVELOPE_MAX_BYTES).toBe(4096);
    expect(EXPORT_MAX_BYTES).toBe(268435456 + 1048576 + 16384);
  });

  test("the schema bounds exportByteLength by the same export cap", () => {
    const length = (schema.properties as JsonObject).exportByteLength as JsonObject;
    expect(length.minimum).toBe(1);
    expect(length.maximum).toBe(EXPORT_MAX_BYTES);
  });

  test("exactly 4096 bytes are analysed, 4097 are refused before any parsing", () => {
    const body = JSON.stringify(valid);
    const at4096 = encoder.encode(body.padEnd(DELIVERY_ENVELOPE_MAX_BYTES, " "));
    expect(at4096.byteLength).toBe(4096);
    expect(rawDeliveryEnvelopeFailures(at4096)).toEqual([]);
    // Not JSON at all: only a size check that precedes parsing yields size_limit here.
    const garbage = new Uint8Array(DELIVERY_ENVELOPE_MAX_BYTES + 1).fill(0xff);
    expect(rawDeliveryEnvelopeFailures(garbage)).toEqual(["envelope.size_limit"]);
  });

  test("the size is counted in octets, not characters", () => {
    // 1366 three-octet characters = 4098 octets but only 1366 UTF-16 units.
    const multibyte = encoder.encode(`"${"€".repeat(1366)}"`);
    expect(multibyte.byteLength).toBeGreaterThan(DELIVERY_ENVELOPE_MAX_BYTES);
    expect(rawDeliveryEnvelopeFailures(multibyte)).toEqual(["envelope.size_limit"]);
  });

  test("the export length bounds are inclusive at both ends", () => {
    expect(rawDeliveryEnvelopeFailures(envelope({ exportByteLength: 1 }))).toEqual([]);
    expect(rawDeliveryEnvelopeFailures(envelope({ exportByteLength: EXPORT_MAX_BYTES }))).toEqual(
      [],
    );
    expect(rawDeliveryEnvelopeFailures(envelope({ exportByteLength: 0 }))).toEqual([
      "envelope.schema",
    ]);
    expect(
      rawDeliveryEnvelopeFailures(envelope({ exportByteLength: EXPORT_MAX_BYTES + 1 })),
    ).toEqual(["envelope.schema"]);
  });

  test("observedOrigin is at most 267 characters: scheme 8 + DNS name 253 + port :65535 (6)", () => {
    // Labels of at most 63 characters joined by dots; 63+63+63+61 plus three dots = 253.
    const dnsName = (length: number): string => {
      const labels: string[] = [];
      let remaining = length;
      while (remaining > 0) {
        const label = Math.min(63, remaining);
        labels.push("a".repeat(label));
        remaining -= label + 1;
      }
      return labels.join(".");
    };
    const longest = `https://${dnsName(253)}:65535`;
    expect(dnsName(253)).toHaveLength(253);
    expect(longest).toHaveLength(267);
    expect(rawDeliveryEnvelopeFailures(envelope({ observedOrigin: longest }))).toEqual([]);
    const oneTooLong = `https://${dnsName(254)}:65535`;
    expect(oneTooLong).toHaveLength(268);
    expect(rawDeliveryEnvelopeFailures(envelope({ observedOrigin: oneTooLong }))).toEqual([
      "envelope.schema",
    ]);
  });
});

describe("origin", () => {
  test("credentials in an origin are refused, built so no literal user-at-host is stored", () => {
    const withUser = `https://user${"@"}app.example.com`;
    expect(rawDeliveryEnvelopeFailures(envelope({ observedOrigin: withUser }))).toEqual([
      "envelope.schema",
    ]);
    const userinfo = ["user", "pw"].join(":");
    const withPassword = `https://${userinfo}${"@"}app.example.com`;
    expect(rawDeliveryEnvelopeFailures(envelope({ observedOrigin: withPassword }))).toEqual([
      "envelope.schema",
    ]);
  });

  test("a value the schema admits but the URL parser does not serialize identically is refused", () => {
    for (const origin of [
      "https://app.example.com:443",
      "http://app.example.com:80",
      "https://app.example.com:65536",
    ]) {
      expect(rawDeliveryEnvelopeFailures(envelope({ observedOrigin: origin }))).toEqual([
        "envelope.origin_non_canonical",
      ]);
    }
  });

  test("a non-default port and a null origin are accepted", () => {
    expect(
      rawDeliveryEnvelopeFailures(envelope({ observedOrigin: "https://app.example.com:8443" })),
    ).toEqual([]);
    expect(rawDeliveryEnvelopeFailures(envelope({ observedOrigin: null }))).toEqual([]);
  });
});

describe("failure codes", () => {
  test("a refused envelope yields exactly one code, in the documented order", () => {
    // Oversized and not JSON: size wins over raw_json.
    expect(
      rawDeliveryEnvelopeFailures(new Uint8Array(DELIVERY_ENVELOPE_MAX_BYTES + 1).fill(0x7b)),
    ).toEqual(["envelope.size_limit"]);
    // Duplicate member and a bad shape: raw_json wins over schema.
    const duplicate = encoder.encode('{"schemaVersion":"x","schemaVersion":"y","unknown":1}');
    expect(rawDeliveryEnvelopeFailures(duplicate)).toEqual(["envelope.raw_json"]);
    // Schema failure and a non-canonical origin: schema wins over origin_non_canonical.
    expect(
      rawDeliveryEnvelopeFailures(
        envelope({ observedOrigin: "https://app.example.com:443", exportByteLength: 0 }),
      ),
    ).toEqual(["envelope.schema"]);
  });

  test("a verifier failure never echoes the document", () => {
    const secret = "tenant-visible-text-must-not-leak";
    const failures = rawDeliveryEnvelopeFailures(envelope({ note: secret }));
    expect(failures.join(" ")).not.toContain(secret);
  });
});
