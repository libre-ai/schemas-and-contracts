import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";

export interface ContractValidationIssue {
  instancePath: string;
  schemaPath: string;
  keyword: string;
}

export type ContractValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ContractValidationIssue[] };

function safeIssues(errors: ErrorObject[] | null | undefined): ContractValidationIssue[] {
  return (errors ?? []).map((error) => ({
    instancePath: error.instancePath || "/",
    schemaPath: error.schemaPath,
    keyword: error.keyword,
  }));
}

export class ContractNotFoundError extends Error {
  constructor(readonly schemaName: string) {
    super(`Unknown canonical contract: ${schemaName}`);
    this.name = "ContractNotFoundError";
  }
}

export class ContractValidationError extends Error {
  constructor(
    readonly schemaName: string,
    readonly issues: ContractValidationIssue[],
  ) {
    super(`Contract validation failed for ${schemaName}`);
    this.name = "ContractValidationError";
  }
}

export class JsonSchemaContractRegistry {
  readonly #validators: ReadonlyMap<string, ValidateFunction>;

  private constructor(validators: ReadonlyMap<string, ValidateFunction>) {
    this.#validators = validators;
  }

  static async load(schemaDirectory: string): Promise<JsonSchemaContractRegistry> {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    const schemas = new Map<string, Record<string, unknown>>();

    for await (const relativePath of new Bun.Glob("*.json").scan({
      cwd: schemaDirectory,
      onlyFiles: true,
    })) {
      const schemaName = relativePath;
      const schema = (await Bun.file(resolve(schemaDirectory, relativePath)).json()) as Record<
        string,
        unknown
      >;
      schemas.set(schemaName, schema);
      ajv.addSchema(schema);
    }

    const validators = new Map<string, ValidateFunction>();
    for (const [schemaName, schema] of schemas) {
      const schemaId = schema.$id;
      if (typeof schemaId !== "string") throw new Error(`${schemaName}: missing canonical $id`);
      const validator = ajv.getSchema(schemaId);
      if (!validator) throw new Error(`${schemaName}: schema did not compile`);
      validators.set(schemaName, validator);
    }

    return new JsonSchemaContractRegistry(validators);
  }

  schemaNames(): string[] {
    return [...this.#validators.keys()].sort();
  }

  validate(schemaName: string, value: unknown): ContractValidationResult<unknown> {
    const validator = this.#validators.get(schemaName);
    if (!validator) throw new ContractNotFoundError(schemaName);
    if (validator(value)) return { ok: true, value };
    return { ok: false, issues: safeIssues(validator.errors) };
  }

  assert(schemaName: string, value: unknown): void {
    const result = this.validate(schemaName, value);
    if (!result.ok) throw new ContractValidationError(schemaName, result.issues);
  }
}

/**
 * The schema set shipped WITH the package (`schemas/`, vendored byte-exact
 * from `contracts/schemas` by `scripts/sync-schemas.ts` and gated in CI). A
 * published tarball has no repository around it, so the default load path
 * must never reach outside the package.
 */
function packagedSchemaDirectory(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../schemas");
}

export async function loadCanonicalContractRegistry(
  repositoryRoot?: string,
): Promise<JsonSchemaContractRegistry> {
  const schemaDirectory =
    repositoryRoot === undefined
      ? packagedSchemaDirectory()
      : resolve(repositoryRoot, "contracts/schemas");
  return JsonSchemaContractRegistry.load(schemaDirectory);
}
