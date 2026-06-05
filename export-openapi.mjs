#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { enrichOpenApiSpec } from "./openapi/enrichment.mjs";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "openapi");
const REQUEST_TIMEOUT_MS = Number(process.env.OPENAPI_FETCH_TIMEOUT_MS || 20000);

/** Beta gateway — override with FLUIDE_API_BASE_URL for other environments. */
const API_BASE_URL = (
  process.env.FLUIDE_API_BASE_URL ?? "https://staging.api.fluidehr.com"
).replace(/\/$/, "");

const ALLOWED_HTTP_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
]);

const DEFAULT_SERVERS = [
  { url: API_BASE_URL, description: "Beta (staging)" },
];

/** Gateway Swagger UI segment under /api/v1/docs/{segment}/ */
function gatewayDocsBase(segment) {
  return `${API_BASE_URL}/api/v1/docs/${segment}/`;
}

function buildGatewaySource({ name, out, env, segment, optional = false, localPort }) {
  const docsBase = gatewayDocsBase(segment);
  const defaultUrls = [
    `${API_BASE_URL}/api/v1/docs/${segment}-json`,
    `${docsBase}api-json`,
    `${docsBase}docs-json`,
  ];
  if (localPort) {
    defaultUrls.push(
      `http://localhost:${localPort}/api/docs-json`,
      `http://localhost:${localPort}/api-json`,
    );
  }
  return { name, out, env, docsBase, defaultUrls, optional };
}

const SOURCES = [
  buildGatewaySource({ name: "fluide-auth", out: "fluide-auth.json", env: "OPENAPI_AUTH_URL", segment: "auth", localPort: 3000 }),
  buildGatewaySource({ name: "fluide-hr", out: "fluide-hr.json", env: "OPENAPI_HR_URL", segment: "hr", localPort: 3001 }),
  buildGatewaySource({ name: "fluide-payroll", out: "fluide-payroll.json", env: "OPENAPI_PAYROLL_URL", segment: "payroll", localPort: 5051 }),
  buildGatewaySource({ name: "fluide-pay", out: "fluide-pay.json", env: "OPENAPI_PAY_URL", segment: "payments", localPort: 5058 }),
  buildGatewaySource({ name: "fluide-books", out: "fluide-books.json", env: "OPENAPI_BOOKS_URL", segment: "accounting", localPort: 5052 }),
  buildGatewaySource({ name: "fluide-utils", out: "fluide-utils.json", env: "OPENAPI_UTILS_URL", segment: "utils", optional: true, localPort: 5054 }),
];

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

async function fetchJson(url) {
  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = await res.json();
  const isOas3 = typeof data?.openapi === "string";
  const isOas2 = typeof data?.swagger === "string";
  if (!isObject(data) || (!isOas3 && !isOas2)) {
    throw new Error("Response is not an OpenAPI document");
  }
  return data;
}

async function fetchText(url) {
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function pushUnique(arr, value) {
  if (!arr.includes(value)) arr.push(value);
}

function resolveDocRef(base, raw) {
  try {
    return new URL(raw, base).toString();
  } catch {
    return null;
  }
}

async function discoverFromDocsBase(docsBase) {
  const candidates = [];
  const docsOrigin = new URL(docsBase).origin;
  const initPaths = ["swagger-ui-init.js", "swagger-initializer.js"];

  for (const rel of initPaths) {
    const url = new URL(rel, docsBase).toString();
    try {
      const text = await fetchText(url);
      const regex = /url\s*:\s*["']([^"']+)["']/g;
      let m;
      while ((m = regex.exec(text)) !== null) {
        const resolved = resolveDocRef(docsBase, m[1]);
        if (!resolved) continue;
        // Ignore Swagger UI demo URLs and keep gateway-local discoveries.
        if (!resolved.startsWith(docsOrigin)) continue;
        if (resolved.includes("petstore.swagger.io")) continue;
        pushUnique(candidates, resolved);
      }
    } catch {
      // ignore missing init assets
    }
  }

  return candidates;
}

function extractEmbeddedSwaggerDoc(text) {
  const marker = '"swaggerDoc":';
  const idx = text.indexOf(marker);
  if (idx < 0) return null;
  const start = text.indexOf("{", idx);
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inStr) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inStr = false;
      }
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        const jsonStr = text.slice(start, i + 1);
        try {
          const parsed = JSON.parse(jsonStr);
          if (isObject(parsed) && (typeof parsed.openapi === "string" || typeof parsed.swagger === "string")) {
            return parsed;
          }
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Mintlify only accepts standard OpenAPI path methods; Nest Swagger can emit `search`, etc. */
function sanitizeForMintlify(doc, serviceName) {
  const paths = {};
  for (const [pathKey, pathItem] of Object.entries(doc.paths ?? {})) {
    if (!pathKey.startsWith("/")) continue;
    const cleaned = {};
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!ALLOWED_HTTP_METHODS.has(method.toLowerCase())) continue;
      if (!isObject(operation)) continue;
      cleaned[method] = operation;
    }
    if (Object.keys(cleaned).length > 0) {
      paths[pathKey] = cleaned;
    }
  }

  const info = isObject(doc.info) ? { ...doc.info } : {};
  if (!info.title) {
    info.title = `Fluide ${serviceName} API`;
  }
  if (!info.version) {
    info.version = "1.0";
  }

  const components = fixSecuritySchemes(doc.components);

  const cleaned = stripMintlifyInvalidFields({
    ...doc,
    openapi: doc.openapi ?? "3.0.0",
    info,
    servers: DEFAULT_SERVERS,
    paths,
    components,
  });

  return cleaned;
}

/** Nest Swagger sometimes mixes apiKey fields into http bearer schemes. */
function fixSecuritySchemes(components) {
  if (!isObject(components) || !isObject(components.securitySchemes)) {
    return components;
  }
  const securitySchemes = {};
  for (const [name, scheme] of Object.entries(components.securitySchemes)) {
    if (!isObject(scheme)) continue;
    const fixed = { ...scheme };
    if (fixed.type === "http") {
      delete fixed.name;
      delete fixed.in;
      if (!fixed.scheme) fixed.scheme = "bearer";
    }
    securitySchemes[name] = fixed;
  }
  return { ...components, securitySchemes };
}

/** Remove Nest/Swagger fields Mintlify's OpenAPI validator rejects. */
function stripMintlifyInvalidFields(value) {
  if (Array.isArray(value)) {
    return value.map(stripMintlifyInvalidFields);
  }
  if (!isObject(value)) {
    return value;
  }
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "examples") continue;
    out[key] = stripMintlifyInvalidFields(child);
  }
  return out;
}

async function writeSanitizedSpec(source, doc, label) {
  const sanitized = enrichOpenApiSpec(
    sanitizeForMintlify(doc, source.name),
    source.name,
  );
  const outputPath = path.join(OUT_DIR, source.out);
  const pathCount = Object.keys(sanitized.paths ?? {}).length;
  await writeFile(outputPath, `${JSON.stringify(sanitized, null, 2)}\n`, "utf8");
  console.log(`✓ ${source.name} -> ${source.out} (${pathCount} paths, ${label})`);
}

async function exportOne(source) {
  const override = process.env[source.env]?.trim();
  const urls = [];
  if (override) {
    pushUnique(urls, override);
  } else {
    if (source.docsBase) {
      const initUrl = new URL("swagger-ui-init.js", source.docsBase).toString();
      try {
        const initText = await fetchText(initUrl);
        const embedded = extractEmbeddedSwaggerDoc(initText);
        if (embedded) {
          await writeSanitizedSpec(source, embedded, `${initUrl} embedded swaggerDoc`);
          return true;
        }
      } catch {
        // continue to URL discovery fallbacks
      }
    }
    if (source.docsBase) {
      const discovered = await discoverFromDocsBase(source.docsBase);
      for (const u of discovered) pushUnique(urls, u);
    }
    for (const u of source.defaultUrls) pushUnique(urls, u);
  }
  let lastErr = null;

  for (const url of urls) {
    try {
      const json = await fetchJson(url);
      await writeSanitizedSpec(source, json, url);
      return true;
    } catch (err) {
      lastErr = err;
      console.warn(`- ${source.name}: failed ${url} (${err.message})`);
    }
  }

  if (source.optional) {
    console.warn(
      `⚠ ${source.name}: could not export (${lastErr?.message ?? "unknown error"}) — keeping checked-in ${source.out}`,
    );
    return true;
  }
  console.error(`✗ ${source.name}: could not export (${lastErr?.message ?? "unknown error"})`);
  return false;
}

async function main() {
  console.log(`Exporting OpenAPI from ${API_BASE_URL}/api/v1/docs/*\n`);
  await mkdir(OUT_DIR, { recursive: true });
  let ok = 0;
  for (const source of SOURCES) {
    const pass = await exportOne(source);
    if (pass) ok += 1;
  }

  if (ok !== SOURCES.length) {
    process.exitCode = 1;
    console.error(`\nExported ${ok}/${SOURCES.length} specs.`);
    console.error("Tip: start missing services or set OPENAPI_*_URL environment overrides.");
    return;
  }

  console.log(`\nExported ${ok}/${SOURCES.length} specs successfully.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

