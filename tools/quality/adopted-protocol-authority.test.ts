import { beforeAll, expect, test } from "bun:test";
import registry from "../../contracts/candidate-protocol-authorities.v1.json";
import evidence from "../../docs/reviews/build-brief-missions-specification-lock.json";
import { adoptedMissionProtocolAuthority } from "./adopted-protocol-authority";
import {
  candidateProtocolForVersion,
  candidateProtocolOperations,
} from "./candidate-protocol-authority";
import type { SpecificationLockInput } from "./specification-lock";
import { readSpecificationLockInputs } from "./specification-lock-inputs";

let inputs: SpecificationLockInput;
const requirement = {
  slug: "missions",
  major: 3,
  status: "locked",
  sourceRepository: "libre-ai/ai-work-supervision",
};

beforeAll(async () => {
  inputs = await readSpecificationLockInputs(".");
  const catalog = await Bun.file(evidence.baselineCatalog.path).json();
  for (const row of catalog.contracts) {
    if (evidence.transitions.some((entry) => entry.id === row.id)) {
      row.status = "locked";
      delete row.review;
    }
  }
  inputs.targetCatalog = catalog;
});

test("resolves only the exact adopted owner protocol and retains its source label", async () => {
  const authority = adoptedMissionProtocolAuthority(registry, requirement, inputs);
  expect<unknown>(authority).toEqual(evidence.protocolSource);
  expect(authority.status).toBe("candidate");
  const operations = candidateProtocolOperations(await Bun.file(authority.localPath).text(), 3);
  expect(operations.commands).toHaveLength(13);
  expect(operations.queries).toHaveLength(7);
  const sources = new Map([["missions:3", authority]]);
  expect(candidateProtocolForVersion(sources, "missions", 1, [1, 2])).toBeUndefined();
  expect(candidateProtocolForVersion(sources, "missions", 2, [1, 2])).toBeUndefined();
  expect(() => candidateProtocolForVersion(sources, "missions", 4, [1, 2])).toThrow();
});

test("rejects missing adoption or an unqualified catalog", () => {
  expect(() =>
    adoptedMissionProtocolAuthority(registry, requirement, { ...inputs, evidence: null }),
  ).toThrow();
  expect(() =>
    adoptedMissionProtocolAuthority(registry, requirement, { ...inputs, targetCatalog: {} }),
  ).toThrow();
});

test("does not broaden adoption to another owner, version or lifecycle", () => {
  for (const changed of [
    { slug: "other" },
    { major: 4 },
    { status: "candidate" },
    { sourceRepository: "libre-ai/other" },
  ]) {
    expect(() =>
      adoptedMissionProtocolAuthority(registry, { ...requirement, ...changed }, inputs),
    ).toThrow();
  }
});

test("rejects another candidate source even when its fields are structurally valid", () => {
  for (const changed of [
    { sourceRevision: "0".repeat(40) },
    { sha256: "0".repeat(64) },
    { sourcePath: "docs/apps/other.md" },
    { sourceRepository: "libre-ai/other" },
  ]) {
    const other = { ...registry, entries: [{ ...registry.entries[0], ...changed }] };
    expect(() => adoptedMissionProtocolAuthority(other, requirement, inputs)).toThrow();
  }
});
