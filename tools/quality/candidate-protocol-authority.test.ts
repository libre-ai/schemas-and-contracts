import { describe, expect, test } from "bun:test";
import {
  candidateProtocolAuthorities,
  candidateProtocolForVersion,
  candidateProtocolOperations,
} from "./candidate-protocol-authority";

const entry = {
  slug: "missions",
  major: 3,
  status: "candidate" as const,
  sourceRepository: "libre-ai/ai-work-supervision",
  sourceRevision: "a".repeat(40),
  sourcePath: "docs/apps/missions.v3.md",
  localPath: "docs/protocols/candidates/missions.v3.md",
  sha256: "b".repeat(64),
};
const requirement = {
  slug: entry.slug,
  major: entry.major,
  status: "candidate",
  sourceRepository: entry.sourceRepository,
};
function document(entries: unknown[] = [entry]): unknown {
  return { schemaVersion: "candidate-protocol-authorities.v1", entries };
}
describe("versioned candidate protocol provenance", () => {
  test("selects the exact candidate major without overriding historical majors", () => {
    const authorities = candidateProtocolAuthorities(document(), [requirement]);
    expect(authorities.get("missions:3")).toEqual(entry);
    expect(authorities.has("missions:1")).toBe(false);
    expect(authorities.has("missions:2")).toBe(false);
  });
  test("accepts an explicitly empty inventory only with no required candidate", () => {
    expect(candidateProtocolAuthorities(document([]), []).size).toBe(0);
  });
  test("refuses absent, duplicate, unexpected or promoted candidate sources", () => {
    for (const entries of [
      [],
      [entry, entry],
      [{ ...entry, major: 2 }],
      [{ ...entry, status: "locked" }],
      [{ ...entry, sourceRepository: "libre-ai/other" }],
    ]) {
      expect(() => candidateProtocolAuthorities(document(entries), [requirement])).toThrow();
    }
    expect(() => candidateProtocolAuthorities(document(), [])).toThrow();
    expect(() =>
      candidateProtocolAuthorities(document(), [{ ...requirement, status: "locked" }]),
    ).toThrow();
    expect(() => candidateProtocolAuthorities(document(), [requirement, requirement])).toThrow();
  });
  test("refuses extra or absent fields, unsafe paths, malformed pins and coerced majors", () => {
    for (const value of [
      null,
      [],
      {},
      { ...(document() as object), extra: true },
      { ...(document() as object), schemaVersion: "v2" },
    ]) {
      expect(() => candidateProtocolAuthorities(value, [requirement])).toThrow();
    }
    for (const [key, value] of Object.entries({
      extra: true,
      slug: "../missions",
      major: "3",
      sourceRevision: "latest",
      sha256: "bad",
      sourcePath: "docs/../secret.md",
      localPath: "docs/protocols/missions/missions.md",
    })) {
      expect(() =>
        candidateProtocolAuthorities(document([{ ...entry, [key]: value }]), [requirement]),
      ).toThrow();
    }
    for (const key of Object.keys(entry)) {
      const missing: Record<string, unknown> = { ...entry };
      delete missing[key];
      expect(() => candidateProtocolAuthorities(document([missing]), [requirement])).toThrow();
    }
    for (const major of [0, -1, 1.5, NaN, Infinity]) {
      expect(() =>
        candidateProtocolAuthorities(document([{ ...entry, major }]), [{ ...requirement, major }]),
      ).toThrow();
    }
  });
});

describe("explicit versioned candidate operations", () => {
  const source =
    "**Commands v3 candidate:** `ProposeMission`, `StartMission`.\n**Queries v3 candidate:** `GetMission`.\n";
  test("extracts the exact version only", () => {
    expect(candidateProtocolOperations(source, 3)).toEqual({
      commands: ["ProposeMission", "StartMission"],
      queries: ["GetMission"],
    });
  });
  test("never falls back to generic or other-major operations", () => {
    for (const input of [
      source.replaceAll(" v3 candidate", ""),
      source.replaceAll("v3", "v2"),
      source.replace("`GetMission`", ""),
      source + source,
      source.replace("`GetMission`", "`GetMission`, `GetMission`"),
      source.replace("`GetMission`", "GetMission"),
      source.replace("`GetMission`", "`GetMission` plus arbitrary text"),
    ]) {
      expect(() => candidateProtocolOperations(input, 3)).toThrow();
    }
  });
});

test("unknown successor versions cannot fall back to historical Missions authority", () => {
  const authorities = candidateProtocolAuthorities(document(), [requirement]);
  expect(candidateProtocolForVersion(authorities, "missions", 1, [1, 2])).toBeUndefined();
  expect(candidateProtocolForVersion(authorities, "missions", 2, [1, 2])).toBeUndefined();
  expect(candidateProtocolForVersion(authorities, "missions", 3, [1, 2])).toEqual(entry);
  expect(() => candidateProtocolForVersion(authorities, "missions", 4, [1, 2])).toThrow();
});
