//! Rust side of the strict JSON differential test (`tools/quality/strict-json-differential.test.ts`).
//!
//! It reads, on standard input, `{"documents": ["<hex>", ...]}` and writes, on standard output,
//! one verdict per document, in the same order, from the exported `strict_json::parse` and
//! `strict_json::canonicalize` of `crates/sdk-rs`:
//!
//! - `{"accepted": true, "canonical": "<hex>"}`;
//! - `{"accepted": false, "stage": "parse", "defect": "<label>", "offset": <byte offset>}`;
//! - `{"accepted": false, "stage": "canonicalize", "defect": "<label>"}`.
//!
//! The transport envelope is read with `serde_json`, not with the reader under test: a defect of
//! the reader must change a verdict, never the reading of the batch. Documents travel as hex so
//! that a byte order mark or invalid UTF-8 reaches `parse` unchanged.
use libre_ai_contract_types::strict_json::{canonicalize, parse};
use serde_json::{Map, Value, json};
use std::io::{self, Read, Write};
use std::process::ExitCode;

fn decode_hex(text: &str) -> Option<Vec<u8>> {
    let digits = text.as_bytes();
    if !digits.len().is_multiple_of(2) {
        return None;
    }
    digits
        .chunks(2)
        .map(|pair| {
            let high = char::from(*pair.first()?).to_digit(16)?;
            let low = char::from(*pair.get(1)?).to_digit(16)?;
            u8::try_from(high * 16 + low).ok()
        })
        .collect()
}

fn encode_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn verdict(document: &[u8]) -> Value {
    let value = match parse(document) {
        Ok(value) => value,
        Err(error) => {
            return json!({
                "accepted": false,
                "stage": "parse",
                "defect": error.defect.as_str(),
                "offset": error.offset,
            });
        }
    };
    match canonicalize(&value) {
        Ok(canonical) => json!({ "accepted": true, "canonical": encode_hex(&canonical) }),
        Err(error) => json!({
            "accepted": false,
            "stage": "canonicalize",
            "defect": error.as_str(),
        }),
    }
}

fn documents(input: &[u8]) -> Result<Vec<Vec<u8>>, &'static str> {
    let envelope: Map<String, Value> =
        serde_json::from_slice(input).map_err(|_| "input is not a JSON object")?;
    let listed = envelope
        .get("documents")
        .and_then(Value::as_array)
        .ok_or("input has no documents array")?;
    listed
        .iter()
        .map(|entry| {
            entry
                .as_str()
                .and_then(decode_hex)
                .ok_or("a document is not a hex string")
        })
        .collect()
}

fn main() -> ExitCode {
    let mut input = Vec::new();
    if io::stdin().read_to_end(&mut input).is_err() {
        eprintln!("strict-json-oracle: standard input is unreadable");
        return ExitCode::from(2);
    }
    let documents = match documents(&input) {
        Ok(documents) => documents,
        Err(reason) => {
            eprintln!("strict-json-oracle: {reason}");
            return ExitCode::from(2);
        }
    };
    let verdicts: Vec<Value> = documents.iter().map(|document| verdict(document)).collect();
    let output = json!({ "verdicts": verdicts }).to_string();
    if io::stdout().write_all(output.as_bytes()).is_err() {
        eprintln!("strict-json-oracle: standard output is unwritable");
        return ExitCode::from(2);
    }
    ExitCode::SUCCESS
}
