import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface JsonSchema {
  $defs?: Record<string, JsonSchema | boolean>;
  $ref?: string;
  additionalProperties?: boolean | JsonSchema;
  allOf?: Array<JsonSchema | boolean>;
  anyOf?: Array<JsonSchema | boolean>;
  const?: unknown;
  enum?: unknown[];
  items?: JsonSchema | boolean;
  oneOf?: Array<JsonSchema | boolean>;
  properties?: Record<string, JsonSchema | boolean>;
  required?: string[];
  title?: string;
  type?: string | string[];
  if?: JsonSchema;
  [key: string]: unknown;
}

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// The canonical source is the contracts AUTHORITY at a pinned revision,
// consumed as a GitHub git-dep (I-05: the vendored copy under schemas/ is a
// verified projection; the pin lives in package.json + bun.lock).
const schemaRoot = resolve(packageRoot, "../../contracts/schemas");
const generatedRoot = resolve(packageRoot, "src/generated");
const checkOnly = process.argv.includes("--check");
const banner = `/**
 * SPDX-FileCopyrightText: 2026 Libre AI contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * Generated from canonical Libre AI JSON Schema.
 * DO NOT EDIT: run \`bun run generate\` in packages/contracts.
 * Runtime schema validation remains authoritative.
 */\n`;

function sha256(value: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(value);
  return hasher.digest("hex");
}

function typeName(value: string): string {
  const words = value.match(/[A-Za-z]+|\d+/g) ?? ["Contract"];
  const name = words
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join("");
  return /^\d/.test(name) ? `Contract${name}` : name;
}

function propertyName(value: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) ? value : JSON.stringify(value);
}

function literal(value: unknown): string {
  return value === undefined ? "unknown" : JSON.stringify(value);
}

function resolveReference(
  reference: string,
  currentSchemaName: string,
  documents: ReadonlyMap<string, JsonSchema>,
): { schema: JsonSchema | boolean; schemaName: string; key: string } {
  const [relativeName, fragment = ""] = reference.split("#", 2);
  const schemaName = relativeName || currentSchemaName;
  const document = documents.get(schemaName);
  if (!document) throw new Error(`${currentSchemaName}: unknown schema reference ${reference}`);
  let target: unknown = document;
  if (fragment) {
    if (!fragment.startsWith("/"))
      throw new Error(`${currentSchemaName}: unsupported fragment ${reference}`);
    for (const segment of fragment
      .slice(1)
      .split("/")
      .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))) {
      if (typeof target !== "object" || target === null || !(segment in target)) {
        throw new Error(`${currentSchemaName}: unknown schema pointer ${reference}`);
      }
      target = (target as Record<string, unknown>)[segment];
    }
  }
  if (
    typeof target !== "boolean" &&
    (typeof target !== "object" || target === null || Array.isArray(target))
  ) {
    throw new Error(`${currentSchemaName}: reference does not target a schema ${reference}`);
  }
  return { schema: target as JsonSchema | boolean, schemaName, key: `${schemaName}#${fragment}` };
}

function renderType(
  schema: JsonSchema | boolean,
  schemaName: string,
  documents: ReadonlyMap<string, JsonSchema>,
  stack = new Set<string>(),
): string {
  if (typeof schema === "boolean") return schema ? "unknown" : "never";
  if (schema.$ref) {
    const target = resolveReference(schema.$ref, schemaName, documents);
    if (stack.has(target.key)) {
      if (
        typeof target.schema !== "boolean" &&
        target.schema.$comment === "libre-ai-static-projection-recursion=opaque"
      ) {
        return "unknown";
      }
      throw new Error(`${schemaName}: recursive references are not projectable`);
    }
    const nextStack = new Set(stack);
    nextStack.add(target.key);
    return renderType(target.schema, target.schemaName, documents, nextStack);
  }
  if ("const" in schema) return literal(schema.const);
  if (schema.enum) return schema.enum.map(literal).join(" | ") || "never";
  if (Array.isArray(schema.type)) {
    return schema.type
      .map((type) => renderType({ ...schema, type }, schemaName, documents, stack))
      .join(" | ");
  }

  const intersections: string[] = [];
  if (schema.allOf) {
    intersections.push(
      ...schema.allOf
        .filter((entry) => typeof entry === "boolean" || !entry.if)
        .map((entry) => renderType(entry, schemaName, documents, stack)),
    );
  }
  const unions = schema.oneOf ?? schema.anyOf;
  if (unions) {
    intersections.unshift(
      `(${unions.map((entry) => renderType(entry, schemaName, documents, stack)).join(" | ")})`,
    );
  }

  let base: string | undefined;
  switch (schema.type) {
    case "null":
      base = "null";
      break;
    case "boolean":
      base = "boolean";
      break;
    case "integer":
    case "number":
      base = "number";
      break;
    case "string":
      base = "string";
      break;
    case "array": {
      const item = schema.items
        ? renderType(schema.items, schemaName, documents, stack)
        : "unknown";
      base = `Array<${item}>`;
      break;
    }
    default:
      if (
        schema.type === "object" ||
        schema.properties ||
        schema.additionalProperties !== undefined
      ) {
        const required = new Set(schema.required ?? []);
        const fields = Object.entries(schema.properties ?? {}).map(
          ([name, property]) =>
            `${propertyName(name)}${required.has(name) ? "" : "?"}: ${renderType(property, schemaName, documents, stack)};`,
        );
        if (typeof schema.additionalProperties === "object") {
          fields.push(
            `[key: string]: ${renderType(schema.additionalProperties, schemaName, documents, stack)};`,
          );
        } else if (schema.additionalProperties !== false) {
          fields.push("[key: string]: unknown;");
        }
        base = `{ ${fields.join(" ")} }`;
      }
      break;
  }
  if (base) intersections.unshift(base);
  return intersections.length > 0 ? intersections.join(" & ") : "unknown";
}

async function format(directory: string): Promise<void> {
  const biome = resolve(packageRoot, "../../node_modules/.bin/biome");
  const result = Bun.spawnSync({
    cmd: [
      biome,
      "format",
      "--write",
      "--config-path",
      resolve(packageRoot, "biome.json"),
      directory,
    ],
    cwd: packageRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString() || "Biome formatting failed");
}

const schemaNames = (await readdir(schemaRoot))
  .filter((name) => name.endsWith(".schema.json"))
  .sort();
const sources = new Map<string, string>();
const documents = new Map<string, JsonSchema>();
for (const schemaName of schemaNames) {
  const source = await readFile(resolve(schemaRoot, schemaName), "utf8");
  sources.set(schemaName, source);
  documents.set(schemaName, JSON.parse(source) as JsonSchema);
}

const temporaryRoot = await mkdtemp(join(tmpdir(), "libre-ai-contract-types-"));
try {
  const generatedDirectory = join(temporaryRoot, "generated");
  await mkdir(generatedDirectory, { recursive: true });
  const manifest: Array<{ schema: string; schemaSha256: string; declaration: string }> = [];

  for (const schemaName of schemaNames) {
    const schema = documents.get(schemaName);
    const source = sources.get(schemaName);
    if (!schema || source === undefined) throw new Error(`${schemaName}: schema was not loaded`);
    const declarationName = schemaName.replace(/\.schema\.json$/, ".d.ts");
    const declarations: string[] = [];
    if (schema.title || schema.type || schema.oneOf || schema.anyOf) {
      declarations.push(
        `export type ${typeName(schema.title ?? schemaName)} = ${renderType(schema, schemaName, documents)};`,
      );
    }
    for (const [definitionName, definition] of Object.entries(schema.$defs ?? {})) {
      declarations.push(
        `export type ${typeName(definitionName)} = ${renderType(definition, schemaName, documents)};`,
      );
    }
    await writeFile(
      join(generatedDirectory, declarationName),
      `${banner}\n${declarations.join("\n\n")}\n`,
    );
    manifest.push({
      schema: schemaName,
      schemaSha256: sha256(source),
      declaration: declarationName,
    });
  }

  await writeFile(
    join(generatedDirectory, "manifest.json"),
    `${JSON.stringify({ schemaVersion: "libre-ai.generated-contract-types.v1", entries: manifest }, null, 2)}\n`,
  );
  await format(generatedDirectory);

  const outputNames = [
    ...schemaNames.map((name) => name.replace(/\.schema\.json$/, ".d.ts")),
    "manifest.json",
  ];
  const differences: string[] = [];
  for (const outputName of outputNames) {
    const expected = await readFile(join(generatedDirectory, outputName), "utf8");
    if (checkOnly) {
      try {
        const actual = await readFile(join(generatedRoot, outputName), "utf8");
        if (actual !== expected) differences.push(outputName);
      } catch {
        differences.push(outputName);
      }
    } else {
      await mkdir(generatedRoot, { recursive: true });
      await writeFile(join(generatedRoot, outputName), expected);
    }
  }

  if (differences.length > 0) {
    for (const outputName of differences)
      console.error(`Generated contract type differs: ${outputName}`);
    process.exit(1);
  }
  console.log(
    `${checkOnly ? "Verified" : "Generated"} ${schemaNames.length} TypeScript contract projections`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
