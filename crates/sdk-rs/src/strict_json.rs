//! Strict integer-only JSON reader and RFC 8785 canonicalizer.
//!
//! Two pure functions, without I/O, that never abort on any input:
//!
//! - [`parse`] reads octets into a [`serde_json::Value`], or reports the first defect
//!   met and its byte offset;
//! - [`canonicalize`] writes the RFC 8785 (JCS) octets of a value whose numbers are
//!   all integers of magnitude at most [`MAX_SAFE_INTEGER`].
//!
//! No error text carries an octet of the input: a caller translates the defect into
//! its own closed code. The size ceiling of an input is the caller's, before `parse`.
//!
//! # Relation to the contracts of this authority
//!
//! - This reader is a strict subset of the reader of the candidate `canonicalize`
//!   semantics (`contracts/wit/signalement-policy-receipt-v1/SEMANTICS.md`). That
//!   semantics judges the binary64 value of a number, so it reads `1.0`, `1e2` and
//!   `10E-1` as integers; this reader judges the literal and refuses them. On every
//!   document this reader accepts, its canonical form is, octet for octet, the one of
//!   that semantics and the one of the locked digest vectors.
//! - It does not replace the policy-core decoder
//!   (`contracts/wit/policy-core-v2/SEMANTICS.md`), which admits fractions. Its depth
//!   rule is the one of the candidate semantics: the top-level value has depth 1.
//! - It is not an implementation of the `signalement-policy-receipt-v1` world and
//!   qualifies none.

use serde_json::{Map, Number, Value};
use std::error::Error;
use std::fmt::{self, Display, Formatter};

/// Deepest admitted nesting. The top-level value has depth 1; a value inside an array
/// or an object, scalars included, has the depth of that container plus 1.
pub const MAX_DEPTH: usize = 64;

/// Largest admitted integer magnitude, 2^53 - 1.
pub const MAX_SAFE_INTEGER: u64 = 9_007_199_254_740_991;

const BOM: [u8; 3] = [0xef, 0xbb, 0xbf];

/// The closed list of reasons [`parse`] refuses an input.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StrictJsonDefect {
    /// `EF BB BF` at the start of the input.
    Bom,
    /// The input is not UTF-8.
    InvalidUtf8,
    /// Two member names of one object are equal once their escapes are decoded.
    DuplicateMember,
    /// An escape `\uD800` to `\uDFFF` that is not a high surrogate immediately
    /// followed by an escaped low surrogate.
    UnpairedSurrogate,
    /// A value of depth [`MAX_DEPTH`] + 1.
    MaxDepth,
    /// A number literal outside `-?(0|[1-9][0-9]*)`, or a value starting with `+`,
    /// `N` or `I`.
    InvalidNumber,
    /// A well-formed integer literal of magnitude above [`MAX_SAFE_INTEGER`].
    UnsafeInteger,
    /// Any other defect of the JSON text.
    InvalidJson,
}

impl StrictJsonDefect {
    /// The stable kebab-case label of the defect.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Bom => "bom",
            Self::InvalidUtf8 => "invalid-utf8",
            Self::DuplicateMember => "duplicate-member",
            Self::UnpairedSurrogate => "unpaired-surrogate",
            Self::MaxDepth => "max-depth",
            Self::InvalidNumber => "invalid-number",
            Self::UnsafeInteger => "unsafe-integer",
            Self::InvalidJson => "invalid-json",
        }
    }
}

/// The first defect of an input and where it is met.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct StrictJsonError {
    pub defect: StrictJsonDefect,
    /// Byte offset of the defect; the input length when the input ends too early.
    pub offset: usize,
}

impl Display for StrictJsonError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        // Label and offset only: an error text never carries an octet of the input.
        write!(
            formatter,
            "{} at byte offset {}",
            self.defect.as_str(),
            self.offset
        )
    }
}

impl Error for StrictJsonError {}

/// The closed list of reasons [`canonicalize`] refuses a value.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CanonicalizeError {
    /// A number that is not an integer of magnitude at most [`MAX_SAFE_INTEGER`];
    /// every floating-point number of the value, `1.0` included.
    NonIntegerNumber,
    /// A value of depth [`MAX_DEPTH`] + 1 or more.
    MaxDepth,
}

impl CanonicalizeError {
    /// The stable label of the error.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::NonIntegerNumber => "non_integer_number",
            Self::MaxDepth => "max-depth",
        }
    }
}

impl Display for CanonicalizeError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

impl Error for CanonicalizeError {}

/// Reads one strict JSON text whose numbers are all written as safe integers.
///
/// Checks, in this order: a byte order mark (offset 0), invalid UTF-8 over the whole
/// input (offset of the first invalid octet), then a left-to-right scan whose first
/// defect gives the error.
pub fn parse(bytes: &[u8]) -> Result<Value, StrictJsonError> {
    if bytes.starts_with(&BOM) {
        return Err(defect(StrictJsonDefect::Bom, 0));
    }
    let text = std::str::from_utf8(bytes)
        .map_err(|error| defect(StrictJsonDefect::InvalidUtf8, error.valid_up_to()))?;
    let mut reader = Reader { text, position: 0 };
    reader.skip_whitespace();
    let value = reader.value(1)?;
    reader.skip_whitespace();
    if reader.position < bytes.len() {
        return Err(defect(StrictJsonDefect::InvalidJson, reader.position));
    }
    Ok(value)
}

/// Writes the RFC 8785 form of a value restricted to safe integers: no whitespace,
/// members sorted by the UTF-16 code units of their names, array order kept, integers
/// in decimal, strings with only the escapes the RFC requires.
pub fn canonicalize(value: &Value) -> Result<Vec<u8>, CanonicalizeError> {
    let mut output = Vec::new();
    write_canonical(value, 1, &mut output)?;
    Ok(output)
}

fn defect(defect: StrictJsonDefect, offset: usize) -> StrictJsonError {
    StrictJsonError { defect, offset }
}

struct Reader<'a> {
    text: &'a str,
    position: usize,
}

impl Reader<'_> {
    fn peek(&self) -> Option<u8> {
        self.text.as_bytes().get(self.position).copied()
    }

    fn invalid_json_here(&self) -> StrictJsonError {
        // At the end of the input the position is the input length.
        defect(StrictJsonDefect::InvalidJson, self.position)
    }

    fn skip_whitespace(&mut self) {
        while matches!(self.peek(), Some(b' ' | b'\t' | b'\n' | b'\r')) {
            self.position += 1;
        }
    }

    /// Reads the value starting at the current position. Recursion is bounded by
    /// `MAX_DEPTH`: the depth is checked before any descent.
    fn value(&mut self, depth: usize) -> Result<Value, StrictJsonError> {
        let Some(first) = self.peek() else {
            return Err(self.invalid_json_here());
        };
        if depth > MAX_DEPTH {
            return Err(defect(StrictJsonDefect::MaxDepth, self.position));
        }
        match first {
            b'{' => self.object(depth),
            b'[' => self.array(depth),
            b'"' => self.string().map(Value::String),
            b'-' | b'0'..=b'9' => self.number(),
            // Parity with the raw-input manifest, which files `+1` and `NaN` (and so
            // `Infinity`) under the number defect.
            b'+' | b'N' | b'I' => Err(defect(StrictJsonDefect::InvalidNumber, self.position)),
            b't' => self.literal(b"true", Value::Bool(true)),
            b'f' => self.literal(b"false", Value::Bool(false)),
            b'n' => self.literal(b"null", Value::Null),
            _ => Err(self.invalid_json_here()),
        }
    }

    fn literal(&mut self, expected: &[u8], value: Value) -> Result<Value, StrictJsonError> {
        for byte in expected {
            if self.peek() != Some(*byte) {
                return Err(self.invalid_json_here());
            }
            self.position += 1;
        }
        Ok(value)
    }

    fn number(&mut self) -> Result<Value, StrictJsonError> {
        let start = self.position;
        // The lexeme spans every character a JSON number may hold, so that `1.5` is
        // refused as a number instead of read as `1` followed by a residue.
        while matches!(
            self.peek(),
            Some(b'0'..=b'9' | b'+' | b'-' | b'.' | b'e' | b'E')
        ) {
            self.position += 1;
        }
        let lexeme = self
            .text
            .as_bytes()
            .get(start..self.position)
            .unwrap_or(&[]);
        let (negative, digits) = match lexeme.split_first() {
            Some((b'-', rest)) => (true, rest),
            _ => (false, lexeme),
        };
        let well_formed = match digits.split_first() {
            Some((b'0', rest)) => rest.is_empty(),
            Some((b'1'..=b'9', rest)) => rest.iter().all(u8::is_ascii_digit),
            _ => false,
        };
        if !well_formed {
            return Err(defect(StrictJsonDefect::InvalidNumber, start));
        }
        let mut magnitude: u64 = 0;
        for digit in digits {
            magnitude = magnitude
                .checked_mul(10)
                .and_then(|scaled| scaled.checked_add(u64::from(digit - b'0')))
                .filter(|sum| *sum <= MAX_SAFE_INTEGER)
                .ok_or(defect(StrictJsonDefect::UnsafeInteger, start))?;
        }
        if negative && magnitude != 0 {
            // The magnitude is at most 2^53 - 1, so it fits an i64 and its negation.
            let signed = i64::try_from(magnitude)
                .map_err(|_| defect(StrictJsonDefect::UnsafeInteger, start))?;
            Ok(Value::Number(Number::from(-signed)))
        } else {
            // `-0` is admitted and is the integer 0.
            Ok(Value::Number(Number::from(magnitude)))
        }
    }

    fn string(&mut self) -> Result<String, StrictJsonError> {
        // The caller saw the opening quotation mark.
        self.position += 1;
        let mut decoded = String::new();
        let mut run_start = self.position;
        loop {
            let Some(byte) = self.peek() else {
                return Err(self.invalid_json_here());
            };
            match byte {
                b'"' => {
                    self.push_run(&mut decoded, run_start)?;
                    self.position += 1;
                    return Ok(decoded);
                }
                b'\\' => {
                    self.push_run(&mut decoded, run_start)?;
                    decoded.push(self.escape()?);
                    run_start = self.position;
                }
                0x00..=0x1f => return Err(self.invalid_json_here()),
                _ => self.position += 1,
            }
        }
    }

    /// Appends the raw characters read since `run_start`. A run starts and ends next
    /// to an ASCII octet of valid UTF-8, hence on character boundaries.
    fn push_run(&self, decoded: &mut String, run_start: usize) -> Result<(), StrictJsonError> {
        let run = self
            .text
            .get(run_start..self.position)
            .ok_or(defect(StrictJsonDefect::InvalidJson, run_start))?;
        decoded.push_str(run);
        Ok(())
    }

    /// Reads one escape, the current position being its backslash.
    fn escape(&mut self) -> Result<char, StrictJsonError> {
        let backslash = self.position;
        self.position += 1;
        let Some(kind) = self.peek() else {
            return Err(self.invalid_json_here());
        };
        let character = match kind {
            b'"' => '"',
            b'\\' => '\\',
            b'/' => '/',
            b'b' => '\u{0008}',
            b'f' => '\u{000c}',
            b'n' => '\n',
            b'r' => '\r',
            b't' => '\t',
            b'u' => {
                self.position += 1;
                return self.unicode_escape(backslash);
            }
            _ => return Err(self.invalid_json_here()),
        };
        self.position += 1;
        Ok(character)
    }

    /// Reads the four hexadecimal digits of a `\u` escape, and the low surrogate that
    /// must follow a high one.
    fn unicode_escape(&mut self, backslash: usize) -> Result<char, StrictJsonError> {
        let unpaired = defect(StrictJsonDefect::UnpairedSurrogate, backslash);
        let first = self.hex4()?;
        let code_point = match first {
            0xd800..=0xdbff => {
                let bytes = self.text.as_bytes();
                if bytes.get(self.position) != Some(&b'\\')
                    || bytes.get(self.position + 1) != Some(&b'u')
                {
                    return Err(unpaired);
                }
                self.position += 2;
                let second = self.hex4().map_err(|_| unpaired)?;
                if !(0xdc00..=0xdfff).contains(&second) {
                    return Err(unpaired);
                }
                0x10000 + ((first - 0xd800) << 10) + (second - 0xdc00)
            }
            0xdc00..=0xdfff => return Err(unpaired),
            scalar => scalar,
        };
        char::from_u32(code_point).ok_or(unpaired)
    }

    fn hex4(&mut self) -> Result<u32, StrictJsonError> {
        let mut code_unit: u32 = 0;
        for _ in 0..4 {
            let digit = self
                .peek()
                .and_then(|byte| char::from(byte).to_digit(16))
                .ok_or(self.invalid_json_here())?;
            code_unit = code_unit * 16 + digit;
            self.position += 1;
        }
        Ok(code_unit)
    }

    fn array(&mut self, depth: usize) -> Result<Value, StrictJsonError> {
        // The caller saw the opening bracket.
        self.position += 1;
        let mut items = Vec::new();
        self.skip_whitespace();
        if self.peek() == Some(b']') {
            self.position += 1;
            return Ok(Value::Array(items));
        }
        loop {
            self.skip_whitespace();
            items.push(self.value(depth + 1)?);
            self.skip_whitespace();
            match self.peek() {
                Some(b',') => self.position += 1,
                Some(b']') => {
                    self.position += 1;
                    return Ok(Value::Array(items));
                }
                _ => return Err(self.invalid_json_here()),
            }
        }
    }

    fn object(&mut self, depth: usize) -> Result<Value, StrictJsonError> {
        // The caller saw the opening brace.
        self.position += 1;
        let mut members = Map::new();
        self.skip_whitespace();
        if self.peek() == Some(b'}') {
            self.position += 1;
            return Ok(Value::Object(members));
        }
        loop {
            self.skip_whitespace();
            let name_offset = self.position;
            if self.peek() != Some(b'"') {
                return Err(self.invalid_json_here());
            }
            let name = self.string()?;
            // Every name is an ordinary member, `__proto__` included: only equality
            // with an earlier name of the same object is refused.
            if members.contains_key(&name) {
                return Err(defect(StrictJsonDefect::DuplicateMember, name_offset));
            }
            self.skip_whitespace();
            if self.peek() != Some(b':') {
                return Err(self.invalid_json_here());
            }
            self.position += 1;
            self.skip_whitespace();
            let value = self.value(depth + 1)?;
            members.insert(name, value);
            self.skip_whitespace();
            match self.peek() {
                Some(b',') => self.position += 1,
                Some(b'}') => {
                    self.position += 1;
                    return Ok(Value::Object(members));
                }
                _ => return Err(self.invalid_json_here()),
            }
        }
    }
}

/// Recursion is bounded by `MAX_DEPTH`: the depth is checked before any descent.
fn write_canonical(
    value: &Value,
    depth: usize,
    output: &mut Vec<u8>,
) -> Result<(), CanonicalizeError> {
    if depth > MAX_DEPTH {
        return Err(CanonicalizeError::MaxDepth);
    }
    match value {
        Value::Null => output.extend_from_slice(b"null"),
        Value::Bool(true) => output.extend_from_slice(b"true"),
        Value::Bool(false) => output.extend_from_slice(b"false"),
        Value::Number(number) => write_integer(number, output)?,
        Value::String(string) => write_string(string, output),
        Value::Array(items) => {
            output.push(b'[');
            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    output.push(b',');
                }
                write_canonical(item, depth + 1, output)?;
            }
            output.push(b']');
        }
        Value::Object(members) => {
            let mut sorted = members.iter().collect::<Vec<_>>();
            sorted.sort_unstable_by(|(left, _), (right, _)| {
                left.encode_utf16().cmp(right.encode_utf16())
            });
            output.push(b'{');
            for (index, (name, member)) in sorted.into_iter().enumerate() {
                if index > 0 {
                    output.push(b',');
                }
                write_string(name, output);
                output.push(b':');
                write_canonical(member, depth + 1, output)?;
            }
            output.push(b'}');
        }
    }
    Ok(())
}

fn write_integer(number: &Number, output: &mut Vec<u8>) -> Result<(), CanonicalizeError> {
    // A floating-point number answers neither accessor, whatever its value.
    let text = if let Some(unsigned) = number.as_u64() {
        (unsigned <= MAX_SAFE_INTEGER).then(|| unsigned.to_string())
    } else if let Some(signed) = number.as_i64() {
        (signed.unsigned_abs() <= MAX_SAFE_INTEGER).then(|| signed.to_string())
    } else {
        None
    };
    let text = text.ok_or(CanonicalizeError::NonIntegerNumber)?;
    output.extend_from_slice(text.as_bytes());
    Ok(())
}

fn write_string(string: &str, output: &mut Vec<u8>) {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    output.push(b'"');
    for byte in string.bytes() {
        match byte {
            b'"' => output.extend_from_slice(b"\\\""),
            b'\\' => output.extend_from_slice(b"\\\\"),
            0x08 => output.extend_from_slice(b"\\b"),
            0x09 => output.extend_from_slice(b"\\t"),
            0x0a => output.extend_from_slice(b"\\n"),
            0x0c => output.extend_from_slice(b"\\f"),
            0x0d => output.extend_from_slice(b"\\r"),
            0x00..=0x1f => {
                output.extend_from_slice(b"\\u00");
                output.push(HEX[usize::from(byte >> 4)]);
                output.push(HEX[usize::from(byte & 0x0f)]);
            }
            // Every other octet, those of non-ASCII characters included, is written
            // as it is: the string is UTF-8 already.
            _ => output.push(byte),
        }
    }
    output.push(b'"');
}
