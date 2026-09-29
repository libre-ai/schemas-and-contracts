/** Exercise the executable gate without adding its coverage domain to unrelated
 * cryptographic suites; the gate has its own blocking coverage recipe. */
export async function runSpecificationLockGate(): Promise<number> {
  const child = Bun.spawn([process.execPath, "tools/quality/check-specification-lock.ts"], {
    stdout: "ignore",
    stderr: "inherit",
  });
  return await child.exited;
}
