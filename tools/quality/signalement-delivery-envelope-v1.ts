// Authority-fixture verifier only; no browser, privacy or implementation admission.
import Ajv2020 from "ajv/dist/2020";
import { parseStrictJson } from "./policy-core-raw-inputs";

/** Ceiling of the `Signalement-Delivery-Envelope` header value (registry section 4.5). */
export const DELIVERY_ENVELOPE_MAX_BYTES = 4096;
/** 268435456 content + 1048576 manifest + 16384 container margin (SEMANTICS of the export). */
export const EXPORT_MAX_BYTES = 269500416;

interface DeliveryEnvelope {
  schemaVersion: string;
  deliveryId: string;
  exportSha256: string;
  exportByteLength: number;
  observedOrigin: string | null;
}

const ajv = new Ajv2020({ strict: true, allErrors: true });
const validate = ajv.compile<DeliveryEnvelope>(
  await Bun.file(
    new URL(
      "../../contracts/schemas/signalement-delivery-envelope.v1.schema.json",
      import.meta.url,
    ),
  ).json(),
);

/** The schema pattern admits shapes the URL serializer would rewrite (default port, port above 65535). */
function isCanonicalOrigin(origin: string): boolean {
  try {
    return new URL(origin).origin === origin;
  } catch {
    return false;
  }
}

/**
 * Failure codes carry no envelope data. The size is checked on octets before any parsing, so an
 * oversized input is never decoded. Exactly one code is returned, the first in the documented order.
 */
export function rawDeliveryEnvelopeFailures(bytes: Uint8Array): string[] {
  if (bytes.byteLength > DELIVERY_ENVELOPE_MAX_BYTES) return ["envelope.size_limit"];
  let parsed: unknown;
  try {
    parsed = parseStrictJson(bytes, 8);
  } catch {
    return ["envelope.raw_json"];
  }
  if (!validate(parsed)) return ["envelope.schema"];
  if (parsed.observedOrigin !== null && !isCanonicalOrigin(parsed.observedOrigin))
    return ["envelope.origin_non_canonical"];
  return [];
}
