import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import vector from "../../contracts/fixtures/build-brief-v2/vectors.json";
import bindingVector from "../../contracts/fixtures/missions-v3/binding-vectors.json";
import chain from "../../contracts/fixtures/missions-v3/chain-vectors.json";
import adoption from "../../docs/reviews/build-brief-missions-specification-lock.json";
import { canonicalJson } from "./authorized-execution";
import { buildBriefDigest, type CandidateContext } from "./build-brief-v2";
import {
  deriveMissionBinding,
  referenceDecision as evaluateReference,
  type MissionBinding,
  type MissionObservation,
  type PlanningContext,
  type ReferenceAction,
  type ReferenceHistory,
  type ReferenceIdentity,
  type ReferenceState,
  verifyMissionBindingDigests,
} from "./missions-v3";
import { runSpecificationLockGate } from "./specification-lock-test-helper";

const names = [
  "mission-handoff-binding.v1",
  "mission-record.v3",
  "execution-plan-body.v3",
  "execution-authorization.v3",
  "missions-api.v3",
];
for (const name of names)
  test(`Missions candidate authority exists: ${name}`, async () => {
    expect(await Bun.file(`contracts/schemas/${name}.schema.json`).exists()).toBe(true);
  });
test("Missions v3 route authority and separate fixtures exist", async () => {
  expect(await Bun.file("contracts/openapi/missions.v3.yaml").exists()).toBe(true);
  expect(await Bun.file("contracts/fixtures/missions-v3/schema-fixtures.json").exists()).toBe(true);
});
interface Mutation {
  name: string;
  path: string;
  value?: unknown;
  remove?: boolean;
}
interface Fixture {
  schema: string;
  valid: Record<string, unknown>;
  invalidMutations: Mutation[];
}
function mutate(value: Record<string, unknown>, mutation: Mutation): unknown {
  const output = structuredClone(value);
  const parts = mutation.path.slice(1).split("/");
  let parent = output;
  for (const key of parts.slice(0, -1)) parent = parent[key] as Record<string, unknown>;
  const last = parts.at(-1);
  if (!last) throw new Error("Missing fixture mutation path");
  if (mutation.remove) delete parent[last];
  else parent[last] = mutation.value;
  return output;
}
if (await Bun.file("contracts/fixtures/missions-v3/schema-fixtures.json").exists()) {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  for await (const path of new Bun.Glob("contracts/schemas/*.json").scan())
    ajv.addSchema(await Bun.file(path).json());
  const inventory = (await Bun.file(
    "contracts/fixtures/missions-v3/schema-fixtures.json",
  ).json()) as { cases: Fixture[] };
  for (const fixture of inventory.cases)
    test(`Missions v3 strict schema and refusal vectors: ${fixture.schema}`, () => {
      const validate = ajv.getSchema(`https://contracts.libre-ai.fr/schemas/${fixture.schema}`);
      if (!validate) throw new Error("Missing candidate schema");
      expect(validate(fixture.valid), JSON.stringify(validate.errors)).toBe(true);
      expect(validate({ ...fixture.valid, unexpected: true })).toBe(false);
      for (const mutation of fixture.invalidMutations)
        expect(validate(mutate(fixture.valid, mutation)), mutation.name).toBe(false);
    });
  test("Missions v3 preserves every unchanged v2 mission state prerequisite", async () => {
    const old = await Bun.file("contracts/schemas/mission-record.v2.schema.json").json();
    const next = await Bun.file("contracts/schemas/mission-record.v3.schema.json").json();
    expect(next.allOf).toEqual(old.allOf);
    for (const [key, value] of Object.entries(old.properties))
      if (!["schemaVersion", "handoffId", "handoffDigest", "revision"].includes(key))
        expect(next.properties[key], key).toEqual(value);
    expect(next.properties.handoffId).toBeUndefined();
    expect(next.properties.handoffDigest).toBeUndefined();
  });
  test("Plan v3 preserves graph, generation, budgets, capability and isolation restrictions", async () => {
    const old = await Bun.file("contracts/schemas/execution-plan-body.v2.schema.json").json();
    const next = await Bun.file("contracts/schemas/execution-plan-body.v3.schema.json").json();
    expect(next.allOf).toEqual(old.allOf);
    expect(next.$defs).toEqual(old.$defs);
    for (const [key, value] of Object.entries(old.properties))
      if (!["schemaVersion", "handoffId", "handoffDigest", "specPackageDigest"].includes(key))
        expect(next.properties[key], key).toEqual(value);
    expect(next.required).toContain("handoffBindingDigest");
  });
  test("Authorization v3 explicitly binds source versions without weakening generation/revocation", async () => {
    const old = await Bun.file("contracts/schemas/execution-authorization.v2.schema.json").json();
    const next = await Bun.file("contracts/schemas/execution-authorization.v3.schema.json").json();
    expect(next.allOf).toEqual(old.allOf);
    expect(next.$defs).toEqual(old.$defs);
    for (const [key, value] of Object.entries(old.properties))
      if (key !== "schemaVersion") expect(next.properties[key], key).toEqual(value);
    expect(next.properties.missionRecordSchemaVersion.const).toBe("libre-ai.mission-record.v3");
    expect(next.properties.planSchemaVersion.const).toBe("libre-ai.execution-plan-body.v3");
  });
}
test("All inherited contract bytes and existing catalog records remain unchanged", async () => {
  const path = "contracts/fixtures/missions-v3/inherited.json";
  expect(await Bun.file(path).exists()).toBe(true);
  if (!(await Bun.file(path).exists())) return;
  const inherited = (await Bun.file(path).json()) as {
    hashes: Record<string, string>;
    catalog: Record<string, unknown>[];
  };
  expect(Object.keys(inherited.hashes)).toHaveLength(213);
  for (const [name, digest] of Object.entries(inherited.hashes))
    expect(
      createHash("sha256")
        .update(await Bun.file(name).bytes())
        .digest("hex"),
      name,
    ).toBe(digest);
  expect(await runSpecificationLockGate()).toBe(0);
  const catalog = await Bun.file(adoption.baselineCatalog.path).json();
  for (const entry of inherited.catalog)
    expect(catalog.contracts.find((item: Record<string, unknown>) => item.id === entry.id)).toEqual(
      entry,
    );
});

function bytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalJson(value));
}
function planningContext(): PlanningContext {
  return {
    brief: structuredClone(vector.context) as CandidateContext,
    caller: {
      organization: vector.handoff.tenantId,
      membershipRevision: 7,
      currentMembershipRevision: 7,
      operation: "plan",
    },
    source: {
      organization: vector.handoff.tenantId,
      handoffId: vector.handoff.id,
      archiveReference: structuredClone(bindingVector.binding.handoff.archiveReference),
      revision: 1,
      currentRevision: 1,
    },
    historicalAcceptanceDigests: vector.package.acceptances.map(buildBriefDigest),
  };
}
test("Planning derives the complete binding and independent canonical digests from verified raw objects", () => {
  const result = deriveMissionBinding(
    bytes(vector.package),
    bytes(vector.handoff),
    planningContext(),
  );
  expect(result).toEqual({
    ok: true,
    binding: bindingVector.binding as MissionBinding,
    bindingDigest: bindingVector.bindingDigest,
  });
  expect(canonicalJson(vector.handoff)).toBe(bindingVector.handoffCanonical);
  expect(buildBriefDigest(vector.handoff)).toBe(bindingVector.handoffDocumentDigest);
  expect(canonicalJson(bindingVector.binding)).toBe(bindingVector.bindingCanonical);
});
test("Planning refuses unavailable or stale current ports and incomplete historical proof", () => {
  const cases: [string, (c: PlanningContext) => void][] = [
    [
      "caller absent",
      (c) => {
        c.caller = null;
      },
    ],
    [
      "source absent",
      (c) => {
        c.source = null;
      },
    ],
    [
      "permission denied",
      (c) => {
        if (c.caller) c.caller.operation = "none";
      },
    ],
    [
      "membership race",
      (c) => {
        if (c.caller) c.caller.currentMembershipRevision = 8;
      },
    ],
    [
      "source race",
      (c) => {
        if (c.source) c.source.currentRevision = 2;
      },
    ],
    [
      "cross-organization",
      (c) => {
        if (c.source) c.source.organization = "ten_ffffffffffffffff";
      },
    ],
    [
      "caller organization",
      (c) => {
        if (c.caller) c.caller.organization = "ten_ffffffffffffffff";
      },
    ],
    [
      "other handoff",
      (c) => {
        if (c.source) c.source.handoffId = "urn:libre-ai:handoff:other";
      },
    ],
    [
      "digest substituted",
      (c) => {
        if (c.source) c.source.archiveReference.digest = "0".repeat(64);
      },
    ],
    [
      "invalid archive id",
      (c) => {
        if (c.source) c.source.archiveReference.id = "invalid";
      },
    ],
    [
      "invalid archive media",
      (c) => {
        if (c.source) c.source.archiveReference.mediaType = "text/plain";
      },
    ],
    [
      "history unavailable",
      (c) => {
        c.historicalAcceptanceDigests = null;
      },
    ],
    [
      "history incomplete",
      (c) => {
        c.historicalAcceptanceDigests = [];
      },
    ],
    [
      "history duplicated",
      (c) => {
        c.historicalAcceptanceDigests = [
          vector.handoff.acceptanceDigest,
          vector.handoff.acceptanceDigest,
        ];
      },
    ],
    [
      "unsafe revision",
      (c) => {
        if (c.caller) c.caller.membershipRevision = Number.MAX_SAFE_INTEGER + 1;
      },
    ],
    [
      "zero source revision",
      (c) => {
        if (c.source) c.source.revision = 0;
      },
    ],
  ];
  for (const [name, mutateContext] of cases) {
    const c = planningContext();
    mutateContext(c);
    const result = deriveMissionBinding(bytes(vector.package), bytes(vector.handoff), c);
    expect(result.ok, name).toBe(false);
    if (!result.ok) expect(result.code, name).not.toBe("mission.unimplemented");
  }
});
test("Planning refuses raw, cryptographic, expiry and scope defects before deriving a binding", () => {
  const altered = structuredClone(vector.package);
  altered.body.problem = "tampered";
  const cases: [Uint8Array, Uint8Array, PlanningContext][] = [
    [bytes(altered), bytes(vector.handoff), planningContext()],
    [
      bytes(vector.package),
      bytes({ ...vector.handoff, capabilities: ["execute"] }),
      planningContext(),
    ],
    [
      bytes(vector.package),
      bytes({ ...vector.handoff, acceptanceDigest: "0".repeat(64) }),
      planningContext(),
    ],
    [
      new TextEncoder().encode(` ${canonicalJson(vector.package)}`),
      bytes(vector.handoff),
      planningContext(),
    ],
    [
      bytes(vector.package),
      new TextEncoder().encode(` ${canonicalJson(vector.handoff)}`),
      planningContext(),
    ],
    [
      bytes(vector.package),
      bytes(vector.handoff),
      {
        ...planningContext(),
        brief: { ...vector.context, now: vector.handoff.expiresAt } as CandidateContext,
      },
    ],
  ];
  for (const [p, h, c] of cases)
    expect(deriveMissionBinding(p, h, c)).toEqual({ ok: false, code: "mission.source-invalid" });
});
test("Whole handoff digest includes optional evidence and preserves absent versus empty arrays", () => {
  const changed = { ...vector.handoff, evidenceReports: [] };
  const c = planningContext();
  if (c.source) c.source.archiveReference.digest = buildBriefDigest(changed);
  const result = deriveMissionBinding(bytes(vector.package), bytes(changed), c);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.binding.handoff.documentDigest).not.toBe(bindingVector.handoffDocumentDigest);
    expect(result.bindingDigest).not.toBe(bindingVector.bindingDigest);
  }
});
// Test construction keeps proof/history explicit; it is not a wire compatibility adapter.
function referenceDecision(
  action: ReferenceAction,
  state: ReferenceState,
  outcome: MissionObservation["outcome"],
  expected: ReferenceIdentity,
  observed: ReferenceIdentity,
) {
  const released = state === "released";
  const history: ReferenceHistory = {
    everConfirmed: state === "confirmed" || released,
    releasedBy: released ? "removed-final" : null,
    releaseEvidenceDigest: released ? "c".repeat(64) : null,
  };
  return evaluateReference(
    action,
    state,
    {
      outcome,
      evidenceDigest: outcome === "unknown" || outcome === "absent" ? null : "c".repeat(64),
    },
    expected,
    observed,
    history,
  );
}
const identity: ReferenceIdentity = {
  organization: vector.handoff.tenantId,
  missionId: "urn:libre-ai:mission:fixture-1",
  bindingDigest: bindingVector.bindingDigest,
  archiveId: bindingVector.binding.handoff.archiveReference.id,
  handoffDigest: bindingVector.handoffDocumentDigest,
  referenceId: "urn:libre-ai:handoff-reference:fixture-1",
};
test("Reference reservation and confirmation reconcile one exact immutable tuple", () => {
  expect(referenceDecision("reserve", "missing", "absent", identity, identity)).toBe("reserve");
  expect(referenceDecision("reserve", "reserved", "absent", identity, identity)).toBe("protect");
  expect(referenceDecision("confirm", "reserved", "committed", identity, identity)).toBe("confirm");
  expect(referenceDecision("confirm", "confirmed", "committed", identity, identity)).toBe(
    "confirm",
  );
  expect(referenceDecision("reconcile", "reserved", "committed", identity, identity)).toBe(
    "confirm",
  );
  for (const key of Object.keys(identity) as (keyof ReferenceIdentity)[])
    expect(
      referenceDecision("confirm", "reserved", "committed", identity, {
        ...identity,
        [key]: "different",
      }),
      key,
    ).toBe("refuse");
});
test("Unknown effects protect archive and package; only proven terminal detachment releases", () => {
  for (const action of ["reserve", "confirm", "reconcile", "release"] as const) {
    expect(referenceDecision(action, "confirmed", "unknown", identity, identity)).toBe("protect");
  }
  expect(referenceDecision("release", "confirmed", "removed-final", identity, identity)).toBe(
    "release",
  );
  expect(referenceDecision("release", "reserved", "removed-final", identity, identity)).toBe(
    "release",
  );
  expect(referenceDecision("release", "released", "removed-final", identity, identity)).toBe(
    "already-released",
  );
  expect(referenceDecision("reserve", "released", "absent", identity, identity)).toBe("refuse");
  expect(referenceDecision("release", "confirmed", "committed", identity, identity)).toBe("refuse");
  expect(referenceDecision("release", "reserved", "absent", identity, identity)).toBe("refuse");
  expect(referenceDecision("reconcile", "missing", "committed", identity, identity)).toBe("refuse");
  expect(referenceDecision("reconcile", "released", "committed", identity, identity)).toBe(
    "refuse",
  );
});

if (await Bun.file("contracts/openapi/missions.v3.yaml").exists()) {
  const api = Bun.YAML.parse(await Bun.file("contracts/openapi/missions.v3.yaml").text()) as {
    paths: Record<
      string,
      Record<
        string,
        {
          operationId: string;
          parameters?: { $ref?: string }[];
          security: Record<string, unknown>[];
          requestBody?: { content: Record<string, { schema: { $ref: string } }> };
          responses: Record<string, { content: Record<string, { schema: { $ref: string } }> }>;
        }
      >
    >;
  };
  const endpoints = (await Bun.file("contracts/fixtures/missions-v3/endpoints.json").json())
    .endpoints as {
    path: string;
    method: string;
    operationId: string;
    successStatus: string;
    request?: Record<string, unknown>;
    response: Record<string, unknown>;
    invalidRequests: Mutation[];
    invalidResponses: Mutation[];
  }[];
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  for await (const path of new Bun.Glob("contracts/schemas/*.json").scan())
    ajv.addSchema(await Bun.file(path).json());
  function validateRef(ref: string, value: unknown): boolean {
    const validator = ajv.getSchema(
      ref.replace("../schemas/", "https://contracts.libre-ai.fr/schemas/"),
    );
    if (!validator) throw new Error("Missing API schema");
    return Boolean(validator(value));
  }
  test("Initial proposal does not require an archive or trust client approval/binding claims", () => {
    const ref = "../schemas/missions-api.v3.schema.json#/$defs/proposeRequest";
    const request = {
      handoff: { id: vector.handoff.id, documentDigest: bindingVector.handoffDocumentDigest },
      budgets: {
        maxDurationSeconds: 60,
        maxToolCalls: 10,
        maxInputTokens: 100,
        maxOutputTokens: 100,
        network: "none",
      },
    };
    expect(validateRef(ref, request)).toBe(true);
    for (const claim of [
      { accepted: true },
      { planningOnly: true },
      { handoffBinding: bindingVector.binding },
      { acceptanceCriteria: ["claimed"] },
    ])
      expect(validateRef(ref, { ...request, ...claim })).toBe(false);
    expect(
      validateRef(ref, {
        ...request,
        handoff: {
          ...request.handoff,
          archiveReference: bindingVector.binding.handoff.archiveReference,
        },
      }),
    ).toBe(false);
  });
  for (const endpoint of endpoints)
    test(`Missions v3 endpoint contract: ${endpoint.operationId}`, () => {
      const op = api.paths[endpoint.path]?.[endpoint.method];
      if (!op) throw new Error("Endpoint missing");
      expect(op.operationId).toBe(endpoint.operationId);
      const success =
        op.responses[endpoint.successStatus]?.content["application/json"]?.schema.$ref;
      if (!success) throw new Error("Missing response schema");
      expect(validateRef(success, endpoint.response)).toBe(true);
      for (const mutation of endpoint.invalidResponses)
        expect(validateRef(success, mutate(endpoint.response, mutation)), mutation.name).toBe(
          false,
        );
      if (endpoint.request) {
        const request = op.requestBody?.content["application/json"]?.schema.$ref;
        if (!request) throw new Error("Missing request schema");
        expect(validateRef(request, endpoint.request)).toBe(true);
        for (const mutation of endpoint.invalidRequests)
          expect(validateRef(request, mutate(endpoint.request, mutation))).toBe(false);
      }
      const errors =
        endpoint.method === "post"
          ? [400, 401, 403, 404, 405, 409, 412, 413, 415, 422, 503]
          : [400, 401, 403, 404, 405, 503];
      expect(Object.keys(op.responses).sort()).toEqual(
        [endpoint.successStatus, ...errors.map(String)].sort(),
      );
      for (const status of errors) {
        const ref = op.responses[String(status)]?.content["application/problem+json"]?.schema.$ref;
        if (!ref) throw new Error("Missing refusal schema");
        const error = {
          data: null,
          meta: {
            requestId: "request_fixture",
            code: `mission.http_${status}`,
            message: "Request refused",
          },
        };
        expect(validateRef(ref, error)).toBe(true);
        expect(validateRef(ref, { ...error, meta: { ...error.meta, detail: "raw input" } })).toBe(
          false,
        );
      }
      if (endpoint.method === "post") {
        for (const header of ["IdempotencyKey", "Revision"])
          expect(op.parameters?.some((x) => x.$ref === `#/components/parameters/${header}`)).toBe(
            true,
          );
        if (op.security.some((x) => "sessionCookie" in x))
          expect(op.parameters?.some((x) => x.$ref === "#/components/parameters/CsrfToken")).toBe(
            true,
          );
      }
    });
  test("Control variants bind a full exact run/plan/authorization target and reject contradictory commands", async () => {
    const fixtures = await Bun.file("contracts/fixtures/schema-fixtures.v1.json").json();
    const control = fixtures.cases.find(
      (x: Fixture) => x.schema === "orchestrator-control.v1.schema.json",
    ).valid;
    const ref = "../schemas/missions-api.v3.schema.json#/$defs/commandRequest";
    const valid = { command: control.action, reasonCode: "mission.control_requested", control };
    expect(validateRef(ref, valid)).toBe(true);
    expect(
      validateRef(ref, { ...valid, command: control.action === "cancel" ? "pause" : "cancel" }),
    ).toBe(false);
    expect(
      validateRef(ref, {
        command: "cancel",
        reasonCode: "mission.cancel",
        resourceId: "another-run",
      }),
    ).toBe(false);
  });
}

test("Mission snapshot, successor plan and authorization bind the same exact typed identity", () => {
  expect(
    verifyMissionBindingDigests(
      bytes(chain.mission),
      bytes(chain.plan),
      bytes(chain.authorization),
    ),
  ).toBe(true);
  expect(canonicalJson(chain.mission)).toBe(chain.missionCanonical);
  expect(canonicalJson(chain.plan)).toBe(chain.planCanonical);
  expect(canonicalJson(chain.authorization)).toBe(chain.authorizationCanonical);
});
test("Binding chain refuses source-version, mission, plan, digest, criteria and generation substitution", () => {
  for (const [index, field, value] of [
    [0, "handoffBindingDigest", "0".repeat(64)],
    [0, "tenantId", "ten_ffffffffffffffff"],
    [0, "acceptanceCriteria", ["other_criterion"]],
    [1, "schemaVersion", "libre-ai.execution-plan-body.v2"],
    [1, "missionId", "urn:libre-ai:mission:other"],
    [1, "handoffBindingDigest", "0".repeat(64)],
    [1, "acceptanceCriteria", ["other_criterion"]],
    [2, "missionRecordSchemaVersion", "libre-ai.mission-record.v2"],
    [2, "missionRevision", 7],
    [2, "planId", "urn:libre-ai:plan:other"],
    [2, "generation", 2],
    [2, "graphDigest", "0".repeat(64)],
  ] as [number, string, unknown][]) {
    const documents: Record<string, unknown>[] = structuredClone([
      chain.mission,
      chain.plan,
      chain.authorization,
    ]);
    const doc = documents[index];
    if (!doc) throw new Error("Bad mutation index");
    doc[field] = value;
    expect(
      verifyMissionBindingDigests(bytes(documents[0]), bytes(documents[1]), bytes(documents[2])),
      `${index}:${field}`,
    ).toBe(false);
  }
  for (const index of [0, 1, 2]) {
    const raws = [bytes(chain.mission), bytes(chain.plan), bytes(chain.authorization)];
    raws[index] = new TextEncoder().encode(" {}");
    expect(
      verifyMissionBindingDigests(
        raws[0] as Uint8Array,
        raws[1] as Uint8Array,
        raws[2] as Uint8Array,
      ),
    ).toBe(false);
  }
  expect(
    verifyMissionBindingDigests(
      new Uint8Array(2 * 1024 * 1024 + 1),
      bytes(chain.plan),
      bytes(chain.authorization),
    ),
  ).toBe(false);
});

test("Reference oracle refuses incomplete, malformed and unknown identity or operation inputs", () => {
  for (const changed of [
    {},
    { ...identity, bindingDigest: "invalid" },
    { ...identity, missionId: "invalid" },
    { ...identity, extra: "unbound" },
  ])
    expect(
      referenceDecision(
        "reserve",
        "missing",
        "absent",
        changed as ReferenceIdentity,
        changed as ReferenceIdentity,
      ),
    ).toBe("refuse");
  expect(
    referenceDecision("unknown" as "release", "confirmed", "removed-final", identity, identity),
  ).toBe("refuse");
});

test("Rehashed authorization cannot substitute the snapshot's exact plan quorum", () => {
  const authorization = structuredClone(chain.authorization);
  authorization.planQuorum.digest = "0".repeat(64);
  const { authorizationDigest: _excluded, ...unsigned } = authorization;
  authorization.authorizationDigest = buildBriefDigest(unsigned);
  expect(
    verifyMissionBindingDigests(bytes(chain.mission), bytes(chain.plan), bytes(authorization)),
  ).toBe(false);
});
