use schemars::schema::RootSchema;
use serde_json::{Map, Value};
use std::collections::{BTreeMap, BTreeSet};
use std::env;
use std::error::Error;
use std::fs;
use std::path::{Path, PathBuf};
use typify::{TypeDetails, TypeSpace, TypeSpaceSettings};

type BoxError = Box<dyn Error + Send + Sync>;

fn main() -> Result<(), BoxError> {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR")?);
    let schema_dir = manifest_dir.join("schemas").canonicalize()?;
    println!("cargo:rerun-if-changed={}", schema_dir.display());

    let mut schema_paths = fs::read_dir(&schema_dir)?
        .map(|entry| entry.map(|value| value.path()))
        .collect::<Result<Vec<_>, _>>()?;
    schema_paths.retain(|path| {
        path.extension()
            .is_some_and(|extension| extension == "json")
    });
    schema_paths.sort();

    let mut documents = BTreeMap::new();
    for path in &schema_paths {
        let canonical = path.canonicalize()?;
        let document: Value = serde_json::from_str(&fs::read_to_string(&canonical)?)?;
        documents.insert(canonical, document);
    }

    let output_dir = PathBuf::from(env::var("OUT_DIR")?);
    fs::write(
        output_dir.join("embedded_schemas.rs"),
        embedded_schema_source(&schema_paths, &documents)?,
    )?;
    fs::write(
        output_dir.join("generated_types.rs"),
        generated_type_source(&schema_paths, &documents)?,
    )?;

    Ok(())
}

fn embedded_schema_source(
    schema_paths: &[PathBuf],
    documents: &BTreeMap<PathBuf, Value>,
) -> Result<String, BoxError> {
    let mut source = String::from("pub const EMBEDDED_SCHEMAS: &[(&str, &str)] = &[\n");
    for path in schema_paths {
        let canonical = path.canonicalize()?;
        let name = file_name(&canonical)?;
        let document = serde_json::to_string(
            documents
                .get(&canonical)
                .ok_or_else(|| format!("schema not loaded: {}", canonical.display()))?,
        )?;
        source.push_str(&format!("    ({name:?}, {document:?}),\n"));
    }
    source.push_str("];\n");
    Ok(source)
}

fn generated_type_source(
    schema_paths: &[PathBuf],
    documents: &BTreeMap<PathBuf, Value>,
) -> Result<String, BoxError> {
    let mut source = String::from(
        "// Generated from canonical JSON Schema. Runtime validation remains authoritative.\n",
    );
    let mut projected_names = Vec::new();

    for path in schema_paths {
        let canonical = path.canonicalize()?;
        let name = file_name(&canonical)?;
        if name == "common.v1.schema.json" {
            continue;
        }

        let document = documents
            .get(&canonical)
            .ok_or_else(|| format!("schema not loaded: {}", canonical.display()))?;
        let projected = project_schema(document, &canonical, documents, &mut BTreeSet::new())?;
        let root_schema: RootSchema = serde_json::from_value(projected)?;
        let mut settings = TypeSpaceSettings::default();
        settings.with_struct_builder(false);
        let mut type_space = TypeSpace::new(&settings);
        type_space.add_root_schema(root_schema.clone())?;
        if has_duplicate_declarations(&type_space)? {
            // Fully expanded definitions can be discovered both as named roots
            // and inline structs. typify's bulk registration bypasses its normal
            // deduplication. Retry only the identical-struct collision case so
            // already-valid SDK projections retain their exact public output.
            let mut root_schema = root_schema;
            type_space = TypeSpace::new(&settings);
            for (name, definition) in std::mem::take(&mut root_schema.definitions) {
                type_space.add_type_with_name(&definition, Some(name))?;
            }
            type_space.add_root_schema(root_schema)?;
            if has_duplicate_declarations(&type_space)? {
                return Err("static projection still contains duplicate type declarations".into());
            }
        }

        let module_name = rust_module_name(name);
        source.push_str(&format!(
            "pub mod {module_name} {{\n#![allow(clippy::all, missing_docs)]\n{}\n}}\n",
            type_space.to_stream()
        ));
        projected_names.push(name.to_owned());
    }

    source.push_str("pub const GENERATED_TYPE_SCHEMA_NAMES: &[&str] = &[\n");
    for name in projected_names {
        source.push_str(&format!("    {name:?},\n"));
    }
    source.push_str("];\n");
    Ok(source)
}

fn has_duplicate_declarations(type_space: &TypeSpace) -> Result<bool, BoxError> {
    let mut declarations = BTreeMap::new();
    let mut duplicate_names = BTreeMap::new();
    for value in type_space.iter_types() {
        let signature = match value.details() {
            TypeDetails::Struct(details) => Some(
                details
                    .properties_info()
                    .map(|property| {
                        (
                            property.name.to_owned(),
                            property.type_id,
                            property.required,
                            property.description.map(str::to_owned),
                        )
                    })
                    .collect::<Vec<_>>(),
            ),
            TypeDetails::Enum(_) | TypeDetails::Newtype(_) => None,
            _ => continue,
        };
        if let Some(previous) = declarations.insert(value.name(), signature.clone()) {
            if signature.is_none() || signature != previous {
                return Err(format!(
                    "static projection has incompatible declarations named {}",
                    value.name()
                )
                .into());
            }
            *duplicate_names.entry(value.name()).or_insert(1_usize) += 1;
        }
    }
    if duplicate_names.is_empty() {
        return Ok(false);
    }
    // Compare complete emitted items, not only TypeDetails: serde attributes,
    // defaults, flattening, derives and visibility affect the generated API too.
    // This inspects typify's tokens; it never rewrites generated output.
    let mut items = Vec::new();
    let mut item = Vec::new();
    for token in type_space.to_stream() {
        let token = token.to_string();
        let complete = token == ";" || token.starts_with('{');
        item.push(token);
        if complete {
            items.push(std::mem::take(&mut item));
        }
    }
    if !item.is_empty() {
        return Err("cannot establish complete generated item boundaries".into());
    }
    for (name, count) in duplicate_names {
        let mut declarations = Vec::new();
        let mut implementations = BTreeMap::new();
        for item in &items {
            if item
                .windows(3)
                .any(|tokens| tokens == ["pub", "struct", name.as_str()])
            {
                declarations.push(item);
            } else if item.iter().any(|token| token == "impl")
                && item.iter().any(|token| {
                    token
                        .split(|c: char| !c.is_ascii_alphanumeric() && c != '_')
                        .any(|word| word == name)
                })
            {
                *implementations.entry(item).or_insert(0_usize) += 1;
            }
        }
        if declarations.len() != count
            || declarations.windows(2).any(|pair| pair[0] != pair[1])
            || implementations.values().any(|copies| *copies % count != 0)
        {
            return Err(format!("cannot prove identical generated declarations for {name}").into());
        }
    }
    Ok(true)
}

fn project_schema(
    value: &Value,
    current_path: &Path,
    documents: &BTreeMap<PathBuf, Value>,
    stack: &mut BTreeSet<String>,
) -> Result<Value, BoxError> {
    let document = documents
        .get(current_path)
        .ok_or_else(|| "schema document is not registered".to_owned())?;
    // A pointer can jump below a resource boundary. Check the whole document
    // before dereferencing so an ancestor $id cannot silently change its scope.
    reject_embedded_resources(document, true)?;
    project_schema_value(value, current_path, documents, stack)
}

fn reject_embedded_resources(schema: &Value, document_root: bool) -> Result<(), BoxError> {
    let Some(object) = schema.as_object() else {
        if let Some(schemas) = schema.as_array() {
            for schema in schemas {
                reject_embedded_resources(schema, false)?;
            }
        }
        return Ok(());
    };
    if !document_root && object.contains_key("$id") {
        return Err("static projection does not support embedded $id resource scopes".into());
    }
    for (keyword, value) in object {
        match keyword.as_str() {
            "$defs" | "definitions" | "properties" | "patternProperties" | "dependentSchemas"
            | "dependencies" => {
                if let Some(schemas) = value.as_object() {
                    for schema in schemas.values() {
                        reject_embedded_resources(schema, false)?;
                    }
                }
            }
            "additionalProperties"
            | "unevaluatedProperties"
            | "propertyNames"
            | "items"
            | "contains"
            | "not"
            | "if"
            | "then"
            | "else"
            | "unevaluatedItems"
            | "additionalItems"
            | "contentSchema"
            | "allOf"
            | "anyOf"
            | "oneOf"
            | "prefixItems" => {
                reject_embedded_resources(value, false)?;
            }
            // Literal instance data (const, enum, default, examples) and
            // annotations cannot establish a JSON Schema resource boundary.
            _ => {}
        }
    }
    Ok(())
}

fn project_schema_value(
    value: &Value,
    current_path: &Path,
    documents: &BTreeMap<PathBuf, Value>,
    stack: &mut BTreeSet<String>,
) -> Result<Value, BoxError> {
    match value {
        Value::Array(values) => values
            .iter()
            .map(|value| project_schema_value(value, current_path, documents, stack))
            .collect::<Result<Vec<_>, _>>()
            .map(Value::Array),
        Value::Object(object) => {
            if let Some(reference) = object.get("$ref").and_then(Value::as_str) {
                // These declarations do not constrain the referenced instance. All
                // other siblings remain rejected rather than silently weakened.
                if object.keys().any(|key| {
                    !matches!(key.as_str(), "$ref" | "$schema" | "$id" | "title" | "$defs")
                }) {
                    return Err(format!(
                        "static projection does not support $ref siblings in {}",
                        current_path.display()
                    )
                    .into());
                }
                let (target_path, fragment) = resolve_reference(current_path, reference)?;
                let key = format!("{}#{fragment}", target_path.display());
                let target_document = documents.get(&target_path).ok_or_else(|| {
                    format!("unregistered schema reference: {}", target_path.display())
                })?;
                let target = if fragment.is_empty() {
                    target_document
                } else {
                    target_document
                        .pointer(&fragment)
                        .ok_or_else(|| format!("unknown schema pointer: {key}"))?
                };
                if !stack.insert(key.clone()) {
                    if target.get("$comment").and_then(Value::as_str)
                        == Some("libre-ai-static-projection-recursion=opaque")
                    {
                        return Ok(Value::Bool(true));
                    }
                    return Err(
                        format!("recursive schema reference is not projectable: {key}").into(),
                    );
                }
                let projected = project_schema(target, &target_path, documents, stack)?;
                stack.remove(&key);
                return Ok(projected);
            }

            let mut projected = Map::new();
            for (key, nested) in object {
                if matches!(
                    key.as_str(),
                    "$schema"
                        | "$id"
                        | "if"
                        | "then"
                        | "else"
                        | "not"
                        | "contains"
                        | "minContains"
                        | "maxContains"
                        | "contentEncoding"
                ) {
                    continue;
                }
                if key == "allOf" {
                    let entries = nested
                        .as_array()
                        .ok_or_else(|| "allOf must be an array".to_owned())?;
                    let unconditional = entries
                        .iter()
                        .filter(|entry| {
                            !entry
                                .as_object()
                                .is_some_and(|entry| entry.contains_key("if"))
                        })
                        .map(|entry| project_schema_value(entry, current_path, documents, stack))
                        .collect::<Result<Vec<_>, _>>()?;
                    if !unconditional.is_empty() {
                        projected.insert(key.clone(), Value::Array(unconditional));
                    }
                    continue;
                }
                projected.insert(
                    key.clone(),
                    project_schema_value(nested, current_path, documents, stack)?,
                );
            }
            Ok(Value::Object(projected))
        }
        _ => Ok(value.clone()),
    }
}

fn resolve_reference(current_path: &Path, reference: &str) -> Result<(PathBuf, String), BoxError> {
    let (relative_path, fragment) = reference.split_once('#').unwrap_or((reference, ""));
    let target_path = if relative_path.is_empty() {
        current_path.to_path_buf()
    } else {
        current_path
            .parent()
            .ok_or_else(|| format!("schema has no parent: {}", current_path.display()))?
            .join(relative_path)
            .canonicalize()?
    };
    let pointer = if fragment.is_empty() {
        String::new()
    } else if fragment.starts_with('/') {
        fragment.to_owned()
    } else {
        return Err(format!("unsupported non-pointer schema fragment: {reference}").into());
    };
    Ok((target_path, pointer))
}

fn rust_module_name(file_name: &str) -> String {
    file_name
        .strip_suffix(".schema.json")
        .unwrap_or(file_name)
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character.to_ascii_lowercase()
            } else {
                '_'
            }
        })
        .collect()
}

fn file_name(path: &Path) -> Result<&str, BoxError> {
    path.file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| format!("invalid UTF-8 schema path: {}", path.display()).into())
}
