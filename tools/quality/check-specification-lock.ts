import { specificationLockFailures } from "./specification-lock";
import { readSpecificationLockInputs } from "./specification-lock-inputs";

async function main(): Promise<void> {
  try {
    const failures = specificationLockFailures(
      await readSpecificationLockInputs(process.argv[2] ?? "."),
    );
    if (failures.length > 0) {
      console.error(failures.join("; "));
      process.exitCode = 1;
      return;
    }
    console.log("Specification lock verified; runtime admission not granted");
  } catch {
    // The filesystem and parse exceptions may contain host paths or input data.
    console.error("Unreadable or indirect specification input");
    process.exitCode = 1;
  }
}

await main();
