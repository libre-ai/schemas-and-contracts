import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import registry from "../../contracts/catalog-post-lock-additions.v1.json";
import evidence from "../../docs/reviews/build-brief-missions-specification-lock.json";
import baseline from "../../docs/reviews/evidence/build-brief-missions-lock/baseline-catalog.json";
import {
  POST_LOCK_ADDITIONS_PATH,
  specificationLockDocumentPaths,
  specificationLockFailures,
} from "./specification-lock";

const registryBytes = readFileSync(POST_LOCK_ADDITIONS_PATH);

/** The reviewed transition alone, before any post-lock addition. */
function transitionedBaseline(): typeof baseline {
  const result = structuredClone(baseline);
  const admitted = new Set(evidence.transitions.map((entry) => entry.id));
  for (const entry of result.contracts) {
    if (admitted.has(entry.id)) {
      entry.status = "locked";
      delete entry.review;
    }
  }
  return result;
}

function admittedCatalog(): typeof baseline {
  const result = transitionedBaseline();
  result.contracts.push(
    ...(registry.additions.map((addition) => addition.entry) as typeof result.contracts),
  );
  return result;
}

function documents(): Map<string, Uint8Array> {
  const result = new Map<string, Uint8Array>();
  for (const path of [
    evidence.baselineCatalog.path,
    evidence.consumerMatrix.path,
    ...Object.keys(evidence.preservedFiles),
    ...evidence.roleVerdicts.map((entry) => entry.path),
  ]) {
    result.set(path, readFileSync(path));
  }
  return result;
}

function check(
  target: unknown = admittedCatalog(),
  proof: unknown = evidence,
  inputs: ReadonlyMap<string, Uint8Array> = documents(),
  additions: Uint8Array = registryBytes,
): string[] {
  return specificationLockFailures({
    targetCatalog: target,
    evidence: proof,
    documents: inputs,
    postLockAdditions: additions,
  });
}

describe("the fifteen-authority specification lock", () => {
  test("admits the exact reviewed transition without granting runtime authority", () => {
    expect(check()).toEqual([]);
    expect(evidence.runtimeAdmission).toBe("not-granted");
  });

  test("rejects the old catalog rather than claiming a transition happened", () => {
    expect(check(baseline).length).toBeGreaterThan(0);
  });

  test("parses only the baseline bytes hashed on the first document read", () => {
    const target = admittedCatalog();
    const fabricated = structuredClone(baseline);
    for (const catalog of [target, fabricated]) {
      const extra = catalog.contracts.find((entry) => entry.id === "retention-policy-v3");
      if (!extra) throw new Error("Missing unrelated candidate");
      extra.status = "locked";
      delete extra.review;
    }
    let baselineReads = 0;
    class ChangingDocuments extends Map<string, Uint8Array> {
      override get(path: string): Uint8Array | undefined {
        if (path === evidence.baselineCatalog.path && ++baselineReads > 1)
          return new TextEncoder().encode(JSON.stringify(fabricated));
        return super.get(path);
      }
    }
    expect(check(target, evidence, new ChangingDocuments(documents())).length).toBeGreaterThan(0);
    expect(baselineReads).toBe(1);
  });

  test("copies the verified baseline before another document read can mutate its buffer", () => {
    const inputs = documents();
    const original = inputs.get(evidence.baselineCatalog.path);
    if (!original) throw new Error("Missing baseline bytes");
    class MutatingDocuments extends Map<string, Uint8Array> {
      override get(path: string): Uint8Array | undefined {
        if (path === evidence.consumerMatrix.path) original?.fill(32);
        return super.get(path);
      }
    }
    expect(check(admittedCatalog(), evidence, new MutatingDocuments(inputs))).toEqual([]);
    expect(original.every((byte) => byte === 32)).toBe(true);
  });

  test("rejects promotion of any six unrelated candidates", () => {
    const admitted = new Set(evidence.transitions.map((entry) => entry.id));
    const remaining = baseline.contracts.filter(
      (entry) => entry.status === "candidate" && !admitted.has(entry.id),
    );
    expect(remaining).toHaveLength(6);
    for (const extra of remaining) {
      const target = admittedCatalog();
      const row = target.contracts.find((entry) => entry.id === extra.id);
      if (!row) throw new Error("Missing independent baseline row");
      row.status = "locked";
      delete row.review;
      expect(check(target).length).toBeGreaterThan(0);
    }
  });

  test("refuses one missing transition even when all role verdicts are present", () => {
    for (const item of evidence.transitions) {
      const target = admittedCatalog();
      const index = target.contracts.findIndex((entry) => entry.id === item.id);
      const original = baseline.contracts[index];
      if (!original) throw new Error("Missing baseline");
      target.contracts[index] = structuredClone(original);
      expect(check(target).length).toBeGreaterThan(0);
    }
  });

  test("rejects content, ownership and consumer changes at the same counts", () => {
    for (const field of ["path", "owners", "consumers", "classification", "compatibility"]) {
      const target = admittedCatalog();
      const first = target.contracts[0];
      if (!first) throw new Error("Missing baseline");
      Object.assign(first, {
        [field]: Array.isArray(first[field as keyof typeof first]) ? ["other"] : "other",
      });
      expect(check(target).length).toBeGreaterThan(0);
    }
  });

  test("rejects missing evidence and a purported runtime admission", () => {
    for (const proof of [
      null,
      {},
      { ...evidence, runtimeAdmission: "granted" },
      { ...evidence, scope: "runtime" },
    ]) {
      expect(check(admittedCatalog(), proof).length).toBeGreaterThan(0);
    }
  });

  test("never reads caller fields after verifying a serialized proof", () => {
    const spoofed = {
      ...evidence,
      preservedFiles: { "../outside": "untrusted" },
      toJSON: () => evidence,
    };
    expect(specificationLockDocumentPaths(spoofed)).not.toContain("../outside");
    expect(check(admittedCatalog(), spoofed)).toEqual([]);
  });

  test("refuses malformed proof before exposing document paths", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    for (const malformed of [undefined, cyclic, 1n, [], "proof", null]) {
      expect(
        specificationLockFailures({
          targetCatalog: admittedCatalog(),
          evidence: malformed,
          documents: documents(),
          postLockAdditions: registryBytes,
        }).length,
      ).toBeGreaterThan(0);
      expect(() => specificationLockDocumentPaths(malformed)).toThrow();
    }
  });

  test("rejects absent, shortened and altered preservation inventories", () => {
    const files = { ...evidence.preservedFiles };
    const first = Object.keys(files)[0];
    if (!first) throw new Error("Empty baseline inventory");
    delete files[first as keyof typeof files];
    for (const preservedFiles of [{}, files]) {
      expect(check(admittedCatalog(), { ...evidence, preservedFiles }).length).toBeGreaterThan(0);
    }
    const altered = documents();
    const bytes = altered.get(first);
    if (!bytes) throw new Error("Missing baseline bytes");
    altered.set(first, new Uint8Array([...bytes, 32]));
    expect(check(admittedCatalog(), evidence, altered).length).toBeGreaterThan(0);
  });

  test("refuses missing or altered role records and a fabricated baseline", () => {
    for (const role of evidence.roleVerdicts) {
      const missing = documents();
      missing.delete(role.path);
      expect(check(admittedCatalog(), evidence, missing).length).toBeGreaterThan(0);
      const altered = documents();
      const record = JSON.parse(new TextDecoder().decode(altered.get(role.path)));
      record.verdict = "reject";
      altered.set(role.path, new TextEncoder().encode(JSON.stringify(record)));
      expect(check(admittedCatalog(), evidence, altered).length).toBeGreaterThan(0);
    }
    const fabricated = documents();
    fabricated.set(
      evidence.baselineCatalog.path,
      new TextEncoder().encode(JSON.stringify(admittedCatalog())),
    );
    expect(check(admittedCatalog(), evidence, fabricated).length).toBeGreaterThan(0);
  });

  test("requires the byte-exact matrix rather than silently omitting consumer gaps", () => {
    const missing = documents();
    missing.delete(evidence.consumerMatrix.path);
    expect(check(admittedCatalog(), evidence, missing).length).toBeGreaterThan(0);
    expect(specificationLockDocumentPaths(evidence)).toContain(evidence.consumerMatrix.path);
  });
});

describe("the post-lock additions registry", () => {
  const encoder = new TextEncoder();
  function editedRegistry(change: (value: typeof registry) => void): Uint8Array {
    const value = structuredClone(registry);
    change(value);
    return encoder.encode(`${JSON.stringify(value, null, 2)}\n`);
  }

  test("admits the baseline transition followed by exactly the registered additions", () => {
    expect(registry.additions.length).toBeGreaterThan(0);
    expect(check()).toEqual([]);
  });

  test("refuses the transitioned baseline without the registered additions", () => {
    expect(check(transitionedBaseline())).toEqual([
      "Catalog differs from the exact fifteen-authority transition plus registered additions",
    ]);
  });

  test("refuses a catalog entry that the registry does not list", () => {
    const target = admittedCatalog();
    const unregistered = structuredClone(target.contracts.at(-1));
    if (!unregistered) throw new Error("Missing registered addition");
    unregistered.id = "unregistered-addition-v1";
    target.contracts.push(unregistered);
    expect(check(target)).toEqual([
      "Catalog differs from the exact fifteen-authority transition plus registered additions",
    ]);
  });

  test("refuses a registry edited without updating its pinned digest", () => {
    const extended = editedRegistry((value) => {
      const first = value.additions[0];
      if (!first) throw new Error("Missing registered addition");
      // A clone keeps the registry's element type, which is now a union of entry shapes.
      const copy = structuredClone(first);
      copy.entry.id = "unregistered-addition-v1";
      value.additions.push(copy);
    });
    const target = admittedCatalog();
    const unregistered = structuredClone(target.contracts.at(-1));
    if (!unregistered) throw new Error("Missing registered addition");
    unregistered.id = "unregistered-addition-v1";
    target.contracts.push(unregistered);
    expect(check(target, evidence, documents(), extended)).toEqual([
      "Unrecognized post-lock additions registry",
    ]);
    const emptied = editedRegistry((value) => {
      value.additions = [];
    });
    expect(check(transitionedBaseline(), evidence, documents(), emptied)).toEqual([
      "Unrecognized post-lock additions registry",
    ]);
    expect(check(admittedCatalog(), evidence, documents(), new Uint8Array())).toEqual([
      "Unrecognized post-lock additions registry",
    ]);
  });

  test("refuses a modified, removed or reordered baseline entry even with additions", () => {
    const modified = admittedCatalog();
    const first = modified.contracts[0];
    if (!first) throw new Error("Missing baseline entry");
    first.consumers = [...first.consumers, "unreviewed-consumer"];
    const removed = admittedCatalog();
    removed.contracts.splice(1, 1);
    const reordered = admittedCatalog();
    const [head, second] = reordered.contracts;
    if (!head || !second) throw new Error("Missing baseline entries");
    reordered.contracts[0] = second;
    reordered.contracts[1] = head;
    const additionFirst = admittedCatalog();
    const addition = additionFirst.contracts.pop();
    if (!addition) throw new Error("Missing registered addition");
    additionFirst.contracts.unshift(addition);
    for (const target of [modified, removed, reordered, additionFirst])
      expect(check(target)).toEqual([
        "Catalog differs from the exact fifteen-authority transition plus registered additions",
      ]);
  });

  test("hashes its own copy of the registry bytes", () => {
    const bytes = new Uint8Array(registryBytes);
    expect(check(admittedCatalog(), evidence, documents(), bytes)).toEqual([]);
    bytes[0] = 0x20;
    expect(check(admittedCatalog(), evidence, documents(), bytes)).toEqual([
      "Unrecognized post-lock additions registry",
    ]);
  });
});
