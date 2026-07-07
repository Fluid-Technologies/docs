/**
 * Product-level metadata injected into exported OpenAPI specs.
 * Single source of truth for API reference intros and tag descriptions.
 * Edit here — then run `node export-openapi.mjs` or `node scripts/enrich-openapi.mjs`.
 */

import {
  DEFAULT_FLUIDE_API_BASE_URL,
  DEFAULT_SERVER_DESCRIPTION,
} from "./constants.mjs";
import { injectCodeSamples } from "./code-samples.mjs";

/** Tyk gateway + userFetcher contract for Fluide Connect developer integrations. */
export const CONNECT_SECURITY_SCHEMES = {
  bearer: {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description:
      "Access token JWT. Use as Authorization: Bearer <token>. In the API playground, paste the JWT only.",
  },
  fluideApiKey: {
    type: "apiKey",
    in: "header",
    name: "X-Fluide-Api-Key",
    description:
      "Developer API key (fl_dev_...). Required on every API call with a machine access token.",
    "x-default": "fl_dev_your_key",
  },
  fluideClientId: {
    type: "apiKey",
    in: "header",
    name: "X-Fluide-Client-Id",
    description:
      "First-party client audience. Must match the fluide_client_id claim on the JWT. Use fluide-developer for Connect.",
    "x-default": "fluide-developer",
  },
  fluideApiSecret: {
    type: "apiKey",
    in: "header",
    name: "X-Fluide-Api-Secret",
    description:
      "API secret used only during token exchange. Never send on product routes.",
  },
};

/** AND-combined headers required on product APIs through Tyk (see FluideGateway userFetcher). */
export const CONNECT_PRODUCT_SECURITY = [
  { bearer: [], fluideApiKey: [], fluideClientId: [] },
];

/** Token exchange — no Bearer JWT yet. */
export const TOKEN_EXCHANGE_SECURITY = [
  { fluideApiKey: [], fluideApiSecret: [], fluideClientId: [] },
];

const PRODUCT_SERVICE_KEYS = new Set([
  "fluide-hr",
  "fluide-payroll",
  "fluide-pay",
  "fluide-books",
  "fluide-utils",
]);

const TOKEN_EXCHANGE_PATHS = new Set([
  "/api/v1/authorize/token",
  "/api/v1/authorize/exchange",
]);

const DEVELOPER_SESSION_PATHS = new Set([
  "/api/v1/authorize/current",
  "/api/v1/authorize/rotate-secret",
]);

/** Auth routes that require Bearer + X-Fluide-Api-Key + X-Fluide-Client-Id (prefix match). */
const AUTH_CONNECT_SESSION_PREFIXES = [
  "/api/v1/workspaces",
  "/api/v1/onboarding",
  "/api/v1/webhooks",
  "/api/v1/organizations",
];

/** Credential / health routes that stay unauthenticated in the playground. */
const PUBLIC_AUTH_PATH_PREFIXES = [
  "/api/v1/health",
  "/api/v1/auth/sign",
  "/api/v1/auth/email",
  "/api/v1/auth/forgot",
  "/api/v1/auth/reset",
  "/api/v1/auth/social",
  "/api/v1/auth/sso",
  "/api/v1/auth/.well-known",
  "/api/v1/auth/consume-handoff",
  "/api/v1/auth/handoff",
  "/api/v1/auth/refresh-token",
  "/api/v1/auth/developer/ensure",
];

const HTTP_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
]);

const PLAYGROUND_AUTH_NOTE =
  " In the API playground, click Authorize and provide Bearer JWT, X-Fluide-Api-Key, and X-Fluide-Client-Id (fluide-developer).";

export const PRODUCT_META = {
  "fluide-auth": {
    title: "Fluide Auth API",
    description:
      "Developer credentials, session management, and identity for the Fluide Suite.",
    basePath: "/api/v1",
    productOverview: "/auth/overview",
  },
  "fluide-hr": {
    title: "Fluide HR API",
    description:
      "Employee records, contracts, leave, performance, OKRs, and HR insights. HR is the canonical employee source consumed by payroll and other suite services.",
    basePath: "/api/v1/hr",
    productOverview: "/hr/overview",
  },
  "fluide-payroll": {
    title: "Fluide Payroll API",
    description:
      "Payroll runs, payslip generation, validators, and async payroll processing. Integrate after employee records exist in HR.",
    basePath: "/api/v1/payroll",
    productOverview: "/payroll/overview",
  },
  "fluide-pay": {
    title: "Fluide Pay API",
    description:
      "Digital wallets, transactions, and payment provider integrations (Ecobank, mobile money). Supports async settlement via Kafka.",
    basePath: "/api/v1/payments",
    productOverview: "/pay/overview",
  },
  "fluide-books": {
    title: "Fluide Books API",
    description:
      "Accounting: chart of accounts, journal entries, invoices, bills, banking, budgets, and payroll GL integration.",
    basePath: "/api/v1",
    productOverview: "/books/overview",
  },
  "fluide-utils": {
    title: "Fluide Utils API",
    description:
      "Shared platform utilities: notifications, file storage, document generation (PDFs, spreadsheets), and document jobs used across the suite.",
    basePath: "/api/v1/app",
    productOverview: "/utils/overview",
  },
};

/** Tag descriptions applied when the tag appears in a spec. */
export const TAG_DESCRIPTIONS = {
  App: "Service root and build metadata. Use for quick connectivity checks.",
  Health:
    "Liveness and readiness probes. Returns dependency status (database, Redis, etc.) for orchestrators and uptime monitors.",
  Prometheus:
    "Prometheus scrape endpoint in text exposition format. Configure your metrics collector to poll this path on each service.",
  "Developer Access":
    "Manage developer credentials and session.",
  Authorize:
    "Exchange API key and secret for a machine JWT, read developer metadata, rotate secrets, and manage API billing.",
  "HR Employees": "Create and manage employee records tied to your organization.",
  Notifications: "In-app and multi-channel notifications for suite products.",
  "File Management": "Upload, download, and manage files scoped to your organization.",
  Documents: "Generate payslips, invoices, financial reports, and other PDF or spreadsheet artifacts.",
  "Document Jobs": "Long-running document generation jobs with status polling.",
};

/** Operation-level patches keyed by `METHOD path` (uppercase method). */
export const OPERATION_PATCHES = {
  "GET /api/v1/health": {
    summary: "Health check",
    description:
      "Returns service health and dependency status. Use for load balancer probes and deployment verification.",
  },
  "GET /api/v1/hr/health": {
    summary: "HR health check",
    description:
      "Liveness probe for the HR API. Requires developer JWT, X-Fluide-Api-Key, and X-Fluide-Client-Id — use Authorize in the playground.",
  },
  "GET /api/v1/hr/metrics": {
    summary: "HR Prometheus metrics",
    description:
      "Prometheus exposition format for HR request counters, latency histograms, and process metrics.",
  },
  "GET /api/v1/payroll/metrics": {
    summary: "Payroll Prometheus metrics",
    description: "Prometheus scrape target for payroll processing and API metrics.",
  },
  "GET /api/v1/payments/metrics": {
    summary: "Payments Prometheus metrics",
    description: "Prometheus scrape target for wallet and transaction metrics.",
  },
  "GET /api/v1/metrics": {
    summary: "Books Prometheus metrics",
    description: "Prometheus scrape target for accounting service metrics.",
  },
  "GET /api/v1/app/metrics": {
    summary: "Utils Prometheus metrics",
    description: "Prometheus scrape target for shared utilities service metrics.",
  },
  "GET /api/v1": {
    summary: "Auth service root",
    description: "Returns a simple greeting confirming the auth service is reachable.",
  },
  "GET /api/v1/app": {
    summary: "Utils service root",
    description: "Returns a simple greeting confirming the utils service is reachable.",
  },
  "POST /api/v1/authorize/token": {
    summary: "Exchange API key for access token",
    description:
      "Exchanges a developer API key and secret for a short-lived machine JWT. Send credentials via `X-Fluide-Api-Key`, `X-Fluide-Api-Secret`, and `X-Fluide-Client-Id: fluide-developer` headers. Use the secret only on this route — never on product APIs. See [Authorization](/getting-started/authorization).",
  },
  "GET /api/v1/hr/attendance/events": {
    summary: "List clock events",
    description:
      "List clock events in a date range. Optional IANA `timeZone` interprets `from`/`to` as local calendar days. Without `hr:attendance:write`, scope is self-only (`hr:attendance:self:write` only), direct reports (`hr:attendance:read`), or full reporting subtree (`hr:attendance:read` + `hr:attendance:team:read`).",
  },
};

/** Mintlify slugifies summaries into filenames — keep them short to avoid ENAMETOOLONG. */
const MAX_OPERATION_SUMMARY_LENGTH = 72;

const STANDARD_API_ERROR_RESPONSE = {
  description: "Error response",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ApiErrorResponseDto" },
    },
  },
};

/** Gateway export often omits @Public credential routes — inject for Mintlify API reference. */
function injectAuthorizeTokenPath(paths) {
  const pathKey = "/api/v1/authorize/token";
  if (paths[pathKey]) return paths;

  return {
    ...paths,
    [pathKey]: {
      post: {
        operationId: "AuthorizeController_token_v1",
        summary: "Exchange API key for access token",
        description:
          "Exchanges a developer API key and secret for a short-lived machine JWT. Prefer sending credentials in headers rather than the JSON body.",
        tags: ["Authorize"],
        parameters: [
          {
            name: "X-Fluide-Api-Key",
            in: "header",
            required: true,
            schema: { type: "string" },
            description: "Developer API key (`fl_dev_...`).",
          },
          {
            name: "X-Fluide-Api-Secret",
            in: "header",
            required: true,
            schema: { type: "string" },
            description: "API secret — use only on this route, never on product APIs.",
          },
          {
            name: "X-Fluide-Client-Id",
            in: "header",
            required: true,
            schema: { type: "string", default: "fluide-developer" },
            description: "Must be `fluide-developer` for Connect integrations.",
          },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  apiKey: { type: "string", description: "Optional if sent via header." },
                  apiSecret: { type: "string", description: "Optional if sent via header." },
                  organizationId: {
                    type: "string",
                    format: "uuid",
                    description: "Optional active organization override for the issued token.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Access token issued",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponseDto" },
                    {
                      properties: {
                        data: {
                          type: "object",
                          properties: {
                            accessToken: { type: "string", description: "RS256 JWT." },
                            jti: { type: "string" },
                            tenantId: { type: "string", format: "uuid" },
                            fluideClientId: {
                              type: "string",
                              example: "fluide-developer",
                            },
                            exp: { type: "integer", description: "Expiry (Unix seconds)." },
                            iat: { type: "integer" },
                            authContextPath: {
                              type: "string",
                              example: "/api/v1/auth-context/{jti}",
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          "400": { ...STANDARD_API_ERROR_RESPONSE, description: "Validation failed or invalid request parameters" },
          "401": { ...STANDARD_API_ERROR_RESPONSE, description: "Invalid API key or secret" },
          "403": { ...STANDARD_API_ERROR_RESPONSE, description: "Developer account not eligible for token exchange" },
        },
      },
    },
  };
}

function clampOperationSummary(operation) {
  const summary = operation.summary;
  if (typeof summary !== "string" || summary.length <= MAX_OPERATION_SUMMARY_LENGTH) {
    return operation;
  }
  const trimmed = summary.slice(0, MAX_OPERATION_SUMMARY_LENGTH - 1).trimEnd();
  return {
    ...operation,
    description: operation.description ?? summary,
    summary: `${trimmed}…`,
  };
}

function mergeSecuritySchemes(existing) {
  const merged = { ...(existing ?? {}) };
  if (merged["access-token"] && !merged.bearer) {
    merged.bearer = { ...merged["access-token"] };
  }
  for (const [key, scheme] of Object.entries(CONNECT_SECURITY_SCHEMES)) {
    merged[key] = scheme;
  }
  return merged;
}

function isPublicAuthPath(pathKey) {
  return PUBLIC_AUTH_PATH_PREFIXES.some(
    (prefix) => pathKey === prefix || pathKey.startsWith(`${prefix}/`) || pathKey.startsWith(prefix),
  );
}

function requiresAuthConnectSecurity(serviceKey, pathKey) {
  if (TOKEN_EXCHANGE_PATHS.has(pathKey)) return false;
  if (PRODUCT_SERVICE_KEYS.has(serviceKey)) return true;
  if (serviceKey !== "fluide-auth") return false;
  if (isPublicAuthPath(pathKey)) return false;
  if (DEVELOPER_SESSION_PATHS.has(pathKey)) return true;
  if (AUTH_CONNECT_SESSION_PREFIXES.some((prefix) => pathKey.startsWith(prefix))) {
    return true;
  }
  if (pathKey.startsWith("/api/v1/authorize/")) return true;
  return false;
}

function resolveConnectSecurity(serviceKey, pathKey) {
  if (TOKEN_EXCHANGE_PATHS.has(pathKey)) {
    return TOKEN_EXCHANGE_SECURITY;
  }
  if (requiresAuthConnectSecurity(serviceKey, pathKey)) {
    return CONNECT_PRODUCT_SECURITY;
  }
  return null;
}

function injectGatewayAuth(doc, serviceKey) {
  const components = {
    ...(doc.components ?? {}),
    securitySchemes: mergeSecuritySchemes(doc.components?.securitySchemes),
  };

  const paths = {};
  for (const [pathKey, pathItem] of Object.entries(doc.paths ?? {})) {
    const security = resolveConnectSecurity(serviceKey, pathKey);
    const nextPathItem = { ...pathItem };
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method) || !operation || typeof operation !== "object") {
        continue;
      }
      nextPathItem[method] =
        security !== null ? { ...operation, security } : { ...operation };
    }
    paths[pathKey] = nextPathItem;
  }

  const security =
    PRODUCT_SERVICE_KEYS.has(serviceKey) || serviceKey === "fluide-auth"
      ? CONNECT_PRODUCT_SECURITY
      : doc.security;

  return { ...doc, components, paths, security };
}

export function enrichOpenApiSpec(doc, serviceKey) {
  const meta = PRODUCT_META[serviceKey];
  if (!meta) return doc;

  const info = { ...(doc.info ?? {}) };
  info.title = meta.title;
  info.description = meta.description;
  if (
    (PRODUCT_SERVICE_KEYS.has(serviceKey) || serviceKey === "fluide-auth") &&
    !info.description?.includes("API playground")
  ) {
    info.description = `${meta.description}${PLAYGROUND_AUTH_NOTE}`;
  }

  const tagNames = new Set();
  for (const pathItem of Object.values(doc.paths ?? {})) {
    for (const operation of Object.values(pathItem)) {
      if (!operation?.tags) continue;
      for (const tag of operation.tags) tagNames.add(tag);
    }
  }

  const existingTags = Array.isArray(doc.tags) ? [...doc.tags] : [];
  const tagByName = new Map(existingTags.map((t) => [t.name, { ...t }]));

  for (const name of tagNames) {
    const current = tagByName.get(name) ?? { name };
    if (TAG_DESCRIPTIONS[name] && !current.description) {
      current.description = TAG_DESCRIPTIONS[name];
    }
    if (["App", "Health", "Prometheus"].includes(name)) {
      current["x-group"] = "Operations";
    }
    tagByName.set(name, current);
  }

  const paths = injectAuthorizeTokenPath({ ...doc.paths });
  for (const [pathKey, pathItem] of Object.entries(paths)) {
    const nextPathItem = { ...pathItem };
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!operation || typeof operation !== "object") continue;
      const patchKey = `${method.toUpperCase()} ${pathKey}`;
      const patch = OPERATION_PATCHES[patchKey];
      let nextOp = operation;
      if (patch) {
        nextOp = {
          ...operation,
          summary: patch.summary ?? operation.summary,
          description: patch.description ?? operation.description,
        };
      }
      nextPathItem[method] = clampOperationSummary(nextOp);
    }
    paths[pathKey] = nextPathItem;
  }

  const withPaths = {
    ...doc,
    info,
    servers: [
      {
        url: DEFAULT_FLUIDE_API_BASE_URL,
        description: DEFAULT_SERVER_DESCRIPTION,
      },
    ],
    tags: Array.from(tagByName.values()),
    paths,
    "x-mint": {
      ...(doc["x-mint"] ?? {}),
      productOverview: meta.productOverview,
      basePath: meta.basePath,
    },
  };

  const withAuth = injectGatewayAuth(withPaths, serviceKey);
  return injectCodeSamples(withAuth);
}
