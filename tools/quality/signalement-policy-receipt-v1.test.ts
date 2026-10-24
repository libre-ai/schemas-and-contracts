import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson } from "./authorized-execution";
import {
  loadPolicyReceiptGolden,
  OPERATION_ERROR_CODES,
  POLICY_RECEIPT_GOLDEN_DIRECTORY,
  POLICY_RECEIPT_GOLDEN_ENTRY,
  POLICY_RECEIPT_GOLDEN_MAX_BYTES,
  policyReceiptGoldenFailures,
  REQUIRED_GOLDEN_CASES,
  rawPolicyReceiptFailures,
} from "./signalement-policy-receipt-v1";
import { rawProjectionReceiptFailures } from "./signalement-projection-receipt-v1";
import { loadSignalementV1Vectors } from "./signalement-v1-vector-loader";

type JsonObject = Record<string, unknown>;

interface GoldenCase {
  id: string;
  operation: "evaluate" | "canonicalize" | "sign-receipt" | "verify-receipt";
  args: JsonObject;
  expected: { ok?: unknown; error?: { code: string } };
  rationale: string;
}

interface GoldenDocument extends JsonObject {
  contractFiles: { path: string; sha256: string }[];
  cases: GoldenCase[];
}

const GOLDEN = `${POLICY_RECEIPT_GOLDEN_DIRECTORY}/${POLICY_RECEIPT_GOLDEN_ENTRY}`;
const WORLD_DIRECTORY = `${import.meta.dir}/../../contracts/wit/signalement-policy-receipt-v1`;
const CORPUS_DIRECTORY = `${import.meta.dir}/../../contracts/fixtures/signalement-projection-receipt-v1`;
const encoder = new TextEncoder();

function encode(document: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(document));
}

/** The merged golden document (entry + declared parts), read by the shared loader. */
async function mergedGolden(): Promise<GoldenDocument> {
  const loaded = await loadSignalementV1Vectors(
    POLICY_RECEIPT_GOLDEN_DIRECTORY,
    POLICY_RECEIPT_GOLDEN_ENTRY,
  );
  if (loaded.vectors === null)
    throw new Error(`golden files refused: ${loaded.failures.join("; ")}`);
  return loaded.vectors as GoldenDocument;
}

function caseById(doc: GoldenDocument, id: string): GoldenCase {
  const found = doc.cases.find((c) => c.id === id);
  if (found === undefined) throw new Error(`no case ${id}`);
  return found;
}

function fromBase64url(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, "base64url"));
}

async function corpus(): Promise<{ vectors: JsonObject[]; signCases: JsonObject[] }> {
  const loaded = await loadSignalementV1Vectors(CORPUS_DIRECTORY, "signature-vectors.v1.json");
  if (loaded.vectors === null) throw new Error(loaded.failures.join("; "));
  return loaded.vectors as { vectors: JsonObject[]; signCases: JsonObject[] };
}

// The ids the brief and the controller rulings require, plus the extra cases committed with
// them; written here independently of the verifier's constant.
const EXPECTED_REQUIRED = [
  "exact-origin",
  "file-order-irrelevant",
  "host-pattern-subdomain",
  "host-pattern-apex",
  "host-pattern-port",
  "absent-origin-rule",
  "absent-origin-no-rule",
  "no-rule-matched",
  "denied-dominates",
  "override-most-restrictive",
  "selectable-listed-when-allowed",
  "selectable-excludes-routed",
  "default-withhold",
  "withhold-dominates-transmit",
  "visibility-unknown",
  "gitlab-internal-is-public",
  "residency-withhold",
  "attachment-upload-ignored",
  "denied-in-unmatched-rule-not-counted",
  "selectable-visibility-unknown",
  "declared-ignores-discovered",
  "reason-precedence-independent-of-order",
  "origin-with-path",
  "origin-default-port",
  "input-duplicate-path",
  "policy-unknown-destination",
  "policy-non-canonical-origin",
  "canonicalize-sort-ascii",
  "canonicalize-nested",
  "canonicalize-non-ascii-literal",
  "canonicalize-control-escape",
  "canonicalize-utf16-key-order",
  "canonicalize-safe-integer",
  "canonicalize-integral-forms",
  "canonicalize-float",
  "canonicalize-two-pow-53",
  "canonicalize-non-finite",
  "canonicalize-duplicate-member",
  "canonicalize-byte-order-mark",
  "canonicalize-lone-surrogate",
  "canonicalize-depth-65",
  "sign-valid-active",
  "sign-valid-retired",
  "sign-with-signature-member",
  "sign-short-seed",
  "verify-valid",
  "verify-unknown-key",
  "verify-mismatch",
  "verify-unreadable",
  "verify-other-organization",
  "verify-keys-invalid",
];

describe("committed golden document", () => {
  test("the committed golden document is well formed and complete", async () => {
    expect(await policyReceiptGoldenFailures()).toEqual([]);
    expect(rawPolicyReceiptFailures(encode(await mergedGolden()))).toEqual([]);
  });

  test("a missing required case and a changed contract file are named failures", async () => {
    const doc = await mergedGolden();
    doc.cases = doc.cases.filter((c: { id: string }) => c.id !== "visibility-unknown");
    const first = doc.contractFiles[0];
    if (first === undefined) throw new Error("no contract file");
    first.sha256 = "0".repeat(64);
    expect(rawPolicyReceiptFailures(encode(doc))).toEqual([
      `golden.contract_file:${first.path}`,
      "golden.case_missing:visibility-unknown",
    ]);
  });

  test("every operation has at least one ok and one error case", async () => {
    const doc = await mergedGolden();
    const counts = new Map<string, { ok: number; error: number }>();
    for (const c of doc.cases) {
      const count = counts.get(c.operation) ?? { ok: 0, error: 0 };
      if (c.expected.ok !== undefined) count.ok += 1;
      else count.error += 1;
      counts.set(c.operation, count);
    }
    expect([...counts.keys()].sort()).toEqual(
      ["canonicalize", "evaluate", "sign-receipt", "verify-receipt"].sort(),
    );
    for (const [operation, count] of counts) {
      expect({ operation, ok: count.ok > 0, error: count.error > 0 }).toEqual({
        operation,
        ok: true,
        error: true,
      });
    }
    expect(Object.fromEntries(counts)).toEqual({
      evaluate: { ok: 22, error: 5 },
      canonicalize: { ok: 7, error: 7 },
      "sign-receipt": { ok: 2, error: 2 },
      "verify-receipt": { ok: 5, error: 1 },
    });
  });

  test("the required ids are exactly the briefed and committed cases, in document order", async () => {
    expect([...REQUIRED_GOLDEN_CASES]).toEqual(EXPECTED_REQUIRED);
    expect((await mergedGolden()).cases.map((c) => c.id)).toEqual(EXPECTED_REQUIRED);
  });

  test("the entry file alone is not a golden document: it declares parts", async () => {
    expect(rawPolicyReceiptFailures(await Bun.file(GOLDEN).bytes())).toEqual(["golden.envelope"]);
  });

  test("every golden error code is one of its operation's codes", async () => {
    for (const c of (await mergedGolden()).cases) {
      if (c.expected.error === undefined) continue;
      expect(OPERATION_ERROR_CODES[c.operation]).toContain(c.expected.error.code);
    }
  });
});

describe("expected values against independent sources", () => {
  test("file-order-irrelevant expects the verdict of exact-origin with its files permuted", async () => {
    const doc = await mergedGolden();
    const base = caseById(doc, "exact-origin");
    const permuted = caseById(doc, "file-order-irrelevant");
    expect(permuted.expected).toEqual(base.expected);
    expect(permuted.args.policy).toEqual(base.args.policy);
    const files = (c: GoldenCase) => (c.args.input as { files: { path: string }[] }).files;
    expect(files(permuted).map((f) => f.path)).not.toEqual(files(base).map((f) => f.path));
    expect([...files(permuted)].sort((a, b) => (a.path < b.path ? -1 : 1))).toEqual(
      [...files(base)].sort((a, b) => (a.path < b.path ? -1 : 1)),
    );
  });

  test("every verdict keeps the structural rules of the routing-policy semantics", async () => {
    let checked = 0;
    for (const c of (await mergedGolden()).cases) {
      if (c.operation !== "evaluate" || c.expected.ok === undefined) continue;
      checked += 1;
      const policy = c.args.policy as {
        destinations: { id: string; profileId: string; mediaFallback?: string }[];
        routingRules: { id: string }[];
      };
      const input = c.args.input as { files: { path: string }[] };
      const verdict = c.expected.ok as {
        matchedRuleIds: string[];
        destinations: {
          destinationId: string;
          profileId: string;
          routing: string;
          files: { path: string; decision: string; reason: string | null }[];
          media: string;
        }[];
        override: string;
        deniedCount: number;
      };
      const ruleOrder = policy.routingRules.map((r) => r.id);
      expect(verdict.matchedRuleIds).toEqual(
        ruleOrder.filter((id) => verdict.matchedRuleIds.includes(id)),
      );
      if (verdict.matchedRuleIds.length === 0) {
        expect({
          destinations: verdict.destinations,
          override: verdict.override,
          denied: verdict.deniedCount,
        }).toEqual({
          destinations: [],
          override: "denied",
          denied: 0,
        });
      }
      const ids = verdict.destinations.map((d) => d.destinationId);
      expect(ids).toEqual([...ids].sort());
      const paths = input.files.map((f) => f.path).sort();
      for (const d of verdict.destinations) {
        const declared = policy.destinations.find((p) => p.id === d.destinationId);
        expect(declared?.profileId).toBe(d.profileId);
        expect(d.media).toBe(declared?.mediaFallback ?? "withhold");
        if (verdict.override === "denied") expect(d.routing).not.toBe("selectable");
        expect(d.files.map((f) => f.path)).toEqual(paths);
        for (const f of d.files) {
          expect(f.decision === "transmit").toBe(f.reason === null);
          expect(["attachment-unsupported", "user-withheld"]).not.toContain(f.reason);
        }
      }
    }
    expect(checked).toBe(22);
  });

  test("sign-receipt successes are the exact signed octets of the corpus sign cases", async () => {
    const { signCases } = await corpus();
    const doc = await mergedGolden();
    for (const [id, corpusId] of [
      ["sign-valid-active", "valid-active"],
      ["sign-valid-retired", "valid-retired"],
    ] as const) {
      const golden = caseById(doc, id);
      const source = signCases.find((s) => s.id === corpusId);
      if (source === undefined) throw new Error(`no sign case ${corpusId}`);
      expect(golden.args).toEqual({ unsigned: source.unsigned, secretKey: source.seed });
      const octets = encoder.encode(canonicalJson(golden.expected.ok));
      expect(Buffer.from(octets).equals(Buffer.from(fromBase64url(source.signed as string)))).toBe(
        true,
      );
      expect(rawProjectionReceiptFailures(octets)).toEqual([]);
    }
    const short = caseById(doc, "sign-short-seed").args.secretKey as string;
    expect(fromBase64url(short).byteLength).toBe(31);
    expect(caseById(doc, "sign-with-signature-member").args.unsigned).toHaveProperty("signature");
  });

  test("verify-receipt cases take corpus octets and keep the corpus verdicts", async () => {
    const { vectors } = await corpus();
    let checked = 0;
    for (const c of (await mergedGolden()).cases) {
      if (c.operation !== "verify-receipt") continue;
      checked += 1;
      const source = vectors.find(
        (v) =>
          v.signed === c.args.signed &&
          canonicalJson(v.keySet) === canonicalJson(c.args.publicKeys),
      );
      if (source === undefined) throw new Error(`no corpus vector for ${c.id}`);
      const expected = source.expected as JsonObject;
      if (c.expected.error !== undefined) {
        expect(Object.keys(expected)).toEqual(["refused"]);
        expect(c.expected.error.code).toBe("keys.invalid");
        continue;
      }
      const ok = c.expected.ok as JsonObject;
      expect(Object.keys(ok).sort()).toEqual(["keyId", "keyStatus", "receipt", "signature"]);
      expect({ signature: ok.signature, keyId: ok.keyId, keyStatus: ok.keyStatus }).toEqual({
        signature: expected.signature,
        keyId: expected.keyId,
        keyStatus: expected.keyStatus,
      });
      const signedText = new TextDecoder().decode(fromBase64url(c.args.signed as string));
      expect(ok.receipt).toEqual(ok.signature === "valid" ? JSON.parse(signedText) : null);
    }
    expect(checked).toBe(6);
  });

  test("canonicalize successes have the JCS text written here by hand", async () => {
    const doc = await mergedGolden();
    const expectedText: Record<string, string> = {
      "canonicalize-sort-ascii": '{"B":3,"_":4,"a":2,"b":1}',
      "canonicalize-nested": '{"y":true,"z":{"a":null,"b":[3,{"c":2,"d":1}]}}',
      // Escapes below are TypeScript source escapes: the strings hold the literal characters.
      "canonicalize-non-ascii-literal": '{"k":"é日本"}',
      "canonicalize-control-escape": String.raw`"\u001f/A\t"`,
      "canonicalize-utf16-key-order": '{"\u{1F600}":2,"Ａ":1}',
      "canonicalize-safe-integer": "[9007199254740991,-9007199254740991,0]",
      "canonicalize-integral-forms": "[1,100,0,1]",
    };
    const okIds = doc.cases
      .filter((c) => c.operation === "canonicalize" && c.expected.ok !== undefined)
      .map((c) => c.id);
    expect(okIds.sort()).toEqual(Object.keys(expectedText).sort());
    for (const [id, text] of Object.entries(expectedText))
      expect(canonicalJson(caseById(doc, id).expected.ok)).toBe(text);
    const deep = new TextDecoder().decode(
      fromBase64url(caseById(doc, "canonicalize-depth-65").args.jsonBytes as string),
    );
    expect(deep).toBe(`${"[".repeat(65)}${"]".repeat(65)}`);
  });
});

/** The merged document, mutated by `edit`, then verified. */
async function failuresAfter(edit: (doc: GoldenDocument) => void): Promise<string[]> {
  const doc = await mergedGolden();
  edit(doc);
  return rawPolicyReceiptFailures(encode(doc));
}

function evaluateOk(doc: GoldenDocument, id: string): JsonObject {
  return caseById(doc, id).expected.ok as JsonObject;
}

describe("failure codes", () => {
  test("above 8 MiB nothing is decoded; exactly 8 MiB is read", async () => {
    expect(rawPolicyReceiptFailures(new Uint8Array(POLICY_RECEIPT_GOLDEN_MAX_BYTES + 1))).toEqual([
      "golden.size_limit",
    ]);
    const bytes = encode(await mergedGolden());
    const padded = new Uint8Array(POLICY_RECEIPT_GOLDEN_MAX_BYTES).fill(0x20);
    padded.set(bytes);
    expect(rawPolicyReceiptFailures(padded)).toEqual([]);
  });

  test("octets that are not strict JSON are golden.raw_json", async () => {
    const bytes = encode(await mergedGolden());
    const bom = new Uint8Array(bytes.byteLength + 3);
    bom.set([0xef, 0xbb, 0xbf]);
    bom.set(bytes, 3);
    expect(rawPolicyReceiptFailures(bom)).toEqual(["golden.raw_json"]);
    const text = new TextDecoder().decode(bytes);
    const duplicated = `{"world":"signalement-policy-receipt-v1",${text.slice(1)}`;
    expect(rawPolicyReceiptFailures(encoder.encode(duplicated))).toEqual(["golden.raw_json"]);
    expect(rawPolicyReceiptFailures(encoder.encode(`${"[".repeat(65)}${"]".repeat(65)}`))).toEqual([
      "golden.raw_json",
    ]);
  });

  const envelopeEdits: [string, (doc: GoldenDocument) => void][] = [
    [
      "root is an array",
      (doc) => Object.assign(doc, { cases: undefined, contractFiles: undefined }),
    ],
    ["unknown root member", (doc) => Object.assign(doc, { status: "candidate" })],
    ["parts member", (doc) => Object.assign(doc, { parts: ["golden-vectors.v1.part-2.json"] })],
    [
      "other schema version",
      (doc) => Object.assign(doc, { schemaVersion: "libre-ai.other-golden.v1" }),
    ],
    ["other world", (doc) => Object.assign(doc, { world: "policy-core-v2" })],
    ["other engine version", (doc) => Object.assign(doc, { engineVersion: "1.0.1" })],
    ["other canonicalization", (doc) => Object.assign(doc, { canonicalization: "none" })],
    ["other digest algorithm", (doc) => Object.assign(doc, { digestAlgorithm: "SHA-512" })],
    ["empty warning", (doc) => Object.assign(doc, { testMaterialWarning: "" })],
    ["non-ASCII warning", (doc) => Object.assign(doc, { testMaterialWarning: "tést" })],
    ["no contract file", (doc) => Object.assign(doc, { contractFiles: [] })],
    [
      "contract file path outside contracts/",
      (doc) => doc.contractFiles.push({ path: "tools/quality/x.ts", sha256: "0".repeat(64) }),
    ],
    [
      "contract file path with a parent segment",
      (doc) =>
        doc.contractFiles.push({ path: "contracts/../package.json", sha256: "0".repeat(64) }),
    ],
    [
      "repeated contract file path",
      (doc) => {
        const first = doc.contractFiles[0];
        if (first !== undefined) doc.contractFiles.push({ ...first });
      },
    ],
    [
      "contract file with an upper-case digest",
      (doc) => {
        const first = doc.contractFiles[0];
        if (first !== undefined) first.sha256 = first.sha256.toUpperCase();
      },
    ],
    ["no case", (doc) => Object.assign(doc, { cases: [] })],
    ["case with an unknown member", (doc) => Object.assign(doc.cases[0] ?? {}, { note: "x" })],
    ["case id not an identifier", (doc) => Object.assign(doc.cases[0] ?? {}, { id: "Exact" })],
    ["unknown operation", (doc) => Object.assign(doc.cases[0] ?? {}, { operation: "route" })],
    ["empty rationale", (doc) => Object.assign(doc.cases[0] ?? {}, { rationale: "" })],
    [
      "evaluate without input",
      (doc) => {
        delete (doc.cases[0] as GoldenCase).args.input;
      },
    ],
    [
      "canonicalize with json and jsonBytes",
      (doc) => Object.assign(caseById(doc, "canonicalize-sort-ascii").args, { json: 1 }),
    ],
    [
      "canonicalize with neither json nor jsonBytes",
      (doc) => {
        delete caseById(doc, "canonicalize-sort-ascii").args.jsonBytes;
      },
    ],
    [
      "non-canonical base64url",
      (doc) => Object.assign(caseById(doc, "sign-short-seed").args, { secretKey: "AB" }),
    ],
    [
      "base64url with padding",
      (doc) => Object.assign(caseById(doc, "canonicalize-float").args, { jsonBytes: "WzEuNV0=" }),
    ],
    [
      "signed given as JSON",
      (doc) => Object.assign(caseById(doc, "verify-valid").args, { signed: { a: 1 } }),
    ],
    [
      "expected with ok and error",
      (doc) =>
        Object.assign(caseById(doc, "exact-origin").expected, { error: { code: "input.invalid" } }),
    ],
    ["expected with neither", (doc) => Object.assign(doc.cases[0] ?? {}, { expected: {} })],
    [
      "error code of another operation",
      (doc) =>
        Object.assign(caseById(doc, "origin-with-path").expected, {
          error: { code: "keys.invalid" },
        }),
    ],
    [
      "internal.error expected",
      (doc) =>
        Object.assign(caseById(doc, "origin-with-path").expected, {
          error: { code: "internal.error" },
        }),
    ],
    [
      "error with a message member",
      (doc) =>
        Object.assign(caseById(doc, "origin-with-path").expected, {
          error: { code: "input.origin_invalid", message: "x" },
        }),
    ],
    [
      "a number that is not a safe integer",
      (doc) => Object.assign(evaluateOk(doc, "exact-origin"), { deniedCount: 0.5 }),
    ],
  ];
  for (const [name, edit] of envelopeEdits) {
    test(`envelope: ${name}`, async () => {
      if (name === "root is an array") {
        expect(rawPolicyReceiptFailures(encoder.encode("[]"))).toEqual(["golden.envelope"]);
        return;
      }
      expect(await failuresAfter(edit)).toEqual(["golden.envelope"]);
    });
  }

  test("an unreadable contract file is golden.contract_file", async () => {
    const path = "contracts/schemas/absent.v1.schema.json";
    expect(
      await failuresAfter((doc) => doc.contractFiles.push({ path, sha256: "0".repeat(64) })),
    ).toEqual([`golden.contract_file:${path}`]);
  });

  test("a repeated case id is named once", async () => {
    expect(
      await failuresAfter((doc) => {
        const first = doc.cases[0] as GoldenCase;
        doc.cases.push({ ...first }, { ...first });
      }),
    ).toEqual(["golden.case_duplicate:exact-origin"]);
  });

  test("a refused policy is golden.policy_invalid unless the case expects policy.invalid", async () => {
    expect(
      await failuresAfter((doc) => {
        const policy = caseById(doc, "default-withhold").args.policy as JsonObject;
        policy.version = "01";
      }),
    ).toEqual(["golden.policy_invalid:default-withhold"]);
    expect(
      await failuresAfter((doc) => {
        caseById(doc, "policy-unknown-destination").args.policy = caseById(
          doc,
          "default-withhold",
        ).args.policy;
      }),
    ).toEqual(["golden.policy_invalid:policy-unknown-destination"]);
  });

  test("a verdict without exactly the PolicyVerdict members is golden.verdict_shape", async () => {
    for (const edit of [
      (ok: JsonObject) => Object.assign(ok, { selectable: [] }),
      (ok: JsonObject) => {
        delete ok.deniedCount;
      },
      (ok: JsonObject) =>
        Object.assign((ok.destinations as JsonObject[])[0] ?? {}, { reason: null }),
      (ok: JsonObject) => {
        const destination = (ok.destinations as JsonObject[])[0];
        const file = destination === undefined ? undefined : (destination.files as JsonObject[])[0];
        if (file !== undefined) delete file.reason;
      },
      (ok: JsonObject) => Object.assign(ok, { destinations: {} }),
    ]) {
      expect(await failuresAfter((doc) => edit(evaluateOk(doc, "exact-origin")))).toEqual([
        "golden.verdict_shape:exact-origin",
      ]);
    }
    expect(
      await failuresAfter((doc) =>
        Object.assign(caseById(doc, "exact-origin").expected, { ok: [] }),
      ),
    ).toEqual(["golden.verdict_shape:exact-origin"]);
  });

  test("a verdict of another digest or version is golden.verdict_digest", async () => {
    expect(
      await failuresAfter((doc) =>
        Object.assign(evaluateOk(doc, "denied-dominates"), { policyDigest: "0".repeat(64) }),
      ),
    ).toEqual(["golden.verdict_digest:denied-dominates"]);
    expect(
      await failuresAfter((doc) =>
        Object.assign(evaluateOk(doc, "denied-dominates"), { policyVersion: "2" }),
      ),
    ).toEqual(["golden.verdict_digest:denied-dominates"]);
    // An edited policy whose digest the verdict no longer names (the stale-vector case).
    expect(
      await failuresAfter((doc) => {
        const policy = caseById(doc, "denied-dominates").args.policy as JsonObject;
        policy.policyId = "golden-edited";
      }),
    ).toEqual(["golden.verdict_digest:denied-dominates"]);
  });

  test("a signed receipt the receipt verifier refuses is golden.receipt_invalid", async () => {
    expect(
      await failuresAfter((doc) => {
        const ok = caseById(doc, "sign-valid-active").expected.ok as JsonObject;
        ok.deliveredAt = "2026-10-24T10:00:09Z";
      }),
    ).toEqual(["golden.receipt_invalid:sign-valid-active"]);
  });

  test("codes come in the documented order and accumulate", async () => {
    expect(
      await failuresAfter((doc) => {
        const last = doc.contractFiles[doc.contractFiles.length - 1];
        if (last !== undefined) last.sha256 = "f".repeat(64);
        const first = doc.contractFiles[0];
        if (first !== undefined) first.sha256 = "e".repeat(64);
        const ok = caseById(doc, "sign-valid-retired").expected.ok as JsonObject;
        delete ok.approval;
        Object.assign(evaluateOk(doc, "residency-withhold"), { policyVersion: "9" });
        Object.assign(evaluateOk(doc, "default-withhold"), { extra: true });
        (caseById(doc, "absent-origin-rule").args.policy as JsonObject).version = "x";
        doc.cases = doc.cases.filter(
          (c) => c.id !== "verify-mismatch" && c.id !== "canonicalize-nested",
        );
        doc.cases.push({ ...(doc.cases[3] as GoldenCase) });
      }),
    ).toEqual([
      "golden.contract_file:contracts/schemas/signalement-routing-policy.v1.schema.json",
      "golden.contract_file:contracts/fixtures/signalement-projection-receipt-v1/signature-vectors.v1.part-2.json",
      `golden.case_duplicate:${EXPECTED_REQUIRED[3]}`,
      "golden.case_missing:canonicalize-nested",
      "golden.case_missing:verify-mismatch",
      "golden.policy_invalid:absent-origin-rule",
      "golden.verdict_shape:default-withhold",
      "golden.verdict_digest:residency-withhold",
      "golden.receipt_invalid:sign-valid-retired",
    ]);
  });

  test("codes carry no document data beyond an id or a contract file path", async () => {
    const failures = await failuresAfter((doc) => {
      const ok = caseById(doc, "sign-valid-active").expected.ok as JsonObject;
      ok.organization = "Secret Tenant Name";
    });
    expect(failures).toEqual(["golden.receipt_invalid:sign-valid-active"]);
    expect(failures.join()).not.toContain("Secret Tenant Name");
  });
});

describe("continuation files", () => {
  async function withCopy(edit: (dir: string) => Promise<void>): Promise<string[]> {
    const dir = await mkdtemp(join(tmpdir(), "policy-receipt-golden-"));
    try {
      await cp(POLICY_RECEIPT_GOLDEN_DIRECTORY, dir, { recursive: true });
      await edit(dir);
      return await policyReceiptGoldenFailures(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  test("an unchanged copy elsewhere passes: contract files resolve from the verifier", async () => {
    expect(await withCopy(async () => {})).toEqual([]);
  });

  test("a declared part that is absent is named", async () => {
    expect(await withCopy((dir) => rm(join(dir, "golden-vectors.v1.part-3.json")))).toEqual([
      "golden.parts:golden-vectors.v1.part-3.json: declared by golden-vectors.v1.json but absent or unreadable",
    ]);
  });

  test("an undeclared part is an orphan", async () => {
    expect(
      await withCopy((dir) =>
        writeFile(
          join(dir, "golden-vectors.v1.part-4.json"),
          JSON.stringify({
            schemaVersion: "libre-ai.signalement-policy-receipt-golden-vectors.v1",
            cases: [],
          }),
        ),
      ),
    ).toEqual([
      "golden.parts:golden-vectors.v1.part-4.json: vector file not declared by golden-vectors.v1.json",
    ]);
  });

  test("a file above 8 MiB is refused before it is read", async () => {
    expect(
      await withCopy((dir) =>
        writeFile(
          join(dir, "golden-vectors.v1.part-3.json"),
          new Uint8Array(POLICY_RECEIPT_GOLDEN_MAX_BYTES + 1).fill(0x20),
        ),
      ),
    ).toEqual(["golden.size_limit:golden-vectors.v1.part-3.json"]);
  });

  test("a case dropped from a part is missing from the merged document", async () => {
    expect(
      await withCopy(async (dir) => {
        const path = join(dir, "golden-vectors.v1.part-3.json");
        const part = (await Bun.file(path).json()) as GoldenDocument;
        part.cases = part.cases.filter((c) => c.id !== "verify-unreadable");
        await writeFile(path, JSON.stringify(part));
      }),
    ).toEqual(["golden.case_missing:verify-unreadable"]);
  });

  test("an unreadable directory is a named failure", async () => {
    expect(await loadPolicyReceiptGolden(join(tmpdir(), "absent-policy-receipt-golden"))).toEqual({
      document: null,
      failures: ["golden.parts:directory is unreadable"],
    });
  });
});

describe("world and semantics", () => {
  test("the world exports the registry's four functions and imports nothing", async () => {
    const text = await Bun.file(`${WORLD_DIRECTORY}/world.wit`).text();
    for (const line of [
      "package libre-ai:signalement-policy-receipt@1.0.0;",
      "record contract-error { code: string, message: string }",
      "evaluate: func(policy: list<u8>, input: list<u8>) -> result<list<u8>, contract-error>;",
      "canonicalize: func(json: list<u8>) -> result<list<u8>, contract-error>;",
      "sign-receipt: func(unsigned: list<u8>, secret-key: list<u8>) -> result<list<u8>, contract-error>;",
      "verify-receipt: func(signed: list<u8>, public-keys: list<u8>) -> result<list<u8>, contract-error>;",
      "world signalement-policy-receipt {",
      "export api;",
    ])
      expect(text).toContain(line);
    const executable = text.replaceAll(/\/\/.*$/gm, "");
    expect(executable).not.toMatch(/\bimport\b/);
    expect(executable).not.toContain("key-id");
    expect(executable.match(/: func\(/g)).toHaveLength(4);
  });

  test("the semantics state every operation code and every golden failure code", async () => {
    const text = await Bun.file(`${WORLD_DIRECTORY}/SEMANTICS.md`).text();
    const codes = [
      ...Object.values(OPERATION_ERROR_CODES).flat(),
      "internal.error",
      "golden.size_limit",
      "golden.raw_json",
      "golden.envelope",
      "golden.contract_file:<path>",
      "golden.case_duplicate:<id>",
      "golden.case_missing:<id>",
      "golden.policy_invalid:<id>",
      "golden.verdict_shape:<id>",
      "golden.verdict_digest:<id>",
      "golden.receipt_invalid:<id>",
      "golden.size_limit:<file>",
      "golden.parts:<description>",
    ];
    for (const code of codes) expect(text).toContain(`\`${code}\``);
    for (const id of EXPECTED_REQUIRED) expect(text).toContain(`\`${id}\``);
  });

  test("the operation codes are those of the semantics table", () => {
    expect(OPERATION_ERROR_CODES).toEqual({
      evaluate: ["input.too_large", "policy.invalid", "input.invalid", "input.origin_invalid"],
      canonicalize: [
        "canonicalize.too_large",
        "canonicalize.raw_json",
        "canonicalize.lone_surrogate",
        "canonicalize.depth",
        "canonicalize.number",
      ],
      "sign-receipt": ["key.invalid", "receipt.invalid"],
      "verify-receipt": ["keys.invalid"],
    });
  });

  test("the contract files are bound by their SHA-256", async () => {
    const doc = await mergedGolden();
    expect(doc.contractFiles.map((f) => f.path)).toEqual([
      "contracts/schemas/signalement-routing-policy.v1.schema.json",
      "contracts/schemas/signalement-projection-receipt.v1.schema.json",
      "contracts/fixtures/signalement-projection-receipt-v1/signature-vectors.v1.json",
      "contracts/fixtures/signalement-projection-receipt-v1/signature-vectors.v1.part-2.json",
    ]);
    for (const file of doc.contractFiles) {
      const bytes = await Bun.file(`${import.meta.dir}/../../${file.path}`).bytes();
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(file.sha256);
    }
  });
});
