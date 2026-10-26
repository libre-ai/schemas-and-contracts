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

/// 2^53 - 1: above it a binary64 value is no longer an exact integer, and JCS (RFC 8785) writes
/// the binary64 value, so `9007199254740993` would become `9007199254740992`.
const MAX_SAFE_INTEGER: u64 = (1 << 53) - 1;

/// Every number is integral with magnitude at most 2^53 - 1: rule 2 of SEMANTICS "Canonical
/// form", the domain where `serde_json` and JCS write the same text. A float never qualifies:
/// `serde_json` writes `1.0` where JCS writes `1`.
fn integers_only(value: &Value) -> bool {
    match value {
        Value::Number(number) => match (number.as_u64(), number.as_i64()) {
            (Some(positive), _) => positive <= MAX_SAFE_INTEGER,
            (None, Some(negative)) => negative.unsigned_abs() <= MAX_SAFE_INTEGER,
            (None, None) => false,
        },
        Value::Array(items) => items.iter().all(integers_only),
        Value::Object(members) => members.values().all(integers_only),
        _ => true,
    }
}

/// `serde_json::to_vec` of a `Value` equals its JCS form (RFC 8785) when the text is ASCII (keys
/// sorted by octet equal keys sorted by UTF-16 unit, and no escaping difference) and every number
/// passes `integers_only`. `Map` sorts its keys because the `preserve_order` feature is off.
/// Outside that premise the oracle cannot decide, so it stops.
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
/// A number outside `integers_only` is `unreadable` too, as SEMANTICS "Canonical form"
/// prescribes: a float is `receipt.non_canonical` or `receipt.schema`, an integer above
/// 2^53 - 1 is `receipt.schema`. The `jcs-premise` stop is checked last: it is reached only by
/// a receipt that parses, serializes back to its exact octets and holds safe integers only, and
/// then only when those octets are not ASCII. Non-ASCII text that fails the round trip or holds
/// another number is `unreadable` before the premise is checked, as any non-JCS text is.
fn read_receipt(signed: &[u8]) -> Result<Option<Receipt>, &'static str> {
    let Ok(value) = serde_json::from_slice::<Value>(signed) else {
        return Ok(None);
    };
    if serde_json::to_vec(&value).map_err(|_| "output")? != signed || !integers_only(&value) {
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
        // An orphan is an undeclared `<stem>*.json` file (SEMANTICS "Vector files").
        if name.starts_with(STEM)
            && name.ends_with(".json")
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

    /// The names the committed entry declares, in declaration order.
    fn declared_names() -> Vec<String> {
        declared_parts(&corpus_members(ENTRY_NAME)).expect("committed parts declaration")
    }

    /// Every part the committed entry declares, parsed, in declaration order.
    fn corpus_parts() -> Vec<Map<String, Value>> {
        declared_names()
            .iter()
            .map(|name| corpus_members(name))
            .collect()
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

        /// The entry and every part it declares, under their own names.
        fn copy_corpus(&self) {
            self.copy(ENTRY_NAME, ENTRY_NAME);
            for name in declared_names() {
                self.copy(&name, &name);
            }
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
        scratch.copy_corpus();
        scratch.copy(ENTRY_NAME, "signature-vectors.v1.part-99.json");
        assert_eq!(run_path(&scratch.0.join(ENTRY_NAME)), Err("orphan-part"));
    }

    #[test]
    fn a_file_of_the_stem_that_is_not_json_is_not_an_orphan() {
        // SEMANTICS "Vector files": an orphan is an undeclared `<stem>*.json` file; a file of the
        // same stem with another suffix belongs to no vector set.
        let scratch = Scratch::new("stem-not-json");
        scratch.copy_corpus();
        fs::write(scratch.0.join("signature-vectors.v1.notes.txt"), "notes\n").expect("write");
        fs::write(scratch.0.join("signature-vectors.v1.json.bak"), "{}\n").expect("write");
        assert!(run_path(&scratch.0.join(ENTRY_NAME)).is_ok());
    }

    #[test]
    fn verifies_the_committed_corpus_across_its_parts() {
        let summary = run_path(&corpus_file(ENTRY_NAME)).expect("corpus verifies");
        let entry = corpus_members(ENTRY_NAME);
        let parts = corpus_parts();
        let count =
            |file: &Map<String, Value>, name: &str| file[name].as_array().map_or(0, Vec::len);
        assert!(!parts.is_empty(), "the entry declares parts");
        assert_eq!(
            summary.vectors,
            count(&entry, "vectors")
                + parts
                    .iter()
                    .map(|part| count(part, "vectors"))
                    .sum::<usize>()
        );
        assert_eq!(summary.sign_cases, count(&entry, "signCases"));
        for part in &parts {
            assert!(count(part, "vectors") > 0, "every part contributes vectors");
        }
    }

    #[test]
    fn refuses_a_part_that_carries_more_than_its_vectors() {
        let entry = corpus_members(ENTRY_NAME);
        let mut parts = corpus_parts();
        parts[0].insert("signCases".to_owned(), entry["signCases"].clone());
        assert_eq!(verify_corpus(&entry, &parts), Err("part-members"));
    }

    #[test]
    fn refuses_a_forgery_expected_valid_and_a_valid_receipt_expected_invalid() {
        let entry = corpus_members(ENTRY_NAME);
        let parts = corpus_parts();
        assert!(verify_corpus(&entry, &parts).is_ok());
        for (id, class) in [
            ("key-mixed-order-1", "valid"),
            ("key-non-canonical-identity", "valid"),
            ("r-torsion-1", "valid"),
            ("r-mixed-order-1", "valid"),
            ("r-non-canonical-identity", "valid"),
            ("wrong-domain", "valid"),
            ("valid-active", "invalid"),
        ] {
            let mut files: Vec<Map<String, Value>> =
                std::iter::once(entry.clone()).chain(parts.clone()).collect();
            let holder = files
                .iter_mut()
                .find(|file| {
                    file["vectors"]
                        .as_array()
                        .is_some_and(|vectors| vectors.iter().any(|vector| vector["id"] == id))
                })
                .expect("vector in the corpus");
            vector_mut(holder, id)["expected"]["signature"] = Value::from(class);
            assert_eq!(
                verify_corpus(&files[0], &files[1..]),
                Err("signature-verdict"),
                "{id}"
            );
        }
    }

    /// dalek `verify_strict` alone over a readable vector: the oracle's own point checks skipped.
    fn bare_verify_strict(vector: &Value) -> &'static str {
        let receipt = read_receipt(&field(vector, "signed").expect("signed"))
            .expect("premise")
            .expect("readable receipt");
        let key_set = read_key_set(&vector["keySet"]).expect("readable key set");
        let key = key_set
            .keys
            .iter()
            .find(|key| key.key_id == receipt.key_id)
            .expect("key present");
        let Ok(verifying_key) = VerifyingKey::from_bytes(&key.public_key) else {
            return "refused by VerifyingKey::from_bytes";
        };
        let message = signing_message(&receipt.unsigned).expect("message");
        let signature = Signature::from_bytes(&receipt.signature);
        if verifying_key.verify_strict(&message, &signature).is_ok() {
            "accepted"
        } else {
            "refused"
        }
    }

    #[test]
    fn classifies_the_mixed_order_r_non_canonical_and_wrong_domain_vectors_invalid() {
        let files: Vec<Map<String, Value>> = std::iter::once(corpus_members(ENTRY_NAME))
            .chain(corpus_parts())
            .collect();
        let vectors: Vec<&Value> = files
            .iter()
            .flat_map(|file| file["vectors"].as_array().expect("vectors").iter())
            .collect();
        let point_forgeries: Vec<String> = (1..=7)
            .map(|index| format!("r-mixed-order-{index}"))
            .chain(["r-non-canonical-identity".to_owned()])
            .collect();
        for id in point_forgeries
            .iter()
            .map(String::as_str)
            .chain(["key-non-canonical-identity", "wrong-domain"])
        {
            let vector = vectors
                .iter()
                .find(|vector| vector["id"] == id)
                .expect("vector present");
            let receipt = read_receipt(&field(vector, "signed").expect("signed"))
                .expect("premise")
                .expect("readable receipt");
            let key_set = read_key_set(&vector["keySet"]).expect("readable key set");
            let public_key = key_set.keys[0].public_key;
            let admissible_a = admissible(&public_key);
            let admissible_r = admissible(&receipt.signature[..32]);
            let class = classify(vector);
            let strict = bare_verify_strict(vector);
            eprintln!(
                "{id}: oracle class {class:?}; admissible A {admissible_a}, admissible R {admissible_r}; verify_strict alone {strict}"
            );
            assert_eq!(class, Ok("invalid"), "{id}");
            assert_eq!(expected_class(vector), Ok("invalid"), "{id}");
            match id {
                "key-non-canonical-identity" => assert!(!admissible_a, "{id}"),
                "wrong-domain" => assert!(admissible_a && admissible_r, "{id}"),
                _ => assert!(admissible_a && !admissible_r, "{id}"),
            }
        }
    }

    #[test]
    fn refuses_a_sign_case_whose_signed_octets_differ() {
        let mut entry = corpus_members(ENTRY_NAME);
        let case = &mut entry["signCases"][0];
        case["unsigned"]["revision"] = Value::from(2);
        assert_eq!(verify_corpus(&entry, &corpus_parts()), Err("sign-case"));
    }

    #[test]
    fn refuses_a_domain_other_than_the_signing_domain() {
        let mut entry = corpus_members(ENTRY_NAME);
        entry.insert("domain".to_owned(), Value::from("libre-ai.other.v1"));
        assert_eq!(verify_corpus(&entry, &corpus_parts()), Err("domain"));
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

    fn valid_active() -> Value {
        corpus_members(ENTRY_NAME)["vectors"]
            .as_array()
            .and_then(|vectors| vectors.iter().find(|vector| vector["id"] == "valid-active"))
            .cloned()
            .expect("valid-active vector")
    }

    /// The vector with its receipt edited, then written back as its own `serde_json` octets, so
    /// that the canonical round trip holds and only the checks after it can decide.
    fn with_receipt(vector: &Value, edit: impl FnOnce(&mut Value)) -> Value {
        let octets = field(vector, "signed").expect("signed octets");
        let mut receipt: Value = serde_json::from_slice(&octets).expect("receipt parses");
        edit(&mut receipt);
        let mut edited = vector.clone();
        edited["signed"] = Value::from(
            URL_SAFE_NO_PAD.encode(serde_json::to_vec(&receipt).expect("receipt serializes")),
        );
        edited
    }

    #[test]
    fn reads_a_revision_beyond_two_to_the_53_minus_one_as_unreadable() {
        // SEMANTICS "Canonical form" rules 2 and 3: a number of magnitude above 2^53 - 1 skips the
        // canonical comparison and cannot pass the schema (`receipt.schema`), so the class is
        // `unreadable`. serde_json reads 2^53 + 1 as an exact integer and writes it back
        // unchanged, so only the magnitude bound stops it from being verified as a receipt.
        let vector = valid_active();
        for revision in [
            Value::from(9_007_199_254_740_993_u64),
            Value::from(-9_007_199_254_740_993_i64),
        ] {
            let edited = with_receipt(&vector, |receipt| receipt["revision"] = revision.clone());
            assert_eq!(classify(&edited), Ok("unreadable"), "{revision}");
        }
    }

    #[test]
    fn reads_a_revision_of_magnitude_two_to_the_53_minus_one() {
        // Boundary accepted by rule 2: the receipt is readable and reaches the equation, which
        // fails because the signature covers revision 1.
        let vector = valid_active();
        for revision in [9_007_199_254_740_991_i64, -9_007_199_254_740_991] {
            let edited = with_receipt(&vector, |receipt| {
                receipt["revision"] = Value::from(revision)
            });
            assert_eq!(classify(&edited), Ok("invalid"), "{revision}");
        }
    }

    #[test]
    fn stops_on_a_non_ascii_receipt() {
        // Outside ASCII, octet order of keys and UTF-16 order (JCS) may differ: no class is claimed.
        let edited = with_receipt(&valid_active(), |receipt| {
            receipt["organization"] = Value::from("exämple-org")
        });
        assert_eq!(classify(&edited), Err("jcs-premise"));
    }

    #[test]
    fn refuses_a_file_one_octet_past_one_mebibyte() {
        let mut at_bound = br#"{"schemaVersion":"x"}"#.to_vec();
        at_bound.resize(MAX_FILE_OCTETS as usize, b' ');
        assert_eq!(run_document(&at_bound), Err("version"));
        let mut past = at_bound.clone();
        past.push(b' ');
        assert_eq!(run_document(&past), Err("input-size"));
        let scratch = Scratch::new("oversized-part");
        scratch.copy(ENTRY_NAME, ENTRY_NAME);
        fs::write(scratch.0.join("signature-vectors.v1.part-2.json"), &past).expect("write part");
        assert_eq!(run_path(&scratch.0.join(ENTRY_NAME)), Err("input-size"));
    }
}
