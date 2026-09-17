include!("../build.rs");

#[test]
fn root_reference_with_declarations_preserves_referenced_shape() -> Result<(), BoxError> {
    let path = PathBuf::from("fixture.schema.json");
    let document = serde_json::json!({
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "https://example.invalid/fixture.schema.json",
        "title": "Fixture response",
        "$ref": "#/$defs/response",
        "$defs": {"response": {
            "type": "object", "additionalProperties": false,
            "required": ["data"], "properties": {"data": {"type": "string"}}
        }}
    });
    let documents = BTreeMap::from([(path.clone(), document.clone())]);
    let actual = project_schema(&document, &path, &documents, &mut BTreeSet::new())?;
    assert_eq!(actual, document["$defs"]["response"]);
    Ok(())
}

#[test]
fn reference_validation_siblings_remain_fail_closed() {
    let path = PathBuf::from("fixture.schema.json");
    for (keyword, value) in [
        ("type", serde_json::json!("integer")),
        ("minLength", serde_json::json!(10)),
        ("allOf", serde_json::json!([{"type": "integer"}])),
        ("unevaluatedProperties", serde_json::json!(false)),
        ("$dynamicAnchor", serde_json::json!("selected")),
    ] {
        let mut document = serde_json::json!({
            "$ref": "#/$defs/value", "$defs": {"value": {"type": "string"}}
        });
        document[keyword] = value;
        let documents = BTreeMap::from([(path.clone(), document.clone())]);
        let result = project_schema(&document, &path, &documents, &mut BTreeSet::new());
        assert!(
            result.is_err(),
            "sibling {keyword} must not be silently erased"
        );
    }
}

#[test]
fn nested_resource_scopes_are_rejected_without_changing_the_oracle() -> Result<(), BoxError> {
    let path = PathBuf::from("fixture.schema.json");
    for nested_reference in [true, false] {
        let nested = if nested_reference {
            serde_json::json!({
                "$id": "nested.schema.json", "$ref": "#/$defs/selected",
                "$defs": {"selected": {"type": "integer"}}
            })
        } else {
            serde_json::json!({
                "$id": "nested.schema.json", "type": "object", "required": ["inner"],
                "$defs": {"selected": {"type": "integer"}},
                "properties": {"inner": {"$ref": "#/$defs/selected"}}
            })
        };
        let document = serde_json::json!({
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "$id": "https://example.invalid/fixture.schema.json",
            "type": "object", "required": ["value"],
            "$defs": {"selected": {"type": "string"}},
            "properties": {"value": nested}
        });
        let valid = if nested_reference {
            serde_json::json!({"value": 42})
        } else {
            serde_json::json!({"value": {"inner": 42}})
        };
        let invalid = if nested_reference {
            serde_json::json!({"value": "wrong"})
        } else {
            serde_json::json!({"value": {"inner": "wrong"}})
        };
        let validator = jsonschema::validator_for(&document)?;
        assert!(validator.is_valid(&valid));
        assert!(!validator.is_valid(&invalid));
        let documents = BTreeMap::from([(path.clone(), document.clone())]);
        let result = project_schema(&document, &path, &documents, &mut BTreeSet::new());
        assert!(
            result.is_err(),
            "unresolved embedded resource scope must be refused"
        );
    }
    Ok(())
}

#[test]
fn pointer_cannot_skip_an_embedded_resource_scope() -> Result<(), BoxError> {
    let path = PathBuf::from("fixture.schema.json");
    let document = serde_json::json!({
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "https://example.invalid/fixture.schema.json",
        "$ref": "#/$defs/resource/$defs/alias",
        "$defs": {
            "selected": {"type": "string"},
            "resource": {
                "$id": "nested.schema.json",
                "$defs": {
                    "selected": {"type": "integer"},
                    "alias": {"$ref": "#/$defs/selected"}
                }
            }
        }
    });
    let validator = jsonschema::validator_for(&document)?;
    assert!(validator.is_valid(&serde_json::json!(42)));
    assert!(!validator.is_valid(&serde_json::json!("wrong")));
    let documents = BTreeMap::from([(path.clone(), document.clone())]);
    assert!(project_schema(&document, &path, &documents, &mut BTreeSet::new()).is_err());
    Ok(())
}

#[test]
fn resource_preflight_distinguishes_schemas_from_instance_data() -> Result<(), BoxError> {
    let document = serde_json::json!({
        "type": "object",
        "properties": {"$id": {"type": "string"}},
        "const": {"$id": "literal"},
        "enum": [{"$id": "literal"}],
        "default": {"$id": "literal"},
        "examples": [{"$id": "literal"}]
    });
    reject_embedded_resources(&document, true)?;
    for keyword in ["allOf", "anyOf", "oneOf", "prefixItems"] {
        let document = serde_json::json!({keyword: [{"$id": "nested.schema.json"}]});
        assert!(reject_embedded_resources(&document, true).is_err());
    }
    Ok(())
}

#[test]
fn inlined_reference_and_named_definition_generate_one_claim_type() -> Result<(), BoxError> {
    let document = serde_json::json!({
        "title": "Fixture",
        "type": "object", "additionalProperties": false,
        "required": ["entry"],
        "properties": {"entry": {"$ref": "#/$defs/entry"}},
        "$defs": {
            "entry": {"type": "object", "additionalProperties": false,
                "required": ["claims"],
                "properties": {"claims": {"$ref": "#/$defs/entryClaims"}}},
            "entryClaims": {"type": "object", "additionalProperties": false,
                "required": ["allowed"], "properties": {"allowed": {"const": true}}}
        }
    });
    let validator = jsonschema::validator_for(&document)?;
    assert!(validator.is_valid(&serde_json::json!({"entry": {"claims": {"allowed": true}}})));
    assert!(!validator.is_valid(&serde_json::json!({"entry": {"claims": {"allowed": false}}})));
    let directory =
        env::temp_dir().join(format!("sdk-projection-collision-{}", std::process::id()));
    fs::create_dir_all(&directory)?;
    let path = directory.join("collision.schema.json");
    fs::write(&path, serde_json::to_vec(&document)?)?;
    let canonical = path.canonicalize()?;
    let documents = BTreeMap::from([(canonical, document)]);
    let generated = generated_type_source(&[path], &documents)?;
    // Two declarations of this public type make the Rust module fail E0428/E0119.
    assert_eq!(generated.matches("pub struct EntryClaims ").count(), 1);
    assert!(generated.contains("pub claims : EntryClaims"));
    Ok(())
}

#[test]
fn incompatible_same_name_structs_are_not_silently_merged() -> Result<(), BoxError> {
    let document = serde_json::json!({
        "title": "Fixture",
        "type": "object", "properties": {"entry": {"$ref": "#/$defs/entry"}},
        "$defs": {
            "entry": {"type": "object", "properties": {"claims": {
                "type": "object", "required": ["text"],
                "properties": {"text": {"type": "string"}}
            }}},
            "entryClaims": {"type": "object", "required": ["number"],
                "properties": {"number": {"type": "integer"}}}
        }
    });
    let directory = env::temp_dir().join(format!("sdk-projection-conflict-{}", std::process::id()));
    fs::create_dir_all(&directory)?;
    let path = directory.join("conflict.schema.json");
    fs::write(&path, serde_json::to_vec(&document)?)?;
    let canonical = path.canonicalize()?;
    let documents = BTreeMap::from([(canonical, document)]);
    let result = generated_type_source(&[path], &documents);
    assert!(
        result.is_err(),
        "different structures cannot share a public Rust type"
    );
    if let Err(error) = result {
        assert!(error.to_string().contains("incompatible declarations"));
    }
    Ok(())
}

#[test]
fn same_fields_with_different_defaults_are_not_equivalent_declarations() -> Result<(), BoxError> {
    let claims = serde_json::json!({
        "type": "object", "additionalProperties": false,
        "required": ["allowed"], "properties": {"allowed": {"type": "boolean"}},
        "default": {"allowed": true}
    });
    let mut other = claims.clone();
    other["default"] = serde_json::json!({"allowed": false});
    let document = serde_json::json!({
        "title": "Fixture", "type": "object",
        "properties": {"entry": {"$ref": "#/$defs/entry"}},
        "$defs": {
            "entry": {"type": "object", "properties": {"claims": other}},
            "entryClaims": claims
        }
    });
    let directory = env::temp_dir().join(format!("sdk-projection-default-{}", std::process::id()));
    fs::create_dir_all(&directory)?;
    let path = directory.join("default.schema.json");
    fs::write(&path, serde_json::to_vec(&document)?)?;
    let canonical = path.canonicalize()?;
    let documents = BTreeMap::from([(canonical, document)]);
    let result = generated_type_source(&[path], &documents);
    assert!(
        result.is_err(),
        "matching fields do not justify changing generated defaults"
    );
    Ok(())
}
