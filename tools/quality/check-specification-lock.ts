import { pinnedPostLockAdditions, specificationLockFailures } from "./specification-lock";
import { readSpecificationLockInputs } from "./specification-lock-inputs";

async function main(): Promise<void> {
  try {
    const input = await readSpecificationLockInputs(process.argv[2] ?? ".");
    const failures = specificationLockFailures(input);
    if (failures.length > 0) {
      console.error(failures.join("; "));
      process.exitCode = 1;
      return;
    }
    const catalog = input.targetCatalog as { contracts: unknown[] };
    const additions = pinnedPostLockAdditions(input.postLockAdditions) ?? [];
    console.log(
      `Specification lock verified; runtime admission not granted (${catalog.contracts.length} catalog entries: ${catalog.contracts.length - additions.length} reviewed baseline, ${additions.length} registered post-lock)`,
    );
  } catch {
    // The filesystem and parse exceptions may contain host paths or input data.
    console.error("Unreadable or indirect specification input");
    process.exitCode = 1;
  }
}

await main();
