import { describe, expect, test } from "bun:test";

import {
  differingPointers,
  evaluateSymbolicReceipt,
  i34Clauses,
  type MlsProperty,
  mlsRedVectorDocumentFailures,
  mlsVerdicts,
  type SymbolicMessage,
  type SymbolicReceiver,
} from "./mls-sender-authentication";

const vectorPath = "contracts/fixtures/mls-sender-authentication-candidate/red-vectors.v1.json";

interface Vector {
  id: string;
  polarity: "red" | "green";
  i34Clause?: string;
  message: SymbolicMessage;
  expected: string;
  violatedProperties?: string[];
  pairedGreen?: string;
  differsAt?: string[];
  knownGaps?: string[];
  documentMutated: boolean;
  cryptoMaterial: string;
}

interface VectorDocument {
  receiver: SymbolicReceiver;
  knownGaps: { id: string; vectors: string[] }[];
  vectors: Vector[];
  [key: string]: unknown;
}

async function readDocument(): Promise<VectorDocument> {
  return (await Bun.file(vectorPath).json()) as VectorDocument;
}

function vector(document: VectorDocument, id: string): Vector {
  const found = document.vectors.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} is missing`);
  return found;
}

describe("I-34 MLS sender-authentication red vectors", () => {
  test("the document is closed, paired and replays to every verdict", async () => {
    const document = await readDocument();
    expect(mlsRedVectorDocumentFailures(document)).toEqual([]);
    // The examined volume, so an empty or truncated file cannot pass silently.
    const reds = document.vectors.filter((entry) => entry.polarity === "red");
    const greens = document.vectors.filter((entry) => entry.polarity === "green");
    expect(reds.length).toBe(17);
    expect(greens.length).toBe(2);
    expect(new Set(reds.map((entry) => entry.i34Clause)).size).toBe(i34Clauses.length);
    expect(new Set(document.vectors.map((entry) => entry.expected)).size).toBe(mlsVerdicts.length);
    console.info(
      `I-34 vectors: ${reds.length} red, ${greens.length} green, ` +
        `${i34Clauses.length} clauses, ${mlsVerdicts.length} verdicts, all cryptoMaterial to-generate`,
    );
  });

  test("the vectors the mandate names are present with their verdicts", async () => {
    const document = await readDocument();
    const expectations: [string, string][] = [
      ["i34-sender-forged-by-member", "refused-signature-invalid"],
      ["i34-stale-epoch", "refused-stale-epoch"],
      ["i34-future-epoch", "refused-future-epoch"],
      ["i34-replay-verbatim", "refused-replay"],
      ["i34-replay-consumed-generation-fresh-nonce", "refused-replay"],
      ["i34-relay-forged-frame", "refused-group-authentication"],
      ["i34-content-under-exporter-key-in-private-message", "refused-group-authentication"],
      ["i34-content-sealed-frame-under-exported-key", "refused-not-mls-private-message"],
    ];
    for (const [id, verdict] of expectations) expect(vector(document, id).expected).toBe(verdict);
    const forged = vector(document, "i34-sender-forged-by-member").message;
    // The member forgery keeps a valid AEAD: only the signature betrays it.
    expect(forged.aeadSealedBy).toBe("member-holding-epoch-secrets");
    expect(forged.contentProtection).toBe("secret-tree-application-ratchet");
    expect(forged.signature.signerLeafIndex).not.toBe(forged.senderData.leafIndex);
  });

  test("a receiver that trusts the AEAD for identity accepts the member forgery", async () => {
    // The amended R5 belief: a valid AEAD binds the sender. The vector must turn
    // red against exactly that implementation.
    const document = await readDocument();
    const forged = vector(document, "i34-sender-forged-by-member").message;
    const withoutSignature = new Set<MlsProperty>(["sender-signature"]);
    expect(evaluateSymbolicReceipt(document.receiver, forged)).toBe("refused-signature-invalid");
    expect(evaluateSymbolicReceipt(document.receiver, forged, withoutSignature)).toBe("applied");
  });

  test("a receiver that opens exporter-sealed content accepts the R4 frame", async () => {
    const document = await readDocument();
    const exporter = vector(document, "i34-content-under-exporter-key-in-private-message").message;
    const withoutKeyCheck = new Set<MlsProperty>(["content-key-from-secret-tree"]);
    expect(evaluateSymbolicReceipt(document.receiver, exporter, withoutKeyCheck)).toBe("applied");
  });

  test("differingPointers reports leaf pointers only", () => {
    expect(differingPointers({ a: { b: 1, c: 2 } }, { a: { b: 1, c: 3 } })).toEqual(["/a/c"]);
    expect(differingPointers({ a: null }, { a: { b: 1 } })).toEqual(["/a"]);
    expect(differingPointers({ a: 1 }, { a: 1 })).toEqual([]);
  });

  describe("the checker refuses a document that does not hold", () => {
    test("an open verdict", async () => {
      const document = await readDocument();
      vector(document, "i34-stale-epoch").expected = "refused-maybe";
      expect(mlsRedVectorDocumentFailures(document)).toContain(
        "i34-stale-epoch: expected is not a closed verdict",
      );
    });

    test("a red vector expected to be applied", async () => {
      const document = await readDocument();
      vector(document, "i34-signature-absent").expected = "applied";
      expect(mlsRedVectorDocumentFailures(document)).toContain(
        "i34-signature-absent: a red vector is refused",
      );
    });

    test("a red vector with no green pair", async () => {
      const document = await readDocument();
      delete vector(document, "i34-future-epoch").pairedGreen;
      expect(mlsRedVectorDocumentFailures(document)).toContain(
        "i34-future-epoch: pairedGreen must name a green vector",
      );
    });

    test("a green vector no red is paired with", async () => {
      const document = await readDocument();
      vector(document, "i34-replay-consumed-generation-fresh-nonce").pairedGreen =
        "i34-green-canonical-application-message";
      vector(document, "i34-replay-consumed-generation-fresh-nonce").differsAt = [
        "/senderData/generation",
      ];
      expect(mlsRedVectorDocumentFailures(document)).toContain(
        "i34-green-out-of-order-unconsumed-generation: a green vector no red is paired with",
      );
    });

    test("a pair that differs elsewhere than declared", async () => {
      const document = await readDocument();
      vector(document, "i34-sender-forged-by-member").message.senderData.generation = 9;
      const failures = mlsRedVectorDocumentFailures(document);
      expect(
        failures.some((failure) =>
          failure.startsWith(
            "i34-sender-forged-by-member: differs from i34-green-canonical-application-message",
          ),
        ),
      ).toBe(true);
    });

    test("a missing I-34 clause", async () => {
      const document = await readDocument();
      document.vectors = document.vectors.filter(
        (entry) => entry.i34Clause !== "relay-forged-frame",
      );
      expect(mlsRedVectorDocumentFailures(document)).toContain(
        "I-34 clause relay-forged-frame has no red vector",
      );
    });

    test("an undeclared violated property", async () => {
      const document = await readDocument();
      vector(document, "i34-relay-forged-frame").violatedProperties = ["group-authentication"];
      expect(mlsRedVectorDocumentFailures(document)).toContain(
        "i34-relay-forged-frame: still refused-signature-invalid once [group-authentication] are dropped: it violates an undeclared property",
      );
    });

    test("a declared property the vector does not violate", async () => {
      const document = await readDocument();
      vector(document, "i34-signature-truncated").violatedProperties = [
        "sender-signature",
        "epoch-not-stale",
      ];
      expect(mlsRedVectorDocumentFailures(document)).toContain(
        "i34-signature-truncated: epoch-not-stale alone does not refuse it: it is not violated",
      );
    });

    test("a verdict that does not replay", async () => {
      const document = await readDocument();
      const red = vector(document, "i34-signature-over-other-content");
      red.expected = "refused-replay";
      expect(mlsRedVectorDocumentFailures(document)).toContain(
        "i34-signature-over-other-content: replays to refused-signature-invalid, expects refused-replay",
      );
    });

    test("cryptographic material admitted in place of to-generate", async () => {
      const document = await readDocument();
      vector(document, "i34-replay-verbatim").cryptoMaterial = "inline";
      document.cryptoMaterial = "inline";
      const failures = mlsRedVectorDocumentFailures(document);
      expect(failures).toContain('i34-replay-verbatim: cryptoMaterial must be "to-generate"');
      expect(failures).toContain(
        'cryptoMaterial must be "to-generate": no material is admitted here',
      );
    });

    test("a known gap whose vector does not point back", async () => {
      const document = await readDocument();
      vector(document, "i34-content-sealed-frame-under-exported-key").knownGaps = [
        "sc-protocol-per-epoch-group-key",
      ];
      expect(mlsRedVectorDocumentFailures(document)).toContain(
        "knownGaps cds-sealed-frame-without-sender: i34-content-sealed-frame-under-exported-key does not point back",
      );
    });
  });
});
