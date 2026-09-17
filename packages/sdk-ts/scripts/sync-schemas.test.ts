import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareSchemaDirectories, syncSchemaDirectories } from "./sync-schemas";

// The published SDK vendors the canonical schemas (a package must not reach
// outside its own tarball). The sync script keeps the vendored copy byte-exact
// against contracts/schemas, and its --check mode is the CI drift gate.

async function makeDirs(): Promise<{ src: string; dst: string; cleanup: () => Promise<void> }> {
  const src = await mkdtemp(join(tmpdir(), "schemas-src-"));
  const dst = await mkdtemp(join(tmpdir(), "schemas-dst-"));
  return {
    src,
    dst,
    cleanup: async () => {
      await rm(src, { recursive: true, force: true });
      await rm(dst, { recursive: true, force: true });
    },
  };
}

describe("sync-schemas", () => {
  test("sync copies every schema and check passes on identical directories", async () => {
    const { src, dst, cleanup } = await makeDirs();
    try {
      await writeFile(join(src, "a.schema.json"), '{"$id":"a"}\n');
      await writeFile(join(src, "b.schema.json"), '{"$id":"b"}\n');
      await syncSchemaDirectories(src, dst);
      expect(await compareSchemaDirectories(src, dst)).toEqual([]);
    } finally {
      await cleanup();
    }
  });

  test("check reports a byte-level drift", async () => {
    const { src, dst, cleanup } = await makeDirs();
    try {
      await writeFile(join(src, "a.schema.json"), '{"$id":"a"}\n');
      await syncSchemaDirectories(src, dst);
      await writeFile(join(dst, "a.schema.json"), '{"$id":"tampered"}\n');
      const issues = await compareSchemaDirectories(src, dst);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toContain("a.schema.json");
      expect(issues[0]).toContain("differs");
    } finally {
      await cleanup();
    }
  });

  test("check reports missing and extra files", async () => {
    const { src, dst, cleanup } = await makeDirs();
    try {
      await writeFile(join(src, "only-in-src.schema.json"), "{}\n");
      await writeFile(join(dst, "only-in-dst.schema.json"), "{}\n");
      const issues = await compareSchemaDirectories(src, dst);
      expect(
        issues.some((issue) => issue.includes("only-in-src") && issue.includes("missing")),
      ).toBe(true);
      expect(issues.some((issue) => issue.includes("only-in-dst") && issue.includes("extra"))).toBe(
        true,
      );
    } finally {
      await cleanup();
    }
  });

  test("sync removes files that no longer exist in the source", async () => {
    const { src, dst, cleanup } = await makeDirs();
    try {
      await writeFile(join(dst, "stale.schema.json"), "{}\n");
      await writeFile(join(src, "kept.schema.json"), "{}\n");
      await syncSchemaDirectories(src, dst);
      expect(await compareSchemaDirectories(src, dst)).toEqual([]);
    } finally {
      await cleanup();
    }
  });
});

for (const state of ["missing", "empty"] as const) {
  test(`refuses ${state} authority before changing vendored bytes`, async () => {
    const { src, dst, cleanup } = await makeDirs();
    try {
      await writeFile(join(dst, "retained.schema.json"), '{"retained":true}\n');
      const authority = state === "missing" ? join(src, "absent") : src;
      await expect(syncSchemaDirectories(authority, dst)).rejects.toThrow();
      expect(await Bun.file(join(dst, "retained.schema.json")).text()).toBe('{"retained":true}\n');
      await expect(compareSchemaDirectories(authority, dst)).rejects.toThrow();
    } finally {
      await cleanup();
    }
  });
}
