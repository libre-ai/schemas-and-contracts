// Authority-fixture verifier only; no browser, privacy or implementation admission.
import Ajv2020 from "ajv/dist/2020";
import { parseStrictJson } from "./policy-core-raw-inputs";

/** Ceiling of one connector profile document, in octets. */
export const CONNECTOR_PROFILE_MAX_BYTES = 65536;

interface ConnectorProfile {
  profileId: string;
  family: string;
  edition: string;
  api: { style: string; version: string };
  capabilities: { consistentLookup: { method: string; status: string } };
}

const ajv = new Ajv2020({ strict: true, allErrors: true });
const validate = ajv.compile<ConnectorProfile>(
  await Bun.file(
    new URL(
      "../../contracts/schemas/signalement-connector-profile.v1.schema.json",
      import.meta.url,
    ),
  ).json(),
);

/**
 * Failure codes carry no profile data. The size is checked on octets before any parsing, so an
 * oversized input is never decoded. Exactly one code is returned, the first in the documented order.
 */
export function rawConnectorProfileFailures(bytes: Uint8Array): string[] {
  if (bytes.byteLength > CONNECTOR_PROFILE_MAX_BYTES) return ["profile.size_limit"];
  let parsed: unknown;
  try {
    parsed = parseStrictJson(bytes, 8);
  } catch {
    return ["profile.raw_json"];
  }
  if (!validate(parsed)) return ["profile.schema"];
  const { family, edition, api, profileId, capabilities } = parsed;
  if (profileId !== `${family}/${edition}/${api.style}-${api.version}`)
    return ["profile.id_mismatch"];
  // "none" names no lookup method, so any claim of support (or a pending proof) contradicts it.
  if (
    capabilities.consistentLookup.method === "none" &&
    capabilities.consistentLookup.status !== "unsupported"
  )
    return ["profile.lookup_inconsistent"];
  return [];
}
