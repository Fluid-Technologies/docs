/**
 * Product-level metadata injected into exported OpenAPI specs.
 * Single source of truth for API reference intros and tag descriptions.
 * Edit here — then run `node export-openapi.mjs` or `node scripts/enrich-openapi.mjs`.
 */

export const PRODUCT_META = {
  "fluide-auth": {
    title: "Fluide Auth API",
    description:
      "Identity, developer credentials, token exchange, organizations, and RBAC for the Fluide Suite. Use this API to obtain JWTs before calling product services through the gateway.",
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
    description: "Liveness probe for the HR service and its dependencies.",
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

export function enrichOpenApiSpec(doc, serviceKey) {
  const meta = PRODUCT_META[serviceKey];
  if (!meta) return doc;

  const info = { ...(doc.info ?? {}) };
  info.title = meta.title;
  info.description = meta.description;

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
        summary: operation.summary || patch.summary,
        description: operation.description || patch.description,
      };
    }
    paths[pathKey] = nextPathItem;
  }

  return {
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
}
