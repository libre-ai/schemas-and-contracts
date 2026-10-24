import { describe, expect, test } from "bun:test";
import Ajv2020 from "ajv/dist/2020";
import profiles from "../../contracts/fixtures/signalement-connector-profile-v1/profiles.v1.json";
import fixtureFile from "../../contracts/fixtures/signalement-connector-profile-v1/schema-fixtures.json";
import vectorFile from "../../contracts/fixtures/signalement-connector-profile-v1/vectors.json";
import schema from "../../contracts/schemas/signalement-connector-profile.v1.schema.json";
import {
  CONNECTOR_PROFILE_MAX_BYTES,
  rawConnectorProfileFailures,
} from "./signalement-connector-profile-v1";

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
const valid = fixture.valid;

interface Profile extends JsonObject {
  profileId: string;
  auth: { mode: string; scopes: string[] };
  capabilities: { consistentLookup: { method: string; status: string } };
}

describe("vector files", () => {
  test("declare a version, both polarities, and unique names", () => {
    expect(vectorFile.schemaVersion).toBe("libre-ai.signalement-connector-profile-vectors.v1");
    expect(vectorFile.valid.length).toBeGreaterThanOrEqual(1);
    expect(vectorFile.invalid.length).toBeGreaterThanOrEqual(1);
    const names = [...vectorFile.valid, ...vectorFile.invalid].map((vector) => vector.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("rawConnectorProfileFailures", () => {
  for (const vector of vectorFile.valid as Vector[]) {
    test(`accepts ${vector.name}`, () =>
      expect(rawConnectorProfileFailures(bytesOf(vector))).toEqual([]));
  }
  for (const vector of vectorFile.invalid as Vector[]) {
    test(`refuses ${vector.name}`, () => {
      // An invalid vector without an exact expected list would silently expect acceptance.
      expect(vector.failures, `${vector.name} must declare its failures`).toBeDefined();
      expect(vector.failures?.length).toBeGreaterThanOrEqual(1);
      expect(rawConnectorProfileFailures(bytesOf(vector))).toEqual(vector.failures as string[]);
    });
  }
});

describe("schema fixture", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);

  test("the valid document passes the schema and the verifier", () => {
    expect(validate(valid)).toBe(true);
    expect(rawConnectorProfileFailures(encode(valid))).toEqual([]);
  });

  for (const mutation of fixture.invalidMutations) {
    test(`every mutation fails: ${mutation.name}`, () => {
      const mutated = mutate(valid, mutation);
      expect(validate(mutated)).toBe(false);
      expect(rawConnectorProfileFailures(encode(mutated))).toEqual(["profile.schema"]);
    });
  }
});

describe("published profiles", () => {
  test("profiles.v1.json carries exactly the four v1.0 profile ids, each valid", () => {
    expect(profiles.schemaVersion).toBe("libre-ai.signalement-connector-profiles.v1");
    expect(profiles.profiles.map((p) => p.profileId)).toEqual([
      "github-issues/github.com/rest-2022-11-28",
      "gitlab-issues/gitlab.com/rest-v4",
      "jira-cloud/cloud/rest-v3",
      "plane/self-hosted/rest-v1",
    ]);
    for (const p of profiles.profiles) expect(rawConnectorProfileFailures(encode(p))).toEqual([]);
  });

  test("no published profile claims a GitLab project access token or a Jira consistent lookup", () => {
    const byId = Object.fromEntries(profiles.profiles.map((p) => [p.profileId, p])) as Record<
      string,
      Profile
    >;
    expect(byId["gitlab-issues/gitlab.com/rest-v4"]?.auth.mode).not.toBe("project-access-token");
    expect(byId["jira-cloud/cloud/rest-v3"]?.capabilities.consistentLookup.status).toBe(
      "unsupported",
    );
  });

  test("the GitLab profile carries the owner decision: personal access token, scope api", () => {
    const gitlab = profiles.profiles[1] as Profile;
    expect(gitlab.auth).toEqual({ mode: "personal-access-token", scopes: ["api"] });
  });

  test("the cells fixed by the design are published as written", () => {
    const cells = profiles.profiles.map((p) => ({
      id: p.profileId,
      upload: p.capabilities.attachmentUpload,
      visibility: p.capabilities.visibility,
      lookup: p.capabilities.consistentLookup,
      body: p.bodyFormat,
    }));
    expect(cells).toEqual([
      {
        id: "github-issues/github.com/rest-2022-11-28",
        upload: "unsupported",
        visibility: "discovered",
        lookup: { method: "issue-list", status: "unproven" },
        body: "markdown-gfm",
      },
      {
        id: "gitlab-issues/gitlab.com/rest-v4",
        upload: "supported",
        visibility: "discovered",
        lookup: { method: "filtered-list", status: "unproven" },
        body: "markdown-glfm",
      },
      {
        id: "jira-cloud/cloud/rest-v3",
        upload: "supported",
        visibility: "declared",
        lookup: { method: "jql", status: "unsupported" },
        body: "adf",
      },
      {
        id: "plane/self-hosted/rest-v1",
        upload: "unproven",
        visibility: "declared",
        lookup: { method: "external-id", status: "unproven" },
        body: "html",
      },
    ]);
  });

  test("every published profile has the same conflict policy and unknown limits", () => {
    for (const p of profiles.profiles) {
      expect(p.conflictPolicy).toEqual({
        title: "dossier-owned",
        body: "dossier-owned",
        attachments: "dossier-owned",
        comments: "dossier-owned",
        status: "provider-owned",
        closure: "provider-owned",
      });
      expect(p.limits).toEqual({
        maxBodyBytes: null,
        maxAttachmentBytes: null,
        maxAttachmentsPerItem: null,
      });
    }
  });

  test("the first four valid vectors are the published profiles, cell for cell", () => {
    const vectorDocuments = (vectorFile.valid as Vector[]).slice(0, 4).map((v) => v.document);
    expect(vectorDocuments).toEqual(profiles.profiles);
    // The comparison is not vacuous: one altered cell of a copy makes it fail.
    const altered = structuredClone(vectorDocuments) as Profile[];
    (altered[1] as Profile).capabilities.consistentLookup.status = "supported";
    expect(altered).not.toEqual(profiles.profiles);
  });

  test("a self-hosted profile has no provider version until qualification", () => {
    expect(profiles.profiles[3]?.providerVersion).toBeNull();
  });

  test("a published profile carries no qualification status", () => {
    for (const p of profiles.profiles) expect(Object.keys(p)).not.toContain("qualification");
  });
});

describe("bounds", () => {
  test("the profile cap is 65536 octets", () => {
    expect(CONNECTOR_PROFILE_MAX_BYTES).toBe(65536);
  });

  test("exactly 65536 octets are analysed, 65537 are refused before any parsing", () => {
    const body = JSON.stringify(valid);
    const at65536 = encoder.encode(body.padEnd(CONNECTOR_PROFILE_MAX_BYTES, " "));
    expect(at65536.byteLength).toBe(65536);
    expect(rawConnectorProfileFailures(at65536)).toEqual([]);
    // Not JSON at all: only a size check that precedes parsing yields size_limit here.
    const garbage = new Uint8Array(CONNECTOR_PROFILE_MAX_BYTES + 1).fill(0xff);
    expect(rawConnectorProfileFailures(garbage)).toEqual(["profile.size_limit"]);
  });

  test("the size is counted in octets, not characters", () => {
    // 21846 three-octet characters = 65538 octets but only 21846 UTF-16 units.
    const multibyte = encoder.encode(`"${"€".repeat(21846)}"`);
    expect(multibyte.byteLength).toBeGreaterThan(CONNECTOR_PROFILE_MAX_BYTES);
    expect(rawConnectorProfileFailures(multibyte)).toEqual(["profile.size_limit"]);
  });

  test("the schema bounds every array and every string member", () => {
    const profileId = (schema.properties as JsonObject).profileId as JsonObject;
    // 32 + "/" + 32 + "/" + "graphql" + "-" + 32
    expect(profileId.maxLength).toBe(32 + 1 + 32 + 1 + 7 + 1 + 32);
    const scopes = (((schema.properties as JsonObject).auth as JsonObject).properties as JsonObject)
      .scopes as JsonObject;
    expect(scopes.maxItems).toBe(32);
    expect((scopes.items as JsonObject).maxLength).toBe(64);
  });

  test("at most 32 scopes of at most 64 characters are accepted", () => {
    const scoped = (scopes: string[]): Uint8Array =>
      encode({ ...valid, auth: { mode: "fine-grained-token", scopes } });
    const at32 = Array.from(
      { length: 32 },
      (_, i) => `${"s".repeat(60)}${String(i).padStart(4, "0")}`,
    );
    expect(new Set(at32).size).toBe(32);
    expect(at32.every((scope) => scope.length === 64)).toBe(true);
    expect(rawConnectorProfileFailures(scoped(at32))).toEqual([]);
    expect(rawConnectorProfileFailures(scoped([...at32, "extra"]))).toEqual(["profile.schema"]);
    expect(rawConnectorProfileFailures(scoped(["s".repeat(65)]))).toEqual(["profile.schema"]);
  });
});

describe("failure codes", () => {
  test("a refused profile yields exactly one code, in the documented order", () => {
    // Oversized and not JSON: size wins over raw_json.
    expect(
      rawConnectorProfileFailures(new Uint8Array(CONNECTOR_PROFILE_MAX_BYTES + 1).fill(0x7b)),
    ).toEqual(["profile.size_limit"]);
    // Duplicate member and a bad shape: raw_json wins over schema.
    const duplicate = encoder.encode('{"schemaVersion":"x","schemaVersion":"y","unknown":1}');
    expect(rawConnectorProfileFailures(duplicate)).toEqual(["profile.raw_json"]);
    // Schema failure and an inconsistent id: schema wins over id_mismatch.
    const bad = { ...valid, profileId: "github-issues/github.com/rest-2022-11-29" } as Profile;
    const bothBad = {
      ...bad,
      capabilities: { ...(valid.capabilities as JsonObject), comment: "partial" },
    };
    expect(rawConnectorProfileFailures(encode(bothBad))).toEqual(["profile.schema"]);
    // Inconsistent id and inconsistent lookup: id_mismatch wins over lookup_inconsistent.
    const bothSemantic = {
      ...bad,
      capabilities: {
        ...(valid.capabilities as JsonObject),
        consistentLookup: { method: "none", status: "supported" },
      },
    };
    expect(rawConnectorProfileFailures(encode(bothSemantic))).toEqual(["profile.id_mismatch"]);
  });

  test("the id is rebuilt from family, edition, api style and api version", () => {
    for (const [patch, expected] of [
      [{ family: "gitlab-issues" }, ["profile.id_mismatch"]],
      [{ edition: "gitlab.com" }, ["profile.id_mismatch"]],
      [{ api: { style: "graphql", version: "2022-11-28" } }, ["profile.id_mismatch"]],
      [{ api: { style: "rest", version: "v4" } }, ["profile.id_mismatch"]],
    ] as [JsonObject, string[]][]) {
      expect(rawConnectorProfileFailures(encode({ ...valid, ...patch }))).toEqual(expected);
    }
  });

  test("method none is consistent only with an unsupported status", () => {
    const lookup = (status: string): Uint8Array =>
      encode({
        ...valid,
        capabilities: {
          ...(valid.capabilities as JsonObject),
          consistentLookup: { method: "none", status },
        },
      });
    expect(rawConnectorProfileFailures(lookup("unsupported"))).toEqual([]);
    expect(rawConnectorProfileFailures(lookup("unproven"))).toEqual([
      "profile.lookup_inconsistent",
    ]);
    expect(rawConnectorProfileFailures(lookup("supported"))).toEqual([
      "profile.lookup_inconsistent",
    ]);
  });

  test("a verifier failure never echoes the document", () => {
    const secret = "tenant-visible-text-must-not-leak";
    const failures = rawConnectorProfileFailures(encode({ ...valid, note: secret }));
    expect(failures.join(" ")).not.toContain(secret);
  });
});
