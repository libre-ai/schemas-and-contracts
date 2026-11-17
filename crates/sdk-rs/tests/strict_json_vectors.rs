use libre_ai_contract_types::strict_json::{
    CanonicalizeError, MAX_DEPTH, MAX_SAFE_INTEGER, StrictJsonDefect, StrictJsonError,
    canonicalize, parse,
};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

fn fixtures() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../contracts/fixtures")
}

/// An unreadable declared source is a failure, never an empty set.
fn read_json(path: &Path) -> Value {
    let bytes = fs::read(path).unwrap_or_else(|error| panic!("{}: {error}", path.display()));
    serde_json::from_slice(&bytes).unwrap_or_else(|error| panic!("{}: {error}", path.display()))
}

fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// Base64url without padding (RFC 4648 section 5), the encoding of `jsonBytes`.
fn base64url(text: &str) -> Vec<u8> {
    let mut output = Vec::new();
    let mut buffer: u32 = 0;
    let mut bits = 0;
    for byte in text.bytes() {
        let sextet = match byte {
            b'A'..=b'Z' => byte - b'A',
            b'a'..=b'z' => byte - b'a' + 26,
            b'0'..=b'9' => byte - b'0' + 52,
            b'-' => 62,
            b'_' => 63,
            other => panic!("not a base64url character: {other:#04x}"),
        };
        buffer = (buffer << 6) | u32::from(sextet);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            output.push(u8::try_from((buffer >> bits) & 0xff).expect("one octet"));
        }
    }
    output
}

/// `serde_json` reads the literal `-0` as the binary64 negative zero; the strict
/// reader reads it as the integer 0. This is the only value on which the two differ.
fn fold_negative_zero(value: Value) -> Value {
    match value {
        Value::Number(number) if number.is_f64() && number.as_f64() == Some(0.0) => json!(0),
        Value::Array(items) => Value::Array(items.into_iter().map(fold_negative_zero).collect()),
        Value::Object(members) => Value::Object(
            members
                .into_iter()
                .map(|(name, member)| (name, fold_negative_zero(member)))
                .collect(),
        ),
        other => other,
    }
}

/// Every accepted input is standard JSON with the same value, and canonicalization is
/// a fixed point over it.
fn assert_accepted(label: &str, bytes: &[u8]) -> Value {
    let value = parse(bytes).unwrap_or_else(|error| panic!("{label}: refused, {error}"));
    let standard: Value = serde_json::from_slice(bytes)
        .unwrap_or_else(|error| panic!("{label}: not standard JSON, {error}"));
    assert_eq!(
        value,
        fold_negative_zero(standard),
        "{label}: differs from a standard reader"
    );
    let canonical = canonicalize(&value).unwrap_or_else(|error| panic!("{label}: {error}"));
    let reread =
        parse(&canonical).unwrap_or_else(|error| panic!("{label}: canonical form, {error}"));
    assert_eq!(reread, value, "{label}: canonical form changes the value");
    assert_eq!(
        canonicalize(&reread),
        Ok(canonical),
        "{label}: canonical form is not stable"
    );
    value
}

fn refusal(defect: StrictJsonDefect, offset: usize) -> Result<Value, StrictJsonError> {
    Err(StrictJsonError { defect, offset })
}

/// U+1D11E written as an escaped surrogate pair, assembled so that the source holds
/// the escape and never the character.
const G_CLEF_ESCAPED: &str = concat!(r"\u", "D834", r"\u", "DD1E");

fn nested_arrays(depth: usize, innermost: &str) -> Vec<u8> {
    format!("{}{innermost}{}", "[".repeat(depth), "]".repeat(depth)).into_bytes()
}

#[test]
fn labels_and_constants_are_the_closed_lists() {
    let labels = [
        (StrictJsonDefect::Bom, "bom"),
        (StrictJsonDefect::InvalidUtf8, "invalid-utf8"),
        (StrictJsonDefect::DuplicateMember, "duplicate-member"),
        (StrictJsonDefect::UnpairedSurrogate, "unpaired-surrogate"),
        (StrictJsonDefect::MaxDepth, "max-depth"),
        (StrictJsonDefect::InvalidNumber, "invalid-number"),
        (StrictJsonDefect::UnsafeInteger, "unsafe-integer"),
        (StrictJsonDefect::InvalidJson, "invalid-json"),
    ];
    for (defect, label) in labels {
        assert_eq!(defect.as_str(), label);
    }
    assert_eq!(
        CanonicalizeError::NonIntegerNumber.as_str(),
        "non_integer_number"
    );
    assert_eq!(CanonicalizeError::MaxDepth.as_str(), "max-depth");
    assert_eq!(MAX_DEPTH, 64);
    assert_eq!(MAX_SAFE_INTEGER, 9_007_199_254_740_991);
}

#[test]
fn policy_core_raw_inputs_are_refused_with_their_defect() {
    let root = fixtures().join("policy-core-invalid-json");
    let manifest = read_json(&root.join("manifest.json"));
    let cases = manifest["cases"].as_array().expect("raw input cases");
    let mut classes = BTreeSet::new();
    let mut verified = 0;

    for case in cases {
        let id = case["id"].as_str().expect("raw input id");
        let file = case["file"].as_str().expect("raw input file");
        let expected = case["defect"].as_str().expect("raw input defect");
        let bytes = fs::read(root.join(file)).unwrap_or_else(|error| panic!("{id}: {error}"));
        let error = parse(&bytes).expect_err(id);
        assert_eq!(error.defect.as_str(), expected, "{id}");
        classes.insert(expected.to_owned());
        verified += 1;
    }

    assert_ne!(verified, 0, "no raw input case read");
    assert_eq!(verified, cases.len());
    for class in [
        "bom",
        "invalid-utf8",
        "duplicate-member",
        "unpaired-surrogate",
        "invalid-number",
    ] {
        assert!(classes.contains(class), "class never met: {class}");
    }
    println!(
        "policy-core raw inputs: {verified} case(s) refused, {} class(es)",
        classes.len()
    );
}

enum Golden {
    /// Accepted; the output is the canonical form of `expected.ok`.
    Canonical,
    /// Refused by `parse` with this defect.
    Refused(StrictJsonDefect),
}

fn golden_canonicalize_expectations() -> BTreeMap<&'static str, Golden> {
    BTreeMap::from([
        ("canonicalize-sort-ascii", Golden::Canonical),
        ("canonicalize-nested", Golden::Canonical),
        ("canonicalize-non-ascii-literal", Golden::Canonical),
        ("canonicalize-control-escape", Golden::Canonical),
        ("canonicalize-utf16-key-order", Golden::Canonical),
        ("canonicalize-safe-integer", Golden::Canonical),
        // Intended gap: the candidate semantics reads `1.0`, `1e2` and `10E-1` as
        // integers, this reader refuses the literals.
        (
            "canonicalize-integral-forms",
            Golden::Refused(StrictJsonDefect::InvalidNumber),
        ),
        (
            "canonicalize-float",
            Golden::Refused(StrictJsonDefect::InvalidNumber),
        ),
        (
            "canonicalize-two-pow-53",
            Golden::Refused(StrictJsonDefect::UnsafeInteger),
        ),
        (
            "canonicalize-non-finite",
            Golden::Refused(StrictJsonDefect::InvalidNumber),
        ),
        (
            "canonicalize-duplicate-member",
            Golden::Refused(StrictJsonDefect::DuplicateMember),
        ),
        (
            "canonicalize-byte-order-mark",
            Golden::Refused(StrictJsonDefect::Bom),
        ),
        (
            "canonicalize-lone-surrogate",
            Golden::Refused(StrictJsonDefect::UnpairedSurrogate),
        ),
        (
            "canonicalize-depth-65",
            Golden::Refused(StrictJsonDefect::MaxDepth),
        ),
    ])
}

#[test]
fn signalement_golden_canonicalize_cases_follow_the_declared_split() {
    let root = fixtures().join("signalement-policy-receipt-v1");
    let entry = read_json(&root.join("golden-vectors.v1.json"));
    let mut documents = Vec::new();
    for part in entry["parts"].as_array().expect("declared parts") {
        documents.push(read_json(&root.join(part.as_str().expect("part name"))));
    }
    documents.insert(0, entry);

    let expectations = golden_canonicalize_expectations();
    let mut met = BTreeSet::new();
    let mut read = 0;
    let mut canonical = 0;
    let mut refused = 0;

    for document in &documents {
        for case in document["cases"].as_array().expect("golden cases") {
            if case["operation"] != "canonicalize" {
                continue;
            }
            read += 1;
            let id = case["id"].as_str().expect("case id");
            let bytes = base64url(case["args"]["jsonBytes"].as_str().expect("jsonBytes"));
            let expectation = expectations
                .get(id)
                .unwrap_or_else(|| panic!("canonicalize case outside the declared split: {id}"));
            assert!(met.insert(id.to_owned()), "{id}: met twice");
            match expectation {
                Golden::Canonical => {
                    let expected = case["expected"]
                        .get("ok")
                        .unwrap_or_else(|| panic!("{id}: no expected.ok"));
                    let value = assert_accepted(id, &bytes);
                    assert_eq!(&value, expected, "{id}: value");
                    assert_eq!(canonicalize(&value), canonicalize(expected), "{id}: octets");
                    canonical += 1;
                }
                Golden::Refused(defect) => {
                    let error = parse(&bytes).expect_err(id);
                    assert_eq!(error.defect, *defect, "{id}");
                    if id != "canonicalize-integral-forms" {
                        assert!(case["expected"].get("error").is_some(), "{id}: no error");
                    }
                    refused += 1;
                }
            }
        }
    }

    assert_eq!(canonical + refused, read, "a canonicalize case was skipped");
    assert_eq!(
        met.len(),
        expectations.len(),
        "a declared case was never met"
    );
    println!(
        "signalement golden canonicalize: {read} read = {canonical} canonical + {refused} refused"
    );
}

#[test]
fn canonical_octets_reproduce_the_locked_digests() {
    for (directory, list) in [
        ("authorized-execution-v1", "cases"),
        ("agent-orchestration-v1", "vectors"),
    ] {
        let document = read_json(&fixtures().join(directory).join("digest-vectors.v1.json"));
        let vectors = document[list].as_array().expect("digest vectors");
        let mut verified = 0;
        for vector in vectors {
            let id = vector["id"].as_str().expect("vector id");
            let payload = vector
                .get("unsignedPayload")
                .unwrap_or_else(|| panic!("{directory}/{id}: no unsignedPayload"));
            let octets =
                canonicalize(payload).unwrap_or_else(|error| panic!("{directory}/{id}: {error}"));
            assert_eq!(
                sha256_hex(&octets),
                vector["expectedDigest"].as_str().expect("expected digest"),
                "{directory}/{id}"
            );
            verified += 1;
        }
        assert_ne!(verified, 0, "{directory}: no digest vector read");
        assert_eq!(verified, vectors.len());
        println!("{directory}: {verified} digest(s) reproduced");
    }
}

#[test]
fn gap_table_refusals() {
    use StrictJsonDefect::{
        DuplicateMember, InvalidJson, InvalidNumber, MaxDepth, UnpairedSurrogate, UnsafeInteger,
    };
    // (input, defect, offset when the brief gives or fixes it).
    let table: Vec<(Vec<u8>, StrictJsonDefect, Option<usize>)> = vec![
        (br#"{"a":1,"a":2}"#.to_vec(), DuplicateMember, Some(7)),
        (b"1.5".to_vec(), InvalidNumber, Some(0)),
        (b"1e3".to_vec(), InvalidNumber, Some(0)),
        (b"01".to_vec(), InvalidNumber, Some(0)),
        (b"1.0".to_vec(), InvalidNumber, Some(0)),
        (b"9007199254740992".to_vec(), UnsafeInteger, Some(0)),
        (b"-9007199254740992".to_vec(), UnsafeInteger, Some(0)),
        // The defect is at the backslash of the lone escape.
        (br#""\ud800""#.to_vec(), UnpairedSurrogate, Some(1)),
        // A raw U+0001 inside a string, at its own offset.
        (b"\"\x01\"".to_vec(), InvalidJson, Some(1)),
        (br#""\x""#.to_vec(), InvalidJson, None),
        (b"1 2".to_vec(), InvalidJson, Some(2)),
        (b"".to_vec(), InvalidJson, Some(0)),
        (nested_arrays(65, ""), MaxDepth, Some(64)),
        // The scalar is at depth 65.
        (nested_arrays(64, "0"), MaxDepth, Some(64)),
        (nested_arrays(100_000, ""), MaxDepth, Some(64)),
    ];

    for (index, (input, defect, offset)) in table.iter().enumerate() {
        let error = parse(input).expect_err("gap table refusal accepted");
        assert_eq!(error.defect, *defect, "row {index}");
        if let Some(offset) = offset {
            assert_eq!(error.offset, *offset, "row {index}");
        }
    }
    assert_eq!(table.len(), 15);
}

#[test]
fn gap_table_refusals_keep_first_defect_order() {
    // A byte order mark inside a string is content; at the start it wins over
    // everything, and invalid UTF-8 anywhere wins over the scan.
    assert_eq!(
        parse(b"\xef\xbb\xbf\xff"),
        refusal(StrictJsonDefect::Bom, 0)
    );
    assert_eq!(parse(b"01 \xff"), refusal(StrictJsonDefect::InvalidUtf8, 3));
    assert_eq!(
        parse(br#"[01,{"a":1,"a":2}]"#),
        refusal(StrictJsonDefect::InvalidNumber, 1)
    );
}

#[test]
fn gap_table_acceptances() {
    let table: Vec<(Vec<u8>, Value)> = vec![
        (
            b"9007199254740991".to_vec(),
            json!(9_007_199_254_740_991_u64),
        ),
        (
            b"-9007199254740991".to_vec(),
            json!(-9_007_199_254_740_991_i64),
        ),
        (b"-0".to_vec(), json!(0)),
        (nested_arrays(64, ""), {
            let mut value = json!([]);
            for _ in 1..64 {
                value = json!([value]);
            }
            value
        }),
        ("\"a\u{feff}b\"".as_bytes().to_vec(), json!("a\u{feff}b")),
        ("\"\u{1f600}\"".as_bytes().to_vec(), json!("\u{1f600}")),
        ("\"\u{1d11e}\"".as_bytes().to_vec(), json!("\u{1d11e}")),
        (
            format!("\"{G_CLEF_ESCAPED}\"").into_bytes(),
            json!("\u{1d11e}"),
        ),
        (
            br#"{"__proto__":1,"constructor":2,"prototype":3}"#.to_vec(),
            json!({"__proto__": 1, "constructor": 2, "prototype": 3}),
        ),
        (
            format!(
                r#"{{"key":1,"kEy":2,"value":"{G_CLEF_ESCAPED}","numbers":[0,-1,9007199254740991]}}"#
            )
            .into_bytes(),
            json!({
                "key": 1,
                "kEy": 2,
                "value": "\u{1d11e}",
                "numbers": [0, -1, 9_007_199_254_740_991_u64],
            }),
        ),
        (b" \t\r\n[ 1 , true , false , null ] \n".to_vec(), json!([1, true, false, null])),
    ];

    for (index, (input, expected)) in table.iter().enumerate() {
        let value = assert_accepted(&format!("row {index}"), input);
        assert_eq!(&value, expected, "row {index}");
    }
    assert_eq!(table.len(), 11);
}

#[test]
fn gap_table_canonicalize() {
    assert_eq!(
        canonicalize(&json!({"\u{1f600}": 2, "\u{20ac}": 1})),
        Ok("{\"\u{20ac}\":1,\"\u{1f600}\":2}".as_bytes().to_vec())
    );
    // Candidate semantics, canonicalize step 5: U+1F600, written D83D DE00, sorts
    // before U+FF21. Code point order and UTF-8 octet order both give the reverse.
    assert_eq!(
        canonicalize(&json!({"\u{ff21}": 1, "\u{1f600}": 2})),
        Ok("{\"\u{1f600}\":2,\"\u{ff21}\":1}".as_bytes().to_vec())
    );
    // Same step: only the escapes the RFC requires, `\u00xx` in lowercase.
    assert_eq!(
        canonicalize(&json!("\u{1f}/A\"\\\u{8}\t\n\u{c}\r\u{0}\u{7f}\u{e9}")),
        Ok([
            br#"""#.as_slice(),
            br"\u001f/A",
            br#"\"\\\b\t\n\f\r"#,
            br"\u0000",
            "\u{7f}\u{e9}".as_bytes(),
            br#"""#.as_slice(),
        ]
        .concat())
    );
    let prototype = parse(br#"{"__proto__":1,"a":2}"#).expect("ordinary member names");
    assert_eq!(
        canonicalize(&prototype),
        Ok(br#"{"__proto__":1,"a":2}"#.to_vec())
    );
    let negative_zero = parse(b"-0").expect("negative zero");
    assert_eq!(canonicalize(&negative_zero), Ok(b"0".to_vec()));

    for number in [json!(1.5), json!(1.0), json!(9_007_199_254_740_992_u64)] {
        assert_eq!(
            canonicalize(&json!([number])),
            Err(CanonicalizeError::NonIntegerNumber)
        );
    }

    let mut nested = json!([]);
    for _ in 1..64 {
        nested = json!([nested]);
    }
    assert!(canonicalize(&nested).is_ok(), "64 nested arrays");
    assert_eq!(
        canonicalize(&json!([nested])),
        Err(CanonicalizeError::MaxDepth),
        "65 nested arrays"
    );
}

#[test]
fn error_text_carries_no_octet_of_the_input() {
    let error = parse(br#"{"secret-marker":1,"secret-marker":2}"#).expect_err("duplicate member");
    assert_eq!(error.defect, StrictJsonDefect::DuplicateMember);
    let text = error.to_string();
    assert!(!text.contains("secret-marker"), "{text}");
    assert_eq!(text, "duplicate-member at byte offset 19");
}

#[test]
fn module_source_has_no_abort_path() {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("src/strict_json.rs");
    let source = fs::read_to_string(&path).unwrap_or_else(|error| panic!("{error}"));
    let mut lines = 0;
    for (index, line) in source.lines().enumerate() {
        lines += 1;
        // The label of `UnsafeInteger` is the one admitted occurrence of the word.
        let scanned = line.replace("\"unsafe-integer\"", "");
        for forbidden in ["unwrap()", "expect(", "panic!", "unsafe"] {
            assert!(
                !scanned.contains(forbidden),
                "line {}: {forbidden}",
                index + 1
            );
        }
    }
    assert_ne!(lines, 0, "module source is empty");
    println!("strict_json.rs: {lines} line(s) scanned");
}
