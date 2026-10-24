//! Independent receipt-signature-corpus oracle only; no producer, registry or signing key.
//!
//! It reads the octets of `signature-vectors.v1.json` and of every continuation file the entry
//! declares, and decides each vector's class (`valid`, `invalid`, `unknown-key`, `unreadable`,
//! `refused`) with ed25519-dalek `verify_strict` plus curve25519-dalek point checks. It shares no
//! code with the TypeScript verifier and never looks up fixture points: a forged key is judged
//! from its own octets.
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use curve25519_dalek::{edwards::CompressedEdwardsY, traits::IsIdentity};
use ed25519_dalek::{Signature, Signer, SigningKey, VerifyingKey};
use serde_json::{Map, Value};
use sha2::{Digest, Sha256};
use std::{
    env, fs,
    io::{self, Read},
    path::Path,
};

const SCHEMA_VERSION: &str = "libre-ai.signalement-projection-receipt-signature-vectors.v1";
/// The signing domain of DL5, restated here rather than read from the corpus: a corpus whose
/// `domain` drifted together with its generator would otherwise verify against itself.
const DOMAIN: &str = "libre-ai.signalement-projection-receipt.v1";
const ENTRY_NAME: &str = "signature-vectors.v1.json";
const STEM: &str = "signature-vectors.v1";
const MAX_FILE_OCTETS: u64 = 1024 * 1024;
const ENTRY_MEMBERS: [&str; 6] = [
    "schemaVersion",
    "testMaterialWarning",
    "domain",
    "parts",
    "vectors",
    "signCases",
];
const PART_MEMBERS: [&str; 2] = ["schemaVersion", "vectors"];
/// Compiled in so that the success line names the versions the build resolved, not a literal.
const CARGO_LOCK: &str = include_str!("../Cargo.lock");

#[derive(Debug, PartialEq, Eq)]
struct Summary {
    vectors: usize,
    sign_cases: usize,
}

/// A receipt whose octets are its own `serde_json` serialization, with the members verification needs.
struct Receipt {
    organization: String,
    key_id: String,
    issued_at: String,
    signature: [u8; 64],
    unsigned: Value,
}

struct Key {
    key_id: String,
    public_key: [u8; 32],
    not_before: String,
    not_after: Option<String>,
}

struct KeySet {
    organization: String,
    keys: Vec<Key>,
}

fn admissible(bytes: &[u8]) -> bool {
    let Ok(array) = <[u8; 32]>::try_from(bytes) else {
        return false;
    };
    let Some(point) = CompressedEdwardsY(array).decompress() else {
        return false;
    };
    point.compress().to_bytes() == array && !point.is_identity() && point.is_torsion_free()
}

/// Canonical base64url without padding: re-encoding the decoded octets gives the same text.
fn canonical_base64url(encoded: &str) -> Option<Vec<u8>> {
    let decoded = URL_SAFE_NO_PAD.decode(encoded).ok()?;
    (URL_SAFE_NO_PAD.encode(&decoded) == encoded).then_some(decoded)
}

fn field(value: &Value, name: &str) -> Result<Vec<u8>, &'static str> {
    let encoded = value.get(name).and_then(Value::as_str).ok_or("field")?;
    canonical_base64url(encoded).ok_or("encoding")
}

/// `YYYY-MM-DDTHH:MM:SSZ`: one fixed width, so lexical order is chronological order.
fn timestamp(value: &Value) -> Option<String> {
    let text = value.as_str()?;
    let shaped = text.len() == 20
        && text.bytes().enumerate().all(|(index, octet)| match index {
            4 | 7 => octet == b'-',
            10 => octet == b'T',
            13 | 16 => octet == b':',
            19 => octet == b'Z',
            _ => octet.is_ascii_digit(),
        });
    shaped.then(|| text.to_owned())
}

fn integers_only(value: &Value) -> bool {
    match value {
        Value::Number(number) => number.is_i64() || number.is_u64(),
        Value::Array(items) => items.iter().all(integers_only),
        Value::Object(members) => members.values().all(integers_only),
        _ => true,
    }
}

/// `serde_json::to_vec` of a `Value` equals its JCS form (RFC 8785) when the text is ASCII (keys
/// sorted by octet equal keys sorted by UTF-16 unit, and no escaping difference) and every number
/// is an integer (no float formatting difference). `Map` sorts its keys because the
/// `preserve_order` feature is off. Outside that premise the oracle cannot decide, so it stops.
fn jcs_octets(value: &Value) -> Result<Vec<u8>, &'static str> {
    let octets = serde_json::to_vec(value).map_err(|_| "output")?;
    if !octets.is_ascii() || !integers_only(value) {
        return Err("jcs-premise");
    }
    Ok(octets)
}

fn signing_message(unsigned: &Value) -> Result<Vec<u8>, &'static str> {
    let mut message = DOMAIN.as_bytes().to_vec();
    message.push(0);
    message.extend_from_slice(&Sha256::digest(jcs_octets(unsigned)?));
    Ok(message)
}

/// `None` is the class `unreadable`. A duplicate member parses (last one wins) but then
/// serializes to fewer octets, so it fails the canonical comparison like any non-JCS text.
fn read_receipt(signed: &[u8]) -> Result<Option<Receipt>, &'static str> {
    let Ok(value) = serde_json::from_slice::<Value>(signed) else {
        return Ok(None);
    };
    if serde_json::to_vec(&value).map_err(|_| "output")? != signed {
        return Ok(None);
    }
    jcs_octets(&value)?;
    let Some(members) = value.as_object() else {
        return Ok(None);
    };
    let text = |name: &str| members.get(name).and_then(Value::as_str).map(str::to_owned);
    let (Some(organization), Some(key_id), Some(issued_at)) = (
        text("organization"),
        text("keyId"),
        members.get("issuedAt").and_then(timestamp),
    ) else {
        return Ok(None);
    };
    let Some(signature) = members.get("signature").and_then(Value::as_object) else {
        return Ok(None);
    };
    if signature.len() != 2 || signature.get("algorithm").and_then(Value::as_str) != Some("ed25519")
    {
        return Ok(None);
    }
    let Some(octets) = signature
        .get("value")
        .and_then(Value::as_str)
        .and_then(canonical_base64url)
    else {
        return Ok(None);
    };
    let Ok(signature) = <[u8; 64]>::try_from(octets.as_slice()) else {
        return Ok(None);
    };
    let mut unsigned = members.clone();
    unsigned.remove("signature");
    Ok(Some(Receipt {
        organization,
        key_id,
        issued_at,
        signature,
        unsigned: Value::Object(unsigned),
    }))
}

fn read_key(value: &Value) -> Option<Key> {
    let members = value.as_object()?;
    let key_id = members.get("keyId")?.as_str()?.to_owned();
    if members.get("algorithm")?.as_str()? != "ed25519" {
        return None;
    }
    let public_key = canonical_base64url(members.get("publicKey")?.as_str()?)?;
    let public_key = <[u8; 32]>::try_from(public_key.as_slice()).ok()?;
    let status = members.get("status")?.as_str()?;
    let not_before = timestamp(members.get("notBefore")?)?;
    let not_after = match members.get("notAfter")? {
        Value::Null => None,
        other => Some(timestamp(other)?),
    };
    let ordered = not_after.as_ref().is_none_or(|end| end > &not_before);
    let status_holds = match status {
        "active" => true,
        "retired" => not_after.is_some(),
        _ => false,
    };
    (ordered && status_holds).then_some(Key {
        key_id,
        public_key,
        not_before,
        not_after,
    })
}

/// `None` is the outcome `refused`: an unreadable key set verifies nothing.
fn read_key_set(value: &Value) -> Option<KeySet> {
    let organization = value.get("organization")?.as_str()?.to_owned();
    let keys = value
        .get("keys")?
        .as_array()?
        .iter()
        .map(read_key)
        .collect::<Option<Vec<Key>>>()?;
    let mut ids: Vec<&str> = keys.iter().map(|key| key.key_id.as_str()).collect();
    ids.sort_unstable();
    let before = ids.len();
    ids.dedup();
    (ids.len() == before).then_some(KeySet { organization, keys })
}

fn classify(vector: &Value) -> Result<&'static str, &'static str> {
    let Some(receipt) = read_receipt(&field(vector, "signed")?)? else {
        return Ok("unreadable");
    };
    let Some(key_set) = read_key_set(vector.get("keySet").ok_or("field")?) else {
        return Ok("refused");
    };
    if receipt.organization != key_set.organization {
        return Ok("invalid");
    }
    let Some(key) = key_set.keys.iter().find(|key| key.key_id == receipt.key_id) else {
        return Ok("unknown-key");
    };
    if receipt.issued_at < key.not_before
        || key
            .not_after
            .as_ref()
            .is_some_and(|end| &receipt.issued_at >= end)
    {
        return Ok("invalid");
    }
    if !admissible(&key.public_key) || !admissible(&receipt.signature[..32]) {
        return Ok("invalid");
    }
    let Ok(verifying_key) = VerifyingKey::from_bytes(&key.public_key) else {
        return Ok("invalid");
    };
    let message = signing_message(&receipt.unsigned)?;
    let signature = Signature::from_bytes(&receipt.signature);
    Ok(
        if verifying_key.verify_strict(&message, &signature).is_ok() {
            "valid"
        } else {
            "invalid"
        },
    )
}

fn expected_class(vector: &Value) -> Result<&str, &'static str> {
    let expected = vector
        .get("expected")
        .and_then(Value::as_object)
        .ok_or("expected")?;
    if expected.len() == 1 && expected.get("refused").is_some_and(Value::is_string) {
        return Ok("refused");
    }
    match expected.get("signature").and_then(Value::as_str) {
        Some(class @ ("valid" | "invalid" | "unknown-key" | "unreadable")) => Ok(class),
        _ => Err("expected"),
    }
}

/// Ed25519 is deterministic: the seed's signature over the unsigned receipt must rebuild `signed`.
fn check_sign_case(case: &Value) -> Result<(), &'static str> {
    let seed = <[u8; 32]>::try_from(field(case, "seed")?.as_slice()).map_err(|_| "sign-case")?;
    let mut document: Map<String, Value> = case
        .get("unsigned")
        .and_then(Value::as_object)
        .ok_or("sign-case")?
        .clone();
    if document.contains_key("signature") {
        return Err("sign-case");
    }
    let message = signing_message(&Value::Object(document.clone()))?;
    let signature = SigningKey::from_bytes(&seed).sign(&message);
    let mut member = Map::new();
    member.insert("algorithm".to_owned(), Value::from("ed25519"));
    member.insert(
        "value".to_owned(),
        Value::from(URL_SAFE_NO_PAD.encode(signature.to_bytes())),
    );
    document.insert("signature".to_owned(), Value::Object(member));
    if jcs_octets(&Value::Object(document))? != field(case, "signed")? {
        return Err("sign-case");
    }
    Ok(())
}

/// One corpus file: bounded size, a JSON object, the corpus `schemaVersion`.
fn parse_file(bytes: &[u8]) -> Result<Map<String, Value>, &'static str> {
    if bytes.len() as u64 > MAX_FILE_OCTETS {
        return Err("input-size");
    }
    let value: Value = serde_json::from_slice(bytes).map_err(|_| "json")?;
    let Value::Object(members) = value else {
        return Err("json");
    };
    if members.get("schemaVersion").and_then(Value::as_str) != Some(SCHEMA_VERSION) {
        return Err("version");
    }
    Ok(members)
}

/// `parts` absent: no continuation. Present: a non-empty list of distinct bare names
/// `signature-vectors.v1*.json`, none equal to the entry (SEMANTICS, continuation files).
fn declared_parts(entry: &Map<String, Value>) -> Result<Vec<String>, &'static str> {
    let Some(parts) = entry.get("parts") else {
        return Ok(Vec::new());
    };
    let names = parts
        .as_array()
        .filter(|names| !names.is_empty())
        .ok_or("parts")?;
    let mut declared: Vec<String> = Vec::with_capacity(names.len());
    for name in names {
        let name = name.as_str().ok_or("parts")?;
        let bare = !name.contains('/') && !name.contains('\\');
        if !bare
            || !name.starts_with(STEM)
            || !name.ends_with(".json")
            || name == ENTRY_NAME
            || declared.iter().any(|seen| seen == name)
        {
            return Err("parts");
        }
        declared.push(name.to_owned());
    }
    Ok(declared)
}

/// Entry followed by each part in declaration order; the verdict of every vector and every
/// sign case.
fn verify_corpus(
    entry: &Map<String, Value>,
    parts: &[Map<String, Value>],
) -> Result<Summary, &'static str> {
    if entry
        .keys()
        .any(|name| !ENTRY_MEMBERS.contains(&name.as_str()))
    {
        return Err("entry-members");
    }
    if parts.iter().any(|part| {
        part.len() != PART_MEMBERS.len()
            || !PART_MEMBERS.iter().all(|name| part.contains_key(*name))
    }) {
        return Err("part-members");
    }
    let mut vectors: Vec<&Value> = Vec::new();
    for file in std::iter::once(entry).chain(parts) {
        vectors.extend(
            file.get("vectors")
                .and_then(Value::as_array)
                .ok_or("vectors")?,
        );
    }
    let sign_cases = entry
        .get("signCases")
        .and_then(Value::as_array)
        .ok_or("signCases")?;
    if vectors.is_empty() || sign_cases.is_empty() {
        return Err("empty-inventory");
    }
    if entry.get("domain").and_then(Value::as_str) != Some(DOMAIN) {
        return Err("domain");
    }
    for vector in &vectors {
        if classify(vector)? != expected_class(vector)? {
            return Err("signature-verdict");
        }
    }
    for case in sign_cases {
        check_sign_case(case)?;
    }
    Ok(Summary {
        vectors: vectors.len(),
        sign_cases: sign_cases.len(),
    })
}

/// An in-memory entry without a file system: a declared part cannot be read, so it is absent.
#[cfg(test)]
fn run_document(bytes: &[u8]) -> Result<Summary, &'static str> {
    let entry = parse_file(bytes)?;
    if !declared_parts(&entry)?.is_empty() {
        return Err("part-absent");
    }
    verify_corpus(&entry, &[])
}

/// Reads at most one octet past the bound, so an oversized file is refused without loading it.
fn read_bounded(path: &Path) -> io::Result<Vec<u8>> {
    let mut bytes = Vec::new();
    fs::File::open(path)?
        .take(MAX_FILE_OCTETS + 1)
        .read_to_end(&mut bytes)?;
    Ok(bytes)
}

fn run_path(entry_path: &Path) -> Result<Summary, &'static str> {
    if entry_path.file_name().and_then(|name| name.to_str()) != Some(ENTRY_NAME) {
        return Err("entry-name");
    }
    let directory = entry_path.parent().ok_or("entry-name")?;
    let entry = parse_file(&read_bounded(entry_path).map_err(|_| "input")?)?;
    let declared = declared_parts(&entry)?;
    for listed in fs::read_dir(directory).map_err(|_| "directory")? {
        let listed = listed.map_err(|_| "directory")?.file_name();
        let name = listed.to_string_lossy();
        if name.starts_with(STEM)
            && name != ENTRY_NAME
            && !declared.iter().any(|part| *part == name)
        {
            return Err("orphan-part");
        }
    }
    let mut parts = Vec::with_capacity(declared.len());
    for name in &declared {
        let bytes = read_bounded(&directory.join(name)).map_err(|error| match error.kind() {
            io::ErrorKind::NotFound => "part-absent",
            _ => "part-unreadable",
        })?;
        parts.push(parse_file(&bytes)?);
    }
    verify_corpus(&entry, &parts)
}

/// The `version` of the `[[package]]` named `name` in a Cargo.lock.
fn locked_version<'a>(lock: &'a str, name: &str) -> Option<&'a str> {
    let header = format!("name = \"{name}\"");
    let mut lines = lock.lines();
    lines.find(|line| *line == header)?;
    lines
        .next()?
        .strip_prefix("version = \"")?
        .strip_suffix('"')
}

fn run() -> Result<String, &'static str> {
    let argument = env::args().nth(1).ok_or("argument")?;
    let summary = run_path(Path::new(&argument))?;
    let dalek = locked_version(CARGO_LOCK, "ed25519-dalek").ok_or("lock")?;
    let curve = locked_version(CARGO_LOCK, "curve25519-dalek").ok_or("lock")?;
    Ok(format!(
        "Signalement receipt oracle: {} vectors, {} sign cases verified; ed25519-dalek {dalek} + curve25519-dalek {curve}.",
        summary.vectors, summary.sign_cases
    ))
}

fn main() {
    match run() {
        Ok(line) => println!("{line}"),
        Err(code) => {
            eprintln!("signalement-receipt-crypto-oracle.{code}");
            std::process::exit(1);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    const CORPUS: &str = "../../../contracts/fixtures/signalement-projection-receipt-v1";

    fn corpus_file(name: &str) -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join(CORPUS)
            .join(name)
    }

    fn corpus_members(name: &str) -> Map<String, Value> {
        parse_file(&fs::read(corpus_file(name)).expect("corpus file")).expect("corpus parses")
    }

    /// A fresh directory under the system temporary directory, removed when dropped.
    struct Scratch(PathBuf);

    impl Scratch {
        fn new(label: &str) -> Self {
            let path = std::env::temp_dir().join(format!(
                "signalement-receipt-oracle-{}-{label}",
                std::process::id()
            ));
            let _ = fs::remove_dir_all(&path);
            fs::create_dir(&path).expect("scratch directory");
            Scratch(path)
        }

        fn copy(&self, name: &str, as_name: &str) {
            fs::copy(corpus_file(name), self.0.join(as_name)).expect("copy corpus file");
        }
    }

    impl Drop for Scratch {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn vector_mut<'a>(file: &'a mut Map<String, Value>, id: &str) -> &'a mut Value {
        file.get_mut("vectors")
            .and_then(Value::as_array_mut)
            .and_then(|vectors| vectors.iter_mut().find(|vector| vector["id"] == id))
            .expect("vector present")
    }

    #[test]
    fn refuses_an_unknown_version_and_an_empty_inventory() {
        assert_eq!(
            run_document(br#"{"schemaVersion":"x","vectors":[],"signCases":[]}"#),
            Err("version")
        );
        assert_eq!(run_document(br#"{"schemaVersion":"libre-ai.signalement-projection-receipt-signature-vectors.v1","vectors":[],"signCases":[]}"#), Err("empty-inventory"));
    }

    #[test]
    fn refuses_a_declared_part_that_is_absent() {
        let scratch = Scratch::new("absent-part");
        scratch.copy(ENTRY_NAME, ENTRY_NAME);
        assert_eq!(run_path(&scratch.0.join(ENTRY_NAME)), Err("part-absent"));
    }

    #[test]
    fn refuses_an_orphan_part() {
        let scratch = Scratch::new("orphan-part");
        scratch.copy(ENTRY_NAME, ENTRY_NAME);
        scratch.copy(
            "signature-vectors.v1.part-2.json",
            "signature-vectors.v1.part-2.json",
        );
        scratch.copy(
            "signature-vectors.v1.part-2.json",
            "signature-vectors.v1.part-3.json",
        );
        assert_eq!(run_path(&scratch.0.join(ENTRY_NAME)), Err("orphan-part"));
    }

    #[test]
    fn verifies_the_committed_corpus_across_its_parts() {
        let summary = run_path(&corpus_file(ENTRY_NAME)).expect("corpus verifies");
        let entry = corpus_members(ENTRY_NAME);
        let part = corpus_members("signature-vectors.v1.part-2.json");
        let count =
            |file: &Map<String, Value>, name: &str| file[name].as_array().map_or(0, Vec::len);
        assert_eq!(
            summary.vectors,
            count(&entry, "vectors") + count(&part, "vectors")
        );
        assert_eq!(summary.sign_cases, count(&entry, "signCases"));
        assert!(count(&part, "vectors") > 0, "the part contributes vectors");
    }

    #[test]
    fn refuses_a_part_that_carries_more_than_its_vectors() {
        let entry = corpus_members(ENTRY_NAME);
        let mut part = corpus_members("signature-vectors.v1.part-2.json");
        part.insert("signCases".to_owned(), entry["signCases"].clone());
        assert_eq!(verify_corpus(&entry, &[part]), Err("part-members"));
    }

    #[test]
    fn refuses_a_forgery_expected_valid_and_a_valid_receipt_expected_invalid() {
        let entry = corpus_members(ENTRY_NAME);
        let part = corpus_members("signature-vectors.v1.part-2.json");
        assert!(verify_corpus(&entry, std::slice::from_ref(&part)).is_ok());
        for (id, class) in [
            ("key-mixed-order-1", "valid"),
            ("r-torsion-1", "valid"),
            ("valid-active", "invalid"),
        ] {
            let mut entry = entry.clone();
            let mut part = part.clone();
            let target = if entry["vectors"]
                .as_array()
                .is_some_and(|vectors| vectors.iter().any(|vector| vector["id"] == id))
            {
                vector_mut(&mut entry, id)
            } else {
                vector_mut(&mut part, id)
            };
            target["expected"]["signature"] = Value::from(class);
            assert_eq!(
                verify_corpus(&entry, &[part]),
                Err("signature-verdict"),
                "{id}"
            );
        }
    }

    #[test]
    fn refuses_a_sign_case_whose_signed_octets_differ() {
        let mut entry = corpus_members(ENTRY_NAME);
        let part = corpus_members("signature-vectors.v1.part-2.json");
        let case = &mut entry["signCases"][0];
        case["unsigned"]["revision"] = Value::from(2);
        assert_eq!(verify_corpus(&entry, &[part]), Err("sign-case"));
    }

    #[test]
    fn refuses_a_domain_other_than_the_signing_domain() {
        let mut entry = corpus_members(ENTRY_NAME);
        let part = corpus_members("signature-vectors.v1.part-2.json");
        entry.insert("domain".to_owned(), Value::from("libre-ai.other.v1"));
        assert_eq!(verify_corpus(&entry, &[part]), Err("domain"));
    }

    #[test]
    fn refuses_parts_that_leave_the_directory_or_the_stem() {
        for parts in [
            r#"[]"#,
            r#"["../signature-vectors.v1.part-2.json"]"#,
            r#"["vectors.part-2.json"]"#,
            r#"["signature-vectors.v1.json"]"#,
            r#"["signature-vectors.v1.part-2.json","signature-vectors.v1.part-2.json"]"#,
        ] {
            let document = format!(
                r#"{{"schemaVersion":"{SCHEMA_VERSION}","parts":{parts},"vectors":[],"signCases":[]}}"#
            );
            assert_eq!(run_document(document.as_bytes()), Err("parts"), "{parts}");
        }
    }

    #[test]
    fn names_the_versions_pinned_by_the_manifest() {
        let manifest = include_str!("../Cargo.toml");
        for name in ["ed25519-dalek", "curve25519-dalek"] {
            let version = locked_version(CARGO_LOCK, name).expect("locked");
            assert!(
                manifest.contains(&format!("{name} = \"={version}\"")),
                "{name} {version}"
            );
        }
        assert_eq!(locked_version(CARGO_LOCK, "absent-crate"), None);
    }
}
