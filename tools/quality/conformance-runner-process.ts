// One isolated run of an external implementation, for the conformance runner.
//
// Protocol of the child, launched as `sh -c <command>`:
// - working directory: a fresh private directory under the system temporary directory, holding
//   only the files the vector names in `data` (paths relative to the vector's directory); the
//   vector file and its expectation are never copied;
// - environment: PATH alone;
// - stdin: `{"kind": string, "input": unknown, "dir": string}`, `dir` being that directory;
// - stdout: one strict JSON object, at most 1 MiB, `{"outcome": "accept" | "reject" |
//   "unsupported", "code"?: string, "errors"?: [{"keyword": string, "instancePath": string}],
//   ...members proper to the kind}`;
// - exit code 0, within the time limit.
//
// Anything else is `blocked`, with the cause and the limit named. The child's stderr is
// discarded and its stdout is never echoed, so no cause can carry implementation output.
//
// The shell leads a process group of its own; that group is killed at the time limit, on
// oversized output and after every exit, so no descendant outlives its case. The private
// directory is removed in every issue, after the owner's rights are given back to each of its
// directories (links not followed); a directory that still cannot be removed is a named
// `blocked`, never an exception, so the results of the other vectors are kept.
//
// The isolation is hygiene, not a boundary: an implementation that reads the vectors elsewhere on
// the disk is not prevented, and a descendant that leaves the group (its own setsid) escapes the
// kill.

import { chmod, copyFile, lstat, mkdir, mkdtemp, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";
import { parseStrictJson } from "./policy-core-raw-inputs";

/** Cap of the child's standard output, and of one vector file. */
export const OUTPUT_MAX_OCTETS = 1_048_576;

export type CaseOutcome =
  | { kind: "response"; response: Record<string, unknown> }
  | { kind: "blocked"; cause: string };

/** A name the discovery treats as a vector file or as a near miss of one. */
export function namesVectorFile(name: string): boolean {
  return /vector/i.test(name);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Null when every data path may be copied; otherwise the cause that blocks the case. */
async function dataDefect(vectorDir: string, data: readonly string[]): Promise<string | null> {
  for (const path of data) {
    const segments = path.split("/");
    if (isAbsolute(path) || segments.includes(".."))
      return "data path is absolute or contains '..'";
    if (namesVectorFile(basename(path))) return "data path names a vector file";
  }
  for (const path of data) {
    const segments = path.split("/");
    let current = vectorDir;
    for (const [index, segment] of segments.entries()) {
      current = join(current, segment);
      let stats: Awaited<ReturnType<typeof lstat>>;
      try {
        stats = await lstat(current);
      } catch {
        return "unreadable data";
      }
      if (stats.isSymbolicLink()) return "data path traverses or designates a symbolic link";
      const last = index === segments.length - 1;
      if (last ? !stats.isFile() : !stats.isDirectory()) return "unreadable data";
    }
  }
  return null;
}

async function copyData(vectorDir: string, data: readonly string[], dir: string): Promise<boolean> {
  try {
    for (const path of data) {
      const destination = join(dir, path);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(join(vectorDir, path), destination);
    }
    return true;
  } catch {
    return false;
  }
}

/** SIGKILL to the child's whole process group; a group already gone is not an error. */
function killGroup(pid: number): void {
  try {
    // A negative pid addresses the group. POSIX does not reuse a pid while a group of that id
    // exists, so after the leader is reaped this reaches its descendants or nothing.
    process.kill(-pid, "SIGKILL");
  } catch {
    // ESRCH: no process is left in the group.
  }
}

async function launch(
  command: string,
  dir: string,
  kind: string,
  input: unknown,
  timeoutMs: number,
): Promise<CaseOutcome> {
  const child = Bun.spawn(["sh", "-c", command], {
    cwd: dir,
    env: { PATH: process.env.PATH ?? "" },
    stdin: "pipe",
    stdout: "pipe",
    stderr: "ignore",
    // setsid(): the shell leads a group of its own, so its descendants can be killed with it.
    detached: true,
  });
  const reader = child.stdout.getReader();
  const stopped: { by: "timeout" | "oversized" | null } = { by: null };
  const stop = (by: "timeout" | "oversized"): void => {
    stopped.by ??= by;
    killGroup(child.pid);
    // A grandchild outside the group may still hold the pipe open: stop reading.
    void reader.cancel().catch(() => undefined);
  };
  const timer = setTimeout(() => stop("timeout"), timeoutMs);
  const chunks: Uint8Array[] = [];
  let size = 0;
  let exit: number;
  try {
    try {
      child.stdin.write(JSON.stringify({ kind, input, dir }));
      // Not awaited: a child that never reads its stdin must not hold the runner.
      void Promise.resolve(child.stdin.end()).catch(() => undefined);
    } catch {
      // The child closed its stdin or already exited; its exit code and output decide.
    }
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > OUTPUT_MAX_OCTETS) {
        stop("oversized");
        break;
      }
      chunks.push(value);
    }
    exit = await child.exited;
  } finally {
    clearTimeout(timer);
    // In every issue: a descendant left behind would outlive the case and race the removal.
    killGroup(child.pid);
  }
  if (stopped.by === "timeout")
    return { kind: "blocked", cause: `timeout: exceeded ${timeoutMs} ms` };
  if (stopped.by === "oversized")
    return { kind: "blocked", cause: `output above ${OUTPUT_MAX_OCTETS} octets` };
  if (exit !== 0) return { kind: "blocked", cause: `exit code ${exit}` };
  let response: unknown;
  try {
    response = parseStrictJson(Buffer.concat(chunks));
  } catch {
    return { kind: "blocked", cause: "non-JSON output" };
  }
  if (!isRecord(response)) return { kind: "blocked", cause: "non-JSON output: not an object" };
  return { kind: "response", response };
}

/**
 * Gives the owner full rights back on every directory of the tree, so that a child which
 * removed them (`chmod 000`) cannot keep its entries. Symbolic links are never followed: a
 * link inside the tree is left as it is, and only removed with the tree.
 */
async function restoreDirectoryModes(path: string): Promise<void> {
  try {
    if (!(await lstat(path)).isDirectory()) return;
    await chmod(path, 0o700);
    for (const entry of await readdir(path, { withFileTypes: true }))
      if (entry.isDirectory()) await restoreDirectoryModes(join(path, entry.name));
  } catch {
    // Whatever stays unreadable is reported by the removal that follows.
  }
}

/** True when the private directory is gone. */
async function removePrivateDirectory(dir: string): Promise<boolean> {
  await restoreDirectoryModes(dir);
  try {
    await rm(dir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

async function caseIn(
  dir: string,
  command: string,
  vectorDir: string,
  kind: string,
  input: unknown,
  data: readonly string[],
  timeoutMs: number,
): Promise<CaseOutcome> {
  try {
    if (!(await copyData(vectorDir, data, dir)))
      return { kind: "blocked", cause: "unreadable data" };
    return await launch(command, dir, kind, input, timeoutMs);
  } catch {
    // Spawning failed (no shell, no pipe): the case is not judged, the run goes on.
    return { kind: "blocked", cause: "implementation not launched" };
  }
}

/** Never throws: every defect of the case, its removal included, is a named `blocked`. */
export async function runCase(
  command: string,
  vectorDir: string,
  kind: string,
  input: unknown,
  data: readonly string[],
  timeoutMs: number,
): Promise<CaseOutcome> {
  const defect = await dataDefect(vectorDir, data);
  if (defect !== null) return { kind: "blocked", cause: defect };
  let created: string;
  try {
    created = await mkdtemp(join(tmpdir(), "conformance-case-"));
  } catch {
    return { kind: "blocked", cause: "private directory not created" };
  }
  let outcome: CaseOutcome;
  try {
    // Resolved, so that `dir` on stdin is the very path the child sees as its working directory.
    const dir = await realpath(created);
    outcome = await caseIn(dir, command, vectorDir, kind, input, data, timeoutMs);
  } catch {
    outcome = { kind: "blocked", cause: "private directory not created" };
  }
  if (!(await removePrivateDirectory(created)))
    return { kind: "blocked", cause: "private directory not removed" };
  return outcome;
}
