import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import synthetic from "../../contracts/fixtures/signalement-local-export-v1/synthetic.json";
import { canonicalJson } from "./authorized-execution";
import {
  type LogicalFile,
  localExportFailures,
  rawLocalExportFailures,
} from "./signalement-local-export-v1";

interface TestMedia {
  id: string;
  kind: string;
  capturedAt: string;
  derivation: { sourceId: string; operations: string[] };
  audioIncluded: boolean;
  audioReviewed: boolean;
  sanitation: string;
}
interface TestFile {
  path: string;
  role: string;
  mimeType: string;
  byteLength: number;
  sha256: string;
  media: TestMedia | null;
}
interface TestObservation {
  id: string;
  provenance: string;
  text: string;
  capturedAt: string;
  mediaIds: string[];
}
interface TestManifest {
  schemaVersion: string;
  payload: {
    dossierId: string;
    dossierRevision: number;
    createdAt: string;
    reviewedAt: string;
    statements: { expected: string; observed: string };
    context: { provenance: string; application: string; environment: string; steps: string[] };
    observations: TestObservation[];
    hypotheses: { id: string; text: string }[];
    document: { text: string; observationIds: string[] };
    files: TestFile[];
  };
  approval: { target: string; payloadDigest: string; approvedAt: string };
  exportedAt: string;
}
interface Candidate {
  manifest: TestManifest;
  files: LogicalFile[];
}

const encoder = new TextEncoder();
const screenshotBytes = encoder.encode("synthetic screenshot bytes, not a decodable image");
const videoBytes = encoder.encode("synthetic video bytes, not a decodable stream");

function sha256(bytes: string | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function baseline(): Candidate {
  return {
    manifest: structuredClone(synthetic.manifest) as TestManifest,
    files: synthetic.files.map((file) => ({
      path: file.path,
      kind: "file",
      bytes: encoder.encode(file.utf8),
    })),
  };
}

/** Re-approves the payload so that a mutation reaches the semantic check it targets. */
function seal(candidate: Candidate): Candidate {
  candidate.manifest.approval.payloadDigest = sha256(canonicalJson(candidate.manifest.payload));
  return candidate;
}

function media(id: string, kind: "screenshot" | "video"): TestMedia {
  return {
    id,
    kind,
    capturedAt: "2026-10-06T10:00:20Z",
    derivation: { sourceId: `source-${id}`, operations: ["metadata-removal"] },
    audioIncluded: false,
    audioReviewed: false,
    sanitation: "reviewed-with-limitations",
  };
}

function withScreenshot(): Candidate {
  const candidate = baseline();
  const bytes = screenshotBytes;
  candidate.manifest.payload.files.push({
    path: "media/shot-1.png",
    role: "screenshot",
    mimeType: "image/png",
    byteLength: bytes.byteLength,
    sha256: sha256(bytes),
    media: media("shot-1", "screenshot"),
  });
  candidate.manifest.payload.observations.push({
    id: "observation-2",
    provenance: "capture-observation",
    text: "The capture shows an empty region",
    capturedAt: "2026-10-06T10:00:40Z",
    mediaIds: ["shot-1"],
  });
  candidate.files.push({ path: "media/shot-1.png", kind: "file", bytes });
  return seal(candidate);
}

function withVideo(): Candidate {
  const candidate = baseline();
  candidate.manifest.payload.files.push({
    path: "media/clip-1.webm",
    role: "video",
    mimeType: "video/webm",
    byteLength: videoBytes.byteLength,
    sha256: sha256(videoBytes),
    media: media("clip-1", "video"),
  });
  candidate.files.push({ path: "media/clip-1.webm", kind: "file", bytes: videoBytes });
  return seal(candidate);
}

function failures(candidate: Candidate): string[] {
  return localExportFailures(candidate.manifest, candidate.files);
}

function rawFailures(candidate: Candidate): string[] {
  return rawLocalExportFailures(
    encoder.encode(JSON.stringify(candidate.manifest)),
    candidate.files,
  );
}

function screenshotEntry(candidate: Candidate): TestFile {
  const entry = candidate.manifest.payload.files.find((file) => file.role === "screenshot");
  if (entry === undefined) throw new Error("Missing screenshot fixture");
  return entry;
}

function screenshotMedia(candidate: Candidate): TestMedia {
  const value = screenshotEntry(candidate).media;
  if (value === null) throw new Error("Missing screenshot media");
  return value;
}

function videoMedia(candidate: Candidate): TestMedia {
  const value = candidate.manifest.payload.files.find((file) => file.role === "video")?.media;
  if (value === undefined || value === null) throw new Error("Missing video media");
  return value;
}

function firstObservation(candidate: Candidate): TestObservation {
  const observation = candidate.manifest.payload.observations[0];
  if (observation === undefined) throw new Error("Missing observation fixture");
  return observation;
}

function readme(candidate: Candidate): TestFile {
  const entry = candidate.manifest.payload.files[0];
  if (entry === undefined) throw new Error("Missing document fixture");
  return entry;
}

describe("authority synthetic example", () => {
  test("the checked-in logical map is accepted through the raw boundary", () => {
    expect(synthetic.provenance).toBe("synthetic-only");
    expect(rawFailures(baseline())).toEqual([]);
  });

  test("the TypeScript canonicalizer agrees with the independent oracle", () => {
    const { manifest } = baseline();
    const canonical = canonicalJson(manifest.payload);
    expect(canonical).toBe(synthetic.oracle.canonicalPayloadUtf8);
    expect(sha256(canonical)).toBe(synthetic.oracle.sha256);
    expect(manifest.approval.payloadDigest).toBe(synthetic.oracle.sha256);
  });

  test("sealed screenshot and video derivatives are accepted", () => {
    expect(rawFailures(withScreenshot())).toEqual([]);
    expect(rawFailures(withVideo())).toEqual([]);
    const reviewedAudio = withVideo();
    videoMedia(reviewedAudio).audioIncluded = true;
    videoMedia(reviewedAudio).audioReviewed = true;
    expect(failures(seal(reviewedAudio))).toEqual([]);
  });
});

type Mutation = [code: string, build: () => Candidate];

const mutations: Mutation[] = [
  [
    "manifest.schema",
    () => {
      const candidate = baseline();
      candidate.manifest.approval.target = "upload";
      return candidate;
    },
  ],
  [
    "manifest.unicode",
    () => {
      const candidate = baseline();
      firstObservation(candidate).text = "lone \uD800 surrogate";
      return candidate;
    },
  ],
  [
    "approval.digest_mismatch",
    () => {
      const candidate = baseline();
      candidate.manifest.payload.statements.observed = "A changed statement";
      return candidate;
    },
  ],
  [
    "approval.timestamp_mismatch",
    () => {
      const candidate = baseline();
      candidate.manifest.exportedAt = "2026-10-06T10:02:00Z";
      return candidate;
    },
  ],
  [
    "payload.timestamp_order",
    () => {
      const candidate = baseline();
      candidate.manifest.payload.createdAt = "2026-10-06T10:05:00Z";
      return seal(candidate);
    },
  ],
  [
    "file.count_limit",
    () => {
      const candidate = baseline();
      for (let index = 0; index < 33; index += 1)
        candidate.files.push({ path: `media/extra-${index}.png`, kind: "file", bytes: videoBytes });
      return candidate;
    },
  ],
  [
    "file.duplicate",
    () => {
      const candidate = withScreenshot();
      candidate.manifest.payload.files.push(structuredClone(screenshotEntry(candidate)));
      return seal(candidate);
    },
  ],
  [
    "file.order",
    () => {
      const candidate = withScreenshot();
      candidate.manifest.payload.files.reverse();
      return seal(candidate);
    },
  ],
  [
    "document.type_mismatch",
    () => {
      const candidate = baseline();
      readme(candidate).mimeType = "image/png";
      return seal(candidate);
    },
  ],
  [
    "document.size_limit",
    () => {
      const candidate = baseline();
      readme(candidate).byteLength = 262145;
      return seal(candidate);
    },
  ],
  [
    "media.missing",
    () => {
      const candidate = withScreenshot();
      screenshotEntry(candidate).media = null;
      return seal(candidate);
    },
  ],
  [
    "lineage.duplicate_id",
    () => {
      const candidate = withScreenshot();
      const hypothesis = candidate.manifest.payload.hypotheses[0];
      if (hypothesis === undefined) throw new Error("Missing hypothesis fixture");
      hypothesis.id = "shot-1";
      return seal(candidate);
    },
  ],
  [
    "media.type_mismatch",
    () => {
      const candidate = withScreenshot();
      screenshotEntry(candidate).mimeType = "video/webm";
      return seal(candidate);
    },
  ],
  [
    "media.timestamp_order",
    () => {
      const candidate = withScreenshot();
      screenshotMedia(candidate).capturedAt = "2026-10-06T10:01:30Z";
      return seal(candidate);
    },
  ],
  [
    "media.derivation",
    () => {
      const candidate = withScreenshot();
      screenshotMedia(candidate).derivation.operations = ["crop"];
      return seal(candidate);
    },
  ],
  [
    "media.audio",
    () => {
      const candidate = withScreenshot();
      screenshotMedia(candidate).audioIncluded = true;
      screenshotMedia(candidate).audioReviewed = true;
      return seal(candidate);
    },
  ],
  [
    "document.inventory",
    () => {
      const candidate = withScreenshot();
      candidate.manifest.payload.files.shift();
      candidate.files.shift();
      return seal(candidate);
    },
  ],
  [
    "file.total_limit",
    () => {
      const candidate = baseline();
      for (let index = 1; index <= 5; index += 1) {
        candidate.manifest.payload.files.push({
          path: `media/clip-${index}.webm`,
          role: "video",
          mimeType: "video/webm",
          byteLength: 67108864,
          sha256: sha256(videoBytes),
          media: media(`clip-${index}`, "video"),
        });
      }
      return seal(candidate);
    },
  ],
  [
    "file.not_regular",
    () => {
      const candidate = baseline();
      const file = candidate.files[0];
      if (file === undefined) throw new Error("Missing logical file");
      file.kind = "symlink";
      return candidate;
    },
  ],
  [
    "file.inventory_mismatch",
    () => {
      const candidate = baseline();
      candidate.files.push({ path: "media/undeclared.png", kind: "file", bytes: screenshotBytes });
      return candidate;
    },
  ],
  [
    "file.length_mismatch",
    () => {
      const candidate = withScreenshot();
      screenshotEntry(candidate).byteLength += 1;
      return seal(candidate);
    },
  ],
  [
    "file.digest_mismatch",
    () => {
      const candidate = withScreenshot();
      screenshotEntry(candidate).sha256 = "0".repeat(64);
      return seal(candidate);
    },
  ],
  [
    "document.bytes_mismatch",
    () => {
      const candidate = baseline();
      const altered = encoder.encode(synthetic.files[0]?.utf8.replace("panel", "PANEL"));
      const file = candidate.files[0];
      if (file === undefined) throw new Error("Missing logical file");
      file.bytes = altered;
      readme(candidate).sha256 = sha256(altered);
      return seal(candidate);
    },
  ],
  [
    "observation.timestamp_order",
    () => {
      const candidate = baseline();
      firstObservation(candidate).capturedAt = "2026-10-06T09:59:00Z";
      return seal(candidate);
    },
  ],
  [
    "lineage.capture_required",
    () => {
      const candidate = baseline();
      firstObservation(candidate).provenance = "capture-observation";
      return seal(candidate);
    },
  ],
  [
    "lineage.unknown_media",
    () => {
      const candidate = baseline();
      firstObservation(candidate).mediaIds = ["missing-media"];
      return seal(candidate);
    },
  ],
  [
    "lineage.unknown_observation",
    () => {
      const candidate = baseline();
      candidate.manifest.payload.document.observationIds = ["observation-unknown"];
      return seal(candidate);
    },
  ],
];

describe("adversarial logical maps fail closed", () => {
  for (const [code, build] of mutations) {
    test(code, () => {
      expect(failures(build())).toContain(code);
    });
  }

  test("every derivation and audio refusal is reached", () => {
    const sameSource = withScreenshot();
    screenshotMedia(sameSource).derivation.sourceId = "shot-1";
    expect(failures(seal(sameSource))).toContain("media.derivation");
    const unreviewedAudio = withVideo();
    videoMedia(unreviewedAudio).audioIncluded = true;
    expect(failures(seal(unreviewedAudio))).toContain("media.audio");
    const removedButIncluded = withVideo();
    videoMedia(removedButIncluded).audioIncluded = true;
    videoMedia(removedButIncluded).audioReviewed = true;
    videoMedia(removedButIncluded).derivation.operations = ["metadata-removal", "audio-removal"];
    expect(failures(seal(removedButIncluded))).toContain("media.audio");
  });

  test("duplicate logical files and duplicate observations are refused", () => {
    const duplicateFile = baseline();
    const file = duplicateFile.files[0];
    if (file === undefined) throw new Error("Missing logical file");
    duplicateFile.files.push({ ...file });
    expect(failures(duplicateFile)).toContain("file.duplicate");
    const duplicateObservation = withScreenshot();
    const observation = duplicateObservation.manifest.payload.observations[1];
    if (observation === undefined) throw new Error("Missing capture observation");
    observation.id = "shot-1";
    expect(failures(seal(duplicateObservation))).toContain("lineage.duplicate_id");
    const duplicateMedia = withScreenshot();
    const second = structuredClone(screenshotEntry(duplicateMedia));
    second.path = "media/shot-2.png";
    duplicateMedia.manifest.payload.files.push(second);
    duplicateMedia.files.push({ path: "media/shot-2.png", kind: "file", bytes: screenshotBytes });
    expect(failures(seal(duplicateMedia))).toContain("lineage.duplicate_id");
  });

  test("a declared file missing from the logical map is refused", () => {
    const candidate = withScreenshot();
    candidate.files.pop();
    expect(failures(candidate)).toContain("file.inventory_mismatch");
  });

  test("refusal codes never echo dossier content", () => {
    for (const [, build] of mutations)
      for (const code of failures(build())) expect(code).toMatch(/^[a-z]+\.[a-z_]+$/);
  });
});

describe("raw manifest boundary", () => {
  test("oversized manifests are refused before parsing", () => {
    expect(rawLocalExportFailures(new Uint8Array(1048577), [])).toEqual(["manifest.size_limit"]);
  });

  test("duplicate keys, invalid UTF-8 and excessive depth are refused", () => {
    expect(rawLocalExportFailures(encoder.encode('{"a":1,"a":2}'), [])).toEqual([
      "manifest.raw_json",
    ]);
    expect(rawLocalExportFailures(new Uint8Array([0x7b, 0xff, 0x7d]), [])).toEqual([
      "manifest.raw_json",
    ]);
    // Depth 16 is the last admitted nesting level: one level deeper is refused.
    const nested = (levels: number) => encoder.encode(`${"[".repeat(levels)}${"]".repeat(levels)}`);
    expect(rawLocalExportFailures(nested(17), [])).toEqual(["manifest.schema"]);
    expect(rawLocalExportFailures(nested(18), [])).toEqual(["manifest.raw_json"]);
  });

  test("valid raw JSON with a non-manifest shape reaches the schema refusal", () => {
    expect(rawLocalExportFailures(encoder.encode("{}"), [])).toEqual(["manifest.schema"]);
  });
});
