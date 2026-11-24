use serde::de::{DeserializeSeed, Error as _, MapAccess, SeqAccess, Visitor};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::fmt::{self, Write as _};
use std::fs;

fn canonical_json(value: &Value) -> Vec<u8> {
    let mut output = Vec::new();
    write_canonical(value, &mut output);
    output
}

fn write_canonical(value: &Value, output: &mut Vec<u8>) {
    match value {
        Value::Null | Value::Bool(_) | Value::String(_) => {
            serde_json::to_writer(output, value).expect("validated golden scalar")
        }
        Value::Number(number) => output.extend_from_slice(jcs_number(number).as_bytes()),
        Value::Array(values) => {
            output.push(b'[');
            for (index, nested) in values.iter().enumerate() {
                if index > 0 {
                    output.push(b',');
                }
                write_canonical(nested, output);
            }
            output.push(b']');
        }
        Value::Object(object) => {
            output.push(b'{');
            let mut keys = object.keys().collect::<Vec<_>>();
            keys.sort_unstable();
            for (index, key) in keys.into_iter().enumerate() {
                assert!(key.is_ascii(), "policy-core golden object keys are ASCII");
                if index > 0 {
                    output.push(b',');
                }
                serde_json::to_writer(&mut *output, key).expect("validated golden key");
                output.push(b':');
                write_canonical(&object[key], output);
            }
            output.push(b'}');
        }
    }
}

fn jcs_number(number: &serde_json::Number) -> String {
    let value = number.as_f64().expect("validated finite binary64 number");
    assert!(value.is_finite(), "JCS excludes NaN and infinity");
    if value == 0.0 {
        return "0".to_owned();
    }
    if (1e-6..1e21).contains(&value.abs()) {
        return value.to_string();
    }

    let scientific = format!("{value:e}");
    let (mantissa, exponent) = scientific.split_once('e').expect("scientific notation");
    let exponent = exponent.parse::<i32>().expect("binary64 exponent");
    format!(
        "{mantissa}e{}{exponent}",
        if exponent >= 0 { "+" } else { "" }
    )
}

fn type_rank(value: &Value) -> u8 {
    match value {
        Value::Bool(_) => 0,
        Value::Number(_) => 1,
        Value::String(_) => 2,
        _ => panic!("policy fact must be scalar"),
    }
}

fn compare_bytes(left: &[u8], right: &[u8]) -> Ordering {
    left.cmp(right)
}

fn compare_facts(left: &Value, right: &Value, include_source: bool) -> Ordering {
    let left_object = left.as_object().expect("fact object");
    let right_object = right.as_object().expect("fact object");
    left_object["name"]
        .as_str()
        .expect("fact name")
        .as_bytes()
        .cmp(right_object["name"].as_str().expect("fact name").as_bytes())
        .then_with(|| type_rank(&left_object["value"]).cmp(&type_rank(&right_object["value"])))
        .then_with(|| {
            compare_bytes(
                &canonical_json(&left_object["value"]),
                &canonical_json(&right_object["value"]),
            )
        })
        .then_with(|| {
            if include_source {
                compare_bytes(
                    &canonical_json(&left_object["source"]),
                    &canonical_json(&right_object["source"]),
                )
            } else {
                Ordering::Equal
            }
        })
}

fn normalize(mut value: Value, kind: &str) -> Value {
    let object = value.as_object_mut().expect("digest projection object");
    match kind {
        "policy" => {
            let rules = object["rules"].as_array_mut().expect("policy rules");
            for rule in rules.iter_mut() {
                let rule = rule.as_object_mut().expect("policy rule");
                if matches!(rule["operator"].as_str(), Some("in" | "not-in")) {
                    rule["value"]
                        .as_array_mut()
                        .expect("policy set")
                        .sort_by(|left, right| {
                            compare_bytes(&canonical_json(left), &canonical_json(right))
                        });
                }
            }
            rules.sort_by(|left, right| {
                left["id"]
                    .as_str()
                    .expect("rule id")
                    .as_bytes()
                    .cmp(right["id"].as_str().expect("rule id").as_bytes())
            });
        }
        "snapshot" | "need" => object["facts"]
            .as_array_mut()
            .expect("facts")
            .sort_by(|left, right| compare_facts(left, right, kind == "snapshot")),
        _ => panic!("unknown normalization kind"),
    }
    value
}

fn digest(label: &str, value: Value, kind: Option<&str>) -> String {
    let normalized = kind.map_or(value.clone(), |_| normalize(value, kind.expect("kind")));
    let mut hasher = Sha256::new();
    hasher.update(label.as_bytes());
    hasher.update([0]);
    hasher.update(canonical_json(&normalized));
    let mut encoded = String::with_capacity(64);
    for byte in hasher.finalize() {
        write!(&mut encoded, "{byte:02x}").expect("write to string");
    }
    encoded
}

fn without(value: &Value, keys: &[&str]) -> Value {
    let mut projection = value.clone();
    let object = projection.as_object_mut().expect("projection object");
    for key in keys {
        object.remove(*key);
    }
    projection
}

#[derive(Clone, Copy)]
struct StrictJsonSeed {
    depth: usize,
    maximum_depth: usize,
}

impl<'de> DeserializeSeed<'de> for StrictJsonSeed {
    type Value = ();

    fn deserialize<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        if self.depth > self.maximum_depth {
            return Err(D::Error::custom("maximum JSON depth exceeded"));
        }
        deserializer.deserialize_any(StrictJsonVisitor {
            depth: self.depth,
            maximum_depth: self.maximum_depth,
        })
    }
}

struct StrictJsonVisitor {
    depth: usize,
    maximum_depth: usize,
}

impl<'de> Visitor<'de> for StrictJsonVisitor {
    type Value = ();

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a JSON value without duplicate object members")
    }

    fn visit_bool<E>(self, _value: bool) -> Result<Self::Value, E> {
        Ok(())
    }

    fn visit_i64<E>(self, _value: i64) -> Result<Self::Value, E> {
        Ok(())
    }

    fn visit_u64<E>(self, _value: u64) -> Result<Self::Value, E> {
        Ok(())
    }

    fn visit_f64<E>(self, value: f64) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        if value.is_finite() {
            Ok(())
        } else {
            Err(E::custom("non-finite JSON number"))
        }
    }

    fn visit_str<E>(self, _value: &str) -> Result<Self::Value, E> {
        Ok(())
    }

    fn visit_string<E>(self, _value: String) -> Result<Self::Value, E> {
        Ok(())
    }

    fn visit_unit<E>(self) -> Result<Self::Value, E> {
        Ok(())
    }

    fn visit_none<E>(self) -> Result<Self::Value, E> {
        Ok(())
    }

    fn visit_seq<A>(self, mut sequence: A) -> Result<Self::Value, A::Error>
    where
        A: SeqAccess<'de>,
    {
        let nested = StrictJsonSeed {
            depth: self.depth + 1,
            maximum_depth: self.maximum_depth,
        };
        while sequence.next_element_seed(nested)?.is_some() {}
        Ok(())
    }

    fn visit_map<A>(self, mut object: A) -> Result<Self::Value, A::Error>
    where
        A: MapAccess<'de>,
    {
        let mut keys = HashSet::new();
        let nested = StrictJsonSeed {
            depth: self.depth + 1,
            maximum_depth: self.maximum_depth,
        };
        while let Some(key) = object.next_key::<String>()? {
            if !keys.insert(key) {
                return Err(A::Error::custom("duplicate JSON object member"));
            }
            object.next_value_seed(nested)?;
        }
        Ok(())
    }
}

fn decode_strict_json(bytes: &[u8]) -> Result<(), String> {
    if bytes.starts_with(&[0xef, 0xbb, 0xbf]) {
        return Err("UTF-8 BOM is forbidden".to_owned());
    }
    let input = std::str::from_utf8(bytes).map_err(|error| error.to_string())?;
    let mut deserializer = serde_json::Deserializer::from_str(input);
    StrictJsonSeed {
        depth: 0,
        maximum_depth: 64,
    }
    .deserialize(&mut deserializer)
    .map_err(|error| error.to_string())?;
    deserializer.end().map_err(|error| error.to_string())
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let mut encoded = String::with_capacity(64);
    for byte in hasher.finalize() {
        write!(&mut encoded, "{byte:02x}").expect("write to string");
    }
    encoded
}

#[test]
fn policy_core_raw_inputs_are_rejected_before_schema_validation() {
    let manifest: Value = serde_json::from_str(include_str!(
        "../../../contracts/fixtures/policy-core-invalid-json/manifest.json"
    ))
    .expect("policy-core raw input manifest");
    assert_eq!(
        manifest["schemaVersion"],
        "libre-ai.policy-core-raw-input-vectors.v1"
    );
    let cases = manifest["cases"].as_array().expect("raw input cases");
    assert_eq!(cases.len(), 9);
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../contracts/fixtures/policy-core-invalid-json");
    let mut ids = HashSet::new();
    let mut defects = HashSet::new();

    for case in cases {
        let id = case["id"].as_str().expect("raw input id");
        assert!(ids.insert(id), "duplicate raw input id: {id}");
        let file = case["file"].as_str().expect("raw input file");
        assert!(
            file.ends_with(".bin")
                && file.bytes().all(|byte| byte.is_ascii_lowercase()
                    || byte.is_ascii_digit()
                    || b"-.".contains(&byte)),
            "unsafe raw input file name: {file}"
        );
        let bytes = fs::read(root.join(file)).expect("raw input bytes");
        assert_eq!(
            bytes.len() as u64,
            case["byteLength"].as_u64().expect("raw byte length"),
            "{id}: byte length"
        );
        assert_eq!(
            sha256_hex(&bytes),
            case["inputSha256"].as_str().expect("raw input digest"),
            "{id}: SHA-256"
        );

        let defect = case["defect"].as_str().expect("raw input defect");
        defects.insert(defect);
        let strict_error = decode_strict_json(&bytes).expect_err("forbidden input accepted");
        match defect {
            "bom" => assert!(bytes.starts_with(&[0xef, 0xbb, 0xbf])),
            "invalid-utf8" => assert!(std::str::from_utf8(&bytes).is_err()),
            "duplicate-member" => {
                assert!(serde_json::from_slice::<Value>(&bytes).is_ok());
                assert!(strict_error.contains("duplicate JSON object member"));
            }
            "unpaired-surrogate" | "invalid-number" => {
                assert!(serde_json::from_slice::<Value>(&bytes).is_err());
            }
            other => panic!("unknown raw input defect: {other}"),
        }

        let v1_error = &case["expectedErrors"]["policy-core-v1"];
        assert_eq!(v1_error.as_object().expect("v1 error").len(), 2, "{id}: v1");
        assert_eq!(v1_error["code"], "policy.input_invalid", "{id}: v1");
        assert_eq!(
            v1_error["message"], "input does not conform to policy-core-v1",
            "{id}: v1"
        );
        let v2_error = &case["expectedErrors"]["policy-core-v2"];
        assert_eq!(v2_error.as_object().expect("v2 error").len(), 1, "{id}: v2");
        assert_eq!(v2_error["variant"], "input-invalid", "{id}: v2");
    }

    assert_eq!(
        defects,
        HashSet::from([
            "bom",
            "invalid-utf8",
            "duplicate-member",
            "unpaired-surrogate",
            "invalid-number",
        ])
    );
    decode_strict_json(
        br#"{"key":1,"\u006bEy":2,"value":"\uD834\uDD1E","numbers":[0,-1.25,1e+20]}"#,
    )
    .expect("valid strict JSON control");
}

// policy-core-v3 (contracts/wit/policy-core-v3/SEMANTICS.md, section 2): a second instrument
// for the raw-input classes, independent of the TypeScript oracle and of JSON.parse. The
// grammar is judged by a hand-written iterative recognizer of RFC 8259 sections 2 to 7, then
// the semantic classes by the policy-core-v2 test seed above. The v2 reader and its test are
// left unchanged.

#[derive(Clone, Copy)]
enum JsonContainer {
    Array,
    Object,
}

fn skip_json_whitespace(text: &[u8], mut position: usize) -> usize {
    while matches!(text.get(position), Some(b' ' | b'\t' | b'\n' | b'\r')) {
        position += 1;
    }
    position
}

fn json_string_end(text: &[u8], start: usize) -> Result<usize, usize> {
    let mut position = start + 1;
    loop {
        match text.get(position) {
            None => return Err(position),
            Some(b'"') => return Ok(position + 1),
            Some(b'\\') => match text.get(position + 1) {
                Some(b'"' | b'\\' | b'/' | b'b' | b'f' | b'n' | b'r' | b't') => position += 2,
                Some(b'u') => {
                    let digits = text.get(position + 2..position + 6).ok_or(position)?;
                    if !digits.iter().all(u8::is_ascii_hexdigit) {
                        return Err(position);
                    }
                    position += 6;
                }
                _ => return Err(position),
            },
            Some(byte) if *byte < 0x20 => return Err(position),
            Some(_) => position += 1,
        }
    }
}

fn json_digits_end(text: &[u8], mut position: usize) -> Result<usize, usize> {
    if !text.get(position).is_some_and(u8::is_ascii_digit) {
        return Err(position);
    }
    while text.get(position).is_some_and(u8::is_ascii_digit) {
        position += 1;
    }
    Ok(position)
}

fn json_number_end(text: &[u8], start: usize) -> Result<usize, usize> {
    let mut position = start;
    if text.get(position) == Some(&b'-') {
        position += 1;
    }
    position = match text.get(position) {
        Some(b'0') => position + 1,
        Some(b'1'..=b'9') => json_digits_end(text, position)?,
        _ => return Err(position),
    };
    if text.get(position) == Some(&b'.') {
        position = json_digits_end(text, position + 1)?;
    }
    if matches!(text.get(position), Some(b'e' | b'E')) {
        position += 1;
        if matches!(text.get(position), Some(b'+' | b'-')) {
            position += 1;
        }
        position = json_digits_end(text, position)?;
    }
    Ok(position)
}

/// A member name, its colon and the whitespace before the member value.
fn json_member_name_end(text: &[u8], position: usize) -> Result<usize, usize> {
    if text.get(position) != Some(&b'"') {
        return Err(position);
    }
    let position = skip_json_whitespace(text, json_string_end(text, position)?);
    if text.get(position) != Some(&b':') {
        return Err(position);
    }
    Ok(skip_json_whitespace(text, position + 1))
}

/// `Ok` when `text` is one RFC 8259 JSON text, otherwise the offset of the first grammar
/// error. Duplicate names, lone surrogate escapes, depth and number range are not grammar.
/// Iterative, so that its stack does not grow with the nesting of the input.
fn rfc_8259_grammar(text: &[u8]) -> Result<(), usize> {
    let mut stack = Vec::new();
    let mut position = skip_json_whitespace(text, 0);
    loop {
        match text.get(position) {
            Some(b'[') => {
                position = skip_json_whitespace(text, position + 1);
                if text.get(position) == Some(&b']') {
                    position += 1;
                } else {
                    stack.push(JsonContainer::Array);
                    continue;
                }
            }
            Some(b'{') => {
                position = skip_json_whitespace(text, position + 1);
                if text.get(position) == Some(&b'}') {
                    position += 1;
                } else {
                    stack.push(JsonContainer::Object);
                    position = json_member_name_end(text, position)?;
                    continue;
                }
            }
            Some(b'"') => position = json_string_end(text, position)?,
            Some(b'-' | b'0'..=b'9') => position = json_number_end(text, position)?,
            Some(b't' | b'f' | b'n') => {
                let literal = [&b"true"[..], b"false", b"null"]
                    .into_iter()
                    .find(|literal| text[position..].starts_with(literal))
                    .ok_or(position)?;
                position += literal.len();
            }
            _ => return Err(position),
        }
        // A value is complete: close containers until the next value is due.
        loop {
            position = skip_json_whitespace(text, position);
            match (stack.last(), text.get(position)) {
                (None, None) => return Ok(()),
                (None, Some(_)) => return Err(position),
                (Some(JsonContainer::Array), Some(b',')) => {
                    position = skip_json_whitespace(text, position + 1);
                    break;
                }
                (Some(JsonContainer::Object), Some(b',')) => {
                    position =
                        json_member_name_end(text, skip_json_whitespace(text, position + 1))?;
                    break;
                }
                (Some(JsonContainer::Array), Some(b']'))
                | (Some(JsonContainer::Object), Some(b'}')) => {
                    stack.pop();
                    position += 1;
                }
                _ => return Err(position),
            }
        }
    }
}

/// The policy-core-v3 decoder classes (section 2, precedence of the reference oracle).
fn policy_core_v3_defect(bytes: &[u8], maximum_depth: usize) -> Option<&'static str> {
    if bytes.starts_with(&[0xef, 0xbb, 0xbf]) {
        return Some("bom");
    }
    let Ok(text) = std::str::from_utf8(bytes) else {
        return Some("invalid-utf8");
    };
    if rfc_8259_grammar(text.as_bytes()).is_err() {
        return Some("invalid-json");
    }
    let mut deserializer = serde_json::Deserializer::from_str(text);
    let semantic = StrictJsonSeed {
        depth: 0,
        maximum_depth,
    }
    .deserialize(&mut deserializer)
    .and_then(|()| deserializer.end());
    let message = semantic.err()?.to_string();
    // On a grammatical text serde_json can only refuse for these reasons; anything else is
    // reported as is and fails the test.
    Some(if message.contains("duplicate JSON object member") {
        "duplicate-member"
    } else if message.contains("maximum JSON depth exceeded") {
        "max-depth"
    } else if message.contains("surrogate") || message.contains("hex escape") {
        "unpaired-surrogate"
    } else if message.contains("number out of range") || message.contains("non-finite") {
        "invalid-number"
    } else {
        panic!("grammatical text refused outside the semantic classes: {message}")
    })
}

fn read_raw_input_case(root: &std::path::Path, case: &Value) -> (String, Vec<u8>) {
    let id = case["id"].as_str().expect("raw input id").to_owned();
    let file = case["file"].as_str().expect("raw input file");
    assert!(
        file.ends_with(".bin")
            && file.bytes().all(|byte| byte.is_ascii_lowercase()
                || byte.is_ascii_digit()
                || b"-.".contains(&byte)),
        "unsafe raw input file name: {file}"
    );
    let bytes = fs::read(root.join(file)).expect("raw input bytes");
    assert_eq!(
        bytes.len() as u64,
        case["byteLength"].as_u64().expect("raw byte length"),
        "{id}: byte length"
    );
    assert_eq!(
        sha256_hex(&bytes),
        case["inputSha256"].as_str().expect("raw input digest"),
        "{id}: SHA-256"
    );
    (id, bytes)
}

#[test]
fn policy_core_v3_raw_inputs_follow_the_grammar_first_classes() {
    let manifest: Value = serde_json::from_str(include_str!(
        "../../../contracts/fixtures/policy-core-v3/raw-inputs/manifest.json"
    ))
    .expect("policy-core-v3 raw input manifest");
    assert_eq!(
        manifest["schemaVersion"],
        "libre-ai.policy-core-raw-input-vectors.v2"
    );
    let maximum_depth = policy_core_budget_depth();
    let golden_text = include_str!("../../../contracts/fixtures/policy-core-v3/golden.json");
    let golden: Value = serde_json::from_str(golden_text).expect("policy-core-v3 golden");
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../contracts/fixtures/policy-core-v3/raw-inputs");
    let mut ids = HashSet::new();
    let mut defects = HashSet::new();
    let mut compared_as_octets = 0;
    // Carrier vectors: the class each serde_json reading lets through as the exact golden
    // input, so that a component built on it would evaluate instead of refusing.
    let mut defeat_from_slice = HashSet::new();
    let mut defeat_first_value = HashSet::new();

    let refused = manifest["cases"].as_array().expect("refused cases");
    for case in refused {
        let (id, bytes) = read_raw_input_case(&root, case);
        assert!(ids.insert(id.clone()), "duplicate raw input id: {id}");
        let defect = case["defect"].as_str().expect("raw input defect");
        defects.insert(defect);
        assert_eq!(
            policy_core_v3_defect(&bytes, maximum_depth),
            Some(defect),
            "{id}: class"
        );
        assert_eq!(
            case["expectedErrors"],
            json!({"policy-core-v3": {"variant": "input-invalid"}}),
            "{id}: component refusal"
        );
        let Some(argument) = case["argument"].as_str() else {
            continue;
        };
        let golden_case = golden["cases"]
            .as_array()
            .expect("golden cases")
            .iter()
            .find(|candidate| candidate["id"] == case["goldenCase"])
            .unwrap_or_else(|| panic!("{id}: golden case"));
        assert!(
            golden_case["expectedEvaluation"].is_object(),
            "{id}: golden evaluates"
        );
        let expected = &golden_case[argument];
        assert!(expected.is_object(), "{id}: argument {argument}");
        // Compared as octets, so that a reader keeping the last duplicate cannot hide an added
        // member, and checked against the grammar of its class, so that the run cannot hide a
        // second defect of any class (SEMANTICS sections 2 and 10).
        let reference = compact_golden_argument(
            golden_text,
            case["goldenCase"].as_str().expect("golden case id"),
            argument,
        );
        assert_eq!(
            serde_json::from_slice::<Value>(&reference).ok().as_ref(),
            Some(expected),
            "{id}: compact golden argument"
        );
        let readings = insertions(&reference, &bytes);
        assert!(
            !readings.is_empty(),
            "{id}: not its golden argument plus one inserted run"
        );
        let mut index = ReferenceIndex::new(&reference);
        assert!(
            readings
                .iter()
                .any(|&(offset, run)| adds_one_defect(defect, &mut index, offset, run)),
            "{id}: its inserted run ({} octets) is not one {defect} defect at a place where that \
             class can stand",
            readings[0].1.len()
        );
        compared_as_octets += 1;
        if serde_json::from_slice::<Value>(&bytes).ok().as_ref() == Some(expected) {
            defeat_from_slice.insert(defect);
        }
        // A reader that takes the first JSON value and never checks the end of the input.
        let mut deserializer = serde_json::Deserializer::from_slice(&bytes);
        if <Value as serde::Deserialize>::deserialize(&mut deserializer)
            .ok()
            .as_ref()
            == Some(expected)
        {
            defeat_first_value.insert(defect);
        }
    }
    assert_eq!(defeat_from_slice, HashSet::from(["duplicate-member"]));
    assert_eq!(
        defeat_first_value,
        HashSet::from(["duplicate-member", "invalid-json"])
    );
    let accepted = manifest["acceptedCases"]
        .as_array()
        .expect("accepted cases");
    for case in accepted {
        let (id, bytes) = read_raw_input_case(&root, case);
        assert!(ids.insert(id.clone()), "duplicate raw input id: {id}");
        assert_eq!(
            policy_core_v3_defect(&bytes, maximum_depth),
            None,
            "{id}: accepted"
        );
    }
    assert_eq!(
        defects,
        HashSet::from([
            "bom",
            "invalid-utf8",
            "invalid-json",
            "duplicate-member",
            "unpaired-surrogate",
            "max-depth",
            "invalid-number",
        ])
    );
    assert!(!accepted.is_empty());
    assert_eq!(compared_as_octets, 6, "carriers compared as octets");
    println!(
        "policy-core-v3 raw inputs (Rust): {} refused ({} carriers compared as octets), {} accepted",
        refused.len(),
        compared_as_octets,
        accepted.len()
    );
}

/// `text` without the whitespace RFC 8259 allows between tokens: the compact serialization,
/// in the member order of the source.
fn compact_json(text: &str) -> Vec<u8> {
    let mut compact = Vec::with_capacity(text.len());
    let (mut in_string, mut escaped) = (false, false);
    for &octet in text.as_bytes() {
        if in_string {
            compact.push(octet);
            if escaped {
                escaped = false;
            } else if octet == b'\\' {
                escaped = true;
            } else if octet == b'"' {
                in_string = false;
            }
        } else if !b" \t\n\r".contains(&octet) {
            in_string = octet == b'"';
            compact.push(octet);
        }
    }
    compact
}

/// The index just past the object or array that opens at `start` of compact JSON.
fn container_end(compact: &[u8], start: usize) -> usize {
    let (mut depth, mut in_string, mut escaped) = (0usize, false, false);
    for (index, &octet) in compact.iter().enumerate().skip(start) {
        if in_string {
            if escaped {
                escaped = false;
            } else if octet == b'\\' {
                escaped = true;
            } else if octet == b'"' {
                in_string = false;
            }
            continue;
        }
        match octet {
            b'"' => in_string = true,
            b'{' | b'[' => depth += 1,
            b'}' | b']' => {
                depth -= 1;
                if depth == 0 {
                    return index + 1;
                }
            }
            _ => {}
        }
    }
    panic!("unterminated container at {start}");
}

/// The compact octets of `argument` of golden case `case_id`, in the member order of the
/// golden file, as the carriers are built. The caller checks them against the parsed value.
fn compact_golden_argument(golden_text: &str, case_id: &str, argument: &str) -> Vec<u8> {
    let compact = compact_json(golden_text);
    let find = |needle: &[u8], from: usize| {
        compact[from..]
            .windows(needle.len())
            .position(|window| window == needle)
            .map(|offset| from + offset)
    };
    let case = find(format!("\"id\":\"{case_id}\"").as_bytes(), 0).expect("golden case id");
    let key = format!("\"{argument}\":");
    let start = find(key.as_bytes(), case).expect("golden argument") + key.len();
    compact[start..container_end(&compact, start)].to_vec()
}

/// Every reading of `bytes` as `reference` with one non-empty run of octets inserted at an
/// offset of `reference` and nothing else changed: several when the run borders octets equal
/// to its own; none if there is no such reading.
fn insertions<'a>(reference: &[u8], bytes: &'a [u8]) -> Vec<(usize, &'a [u8])> {
    let extra = bytes.len().saturating_sub(reference.len());
    if extra == 0 {
        return Vec::new();
    }
    let prefix = reference
        .iter()
        .zip(bytes)
        .take_while(|(left, right)| left == right)
        .count();
    let suffix = reference
        .iter()
        .rev()
        .zip(bytes.iter().rev())
        .take_while(|(left, right)| left == right)
        .count();
    (reference.len().saturating_sub(suffix)..=prefix)
        .map(|offset| (offset, &bytes[offset..offset + extra]))
        .collect()
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Place {
    /// Between two characters of a string.
    String,
    /// Inside an escape sequence of a string.
    Escape,
    /// Outside every string.
    Outside,
}

/// One pass over the compact JSON `text`: for each offset from 0 to its length, where it falls
/// and the start of the innermost object or array open there. Every reading of a carrier is
/// then checked without walking the reference again.
struct ReferenceIndex<'a> {
    text: &'a [u8],
    place: Vec<Place>,
    container: Vec<Option<usize>>,
    /// The octet range of each member of an object, by the offset of its `{`, computed once.
    members: HashMap<usize, Vec<std::ops::Range<usize>>>,
}

impl<'a> ReferenceIndex<'a> {
    fn new(text: &'a [u8]) -> Self {
        let mut place = Vec::with_capacity(text.len() + 1);
        let mut container = Vec::with_capacity(text.len() + 1);
        let mut open = Vec::new();
        let (mut in_string, mut escaped, mut hex_left) = (false, false, 0usize);
        for index in 0..=text.len() {
            place.push(match (in_string, escaped || hex_left > 0) {
                (false, _) => Place::Outside,
                (true, true) => Place::Escape,
                (true, false) => Place::String,
            });
            container.push(open.last().copied());
            let Some(&octet) = text.get(index) else {
                break;
            };
            if in_string {
                if hex_left > 0 {
                    hex_left -= 1;
                } else if escaped {
                    escaped = false;
                    if octet == b'u' {
                        hex_left = 4;
                    }
                } else if octet == b'\\' {
                    escaped = true;
                } else if octet == b'"' {
                    in_string = false;
                }
                continue;
            }
            match octet {
                b'"' => in_string = true,
                b'{' | b'[' => open.push(index),
                b'}' | b']' => {
                    open.pop();
                }
                _ => {}
            }
        }
        Self {
            text,
            place,
            container,
            members: HashMap::new(),
        }
    }

    /// The octets of each member of the object that opens at `start`, as `"name":value`.
    fn members_at(&mut self, start: usize) -> Vec<&'a [u8]> {
        let Self {
            text,
            place,
            members,
            ..
        } = self;
        let text: &'a [u8] = text;
        members
            .entry(start)
            .or_insert_with(|| {
                let mut ranges = Vec::new();
                let (mut depth, mut member_start) = (0usize, start + 1);
                for at in start + 1..text.len() {
                    if place[at] != Place::Outside {
                        continue;
                    }
                    match text[at] {
                        b'{' | b'[' => depth += 1,
                        b'}' | b']' if depth == 0 => {
                            if at > member_start {
                                ranges.push(member_start..at);
                            }
                            break;
                        }
                        b'}' | b']' => depth -= 1,
                        b',' if depth == 0 => {
                            ranges.push(member_start..at);
                            member_start = at + 1;
                        }
                        _ => {}
                    }
                }
                ranges
            })
            .iter()
            .map(|range| &text[range.clone()])
            .collect()
    }
}

/// The `"name"` token that opens `member`, escapes included.
fn name_token(member: &[u8]) -> Option<&[u8]> {
    if member.first() != Some(&b'"') {
        return None;
    }
    let mut at = 1;
    while at < member.len() {
        match member[at] {
            b'\\' => at += 2,
            b'"' => return Some(&member[..=at]),
            _ => at += 1,
        }
    }
    None
}

/// The member a run inserts at a member boundary of an object: `member,` right after its `{`,
/// or, unless `leading_only`, `,member` before a `,` or its `}`. None anywhere else.
fn inserted_member<'r>(
    index: &ReferenceIndex,
    offset: usize,
    run: &'r [u8],
    leading_only: bool,
) -> Option<(usize, &'r [u8])> {
    let container = index.container[offset]?;
    if index.place[offset] != Place::Outside || index.text[container] != b'{' {
        return None;
    }
    if container + 1 == offset {
        return run.strip_suffix(b",").map(|member| (container, member));
    }
    if !leading_only && matches!(index.text.get(offset), Some(b',' | b'}')) {
        return run.strip_prefix(b",").map(|member| (container, member));
    }
    None
}

/// `\uD800` to `\uDFFF`, and which half of a pair it is.
fn surrogate_escape(octets: &[u8]) -> Option<bool> {
    let [b'\\', b'u', b'd' | b'D', third, fourth, fifth] = *octets else {
        return None;
    };
    if !(fourth.is_ascii_hexdigit() && fifth.is_ascii_hexdigit()) {
        return None;
    }
    match third {
        b'8' | b'9' | b'a' | b'b' | b'A' | b'B' => Some(true),
        b'c'..=b'f' | b'C'..=b'F' => Some(false),
        _ => None,
    }
}

/// Whether `run` inserted at `offset` adds exactly one defect of `defect` to the reference, in
/// the minimal form of its class, which can hide nothing else: SEMANTICS section 2 for the
/// classes, section 10 for the carriers, never the fixtures. Any octet beyond that form makes
/// it false.
fn adds_one_defect(defect: &str, index: &mut ReferenceIndex, offset: usize, run: &[u8]) -> bool {
    let text = index.text;
    match defect {
        "bom" => offset == 0 && run == [0xef, 0xbb, 0xbf],
        // One octet that is never valid after an ASCII octet (a continuation octet, or F5 to
        // FF), between two ASCII octets of a string: dropped, it gives the reference back;
        // replaced, it gives U+FFFD; no reading turns it into a character of the JSON syntax.
        "invalid-utf8" => {
            matches!(run, [0x80..=0xbf | 0xf5..=0xff])
                && index.place[offset] == Place::String
                && offset
                    .checked_sub(1)
                    .and_then(|before| text.get(before))
                    .is_some_and(u8::is_ascii)
                && text.get(offset).is_some_and(u8::is_ascii)
        }
        "unpaired-surrogate" => {
            if index.place[offset] != Place::String {
                return false;
            }
            match surrogate_escape(run) {
                Some(true) => {
                    text.get(offset..offset + 6).and_then(surrogate_escape) != Some(false)
                }
                Some(false) => {
                    text.get(offset.saturating_sub(6)..offset)
                        .and_then(surrogate_escape)
                        != Some(true)
                }
                None => false,
            }
        }
        // Section 2: one JSON text followed by something other than insignificant whitespace.
        // One printable octet that cannot start a value, so the tail holds no second JSON text.
        "invalid-json" => {
            offset == text.len()
                && matches!(run, [octet @ 0x21..=0x7e]
                    if !b"\"[{-0123456789tfn".contains(octet))
        }
        // A byte-exact copy of a member of the same object: a reader that keeps the first
        // duplicate and one that keeps the last both read the golden argument.
        "duplicate-member" => inserted_member(index, offset, run, false)
            .is_some_and(|(container, member)| index.members_at(container).contains(&member)),
        // Section 10: one leading member, under the name token of a member of the same object,
        // whose value is an RFC 8259 number out of the binary64 range.
        "invalid-number" => {
            let Some((container, member)) = inserted_member(index, offset, run, true) else {
                return false;
            };
            let Some(name) = name_token(member) else {
                return false;
            };
            if member.get(name.len()) != Some(&b':') {
                return false;
            }
            let value = &member[name.len() + 1..];
            index
                .members_at(container)
                .iter()
                .any(|golden| name_token(golden) == Some(name))
                && json_number_end(value, 0) == Ok(value.len())
                && std::str::from_utf8(value)
                    .ok()
                    .and_then(|number| number.parse::<f64>().ok())
                    .is_some_and(|number| !number.is_finite())
        }
        _ => false,
    }
}

/// serde_json refuses a document nested past its recursion limit before the seed sees the
/// depth, with a message outside the semantic classes. The instrument therefore holds only
/// while the deepest container the budget admits stays under that limit.
const SERDE_JSON_RECURSION_LIMIT: usize = 128;

fn assert_budget_depth_within_serde_json_limit(maximum_depth: usize) {
    assert!(
        maximum_depth + 1 < SERDE_JSON_RECURSION_LIMIT,
        "budget depth {maximum_depth} reaches the serde_json recursion limit: the Rust \
         instrument would refuse admitted nesting; replace its semantic pass first"
    );
}

/// `decoderQualification.maximumJsonDepth` of the resource budgets, within the instrument's reach.
fn policy_core_budget_depth() -> usize {
    let budgets: Value = serde_json::from_str(include_str!(
        "../../../contracts/fixtures/policy-core-v2/resource-budgets.v1.json"
    ))
    .expect("policy-core resource budgets");
    let maximum_depth = usize::try_from(
        budgets["decoderQualification"]["maximumJsonDepth"]
            .as_u64()
            .expect("maximum JSON depth"),
    )
    .expect("depth fits usize");
    assert_budget_depth_within_serde_json_limit(maximum_depth);
    maximum_depth
}

#[test]
fn serde_json_recursion_limit_bounds_the_rust_instrument_depth() {
    let nested = |count: usize| format!("{}{}", "[".repeat(count), "]".repeat(count));
    let deepest = SERDE_JSON_RECURSION_LIMIT - 2;
    // At the deepest admitted budget, an empty array at that depth is accepted.
    assert_eq!(
        policy_core_v3_defect(nested(deepest + 1).as_bytes(), deepest),
        None
    );
    // One level more and serde_json's limit fires before the seed.
    let beyond = std::panic::catch_unwind(|| {
        policy_core_v3_defect(nested(deepest + 2).as_bytes(), deepest + 1)
    });
    assert!(beyond.is_err());
    assert!(
        std::panic::catch_unwind(|| assert_budget_depth_within_serde_json_limit(deepest)).is_ok()
    );
    assert!(
        std::panic::catch_unwind(|| assert_budget_depth_within_serde_json_limit(deepest + 1))
            .is_err()
    );
}

#[derive(serde::Deserialize)]
struct MemorySegment {
    text: String,
    count: usize,
}

/// The input a memory qualification case generates from its segments. The length is bounded
/// by the ceiling before `repeat` allocates: an absurd count fails by name instead of
/// allocating, or panicking on a capacity overflow.
fn generate_memory_input(
    segments: &[MemorySegment],
    field: &str,
    ceiling: u64,
) -> Result<Vec<u8>, String> {
    let exceeds = || format!("segments exceed the {field} ceiling of {ceiling} octets");
    let mut length: u64 = 0;
    for segment in segments {
        let segment_length = u64::try_from(segment.text.len())
            .ok()
            .and_then(|text| text.checked_mul(u64::try_from(segment.count).ok()?))
            .ok_or_else(exceeds)?;
        length = length
            .checked_add(segment_length)
            .filter(|total| *total <= ceiling)
            .ok_or_else(exceeds)?;
    }
    let mut bytes = Vec::with_capacity(usize::try_from(length).map_err(|_| exceeds())?);
    for segment in segments {
        bytes.extend(segment.text.repeat(segment.count).into_bytes());
    }
    Ok(bytes)
}

#[test]
fn memory_qualification_generator_fails_by_name_before_allocating() {
    let ceiling = 8_388_608;
    let segments = |count: usize| {
        vec![MemorySegment {
            text: "[]".to_owned(),
            count,
        }]
    };
    let expected = Err(format!(
        "segments exceed the policyInput ceiling of {ceiling} octets"
    ));
    // Lengths only: a failing comparison must not print megabytes of generated input.
    // Without the check first, `repeat` panics on a capacity overflow for usize::MAX copies.
    assert_eq!(
        generate_memory_input(&segments(usize::MAX), "policyInput", ceiling)
            .map(|bytes| bytes.len()),
        expected
    );
    assert_eq!(
        generate_memory_input(&segments(4_194_305), "policyInput", ceiling)
            .map(|bytes| bytes.len()),
        expected
    );
    assert_eq!(
        generate_memory_input(&segments(4_194_304), "policyInput", ceiling)
            .map(|bytes| bytes.len()),
        Ok(8_388_608)
    );
}

#[test]
fn policy_core_v3_memory_qualification_inputs_are_refused_at_the_ceiling() {
    let qualification: Value = serde_json::from_str(include_str!(
        "../../../contracts/fixtures/policy-core-v3/memory-qualification.v1.json"
    ))
    .expect("memory qualification inputs");
    let budgets: Value = serde_json::from_str(include_str!(
        "../../../contracts/fixtures/policy-core-v2/resource-budgets.v1.json"
    ))
    .expect("policy-core resource budgets");
    let maximum_depth = policy_core_budget_depth();
    let cases = qualification["cases"].as_array().expect("memory cases");
    assert!(!cases.is_empty());
    for case in cases {
        let id = case["id"].as_str().expect("memory case id");
        let segments: Vec<MemorySegment> =
            serde_json::from_value(case["segments"].clone()).expect("segments");
        let field = match case["argument"].as_str().expect("argument") {
            "policy" => "policyInput",
            "snapshot" => "snapshotInput",
            "need" => "needInput",
            other => panic!("{id}: unknown argument {other}"),
        };
        let ceiling = budgets["byteLimits"][field].as_u64().expect("byte ceiling");
        let bytes = generate_memory_input(&segments, field, ceiling)
            .unwrap_or_else(|error| panic!("{id}: {error}"));
        assert_eq!(bytes.len() as u64, ceiling, "{id}: at the ceiling");
        assert_eq!(
            sha256_hex(&bytes),
            case["inputSha256"].as_str().expect("digest"),
            "{id}: SHA-256"
        );
        assert_eq!(
            policy_core_v3_defect(&bytes, maximum_depth),
            case["defect"].as_str(),
            "{id}: class"
        );
        assert_eq!(
            case["expectedErrors"],
            json!({"policy-core-v3": {"variant": "input-invalid"}}),
            "{id}: component refusal"
        );
    }
    println!(
        "policy-core-v3 memory qualification (Rust): {} input(s) at the ceiling",
        cases.len()
    );
}

#[test]
fn rfc_8259_grammar_recognizer_separates_grammar_from_semantic_classes() {
    for (text, grammatical) in [
        (r#"{"a":[1,-0.5e+3,true,false,null,"𝄞"]}"#, true),
        (r#"{"a":1,"a":2}"#, true),
        (r#""\uD800""#, true),
        ("1e400", true),
        (" [ ] ", true),
        ("[1x]", false),
        (r#""\ud800\uZZZZ""#, false),
        (r#"{"key":1,"key":2,}"#, false),
        ("01", false),
        ("+1", false),
        ("1.", false),
        ("NaN", false),
        ("", false),
        ("[", false),
        ("\"\u{1}\"", false),
        ("[1]]", false),
        (r#"{"a"}"#, false),
    ] {
        assert_eq!(
            rfc_8259_grammar(text.as_bytes()).is_ok(),
            grammatical,
            "{text:?}"
        );
    }
}

#[test]
fn rust_test_canonicalizer_matches_rfc_8785_number_rendering() {
    for (value, expected) in [
        (json!(1.5), "1.5"),
        (json!(0.000001), "0.000001"),
        (json!(1e-7), "1e-7"),
        (json!(1e21), "1e+21"),
        (
            serde_json::from_str("333333333.33333329").unwrap(),
            "333333333.3333333",
        ),
        (json!(-0.0), "0"),
    ] {
        assert_eq!(String::from_utf8(canonical_json(&value)).unwrap(), expected);
    }
}

#[test]
fn policy_core_golden_hashes_are_portable_and_order_stable() {
    let golden: Value = serde_json::from_str(include_str!(
        "../../../contracts/fixtures/policy-core-v1/golden.json"
    ))
    .expect("policy-core golden vectors");
    assert_eq!(
        golden["schemaVersion"],
        "libre-ai.policy-core-golden-vectors.v1"
    );
    assert_eq!(golden["engineVersion"], "1.0.0");

    let cases = golden["cases"].as_array().expect("golden cases");
    assert_eq!(cases.len(), 17);
    let mut order_outputs = Vec::new();
    let mut saw_fractional_number = false;
    let mut saw_tenant_mismatch = false;
    let mut saw_invalid_duplicate = false;
    let mut saw_duplicate_rule_id = false;

    for case in cases {
        let case_id = case["id"].as_str().expect("case id");
        if case_id == "duplicate-exact-fact" {
            assert_eq!(case["expectedError"]["code"], "policy.input_invalid");
            saw_invalid_duplicate = true;
            continue;
        }

        let policy = &case["policy"];
        let policy_subject = json!({
            "schemaVersion": policy["schemaVersion"],
            "id": policy["id"],
            "tenantId": policy["tenantId"],
            "version": policy["version"],
            "status": policy["status"],
            "rules": policy["rules"],
        });
        let policy_digest = digest(
            "libre-ai.policy-definition.v1",
            policy_subject,
            Some("policy"),
        );
        assert_eq!(policy["digest"], policy_digest, "{case_id}: policy digest");
        assert_eq!(
            policy["approval"]["subjectDigest"], policy_digest,
            "{case_id}: approval subject digest"
        );

        let snapshot = &case["snapshot"];
        assert_eq!(
            snapshot["digest"],
            digest(
                "libre-ai.model-snapshot.v1",
                without(snapshot, &["digest"]),
                Some("snapshot")
            ),
            "{case_id}: snapshot digest"
        );
        let need = &case["need"];
        assert_eq!(
            need["digest"],
            digest(
                "libre-ai.policy-need.v1",
                without(need, &["digest"]),
                Some("need")
            ),
            "{case_id}: need digest"
        );

        if let Some(error) = case.get("expectedError") {
            match error["code"].as_str().expect("error code") {
                "policy.tenant_mismatch" => saw_tenant_mismatch = true,
                "policy.rule_id_duplicate" => saw_duplicate_rule_id = true,
                code => panic!("unexpected schema-valid error vector: {code}"),
            }
            continue;
        }

        let evaluation = &case["expectedEvaluation"];
        let evaluation_digest = digest(
            "libre-ai.policy-evaluation.v1",
            without(evaluation, &["id", "digest"]),
            None,
        );
        assert_eq!(
            evaluation["digest"], evaluation_digest,
            "{case_id}: evaluation digest"
        );
        assert_eq!(
            evaluation["id"],
            format!("urn:libre-ai:evaluation:{evaluation_digest}"),
            "{case_id}: evaluation id"
        );

        let rule_ids = evaluation["ruleResults"]
            .as_array()
            .expect("rule results")
            .iter()
            .map(|result| result["ruleId"].as_str().expect("rule id"))
            .collect::<Vec<_>>();
        assert!(
            rule_ids.windows(2).all(|pair| pair[0] < pair[1]),
            "{case_id}: rule results are not strictly sorted"
        );
        if case_id.starts_with("order-independence-") {
            order_outputs.push(evaluation.clone());
        }
        if case_id == "fractional-number-jcs" {
            assert_eq!(case["snapshot"]["facts"][0]["value"], json!(0.000001));
            saw_fractional_number = true;
        }
    }

    assert!(saw_fractional_number);
    assert!(saw_tenant_mismatch);
    assert!(saw_invalid_duplicate);
    assert!(saw_duplicate_rule_id);
    assert_eq!(order_outputs.len(), 2);
    assert_eq!(order_outputs[0], order_outputs[1]);
}

#[test]
fn policy_core_v2_golden_hashes_are_portable_and_enforce_approval_separation() {
    let golden: Value = serde_json::from_str(include_str!(
        "../../../contracts/fixtures/policy-core-v2/golden.json"
    ))
    .expect("policy-core v2 golden vectors");
    assert_v2_payload_golden(&golden, "libre-ai.policy-core-golden-vectors.v2", "2.0.0");
}

// policy-core-v3 keeps the v2 payloads and digest labels; only the engine version of its
// evaluations differs (contracts/wit/policy-core-v3/SEMANTICS.md, change C1).
#[test]
fn policy_core_v3_golden_hashes_are_portable_and_enforce_approval_separation() {
    let golden: Value = serde_json::from_str(include_str!(
        "../../../contracts/fixtures/policy-core-v3/golden.json"
    ))
    .expect("policy-core v3 golden vectors");
    assert_v2_payload_golden(&golden, "libre-ai.policy-core-golden-vectors.v3", "3.0.0");
    for case in golden["cases"].as_array().expect("golden cases") {
        if let Some(evaluation) = case.get("expectedEvaluation") {
            assert_eq!(evaluation["engineVersion"], "3.0.0", "{}", case["id"]);
        }
    }
}

fn assert_v2_payload_golden(golden: &Value, schema_version: &str, engine_version: &str) {
    assert_eq!(golden["schemaVersion"], schema_version);
    assert_eq!(golden["engineVersion"], engine_version);

    let cases = golden["cases"].as_array().expect("golden cases");
    assert_eq!(cases.len(), 20);
    let mut order_outputs = Vec::new();
    let mut error_variants = HashSet::new();
    let mut saw_fractional_number = false;
    let mut saw_tenant_mismatch = false;
    let mut saw_invalid_duplicate = false;
    let mut saw_duplicate_rule_id = false;
    let mut saw_evaluated_at_invalid = false;
    let mut saw_digest_mismatch = false;
    let mut saw_self_approval = false;

    for case in cases {
        let case_id = case["id"].as_str().expect("case id");
        let error_variant = case
            .get("expectedError")
            .map(|error| error["variant"].as_str().expect("WIT error variant"));
        if let Some(variant) = error_variant {
            error_variants.insert(variant);
        }
        if case_id == "duplicate-exact-fact" {
            assert_eq!(error_variant, Some("input-invalid"));
            saw_invalid_duplicate = true;
            continue;
        }

        let policy = &case["policy"];
        let policy_subject = json!({
            "schemaVersion": policy["schemaVersion"],
            "id": policy["id"],
            "tenantId": policy["tenantId"],
            "version": policy["version"],
            "status": policy["status"],
            "proposedBy": policy["proposedBy"],
            "rules": policy["rules"],
        });
        let policy_digest = digest(
            "libre-ai.policy-definition.v2",
            policy_subject,
            Some("policy"),
        );
        let policy_digest_valid = policy["digest"] == policy_digest
            && policy["approval"]["subjectDigest"] == policy_digest;
        let self_approval = policy["approval"]["approverId"] == policy["proposedBy"];
        let policy_rule_ids = policy["rules"]
            .as_array()
            .expect("policy rules")
            .iter()
            .map(|rule| rule["id"].as_str().expect("rule id"))
            .collect::<Vec<_>>();
        let duplicate_rule_id =
            policy_rule_ids.iter().collect::<HashSet<_>>().len() != policy_rule_ids.len();
        let tenants_match = policy["tenantId"] == case["snapshot"]["tenantId"]
            && policy["tenantId"] == case["need"]["tenantId"];

        let snapshot = &case["snapshot"];
        let snapshot_digest_valid = snapshot["digest"]
            == digest(
                "libre-ai.model-snapshot.v2",
                without(snapshot, &["digest"]),
                Some("snapshot"),
            );
        let need = &case["need"];
        let need_digest_valid = need["digest"]
            == digest(
                "libre-ai.policy-need.v2",
                without(need, &["digest"]),
                Some("need"),
            );
        let all_digests_valid = policy_digest_valid && snapshot_digest_valid && need_digest_valid;
        assert_eq!(
            all_digests_valid,
            error_variant != Some("digest-mismatch"),
            "{case_id}: digest condition"
        );
        assert_eq!(
            duplicate_rule_id,
            error_variant == Some("rule-id-duplicate"),
            "{case_id}: duplicate rule condition"
        );
        assert_eq!(
            self_approval,
            error_variant == Some("approval-invalid"),
            "{case_id}: approval separation condition"
        );
        assert_eq!(
            tenants_match,
            error_variant != Some("tenant-mismatch"),
            "{case_id}: tenant condition"
        );
        let evaluated_at_valid = chrono::NaiveDateTime::parse_from_str(
            case["evaluatedAt"].as_str().expect("evaluatedAt"),
            "%Y-%m-%dT%H:%M:%SZ",
        )
        .is_ok();
        assert_eq!(
            evaluated_at_valid,
            error_variant != Some("evaluated-at-invalid"),
            "{case_id}: evaluatedAt condition"
        );

        if let Some(variant) = error_variant {
            match variant {
                "tenant-mismatch" => saw_tenant_mismatch = true,
                "rule-id-duplicate" => saw_duplicate_rule_id = true,
                "evaluated-at-invalid" => saw_evaluated_at_invalid = true,
                "digest-mismatch" => saw_digest_mismatch = true,
                "approval-invalid" => saw_self_approval = true,
                other => panic!("unexpected schema-valid v2 error vector: {other}"),
            }
            continue;
        }

        let evaluation = &case["expectedEvaluation"];
        let evaluation_digest = digest(
            "libre-ai.policy-evaluation.v2",
            without(evaluation, &["id", "digest"]),
            None,
        );
        assert_eq!(
            evaluation["digest"], evaluation_digest,
            "{case_id}: evaluation digest"
        );
        assert_eq!(
            evaluation["id"],
            format!("urn:libre-ai:evaluation:{evaluation_digest}"),
            "{case_id}: evaluation id"
        );

        let rule_ids = evaluation["ruleResults"]
            .as_array()
            .expect("rule results")
            .iter()
            .map(|result| result["ruleId"].as_str().expect("rule id"))
            .collect::<Vec<_>>();
        assert!(
            rule_ids.windows(2).all(|pair| pair[0] < pair[1]),
            "{case_id}: rule results are not strictly sorted"
        );
        if case_id.starts_with("order-independence-") {
            order_outputs.push(evaluation.clone());
        }
        if case_id == "fractional-number-jcs" {
            assert_eq!(case["snapshot"]["facts"][0]["value"], json!(0.000001));
            saw_fractional_number = true;
        }
    }

    assert!(saw_fractional_number);
    assert!(saw_tenant_mismatch);
    assert!(saw_invalid_duplicate);
    assert!(saw_duplicate_rule_id);
    assert!(saw_evaluated_at_invalid);
    assert!(saw_digest_mismatch);
    assert!(saw_self_approval);
    assert_eq!(
        error_variants,
        HashSet::from([
            "input-invalid",
            "evaluated-at-invalid",
            "rule-id-duplicate",
            "approval-invalid",
            "digest-mismatch",
            "tenant-mismatch",
        ])
    );
    assert_eq!(order_outputs.len(), 2);
    assert_eq!(order_outputs[0], order_outputs[1]);
}

#[test]
fn policy_core_v2_resource_budgets_match_schema_maxima() {
    let budgets: Value = serde_json::from_str(include_str!(
        "../../../contracts/fixtures/policy-core-v2/resource-budgets.v1.json"
    ))
    .expect("policy-core v2 resource budgets");
    assert_eq!(
        budgets["schemaVersion"],
        "libre-ai.policy-core-resource-budgets.v1"
    );
    assert_eq!(budgets["status"], "candidate-preimplementation");

    let bytes = &budgets["byteLimits"];
    let policy_bytes = bytes["policyInput"].as_u64().expect("policy bytes");
    let snapshot_bytes = bytes["snapshotInput"].as_u64().expect("snapshot bytes");
    let need_bytes = bytes["needInput"].as_u64().expect("need bytes");
    assert_eq!(policy_bytes, 8 * 1024 * 1024);
    assert_eq!(snapshot_bytes, 8 * 1024 * 1024);
    assert_eq!(need_bytes, 8 * 1024 * 1024);
    assert_eq!(
        bytes["totalJsonInput"].as_u64(),
        Some(policy_bytes + snapshot_bytes + need_bytes)
    );
    assert_eq!(bytes["evaluatedAt"], 20);
    assert_eq!(bytes["successfulOutput"], 2 * 1024 * 1024);

    let boundary_cases = budgets["byteBoundaryCases"]
        .as_array()
        .expect("byte boundary cases");
    assert_eq!(boundary_cases.len(), 10);
    let mut boundary_ids = HashSet::new();
    for case in boundary_cases {
        let id = case["id"].as_str().expect("boundary id");
        assert!(boundary_ids.insert(id), "duplicate boundary id: {id}");
        let (target, limit, expected) = match id {
            "policy-at-limit" => ("policyInput", policy_bytes, "within-limit"),
            "policy-over-limit" => ("policyInput", policy_bytes + 1, "input-invalid"),
            "snapshot-at-limit" => ("snapshotInput", snapshot_bytes, "within-limit"),
            "snapshot-over-limit" => ("snapshotInput", snapshot_bytes + 1, "input-invalid"),
            "need-at-limit" => ("needInput", need_bytes, "within-limit"),
            "need-over-limit" => ("needInput", need_bytes + 1, "input-invalid"),
            "evaluated-at-at-limit" => ("evaluatedAt", 20, "within-limit"),
            "evaluated-at-over-limit" => ("evaluatedAt", 21, "input-invalid"),
            "output-at-limit" => ("successfulOutput", 2 * 1024 * 1024, "within-limit"),
            "output-over-limit" => ("successfulOutput", 2 * 1024 * 1024 + 1, "input-invalid"),
            other => panic!("unknown boundary id: {other}"),
        };
        assert_eq!(case["target"], target, "{id}: target");
        assert_eq!(case["byteLength"], limit, "{id}: byte length");
        let generated = vec![0_u8; usize::try_from(limit).expect("boundary fits usize")];
        let target_limit = bytes[target].as_u64().expect("target byte limit");
        let actual = if generated.len() as u64 > target_limit {
            "input-invalid"
        } else {
            "within-limit"
        };
        assert_eq!(actual, expected, "{id}: preflight");
        if expected == "input-invalid" {
            assert_eq!(case["expectedError"], expected, "{id}: expected error");
        } else {
            assert_eq!(
                case["expectedPreflight"], expected,
                "{id}: expected preflight"
            );
        }
    }

    let golden: Value = serde_json::from_str(include_str!(
        "../../../contracts/fixtures/policy-core-v2/golden.json"
    ))
    .expect("policy-core v2 golden vectors");
    let boundary_base = golden["cases"]
        .as_array()
        .expect("golden cases")
        .iter()
        .find(|case| case["id"] == "all-operators-eligible")
        .expect("boundary base case");
    for (label, value, limit) in [
        ("policy", &boundary_base["policy"], policy_bytes),
        ("snapshot", &boundary_base["snapshot"], snapshot_bytes),
        ("need", &boundary_base["need"], need_bytes),
    ] {
        let mut encoded = serde_json::to_vec(value).expect("boundary JSON");
        assert!(encoded.len() as u64 <= limit, "{label}: base exceeds limit");
        encoded.resize(usize::try_from(limit).expect("limit fits usize"), b' ');
        decode_strict_json(&encoded).unwrap_or_else(|error| panic!("{label}: {error}"));
        let parsed: Value = serde_json::from_slice(&encoded).expect("padded boundary JSON");
        assert_eq!(&parsed, value, "{label}: padded JSON changed value");
    }
    let canonical_evaluated_at = b"2026-07-16T00:00:00Z";
    assert_eq!(canonical_evaluated_at.len(), 20);
    assert!(
        chrono::NaiveDateTime::parse_from_str(
            std::str::from_utf8(canonical_evaluated_at).expect("evaluated-at UTF-8"),
            "%Y-%m-%dT%H:%M:%SZ"
        )
        .is_ok()
    );

    let output_limit = bytes["successfulOutput"]
        .as_u64()
        .expect("output byte limit");
    for (target_length, expected) in [
        (output_limit, "within-limit"),
        (output_limit + 1, "input-invalid"),
    ] {
        let mut output = boundary_base["expectedEvaluation"].clone();
        output["policyId"] = Value::String("urn:libre-ai:policy:a".to_owned());
        let initial_length = canonical_json(&output).len() as u64;
        let padding = target_length
            .checked_sub(initial_length)
            .expect("output target accommodates base");
        output["policyId"] = Value::String(format!(
            "urn:libre-ai:policy:a{}",
            "a".repeat(usize::try_from(padding).expect("padding fits usize"))
        ));
        let evaluation_digest = digest(
            "libre-ai.policy-evaluation.v2",
            without(&output, &["id", "digest"]),
            None,
        );
        output["id"] = Value::String(format!("urn:libre-ai:evaluation:{evaluation_digest}"));
        output["digest"] = Value::String(evaluation_digest);
        let output_bytes = canonical_json(&output);
        assert_eq!(output_bytes.len() as u64, target_length);
        let actual = if output_bytes.len() as u64 > output_limit {
            "input-invalid"
        } else {
            "within-limit"
        };
        assert_eq!(actual, expected);
    }

    let maximum_depth = budgets["decoderQualification"]["maximumJsonDepth"]
        .as_u64()
        .expect("maximum JSON depth");
    assert_eq!(maximum_depth, 64);
    let nested_json =
        |depth: usize| format!("{}0{}", "[".repeat(depth), "]".repeat(depth)).into_bytes();
    decode_strict_json(&nested_json(maximum_depth as usize)).expect("exact JSON depth");
    let depth_error = decode_strict_json(&nested_json(maximum_depth as usize + 1))
        .expect_err("excessive JSON depth accepted");
    assert!(depth_error.contains("maximum JSON depth exceeded"));

    let cardinality = &budgets["cardinalityLimits"];
    let rules = cardinality["rules"].as_u64().expect("rules");
    let model_facts = cardinality["modelFacts"].as_u64().expect("model facts");
    let need_facts = cardinality["needFacts"].as_u64().expect("need facts");
    let set_members = cardinality["setMembersPerRule"]
        .as_u64()
        .expect("set members");
    let policy_schema: Value =
        serde_json::from_str(include_str!("../schemas/policy-definition.v2.schema.json"))
            .expect("policy schema");
    let snapshot_schema: Value =
        serde_json::from_str(include_str!("../schemas/model-snapshot.v2.schema.json"))
            .expect("snapshot schema");
    let need_schema: Value =
        serde_json::from_str(include_str!("../schemas/policy-need.v2.schema.json"))
            .expect("need schema");
    assert_eq!(policy_schema["properties"]["rules"]["maxItems"], rules);
    assert_eq!(
        snapshot_schema["properties"]["facts"]["maxItems"],
        model_facts
    );
    assert_eq!(need_schema["properties"]["facts"]["maxItems"], need_facts);
    let schema_set_members = policy_schema["$defs"]["factSet"]["oneOf"]
        .as_array()
        .expect("fact set variants")
        .iter()
        .filter_map(|variant| variant["maxItems"].as_u64())
        .max()
        .expect("fact set maximum");
    assert_eq!(set_members, schema_set_members);
    assert_eq!(cardinality["setMembersAcrossPolicy"], rules * set_members);

    let matched_pairs = rules * model_facts.max(need_facts);
    let comparisons_per_lookup = u64::from(set_members.ilog2() + 1);
    let cpu = &budgets["cpuQualification"];
    assert_eq!(cpu["ruleOccurrenceEvaluations"], matched_pairs);
    assert_eq!(cpu["setMemberComparisonsPerLookup"], comparisons_per_lookup);
    assert_eq!(
        cpu["setMemberComparisons"],
        matched_pairs * comparisons_per_lookup
    );
    assert_eq!(
        cpu["setLookup"],
        "sorted-binary-search-or-equivalent-bounded-lookup"
    );
    assert_eq!(cpu["duplicateDetection"], "canonical-hash-or-ordered-index");
    assert!(cpu["wallClockLimit"].is_null());
    assert_eq!(
        budgets["memoryQualification"]["peakComponentLinearMemoryBytes"],
        256 * 1024 * 1024
    );
}

#[test]
fn policy_core_operator_fixture_covers_the_closed_matrix() {
    let operators: Value = serde_json::from_str(include_str!(
        "../../../contracts/fixtures/policy-core-v1/operators.json"
    ))
    .expect("policy-core operator vectors");
    assert_eq!(
        operators["schemaVersion"],
        "libre-ai.policy-core-operator-vectors.v1"
    );
    assert_eq!(operators["vectors"].as_array().expect("vectors").len(), 28);
    assert!(
        operators["aggregationVectors"]
            .as_array()
            .expect("aggregation vectors")
            .len()
            >= 5
    );
    assert!(
        operators["invalidPolicyVectors"]
            .as_array()
            .expect("invalid vectors")
            .len()
            >= 10
    );

    let operators_v2: Value = serde_json::from_str(include_str!(
        "../../../contracts/fixtures/policy-core-v2/operators.json"
    ))
    .expect("policy-core v2 operator vectors");
    assert_eq!(
        operators_v2["schemaVersion"],
        "libre-ai.policy-core-operator-vectors.v2"
    );
    assert_eq!(
        operators_v2["vectors"].as_array().expect("vectors").len(),
        28
    );
}
