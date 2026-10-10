// Candidate red vectors for invariant I-34 (project-governance ADR-0048):
// sender authentication of MLS application messages, RFC 9420.
//
// This module is a symbolic reference oracle and a document checker. It is
// not an MLS implementation: it handles no key, no byte string and no wire
// encoding. Each vector describes a received message by the symbolic facts a
// real receiver establishes (wire format, epoch, which key sealed the
// content, whether the AEAD opens, which leaf signed what), and the oracle
// maps those facts to the closed verdict a conformant receiver returns. The
// cryptographic material that realizes each vector is declared
// `cryptoMaterial: "to-generate"`; it is produced in the implementing
// repository, never here (docs/adr/2026-10-10-mls-sender-authentication-red-vectors.md).
//
// Why an oracle at all: it is what proves, without MLS code, that each red
// vector violates exactly the properties it declares. Disabling those checks
// must turn its verdict into `applied`, and disabling all but one of them
// must not. That is I-34's "rougit contre une implémentation privée de la
// propriété qu'il vise", replayed on the symbolic model.

type JsonRecord = Record<string, unknown>;

export const mlsRedVectorSchemaVersion = "libre-ai.mls-sender-authentication-red-vectors.v1";

export const mlsVerdicts = [
  "applied",
  "refused-not-mls-private-message",
  "refused-stale-epoch",
  "refused-future-epoch",
  "refused-group-authentication",
  "refused-unknown-sender-leaf",
  "refused-replay",
  "refused-signature-invalid",
] as const;
export type MlsVerdict = (typeof mlsVerdicts)[number];

export const mlsProperties = [
  "native-private-message-framing",
  "epoch-not-stale",
  "epoch-not-future",
  "content-key-from-secret-tree",
  "group-authentication",
  "sender-leaf-non-blank",
  "generation-not-consumed",
  "sender-signature",
] as const;
export type MlsProperty = (typeof mlsProperties)[number];

export const i34Clauses = [
  "sender-forgery-by-member",
  "signature-absent-or-invalid",
  "content-sealed-under-exported-or-derived-key",
  "application-content-outside-private-message",
  "stale-or-future-epoch",
  "replay",
  "relay-forged-frame",
] as const;
export type I34Clause = (typeof i34Clauses)[number];

const transports = ["mls-message", "application-sealed-frame"] as const;
const wireFormats = ["mls_private_message", "mls_public_message", null] as const;
const contentProtections = [
  "secret-tree-application-ratchet",
  "mls-exporter-derived-key",
  "epoch-secret-hkdf",
  "application-hkdf",
] as const;
const aeadSealers = ["member-holding-epoch-secrets", "relay-without-group-secrets"] as const;
const alterations = ["none", "authenticated-data-rewritten"] as const;
const reuseGuards = ["fresh", "repeated"] as const;
const signatureEncodings = ["complete", "truncated", "absent"] as const;
const signedContents = [
  "this-framed-content",
  "other-framed-content",
  "other-epoch-group-context",
  null,
] as const;
const leafStates = ["member", "blank"] as const;

export interface SymbolicSignature {
  encoding: (typeof signatureEncodings)[number];
  signerLeafIndex: number | null;
  signedContent: (typeof signedContents)[number];
}

export interface SymbolicMessage {
  transport: (typeof transports)[number];
  wireFormat: (typeof wireFormats)[number];
  groupId: string;
  epoch: number;
  contentType: "application";
  contentProtection: (typeof contentProtections)[number];
  aeadSealedBy: (typeof aeadSealers)[number];
  inTransitAlteration: (typeof alterations)[number];
  senderData: { leafIndex: number; generation: number; reuseGuard: (typeof reuseGuards)[number] };
  signature: SymbolicSignature;
}

export interface SymbolicReceiver {
  groupId: string;
  epoch: number;
  receiverLeafIndex: number;
  leaves: { leafIndex: number; state: (typeof leafStates)[number] }[];
  consumedApplicationGenerations: { leafIndex: number; generation: number }[];
}

/**
 * The receiver's decision, in RFC 9420 processing order. Each step is a
 * property; `disabled` removes that check, which models an implementation
 * deprived of it. Vectors are evaluated independently against the initial
 * receiver state: applying one vector consumes nothing for the next.
 */
export function evaluateSymbolicReceipt(
  receiver: SymbolicReceiver,
  message: SymbolicMessage,
  disabled: ReadonlySet<MlsProperty> = new Set(),
): MlsVerdict {
  const enforce = (property: MlsProperty): boolean => !disabled.has(property);
  if (message.groupId !== receiver.groupId) {
    // Not a verdict of this vector set: every vector targets the receiver's group.
    throw new TypeError(`message.groupId ${message.groupId} is not the receiver's group`);
  }

  // RFC 9420 §6: application messages MUST be PrivateMessage; a frame that is
  // not an MLSMessage carries no FramedContentAuthData to verify.
  if (
    enforce("native-private-message-framing") &&
    (message.transport !== "mls-message" || message.wireFormat !== "mls_private_message")
  ) {
    return "refused-not-mls-private-message";
  }

  // The epoch selects the key schedule; I-34 admits no window of past epochs.
  if (enforce("epoch-not-stale") && message.epoch < receiver.epoch) return "refused-stale-epoch";
  if (enforce("epoch-not-future") && message.epoch > receiver.epoch) return "refused-future-epoch";

  // RFC 9420 §6.3.1, §9: the receiver opens the content with the sender's
  // application ratchet key from the secret tree. A content sealed under any
  // other group-shared key does not open under it.
  if (
    enforce("content-key-from-secret-tree") &&
    message.contentProtection !== "secret-tree-application-ratchet"
  ) {
    return "refused-group-authentication";
  }
  // RFC 9420 §16.5, first form: the AEAD proves membership only. A party
  // without the epoch secrets cannot produce it, and an altered AAD breaks it.
  if (
    enforce("group-authentication") &&
    (message.aeadSealedBy !== "member-holding-epoch-secrets" ||
      message.inTransitAlteration !== "none")
  ) {
    return "refused-group-authentication";
  }

  // RFC 9420 §6.3.2: the sender data must name a non-blank leaf.
  const leaf = receiver.leaves.find((entry) => entry.leafIndex === message.senderData.leafIndex);
  if (enforce("sender-leaf-non-blank") && (leaf === undefined || leaf.state !== "member")) {
    return "refused-unknown-sender-leaf";
  }

  // RFC 9420 §9.2: a consumed (leaf, generation) key is deleted. Replay is
  // keyed on the generation, never on the nonce, which the reuse guard varies.
  if (
    enforce("generation-not-consumed") &&
    receiver.consumedApplicationGenerations.some(
      (entry) =>
        entry.leafIndex === message.senderData.leafIndex &&
        entry.generation === message.senderData.generation,
    )
  ) {
    return "refused-replay";
  }

  // RFC 9420 §6.1, §6.3.1, §16.5 second form: the signature in
  // FramedContentAuthData, verified under the signature key of the leaf the
  // sender data names, over this FramedContentTBS (content and GroupContext).
  if (
    enforce("sender-signature") &&
    (message.signature.encoding !== "complete" ||
      message.signature.signerLeafIndex !== message.senderData.leafIndex ||
      message.signature.signedContent !== "this-framed-content")
  ) {
    return "refused-signature-invalid";
  }

  return "applied";
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function oneOf<T>(allowed: readonly T[], value: unknown): value is T {
  return allowed.includes(value as T);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length && [...left].sort().join("\n") === [...right].sort().join("\n")
  );
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return undefined;
  return value as string[];
}

function messageFailures(value: unknown, label: string): string[] {
  if (!isRecord(value)) return [`${label}: message must be an object`];
  const failures: string[] = [];
  const expectedKeys = [
    "transport",
    "wireFormat",
    "groupId",
    "epoch",
    "contentType",
    "contentProtection",
    "aeadSealedBy",
    "inTransitAlteration",
    "senderData",
    "signature",
  ];
  if (!sameStringSet(Object.keys(value), expectedKeys))
    failures.push(`${label}: message keys are not exactly ${expectedKeys.join(", ")}`);
  if (!oneOf(transports, value.transport)) failures.push(`${label}: transport is not closed`);
  if (!oneOf(wireFormats, value.wireFormat)) failures.push(`${label}: wireFormat is not closed`);
  if (typeof value.groupId !== "string") failures.push(`${label}: groupId must be a string`);
  if (!isNonNegativeInteger(value.epoch)) failures.push(`${label}: epoch must be an integer`);
  if (value.contentType !== "application") failures.push(`${label}: contentType is not closed`);
  if (!oneOf(contentProtections, value.contentProtection))
    failures.push(`${label}: contentProtection is not closed`);
  if (!oneOf(aeadSealers, value.aeadSealedBy))
    failures.push(`${label}: aeadSealedBy is not closed`);
  if (!oneOf(alterations, value.inTransitAlteration))
    failures.push(`${label}: inTransitAlteration is not closed`);
  const sender = value.senderData;
  if (
    !isRecord(sender) ||
    !sameStringSet(Object.keys(sender), ["leafIndex", "generation", "reuseGuard"]) ||
    !isNonNegativeInteger(sender.leafIndex) ||
    !isNonNegativeInteger(sender.generation) ||
    !oneOf(reuseGuards, sender.reuseGuard)
  ) {
    failures.push(`${label}: senderData is not closed`);
  }
  const signature = value.signature;
  if (
    !isRecord(signature) ||
    !sameStringSet(Object.keys(signature), ["encoding", "signerLeafIndex", "signedContent"]) ||
    !oneOf(signatureEncodings, signature.encoding) ||
    !oneOf(signedContents, signature.signedContent) ||
    !(signature.signerLeafIndex === null || isNonNegativeInteger(signature.signerLeafIndex))
  ) {
    failures.push(`${label}: signature is not closed`);
  } else if (
    (signature.encoding === "absent") !==
    (signature.signerLeafIndex === null && signature.signedContent === null)
  ) {
    // An absent signature has no signer and covers nothing; a present one has both.
    failures.push(`${label}: signature fields contradict its encoding`);
  }
  return failures;
}

function receiverFailures(value: unknown): string[] {
  if (!isRecord(value)) return ["receiver must be an object"];
  const failures: string[] = [];
  if (typeof value.groupId !== "string") failures.push("receiver.groupId must be a string");
  if (!isNonNegativeInteger(value.epoch)) failures.push("receiver.epoch must be an integer");
  if (!isNonNegativeInteger(value.receiverLeafIndex))
    failures.push("receiver.receiverLeafIndex must be an integer");
  const leaves = value.leaves;
  if (
    !Array.isArray(leaves) ||
    leaves.length === 0 ||
    leaves.some(
      (leaf) =>
        !isRecord(leaf) || !isNonNegativeInteger(leaf.leafIndex) || !oneOf(leafStates, leaf.state),
    )
  ) {
    failures.push("receiver.leaves is not closed");
  }
  const consumed = value.consumedApplicationGenerations;
  if (
    !Array.isArray(consumed) ||
    consumed.length === 0 ||
    consumed.some(
      (entry) =>
        !isRecord(entry) ||
        !isNonNegativeInteger(entry.leafIndex) ||
        !isNonNegativeInteger(entry.generation),
    )
  ) {
    failures.push("receiver.consumedApplicationGenerations must name at least one consumed key");
  }
  return failures;
}

/** JSON pointers of the leaves at which two plain JSON values differ. */
export function differingPointers(left: unknown, right: unknown, at = ""): string[] {
  if (isRecord(left) && isRecord(right)) {
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    return keys.flatMap((key) => differingPointers(left[key], right[key], `${at}/${key}`));
  }
  return Object.is(left, right) ? [] : [at];
}

/**
 * Structural and semantic failures of a red-vector document. An empty list
 * means: closed verdicts, closed message vocabulary, every red paired with a
 * green that differs from it exactly where declared, every I-34 clause,
 * verdict and property covered, and every vector replaying to its verdict
 * with its declared violations exact.
 */
export function mlsRedVectorDocumentFailures(document: unknown): string[] {
  if (!isRecord(document)) return ["document must be an object"];
  const failures: string[] = [];
  if (document.schemaVersion !== mlsRedVectorSchemaVersion)
    failures.push(`schemaVersion must be ${mlsRedVectorSchemaVersion}`);
  if (document.cryptoMaterial !== "to-generate")
    failures.push('cryptoMaterial must be "to-generate": no material is admitted here');
  const declaredVerdicts = stringArray(document.verdicts);
  if (declaredVerdicts === undefined || !sameStringSet(declaredVerdicts, mlsVerdicts))
    failures.push("verdicts must be exactly the closed verdict set");
  const declaredProperties = stringArray(document.properties);
  if (declaredProperties === undefined || !sameStringSet(declaredProperties, mlsProperties))
    failures.push("properties must be exactly the closed property set");
  const declaredClauses = stringArray(document.i34Clauses);
  if (declaredClauses === undefined || !sameStringSet(declaredClauses, i34Clauses))
    failures.push("i34Clauses must be exactly the closed clause set");

  const receiverProblems = receiverFailures(document.receiver);
  failures.push(...receiverProblems);

  const gaps = Array.isArray(document.knownGaps) ? document.knownGaps : undefined;
  if (gaps === undefined) failures.push("knownGaps must be an array");
  const gapIds = new Map<string, string[]>();
  for (const [index, gap] of (gaps ?? []).entries()) {
    const vectorIds = isRecord(gap) ? stringArray(gap.vectors) : undefined;
    if (!isRecord(gap) || typeof gap.id !== "string" || vectorIds === undefined) {
      failures.push(`knownGaps.${index}: needs an id and its vectors`);
      continue;
    }
    gapIds.set(gap.id, vectorIds);
  }

  const vectors = Array.isArray(document.vectors) ? document.vectors : undefined;
  if (vectors === undefined || vectors.length === 0) {
    failures.push("vectors must be a non-empty array");
    return failures;
  }

  const byId = new Map<string, JsonRecord>();
  for (const [index, vector] of vectors.entries()) {
    if (!isRecord(vector) || typeof vector.id !== "string") {
      failures.push(`vectors.${index}: needs a string id`);
      continue;
    }
    if (byId.has(vector.id)) failures.push(`${vector.id}: duplicate id`);
    byId.set(vector.id, vector);
  }

  const pairedGreens = new Set<string>();
  const coveredClauses = new Set<string>();
  const coveredVerdicts = new Set<string>();
  const coveredProperties = new Set<string>();
  const receiver = receiverProblems.length === 0 ? (document.receiver as SymbolicReceiver) : null;

  for (const [id, vector] of byId) {
    const problems = messageFailures(vector.message, id);
    failures.push(...problems);
    if (vector.cryptoMaterial !== "to-generate")
      failures.push(`${id}: cryptoMaterial must be "to-generate"`);
    if (!oneOf(mlsVerdicts, vector.expected)) {
      failures.push(`${id}: expected is not a closed verdict`);
      continue;
    }
    coveredVerdicts.add(vector.expected);
    if (typeof vector.name !== "string" || vector.name.length === 0)
      failures.push(`${id}: needs a name`);
    const rfc = stringArray(vector.rfc);
    if (rfc === undefined || rfc.length === 0) failures.push(`${id}: needs its RFC 9420 sections`);

    if (vector.polarity === "green") {
      if (vector.expected !== "applied") failures.push(`${id}: a green vector is applied`);
      if (vector.documentMutated !== true)
        failures.push(`${id}: a green vector mutates the document`);
      for (const key of ["violatedProperties", "pairedGreen", "differsAt", "i34Clause"])
        if (key in vector) failures.push(`${id}: a green vector declares no ${key}`);
    } else if (vector.polarity === "red") {
      if (vector.expected === "applied") failures.push(`${id}: a red vector is refused`);
      if (vector.documentMutated !== false)
        failures.push(`${id}: a refused vector leaves the document unchanged`);
      if (!oneOf(i34Clauses, vector.i34Clause)) failures.push(`${id}: i34Clause is not closed`);
      else coveredClauses.add(vector.i34Clause);

      const violated = stringArray(vector.violatedProperties);
      if (
        violated === undefined ||
        violated.length === 0 ||
        new Set(violated).size !== violated.length ||
        violated.some((property) => !oneOf(mlsProperties, property))
      ) {
        failures.push(`${id}: violatedProperties must be distinct closed properties`);
      } else {
        for (const property of violated) coveredProperties.add(property);
      }

      const greenId = vector.pairedGreen;
      const green = typeof greenId === "string" ? byId.get(greenId) : undefined;
      if (green === undefined || green.polarity !== "green" || typeof greenId !== "string") {
        failures.push(`${id}: pairedGreen must name a green vector`);
      } else {
        pairedGreens.add(greenId);
        const declared = stringArray(vector.differsAt);
        const actual = differingPointers(green.message, vector.message);
        if (declared === undefined || declared.length === 0)
          failures.push(`${id}: differsAt must name the pointers that make it red`);
        else if (!sameStringSet(declared, actual))
          failures.push(
            `${id}: differs from ${greenId} at [${actual.join(", ")}], declares [${declared.join(", ")}]`,
          );
      }

      if ("knownGaps" in vector) {
        const named = stringArray(vector.knownGaps);
        if (named === undefined || named.length === 0)
          failures.push(`${id}: knownGaps must be a non-empty string array`);
        for (const gapId of named ?? [])
          if (!gapIds.get(gapId)?.includes(id))
            failures.push(`${id}: known gap ${gapId} does not list this vector`);
      }
    } else {
      failures.push(`${id}: polarity must be red or green`);
    }

    // Replay on the symbolic receiver, only when the inputs are well formed.
    if (receiver === null || problems.length > 0) continue;
    const message = vector.message as SymbolicMessage;
    const verdict = evaluateSymbolicReceipt(receiver, message);
    if (verdict !== vector.expected)
      failures.push(`${id}: replays to ${verdict}, expects ${vector.expected}`);
    if (vector.polarity !== "red") continue;
    const violated = stringArray(vector.violatedProperties) ?? [];
    if (violated.length === 0) continue;
    const withoutAll = evaluateSymbolicReceipt(
      receiver,
      message,
      new Set(violated as MlsProperty[]),
    );
    if (withoutAll !== "applied")
      failures.push(
        `${id}: still ${withoutAll} once [${violated.join(", ")}] are dropped: it violates an undeclared property`,
      );
    for (const kept of violated) {
      const dropped = new Set(violated.filter((property) => property !== kept) as MlsProperty[]);
      if (evaluateSymbolicReceipt(receiver, message, dropped) === "applied")
        failures.push(`${id}: ${kept} alone does not refuse it: it is not violated`);
    }
  }

  for (const [gapId, vectorIds] of gapIds)
    for (const vectorId of vectorIds)
      if (!(stringArray(byId.get(vectorId)?.knownGaps) ?? []).includes(gapId))
        failures.push(`knownGaps ${gapId}: ${vectorId} does not point back`);
  for (const [id, vector] of byId)
    if (vector.polarity === "green" && !pairedGreens.has(id))
      failures.push(`${id}: a green vector no red is paired with`);
  for (const clause of i34Clauses)
    if (!coveredClauses.has(clause)) failures.push(`I-34 clause ${clause} has no red vector`);
  for (const verdict of mlsVerdicts)
    if (!coveredVerdicts.has(verdict)) failures.push(`verdict ${verdict} is never expected`);
  for (const property of mlsProperties)
    if (!coveredProperties.has(property)) failures.push(`property ${property} is never violated`);

  return failures;
}
