import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020";
import fixtureFile from "../../contracts/fixtures/signalement-routing-policy-v1/schema-fixtures.json";
import vectorFile from "../../contracts/fixtures/signalement-routing-policy-v1/vectors.json";
import schema from "../../contracts/schemas/signalement-routing-policy.v1.schema.json";
import { canonicalJson } from "./authorized-execution";
import {
  ROUTING_POLICY_MAX_BYTES,
  rawRoutingPolicyFailures,
  routingPolicyDigest,
} from "./signalement-routing-policy-v1";

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

interface Destination extends JsonObject {
  id: string;
  profileId: string;
  target: JsonObject;
}

interface RoutingRule extends JsonObject {
  id: string;
  match: JsonObject;
  imposed: string[];
  optional: string[];
  selectable: string[];
  denied: string[];
}

interface Policy extends JsonObject {
  destinations: Destination[];
  routingRules: RoutingRule[];
  disclosureRules: JsonObject[];
}

const encoder = new TextEncoder();

/** `raw` is base64url for octets that are not JSON; otherwise the document is serialized. */
function bytesOf(vector: Vector): Uint8Array {
  if (vector.raw !== undefined) return new Uint8Array(Buffer.from(vector.raw, "base64url"));
  return encoder.encode(JSON.stringify(vector.document));
}

function encode(document: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(document));
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
const valid = fixture.valid as Policy;
const vectors = vectorFile as unknown as { valid: { document: Policy }[] };

function policy(patch: (draft: Policy) => void): Policy {
  const draft = structuredClone(valid);
  patch(draft);
  return draft;
}

function plainDestination(index: number): Destination {
  return {
    id: `d-${index}`,
    profileId: "gitlab-issues/gitlab.com/rest-v4",
    target: { kind: "gitlab-project", projectPath: `example-group/project-${index}` },
    residency: "eu",
    visibilitySource: "discovered",
  };
}

function absentRule(index: number): RoutingRule {
  return {
    id: `r-${index}`,
    match: { absent: true },
    imposed: [],
    optional: [],
    selectable: [],
    denied: [],
  };
}

describe("vector files", () => {
  test("declare a version, both polarities, and unique names", () => {
    expect(vectorFile.schemaVersion).toBe("libre-ai.signalement-routing-policy-vectors.v1");
    expect(vectorFile.valid.length).toBeGreaterThanOrEqual(1);
    expect(vectorFile.invalid.length).toBeGreaterThanOrEqual(1);
    const names = [...vectorFile.valid, ...vectorFile.invalid].map((vector) => vector.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test("the first valid vector is the schema fixture document", () => {
    expect(vectors.valid[0]?.document).toEqual(valid);
  });
});

describe("rawRoutingPolicyFailures", () => {
  for (const vector of vectorFile.valid as Vector[]) {
    test(`accepts ${vector.name}`, () =>
      expect(rawRoutingPolicyFailures(bytesOf(vector))).toEqual([]));
  }
  for (const vector of vectorFile.invalid as Vector[]) {
    test(`refuses ${vector.name}`, () => {
      // An invalid vector without an exact expected list would silently expect acceptance.
      expect(vector.failures, `${vector.name} must declare its failures`).toBeDefined();
      expect(vector.failures?.length).toBeGreaterThanOrEqual(1);
      expect(rawRoutingPolicyFailures(bytesOf(vector))).toEqual(vector.failures as string[]);
    });
  }
});

describe("schema fixture", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);

  test("the valid document passes the schema and the verifier", () => {
    expect(validate(valid)).toBe(true);
    expect(rawRoutingPolicyFailures(encode(valid))).toEqual([]);
  });

  for (const mutation of fixture.invalidMutations) {
    test(`every mutation fails: ${mutation.name}`, () => {
      const mutated = mutate(valid, mutation);
      expect(validate(mutated)).toBe(false);
      expect(rawRoutingPolicyFailures(encode(mutated))).toEqual(["policy.schema"]);
    });
  }
});

describe("routingPolicyDigest", () => {
  test("the digest is SHA-256 of the JCS form and ignores member order", () => {
    const a = vectors.valid[0]?.document as Policy;
    const b = Object.fromEntries(Object.entries(a).reverse());
    expect(routingPolicyDigest(b)).toBe(routingPolicyDigest(a));
    expect(routingPolicyDigest(a)).toBe(
      createHash("sha256").update(canonicalJson(a)).digest("hex"),
    );
  });

  test("known answer: the JCS text of a small object, hashed outside the code under test", () => {
    // printf '%s' '{"a":"x","b":1}' | shasum -a 256
    expect(routingPolicyDigest({ b: 1, a: "x" })).toBe(
      "cdab067e9f3beb32d1252cfd63e492592fecbf591b0d08cadb24bb17f3864246",
    );
  });

  test("any change of a member changes the digest; whitespace of the source does not", () => {
    const before = routingPolicyDigest(valid);
    expect(routingPolicyDigest(policy((draft) => Object.assign(draft, { version: "2" })))).not.toBe(
      before,
    );
    const spaced = JSON.parse(JSON.stringify(valid, null, 4)) as unknown;
    expect(routingPolicyDigest(spaced)).toBe(before);
    expect(before).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("bounds", () => {
  test("the policy cap is 1 MiB", () => {
    expect(ROUTING_POLICY_MAX_BYTES).toBe(1048576);
  });

  test("exactly 1048576 octets are analysed, 1048577 are refused before any parsing", () => {
    const body = JSON.stringify(valid);
    const atCap = encoder.encode(body.padEnd(ROUTING_POLICY_MAX_BYTES, " "));
    expect(atCap.byteLength).toBe(1048576);
    expect(rawRoutingPolicyFailures(atCap)).toEqual([]);
    // Not JSON at all: only a size check that precedes parsing yields size_limit here.
    const garbage = new Uint8Array(ROUTING_POLICY_MAX_BYTES + 1).fill(0xff);
    expect(rawRoutingPolicyFailures(garbage)).toEqual(["policy.size_limit"]);
  });

  test("the size is counted in octets, not characters", () => {
    // 349526 three-octet characters (1048578 octets, plus two quotes) are only 349528 UTF-16 units.
    const multibyte = encoder.encode(`"${"€".repeat(349526)}"`);
    expect(multibyte.byteLength).toBeGreaterThan(ROUTING_POLICY_MAX_BYTES);
    expect(rawRoutingPolicyFailures(multibyte)).toEqual(["policy.size_limit"]);
  });

  test("64 destinations are accepted, 65 refused", () => {
    const destinations = Array.from({ length: 64 }, (_, i) => plainDestination(i));
    const at64 = policy((draft) => {
      draft.destinations = destinations;
      draft.routingRules = [{ ...absentRule(0), imposed: destinations.map((d) => d.id) }];
    });
    expect(rawRoutingPolicyFailures(encode(at64))).toEqual([]);
    const at65 = policy((draft) => {
      draft.destinations = [...destinations, plainDestination(64)];
      draft.routingRules = [];
    });
    expect(rawRoutingPolicyFailures(encode(at65))).toEqual(["policy.schema"]);
  });

  test("a rule list holds at most 64 destinations", () => {
    const destinations = Array.from({ length: 65 }, (_, i) => plainDestination(i));
    const ids = destinations.map((d) => d.id);
    // 65 destinations exceed their own bound too, so the list bound is checked on the schema alone.
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    const validate = ajv.compile(schema);
    const listOf = (n: number): Policy =>
      policy((draft) => {
        draft.destinations = destinations.slice(0, 64);
        draft.routingRules = [{ ...absentRule(0), denied: ids.slice(0, n) }];
      });
    expect(validate(listOf(64))).toBe(true);
    expect(validate(listOf(65))).toBe(false);
    const listErrors = (validate.errors ?? []).map((error) => error.instancePath);
    expect(listErrors).toContain("/routingRules/0/denied");
  });

  test("256 routing rules and 256 disclosure rules are accepted, 257 refused", () => {
    const routing = Array.from({ length: 256 }, (_, i) => absentRule(i));
    const disclosure = Array.from({ length: 256 }, (_, i) => ({
      id: `x-${i}`,
      roles: ["document"],
      when: { always: true },
      decision: "withhold",
    }));
    const at256 = policy((draft) => {
      draft.routingRules = routing;
      draft.disclosureRules = disclosure;
    });
    expect(rawRoutingPolicyFailures(encode(at256))).toEqual([]);
    const routing257 = policy((draft) => {
      draft.routingRules = [...routing, absentRule(256)];
    });
    expect(rawRoutingPolicyFailures(encode(routing257))).toEqual(["policy.schema"]);
    const disclosure257 = policy((draft) => {
      draft.disclosureRules = [...disclosure, { ...disclosure[0], id: "x-256" }];
    });
    expect(rawRoutingPolicyFailures(encode(disclosure257))).toEqual(["policy.schema"]);
  });

  test("an identifier holds 64 characters at most", () => {
    const id64 = `d${"x".repeat(63)}`;
    const withId = (id: string): Policy =>
      policy((draft) => {
        (draft.destinations[1] as Destination).id = id;
        (draft.routingRules[0] as RoutingRule).optional = [id];
        (draft.routingRules[1] as RoutingRule).imposed = [id];
      });
    expect(rawRoutingPolicyFailures(encode(withId(id64)))).toEqual([]);
    expect(rawRoutingPolicyFailures(encode(withId(`${id64}x`)))).toEqual(["policy.schema"]);
  });
});

describe("match forms", () => {
  const withHostPattern = (hostPattern: string): Uint8Array =>
    encode(
      policy((draft) => {
        (draft.routingRules[1] as RoutingRule).match = { scheme: "https", hostPattern, port: null };
      }),
    );

  test("a host pattern names every subdomain of at least a two-label name, never a top-level domain", () => {
    expect(rawRoutingPolicyFailures(withHostPattern("*.example.com"))).toEqual([]);
    expect(rawRoutingPolicyFailures(withHostPattern("*.a.b.example.co"))).toEqual([]);
    for (const refused of [
      "*.com",
      "example.com",
      "*.example.c",
      "*.-example.com",
      "*.example-.com",
      "*.example.com.",
      "**.example.com",
      "*example.com",
    ]) {
      expect(rawRoutingPolicyFailures(withHostPattern(refused)), refused).toEqual([
        "policy.schema",
      ]);
    }
  });

  test("an origin carrying userinfo is refused", () => {
    // Assembled at run time so that no credential-shaped literal is stored.
    const origin = ["https://user", "app.example.com"].join("@");
    const document = policy((draft) => {
      (draft.routingRules[0] as RoutingRule).match = { origin };
    });
    expect(rawRoutingPolicyFailures(encode(document))).toEqual(["policy.schema"]);
  });

  test("a port is an integer from 1 to 65535 or null", () => {
    const withPort = (port: unknown): Uint8Array =>
      encode(
        policy((draft) => {
          (draft.routingRules[1] as RoutingRule).match = {
            scheme: "https",
            hostPattern: "*.example.com",
            port,
          };
        }),
      );
    expect(rawRoutingPolicyFailures(withPort(1))).toEqual([]);
    expect(rawRoutingPolicyFailures(withPort(65535))).toEqual([]);
    expect(rawRoutingPolicyFailures(withPort(null))).toEqual([]);
    for (const refused of [0, 65536, 8080.5, "8080", -1]) {
      expect(rawRoutingPolicyFailures(withPort(refused)), String(refused)).toEqual([
        "policy.schema",
      ]);
    }
  });
});

describe("failure codes", () => {
  test("a refused policy yields exactly one code, in the documented order", () => {
    // Oversized and not JSON: size wins over raw_json.
    expect(
      rawRoutingPolicyFailures(new Uint8Array(ROUTING_POLICY_MAX_BYTES + 1).fill(0x7b)),
    ).toEqual(["policy.size_limit"]);
    // Duplicate member and a bad shape: raw_json wins over schema.
    const duplicate = encoder.encode('{"schemaVersion":"x","schemaVersion":"y","unknown":1}');
    expect(rawRoutingPolicyFailures(duplicate)).toEqual(["policy.raw_json"]);
    // Schema failure and a dead origin: schema wins.
    const schemaAndDeadOrigin = policy((draft) => {
      (draft.routingRules[0] as RoutingRule).match = { origin: "https://app.example.com:443" };
      draft.version = "0";
    });
    expect(rawRoutingPolicyFailures(encode(schemaAndDeadOrigin))).toEqual(["policy.schema"]);
    // Dead origin and a duplicate id: origin_non_canonical wins.
    const deadOriginAndDuplicate = policy((draft) => {
      (draft.routingRules[2] as RoutingRule).match = { origin: "http://127.1" };
      (draft.destinations[1] as Destination).id = "d-gh";
    });
    expect(rawRoutingPolicyFailures(encode(deadOriginAndDuplicate))).toEqual([
      "policy.origin_non_canonical:r-absent",
    ]);
    // Schema failure and a duplicate id: schema wins.
    const schemaAndDuplicate = policy((draft) => {
      (draft.destinations[1] as Destination).id = "d-gh";
      draft.version = "0";
    });
    expect(rawRoutingPolicyFailures(encode(schemaAndDuplicate))).toEqual(["policy.schema"]);
    // Duplicate id and an unknown destination: duplicate_id wins.
    const duplicateAndUnknown = policy((draft) => {
      (draft.destinations[1] as Destination).id = "d-gh";
      (draft.routingRules[0] as RoutingRule).optional = ["d-missing"];
    });
    expect(rawRoutingPolicyFailures(encode(duplicateAndUnknown))).toEqual([
      "policy.duplicate_id:d-gh",
    ]);
    // Unknown destination and an overlap: unknown_destination wins, even on a later rule.
    const unknownAndOverlap = policy((draft) => {
      (draft.routingRules[0] as RoutingRule).denied = ["d-plane"];
      (draft.routingRules[2] as RoutingRule).selectable = ["d-missing"];
    });
    expect(rawRoutingPolicyFailures(encode(unknownAndOverlap))).toEqual([
      "policy.unknown_destination:r-absent",
    ]);
    // Overlap and a target mismatch: routing_overlap wins.
    const overlapAndMismatch = policy((draft) => {
      (draft.routingRules[1] as RoutingRule).denied = ["d-gl"];
      (draft.destinations[0] as Destination).target = (draft.destinations[1] as Destination).target;
    });
    expect(rawRoutingPolicyFailures(encode(overlapAndMismatch))).toEqual([
      "policy.routing_overlap:r-subdomains",
    ]);
    // Visibility mismatch on an earlier destination and a target mismatch on a later one:
    // target_profile_mismatch wins, each code being a pass over every destination.
    const visibilityAndMismatch = policy((draft) => {
      const github = draft.destinations[0] as Destination;
      github.visibilitySource = "declared";
      github.declaredVisibility = "public";
      (draft.destinations[3] as Destination).target = (draft.destinations[2] as Destination).target;
    });
    expect(rawRoutingPolicyFailures(encode(visibilityAndMismatch))).toEqual([
      "policy.target_profile_mismatch:d-plane",
    ]);
  });

  test("within one code, the first offender in document order is named", () => {
    const twoDuplicates = policy((draft) => {
      (draft.disclosureRules[1] as JsonObject).id = "x-public-media";
      (draft.destinations[3] as Destination).id = "d-gl";
    });
    expect(rawRoutingPolicyFailures(encode(twoDuplicates))).toEqual(["policy.duplicate_id:d-gl"]);
    const twoUnknown = policy((draft) => {
      (draft.routingRules[1] as RoutingRule).imposed = ["d-missing"];
      (draft.routingRules[2] as RoutingRule).denied = ["d-other"];
    });
    expect(rawRoutingPolicyFailures(encode(twoUnknown))).toEqual([
      "policy.unknown_destination:r-subdomains",
    ]);
    const twoMismatches = policy((draft) => {
      (draft.destinations[3] as Destination).target = (draft.destinations[0] as Destination).target;
      (draft.destinations[2] as Destination).target = (draft.destinations[1] as Destination).target;
    });
    expect(rawRoutingPolicyFailures(encode(twoMismatches))).toEqual([
      "policy.target_profile_mismatch:d-jira",
    ]);
  });

  test("every pair of lists of one rule is an overlap", () => {
    const lists = ["imposed", "optional", "selectable", "denied"] as const;
    for (const first of lists) {
      for (const second of lists) {
        if (first === second) continue;
        const document = policy((draft) => {
          const rule = draft.routingRules[1] as RoutingRule;
          for (const list of lists) rule[list] = [];
          rule[first] = ["d-gh"];
          rule[second] = ["d-gh"];
        });
        expect(rawRoutingPolicyFailures(encode(document)), `${first}+${second}`).toEqual([
          "policy.routing_overlap:r-subdomains",
        ]);
      }
    }
  });

  test("each profile family addresses exactly one target kind", () => {
    const targets = valid.destinations.map((destination) => destination.target);
    for (const [profileIndex, source] of valid.destinations.entries()) {
      for (const [targetIndex, target] of targets.entries()) {
        const document = policy((draft) => {
          // Keep the visibility members of the source profile so only the target varies.
          draft.destinations[0] = { ...structuredClone(source), id: "d-gh", target };
        });
        const expected =
          profileIndex === targetIndex ? [] : ["policy.target_profile_mismatch:d-gh"];
        expect(
          rawRoutingPolicyFailures(encode(document)),
          `${source.profileId} ${target.kind}`,
        ).toEqual(expected);
      }
    }
  });

  test("each profile family has exactly one visibility source", () => {
    // Design section 5.3 and the published profiles: discovered where the tracker exposes it.
    const expectedSource: Record<string, "discovered" | "declared"> = {
      "d-gh": "discovered",
      "d-gl": "discovered",
      "d-jira": "declared",
      "d-plane": "declared",
    };
    for (const [index, destination] of valid.destinations.entries()) {
      for (const visibilitySource of ["discovered", "declared"] as const) {
        const document = policy((draft) => {
          const target = draft.destinations[index] as Destination;
          target.visibilitySource = visibilitySource;
          if (visibilitySource === "declared") target.declaredVisibility = "private";
          else delete target.declaredVisibility;
        });
        const expected =
          expectedSource[destination.id] === visibilitySource
            ? []
            : [`policy.visibility_source_mismatch:${destination.id}`];
        expect(
          rawRoutingPolicyFailures(encode(document)),
          `${destination.id} ${visibilitySource}`,
        ).toEqual(expected);
      }
    }
  });

  test("a rule origin must be the URL serializer's own form", () => {
    const withOrigin = (origin: string): string[] =>
      rawRoutingPolicyFailures(
        encode(
          policy((draft) => {
            (draft.routingRules[0] as RoutingRule).match = { origin };
          }),
        ),
      );
    for (const canonical of [
      "https://app.example.com",
      "http://localhost:5173",
      "https://example.com:8443",
      "http://127.0.0.1",
      "https://[::1]",
    ]) {
      expect(withOrigin(canonical), canonical).toEqual([]);
    }
    for (const rewritten of [
      "https://example.com:443",
      "http://example.com:80",
      "https://example.com:65536",
      "http://127.1",
      "http://0x7f.0.0.1",
      "http://[::0001]",
      "http://[::ffff:1.2.3.4]",
    ]) {
      expect(withOrigin(rewritten), rewritten).toEqual(["policy.origin_non_canonical:r-app"]);
    }
  });

  test("a host pattern with the default port of its own scheme is refused, the other scheme's is not", () => {
    const withPort = (scheme: "https" | "http", port: number | null): string[] =>
      rawRoutingPolicyFailures(
        encode(
          policy((draft) => {
            (draft.routingRules[1] as RoutingRule).match = {
              scheme,
              hostPattern: "*.example.com",
              port,
            };
          }),
        ),
      );
    expect(withPort("https", 443)).toEqual(["policy.origin_non_canonical:r-subdomains"]);
    expect(withPort("http", 80)).toEqual(["policy.origin_non_canonical:r-subdomains"]);
    expect(withPort("https", 80)).toEqual([]);
    expect(withPort("http", 443)).toEqual([]);
    expect(withPort("https", null)).toEqual([]);
    expect(withPort("http", null)).toEqual([]);
  });

  test("a verifier failure never echoes document data other than one identifier", () => {
    const secret = "tenant-visible-text-must-not-leak";
    const failures = rawRoutingPolicyFailures(encode({ ...valid, note: secret }));
    expect(failures).toEqual(["policy.schema"]);
    expect(failures.join(" ")).not.toContain(secret);
  });
});

describe("semantics document", () => {
  test("opens with the owner's precedence decision, verbatim", async () => {
    const text = await Bun.file(
      new URL("../../contracts/signalement-routing-policy-v1/SEMANTICS.md", import.meta.url),
    ).text();
    const head = text.split("\n").slice(0, 12).join("\n");
    expect(head).toContain(
      "Precedence among matched rules is the union below (DL8), decided by the owner on 2026-10-24.",
    );
  });
});
