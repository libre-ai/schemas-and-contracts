import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import catalog from "../../contracts/catalog.v1.json";
import postLockAdditions from "../../contracts/catalog-post-lock-additions.v1.json";
import vectors from "../../contracts/fixtures/execution-authorization-v4/binding-vectors.json";
import fixtures from "../../contracts/fixtures/execution-authorization-v4/schema-fixtures.json";
import redVectors from "../../contracts/fixtures/execution-plan-body-v4/red-vectors.json";
import common from "../../contracts/schemas/common.v1.schema.json";
import v3 from "../../contracts/schemas/execution-authorization.v3.schema.json";
import schema from "../../contracts/schemas/execution-authorization.v4.schema.json";
import manifest from "../../packages/sdk-ts/src/generated/manifest.json";
import { canonicalJson } from "./authorized-execution";
import { buildBriefDigest } from "./build-brief-v2";
import {
  type AuthorizationV4Documents,
  authorizationV4BindingFailures,
  verifyAuthorizationV4Binding,
} from "./execution-authorization-v4";

type DocumentName = "mission" | "plan" | "profile" | "authorization";
type Documents = Record<DocumentName, Record<string, unknown>>;

interface Mutation {
  name?: string;
  document?: DocumentName;
  path: string;
  value?: unknown;
  remove?: boolean;
}

interface Refusal {
  name: string;
  mutations: Mutation[];
  reseal: DocumentName[];
  expectedFailures: string[];
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(common);
const validate = ajv.compile(schema);

const SELF_DIGEST: Partial<Record<DocumentName, string>> = {
  profile: "profileDigest",
  plan: "bodyDigest",
  authorization: "authorizationDigest",
};

function mutate(document: unknown, mutation: Mutation): unknown {
  const copy = structuredClone(document) as Record<string, unknown>;
  const segments = mutation.path.split("/").slice(1);
  const last = segments.pop();
  if (last === undefined) throw new Error(`${mutation.path}: empty pointer`);
  let parent: Record<string, unknown> = copy;
  for (const segment of segments) parent = parent[segment] as Record<string, unknown>;
  if (mutation.remove) delete parent[last];
  else parent[last] = structuredClone(mutation.value);
  return copy;
}

function reseal(document: Record<string, unknown>, field: string): Record<string, unknown> {
  const { [field]: _excluded, ...unsigned } = document;
  return { ...document, [field]: buildBriefDigest(unsigned) };
}

function applyRefusal(refusal: Refusal): Documents {
  const documents = structuredClone(vectors.bound) as Documents;
  for (const mutation of refusal.mutations) {
    if (!mutation.document) throw new Error(`${refusal.name}: mutation without document`);
    documents[mutation.document] = mutate(documents[mutation.document], mutation) as Record<
      string,
      unknown
    >;
  }
  for (const name of refusal.reseal) {
    const field = SELF_DIGEST[name];
    if (!field) throw new Error(`${refusal.name}: ${name} carries no self digest`);
    documents[name] = reseal(documents[name], field);
  }
  return documents;
}

function encode(documents: Documents): AuthorizationV4Documents {
  const bytes = (value: unknown) => new TextEncoder().encode(canonicalJson(value));
  return {
    mission: bytes(documents.mission),
    plan: bytes(documents.plan),
    profile: bytes(documents.profile),
    authorization: bytes(documents.authorization),
  };
}

const [fixture] = fixtures.cases;
if (!fixture) throw new Error("missing execution-authorization.v4 fixture case");
const refusals = vectors.refusals as Refusal[];

describe("execution-authorization.v4 candidate schema", () => {
  test("differs from v3 only by its majors and the harness-profile binding", () => {
    // Undo exactly the v4 changes; what remains must be the locked v3 schema.
    const reverted = structuredClone(schema) as Record<string, unknown> & typeof schema;
    reverted.$id = v3.$id;
    reverted.title = v3.title;
    delete (reverted as Record<string, unknown>).description;
    reverted.properties.schemaVersion.const = v3.properties.schemaVersion.const;
    reverted.properties.planSchemaVersion.const = v3.properties.planSchemaVersion.const;
    delete (reverted.properties as Record<string, unknown>).harnessProfileSchemaVersion;
    delete (reverted.properties as Record<string, unknown>).harnessProfileDigest;
    reverted.required = reverted.required.filter(
      (name) => name !== "harnessProfileSchemaVersion" && name !== "harnessProfileDigest",
    );
    expect(reverted).toEqual(v3 as never);
  });

  test("pins the v4 plan major and the v3 harness-profile major", () => {
    expect(schema.properties.schemaVersion.const).toBe("libre-ai.execution-authorization.v4");
    expect(schema.properties.planSchemaVersion.const).toBe("libre-ai.execution-plan-body.v4");
    expect(schema.properties.harnessProfileSchemaVersion.const).toBe("libre-ai.harness-profile.v3");
    expect(schema.required).toContain("harnessProfileSchemaVersion");
    expect(schema.required).toContain("harnessProfileDigest");
  });

  test("execution-authorization.v3 stays byte-identical to its projected digest (I-17)", async () => {
    const bytes = new Uint8Array(
      await Bun.file("contracts/schemas/execution-authorization.v3.schema.json").arrayBuffer(),
    );
    const projected = manifest.entries.find(
      (entry) => entry.schema === "execution-authorization.v3.schema.json",
    );
    expect(projected).toBeDefined();
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      projected?.schemaSha256 as string,
    );
  });

  test("accepts the canonical fixture", () => {
    expect(validate(fixture.valid)).toBe(true);
    expect(fixture.valid).toEqual(vectors.bound.authorization as never);
  });

  test.each(
    (fixture.invalidMutations as Mutation[]).map((mutation) => [mutation.name, mutation]),
  )("refuses %s", (_name, mutation) => {
    expect(validate(mutate(fixture.valid, mutation))).toBe(false);
  });
});

describe("activation condition (ADR-0045 decision 4)", () => {
  test("the catalog admits v4 as a candidate only, in both registries", () => {
    const entry = catalog.contracts.find((item) => item.id === "execution-authorization-v4");
    const addition = postLockAdditions.additions.find(
      (item) => item.entry.id === "execution-authorization-v4",
    );
    expect(entry?.status).toBe("candidate");
    expect(addition?.entry).toEqual(entry as never);
  });

  test("the contract states the red-vector count its condition depends on", () => {
    const stated = /passes the (\d+) red vectors/.exec(schema.description)?.[1];
    const count =
      redVectors.plans.length +
      redVectors.calls.length +
      redVectors.captures.length +
      redVectors.quarantineOutputs.length;
    expect(Number(stated)).toBe(count);
  });

  test("the semantics and the decision record carry the same condition", async () => {
    for (const path of [
      "contracts/execution-authorization-v4/SEMANTICS.md",
      "docs/adr/2026-10-10-execution-authorization-v4.md",
    ]) {
      const text = await Bun.file(path).text();
      expect(text, path).toContain("tools/quality/execution-plan-body-v4.ts");
      expect(text, path).toContain("activates nothing");
    }
  });
});

describe("binding vectors", () => {
  test("the bound chain is canonical and binds", async () => {
    const documents = vectors.bound as Documents;
    expect(await authorizationV4BindingFailures(encode(documents))).toEqual([]);
    expect(await verifyAuthorizationV4Binding(encode(documents))).toBe("authorization-bound");
  });

  test("a non-canonical document is refused before any binding rule", async () => {
    const documents = encode(vectors.bound as Documents);
    documents.plan = new TextEncoder().encode(` ${canonicalJson(vectors.bound.plan)}`);
    expect(await authorizationV4BindingFailures(documents)).toEqual([
      "execution-plan-body.v4: not RFC 8785 canonical",
    ]);
  });

  test.each(
    refusals.map((refusal) => [refusal.name, refusal]),
  )("refuses %s for its stated reasons only", async (_name, refusal) => {
    const documents = encode(applyRefusal(refusal));
    expect(await authorizationV4BindingFailures(documents)).toEqual(refusal.expectedFailures);
    expect(await verifyAuthorizationV4Binding(documents)).toBe("authorization-refused");
  });

  test("every refusal changes at least one document and states at least one reason", () => {
    for (const refusal of refusals) {
      expect(refusal.mutations.length, refusal.name).toBeGreaterThan(0);
      expect(refusal.expectedFailures.length, refusal.name).toBeGreaterThan(0);
    }
  });

  test("vector and mutation names are unique", () => {
    const names = [
      ...fixture.invalidMutations.map((mutation) => mutation.name),
      ...refusals.map((refusal) => refusal.name),
    ];
    expect(new Set(names).size).toBe(names.length);
  });
});
