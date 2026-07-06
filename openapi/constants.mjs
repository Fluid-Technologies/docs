import { resolveFluideApiBaseUrl } from "../lib/fluide-api-url.mjs";

export { resolveFluideApiBaseUrl };

export const DEFAULT_SERVER_DESCRIPTION = "API";

/** Gateway origin used in enriched OpenAPI `servers` and code samples. */
export const DEFAULT_FLUIDE_API_BASE_URL = resolveFluideApiBaseUrl();
