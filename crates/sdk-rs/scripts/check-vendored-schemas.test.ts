import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const script = resolve(import.meta.dir, "check-vendored-schemas.ts");

test("write refuses empty authority and extras without reporting a byte-exact projection", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "rust-schema-drift-"));
  const crate = resolve(root, "crates/sdk-rs");
  try {
    await mkdir(resolve(root, "contracts/schemas"), { recursive: true });
    await mkdir(resolve(crate, "schemas"), { recursive: true });
    await writeFile(resolve(crate, "schemas/stale.json"), "old\n");
    for (const populated of [false, true]) {
      if (populated) await writeFile(resolve(root, "contracts/schemas/current.json"), "{}\n");
      const child = Bun.spawn([process.execPath, script, "--write"], {
        cwd: crate,
        stdout: "pipe",
        stderr: "pipe",
      });
      const [exit, stdout] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      expect(exit).not.toBe(0);
      expect(stdout).not.toContain("byte-exact");
      expect(await Bun.file(resolve(crate, "schemas/current.json")).exists()).toBe(false);
      expect(await readFile(resolve(crate, "schemas/stale.json"), "utf8")).toBe("old\n");
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
