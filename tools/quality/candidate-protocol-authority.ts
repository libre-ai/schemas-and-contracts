export interface CandidateProtocolRequirement {
  slug: string;
  major: number;
  status: string;
  sourceRepository: string;
}
export interface CandidateProtocolAuthority {
  slug: string;
  major: number;
  status: "candidate";
  sourceRepository: string;
  sourceRevision: string;
  sourcePath: string;
  localPath: string;
  sha256: string;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return (
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
  );
}
function validIdentity(slug: unknown, major: unknown): boolean {
  return (
    typeof slug === "string" &&
    /^[a-z][a-z0-9-]*$/.test(slug) &&
    typeof major === "number" &&
    Number.isSafeInteger(major) &&
    major > 0
  );
}
/** Candidate provenance cannot override the separate historical authority map. */
export function candidateProtocolAuthorities(
  value: unknown,
  required: readonly CandidateProtocolRequirement[],
): ReadonlyMap<string, CandidateProtocolAuthority> {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["schemaVersion", "entries"]) ||
    value.schemaVersion !== "candidate-protocol-authorities.v1" ||
    !Array.isArray(value.entries)
  ) {
    throw new Error("Invalid candidate protocol registry");
  }
  const expected = new Map<string, CandidateProtocolRequirement>();
  for (const requirement of required) {
    const key = `${requirement.slug}:${requirement.major}`;
    if (
      !validIdentity(requirement.slug, requirement.major) ||
      requirement.status !== "candidate" ||
      typeof requirement.sourceRepository !== "string" ||
      !/^libre-ai\/[a-z][a-z0-9-]*$/.test(requirement.sourceRepository) ||
      expected.has(key)
    ) {
      throw new Error("Invalid candidate protocol requirement");
    }
    expected.set(key, requirement);
  }
  const result = new Map<string, CandidateProtocolAuthority>();
  for (const item of value.entries) {
    if (
      !isRecord(item) ||
      !exactKeys(item, [
        "slug",
        "major",
        "status",
        "sourceRepository",
        "sourceRevision",
        "sourcePath",
        "localPath",
        "sha256",
      ]) ||
      !validIdentity(item.slug, item.major) ||
      item.status !== "candidate" ||
      typeof item.sourceRepository !== "string" ||
      typeof item.sourceRevision !== "string" ||
      !/^[a-f0-9]{40}$/.test(item.sourceRevision) ||
      typeof item.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(item.sha256) ||
      typeof item.sourcePath !== "string" ||
      !/^docs\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.md$/.test(item.sourcePath) ||
      item.sourcePath.includes("..") ||
      item.localPath !== `docs/protocols/candidates/${item.slug}.v${item.major}.md`
    ) {
      throw new Error("Invalid candidate protocol entry");
    }
    const key = `${item.slug}:${item.major}`;
    const requirement = expected.get(key);
    if (!requirement || result.has(key) || item.sourceRepository !== requirement.sourceRepository) {
      throw new Error("Unexpected or ambiguous candidate protocol entry");
    }
    result.set(key, item as unknown as CandidateProtocolAuthority);
  }
  if (result.size !== expected.size) throw new Error("Missing candidate protocol source");
  return result;
}

export function candidateProtocolOperations(
  source: string,
  major: number,
): { commands: string[]; queries: string[] } {
  if (!Number.isSafeInteger(major) || major < 1)
    throw new Error("Invalid candidate protocol major");
  function operations(label: "Commands" | "Queries"): string[] {
    const prefix = `**${label} v${major} candidate:** `;
    const lines = source.split("\n").filter((line) => line.startsWith(prefix));
    const line = lines[0]?.slice(prefix.length);
    if (
      lines.length !== 1 ||
      line === undefined ||
      !/^`[A-Z][A-Za-z0-9]+`(?:, `[A-Z][A-Za-z0-9]+`)*\.$/.test(line)
    ) {
      throw new Error("Missing or malformed explicit candidate operations");
    }
    const names = [...line.matchAll(/`([A-Z][A-Za-z0-9]+)`/g)].map((match) => match[1] as string);
    if (new Set(names).size !== names.length) throw new Error("Duplicate candidate operation");
    return names;
  }
  return { commands: operations("Commands"), queries: operations("Queries") };
}

export function candidateProtocolForVersion(
  authorities: ReadonlyMap<string, CandidateProtocolAuthority>,
  slug: string,
  major: number,
  historicalMajors: readonly number[],
): CandidateProtocolAuthority | undefined {
  if (historicalMajors.includes(major)) return undefined;
  const authority = authorities.get(`${slug}:${major}`);
  if (!authority) throw new Error("Missing exact successor protocol authority");
  return authority;
}
