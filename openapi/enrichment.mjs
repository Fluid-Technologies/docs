/**
 * Product-level metadata injected into exported OpenAPI specs.
 * Single source of truth for API reference intros and tag descriptions.
 * Edit here — then run `node export-openapi.mjs` or `node scripts/enrich-openapi.mjs`.
 */

/** Tyk gateway + userFetcher contract for Fluide Connect developer integrations. */
export const CONNECT_SECURITY_SCHEMES = {
  bearer: {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description:
      "Developer access token from POST /api/v1/developer-access/token. Paste the raw JWT; Mintlify adds the Bearer prefix.",
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
      "API secret — send only to POST /api/v1/developer-access/token. Never use on product routes.",
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
  "/api/v1/developer-access/token",
  "/api/v1/developer-access/exchange",
]);

const DEVELOPER_SESSION_PATHS = new Set([
  "/api/v1/developer-access/current",
  "/api/v1/developer-access/rotate-secret",
]);

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
  " In the API playground, click Authorize and provide Bearer JWT (from token exchange), X-Fluide-Api-Key, and X-Fluide-Client-Id (fluide-developer).";

export const PRODUCT_META = {
  "fluide-auth": {
    title: "Fluide Auth API",
    description:
      "Developer credentials, token exchange, and session management for the Fluide Suite. Exchange your API key and secret for an access token before calling product APIs.",
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
    "Exchange API key + secret for JWTs and manage developer credentials.",
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
};

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

function resolveConnectSecurity(serviceKey, pathKey) {
  if (TOKEN_EXCHANGE_PATHS.has(pathKey)) {
    return TOKEN_EXCHANGE_SECURITY;
  }
  if (PRODUCT_SERVICE_KEYS.has(serviceKey)) {
    return CONNECT_PRODUCT_SECURITY;
  }
  if (serviceKey === "fluide-auth" && DEVELOPER_SESSION_PATHS.has(pathKey)) {
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
    PRODUCT_SERVICE_KEYS.has(serviceKey) ? CONNECT_PRODUCT_SECURITY : doc.security;

  return { ...doc, components, paths, security };
}

export function enrichOpenApiSpec(doc, serviceKey) {
  const meta = PRODUCT_META[serviceKey];
  if (!meta) return doc;

  const info = { ...(doc.info ?? {}) };
  info.title = meta.title;
  info.description = meta.description;
  if (PRODUCT_SERVICE_KEYS.has(serviceKey) && !info.description?.includes("API playground")) {
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

  const paths = { ...doc.paths };
  for (const [pathKey, pathItem] of Object.entries(paths)) {
    const nextPathItem = { ...pathItem };
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!operation || typeof operation !== "object") continue;
      const patchKey = `${method.toUpperCase()} ${pathKey}`;
      const patch = OPERATION_PATCHES[patchKey];
      if (!patch) continue;
      nextPathItem[method] = {
        ...operation,
        summary: patch.summary ?? operation.summary,
        description: patch.description ?? operation.description,
      };
    }
    paths[pathKey] = nextPathItem;
  }

  const withPaths = {
    ...doc,
    info,
    tags: Array.from(tagByName.values()),
    paths,
    "x-mint": {
      ...(doc["x-mint"] ?? {}),
      productOverview: meta.productOverview,
      basePath: meta.basePath,
    },
  };

  return injectGatewayAuth(withPaths, serviceKey);
}
