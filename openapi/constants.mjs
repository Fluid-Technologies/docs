export const DEFAULT_SERVER_DESCRIPTION = "Sandbox";

/** Sandbox gateway. Used when NEXT_PUBLIC_FLUIDE_API_URL is unset (local export and CI). */
export const SANDBOX_FLUIDE_API_BASE_URL = "https://test.api.fluidehr.com";

/** Production gateway. */
export const PRODUCTION_FLUIDE_API_BASE_URL = "https://api.fluideglobal.com";

/** Servers published in Mintlify. Sandbox stays first so the playground defaults there. */
export const FLUIDE_API_SERVERS = [
  { url: SANDBOX_FLUIDE_API_BASE_URL, description: "Sandbox" },
  { url: PRODUCTION_FLUIDE_API_BASE_URL, description: "Production" },
];

function resolveDocsApiBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_FLUIDE_API_URL?.trim().replace(/\/$/, "");
  return raw || SANDBOX_FLUIDE_API_BASE_URL;
}

/** Gateway origin used in enriched OpenAPI `servers` and code samples. */
export const DEFAULT_FLUIDE_API_BASE_URL = resolveDocsApiBaseUrl();
