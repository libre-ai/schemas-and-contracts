import { expect, test } from "bun:test";
import policy from "../../contracts/data/retention.v4.json";
import vectors from "../../contracts/fixtures/build-brief-storage-v1/vectors.json";
import { evaluateBriefStorage, retentionV4Failures } from "./build-brief-storage-v1";

test("the candidate admits its exact inherited policy and owner-scoped archive class", () => {
  expect(retentionV4Failures(policy)).toEqual([]);
});
for (const mutation of vectors.policyMutations) {
  test(`policy refuses ${mutation.id}`, () => {
    const changed: Record<string, unknown> = structuredClone(policy);
    let parent = changed;
    for (const segment of mutation.path.slice(0, -1))
      parent = parent[segment] as Record<string, unknown>;
    const last = mutation.path.at(-1);
    if (last === undefined) throw new Error("Missing fixture path");
    parent[last] = mutation.value;
    expect(retentionV4Failures(changed).length).toBeGreaterThan(0);
  });
}
for (const vector of vectors.cases) {
  test(`storage mapping: ${vector.id}`, () => {
    expect<string>(evaluateBriefStorage(vector.input)).toBe(vector.expected);
  });
}
test("malformed or unknown observations cannot become lifecycle decisions", () => {
  for (const value of [null, [], true, 0, {}, { kind: "unknown" }]) {
    expect(evaluateBriefStorage(value)).toBe("deny");
  }
  for (const vector of vectors.cases.filter((item) => item.expected !== "deny")) {
    expect(evaluateBriefStorage({ ...vector.input, extra: true })).toBe("deny");
    for (const field of Object.keys(vector.input)) {
      const changed = { ...vector.input } as Record<string, unknown>;
      delete changed[field];
      expect(evaluateBriefStorage(changed)).toBe("deny");
    }
  }
});

test("reference enums reject coercible arrays and objects", () => {
  const input = {
    kind: "reference",
    action: "confirm",
    state: "reserved",
    identityMatches: true,
    currentPermission: true,
    sourceOutcome: "committed",
    sourceEvidenceDigest: "c".repeat(64),
    everConfirmed: false,
    releasedBy: null,
    releaseEvidenceDigest: null,
  };
  for (const state of [["reserved"], { toString: () => "reserved" }]) {
    expect(evaluateBriefStorage({ ...input, state })).toBe("deny");
  }
  expect(evaluateBriefStorage({ ...input, action: ["confirm"] })).toBe("deny");
});
test("an existing accepted package cannot append at creation revision zero", () => {
  const input = vectors.cases.find((vector) => vector.id === "append-new-proof")?.input;
  if (input === undefined) throw new Error("Missing append fixture");
  expect(evaluateBriefStorage({ ...input, expectedRevision: 0, currentRevision: 0 })).toBe("deny");
});

test("v4 preserves the locked v2 rules without adopting parallel auth v3", async () => {
  const inherited = await Bun.file("contracts/data/retention.v2.json").json();
  expect(policy.rules.slice(0, -1)).toEqual(inherited.rules);
  expect(policy.restoreOrder).toEqual(inherited.restoreOrder);
  expect(policy.rules).toHaveLength(inherited.rules.length + 1);
  expect(policy.rules.some((rule) => rule.id === "auth-membership-projection")).toBe(false);
});
