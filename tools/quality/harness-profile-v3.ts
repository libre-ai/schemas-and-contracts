import { sha256Canonical } from "./authorized-execution";

// Resolution rules of harness-profile.v3 that JSON Schema cannot express.
// The schema bounds k and w separately (2..1024); comparing two fields is out
// of reach of draft 2020-12 without a non-standard extension that the Rust
// projection does not share, so the comparison lives here, next to the digest.

export type HarnessProfileV3Verdict = "profile-resolvable" | "profile-invalid";

interface NoProgressGuard {
  repeatThreshold: number;
  windowSize: number;
}

interface HarnessProfileV3 extends Record<string, unknown> {
  noProgressGuard: NoProgressGuard;
  profileDigest: string;
}

/** Every reason a schema-valid v3 profile must not be resolved. Empty means resolvable. */
export async function harnessProfileV3ResolutionFailures(
  profile: HarnessProfileV3,
): Promise<string[]> {
  const failures: string[] = [];
  const { repeatThreshold, windowSize } = profile.noProgressGuard;
  // ADR-0046: k occurrences are counted inside a window of w calls, and the
  // k - 1 overlap of tool-invocation-observation-v1 needs k - 1 < w.
  if (repeatThreshold > windowSize) failures.push("repeatThreshold exceeds windowSize");
  const { profileDigest, ...preimage } = profile;
  if ((await sha256Canonical(preimage)) !== profileDigest)
    failures.push("profileDigest does not match the RFC 8785 profile preimage");
  return failures;
}

export async function resolveHarnessProfileV3(
  profile: HarnessProfileV3,
): Promise<HarnessProfileV3Verdict> {
  const failures = await harnessProfileV3ResolutionFailures(profile);
  return failures.length === 0 ? "profile-resolvable" : "profile-invalid";
}
