import { expect, test } from "bun:test";
import { evaluateBriefStorage } from "./build-brief-storage-v1";
import { referenceDecision } from "./missions-v3";

const identity = {
  organization: "ten_1234567890abcdef",
  missionId: "urn:libre-ai:mission:fixture",
  bindingDigest: "a".repeat(64),
  archiveId: "urn:libre-ai:archive:fixture",
  handoffDigest: "b".repeat(64),
  referenceId: "urn:libre-ai:reference:fixture",
};
const evidence = "c".repeat(64);
const history = { everConfirmed: false, releasedBy: null, releaseEvidenceDigest: null };

test("authenticated final non-commit releases only a never-confirmed reservation", () => {
  expect(
    referenceDecision(
      "reconcile",
      "reserved",
      { outcome: "not-committed-final", evidenceDigest: evidence },
      identity,
      identity,
      history,
    ),
  ).toBe("release");
  expect(
    evaluateBriefStorage({
      kind: "reference",
      action: "reconcile",
      state: "reserved",
      ...history,
      identityMatches: true,
      currentPermission: true,
      sourceOutcome: "not-committed-final",
      sourceEvidenceDigest: evidence,
    }),
  ).toBe("release");
});
test("confirmation survives uncertain observation and refuses a contradictory never-commit", () => {
  const confirmed = { ...history, everConfirmed: true };
  expect(
    referenceDecision(
      "reconcile",
      "confirmed",
      { outcome: "unknown", evidenceDigest: null },
      identity,
      identity,
      confirmed,
    ),
  ).toBe("protect");
  expect(
    referenceDecision(
      "reconcile",
      "confirmed",
      { outcome: "not-committed-final", evidenceDigest: evidence },
      identity,
      identity,
      confirmed,
    ),
  ).toBe("refuse");
  expect(
    evaluateBriefStorage({
      kind: "reference",
      action: "reconcile",
      state: "confirmed",
      ...confirmed,
      identityMatches: true,
      currentPermission: true,
      sourceOutcome: "unknown",
      sourceEvidenceDigest: null,
    }),
  ).toBe("retain");
  expect(
    evaluateBriefStorage({
      kind: "reference",
      action: "reconcile",
      state: "confirmed",
      ...confirmed,
      identityMatches: true,
      currentPermission: true,
      sourceOutcome: "not-committed-final",
      sourceEvidenceDigest: evidence,
    }),
  ).toBe("deny");
});
test("matching final removal resolves uncertainty without leaving an orphan reference", () => {
  expect(
    referenceDecision(
      "reconcile",
      "confirmed",
      { outcome: "removed-final", evidenceDigest: evidence },
      identity,
      identity,
      { ...history, everConfirmed: true },
    ),
  ).toBe("release");
});

const matrix = await Bun.file(
  "contracts/fixtures/missions-v3/reference-reconciliation.json",
).json();
const storageResult = {
  reserve: "reserve",
  confirm: "confirm",
  protect: "retain",
  release: "release",
  "already-released": "idempotent",
  refuse: "deny",
} as const;
for (const row of matrix.cases) {
  test(`cross-owner lifecycle ${row.state}/${row.everConfirmed}/${row.releasedBy}/${row.action}/${row.outcome}`, () => {
    const previous = {
      everConfirmed: row.everConfirmed,
      releasedBy: row.releasedBy,
      releaseEvidenceDigest: row.releaseEvidenceDigest,
    };
    expect(
      referenceDecision(
        row.action,
        row.state,
        { outcome: row.outcome, evidenceDigest: row.evidenceDigest },
        identity,
        identity,
        previous,
      ),
    ).toBe(row.expected);
    expect(
      evaluateBriefStorage({
        kind: "reference",
        action: row.action,
        state: row.state,
        ...previous,
        identityMatches: true,
        currentPermission: true,
        sourceOutcome: row.outcome,
        sourceEvidenceDigest: row.evidenceDigest,
      }),
    ).toBe(storageResult[row.expected as keyof typeof storageResult]);
  });
}

test("malformed or regressed durable histories never release or reactivate a reference", () => {
  const admitted = new Set(
    matrix.cases.map(
      (row: {
        state: string;
        everConfirmed: boolean;
        releasedBy: string | null;
        releaseEvidenceDigest: string | null;
      }) =>
        JSON.stringify([row.state, row.everConfirmed, row.releasedBy, row.releaseEvidenceDigest]),
    ),
  );
  for (const state of ["missing", "reserved", "confirmed", "released"] as const)
    for (const everConfirmed of [false, true])
      for (const releasedBy of [null, "not-committed-final", "removed-final"] as const)
        for (const releaseEvidenceDigest of [null, evidence, "malformed"])
          if (
            !admitted.has(JSON.stringify([state, everConfirmed, releasedBy, releaseEvidenceDigest]))
          ) {
            const previous = { everConfirmed, releasedBy, releaseEvidenceDigest };
            for (const action of ["reserve", "confirm", "reconcile", "release"] as const)
              for (const outcome of [
                "absent",
                "unknown",
                "committed",
                "not-committed-final",
                "removed-final",
              ] as const) {
                const evidenceDigest =
                  outcome === "absent" || outcome === "unknown" ? null : evidence;
                expect(
                  referenceDecision(
                    action,
                    state,
                    { outcome, evidenceDigest },
                    identity,
                    identity,
                    previous,
                  ),
                ).toBe("refuse");
                expect(
                  evaluateBriefStorage({
                    kind: "reference",
                    action,
                    state,
                    ...previous,
                    identityMatches: true,
                    currentPermission: true,
                    sourceOutcome: outcome,
                    sourceEvidenceDigest: evidenceDigest,
                  }),
                ).toBe("deny");
              }
          }
});
test("released retry requires the original terminal evidence digest", () => {
  const previous = {
    everConfirmed: true,
    releasedBy: "removed-final" as const,
    releaseEvidenceDigest: evidence,
  };
  expect(
    referenceDecision(
      "reconcile",
      "released",
      { outcome: "removed-final", evidenceDigest: "d".repeat(64) },
      identity,
      identity,
      previous,
    ),
  ).toBe("refuse");
  expect(
    evaluateBriefStorage({
      kind: "reference",
      action: "release",
      state: "released",
      ...previous,
      identityMatches: true,
      currentPermission: true,
      sourceOutcome: "removed-final",
      sourceEvidenceDigest: "d".repeat(64),
    }),
  ).toBe("deny");
});
test("missing or non-object identity fails closed without throwing", () => {
  for (const invalid of [null, undefined, [], "caller"])
    expect(
      referenceDecision(
        "reserve",
        "missing",
        { outcome: "absent", evidenceDigest: null },
        invalid as never,
        identity,
        history,
      ),
    ).toBe("refuse");
});
