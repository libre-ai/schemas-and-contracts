import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import type { SpecificationLockInput } from "./specification-lock";
import { specificationLockDocumentPaths } from "./specification-lock";

const MAX_FILE_BYTES = 8 * 1024 * 1024;

async function checkedBytes(root: string, relative: string): Promise<Uint8Array> {
  const path = resolve(root, relative);
  if ((await realpath(path)) !== path) throw new Error("Indirect input");
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) throw new Error("Invalid input size");
    const bytes = await file.readFile();
    if (bytes.byteLength > MAX_FILE_BYTES) throw new Error("Input grew beyond limit");
    return bytes;
  } finally {
    await file.close();
  }
}

export async function readSpecificationLockInputs(
  directory: string,
): Promise<SpecificationLockInput> {
  const root = await realpath(resolve(directory));
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const evidence: unknown = JSON.parse(
    decoder.decode(
      await checkedBytes(root, "docs/reviews/build-brief-missions-specification-lock.json"),
    ),
  );
  const documents = new Map<string, Uint8Array>();
  for (const path of specificationLockDocumentPaths(evidence))
    documents.set(path, await checkedBytes(root, path));
  const targetCatalog: unknown = JSON.parse(
    decoder.decode(await checkedBytes(root, "contracts/catalog.v1.json")),
  );
  return { targetCatalog, evidence, documents };
}
