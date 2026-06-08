/**
 * Inject Mintlify x-codeSamples (cURL, Node.js, Python, Java, PHP) for every OpenAPI operation.
 * Run via enrichOpenApiSpec — then `node scripts/enrich-openapi.mjs`.
 */

import { DEFAULT_FLUIDE_API_BASE_URL } from "./constants.mjs";

const HTTP_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
]);

const MAX_SCHEMA_DEPTH = 8;

const HEADER_ENV = {
  Authorization: "FLUIDE_ACCESS_TOKEN",
  "X-Fluide-Api-Key": "FLUIDE_API_KEY",
  "X-Fluide-Api-Secret": "FLUIDE_API_SECRET",
  "X-Fluide-Client-Id": "fluide-developer",
};

const MANAGED_SAMPLE_LANGS = new Set([
  "bash",
  "curl",
  "shell",
  "sh",
  "node",
  "nodejs",
  "node.js",
  "python",
  "java",
  "php",
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function resolveRef(ref, components) {
  if (!ref?.startsWith("#/")) return undefined;
  const parts = ref.slice(2).split("/");
  let current = components;
  for (const part of parts) {
    if (!isObject(current)) return undefined;
    current = current[part];
  }
  return current;
}

function mergeSchemas(base, extra) {
  if (!base) return extra;
  if (!extra) return base;
  return { ...base, ...extra };
}

function schemaToExample(schema, components, depth = 0) {
  if (!schema || depth > MAX_SCHEMA_DEPTH) return undefined;

  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];

  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, components);
    return resolved ? schemaToExample(resolved, components, depth + 1) : undefined;
  }

  if (schema.allOf?.length) {
    let merged = {};
    for (const part of schema.allOf) {
      const example = schemaToExample(part, components, depth + 1);
      if (isObject(example)) merged = { ...merged, ...example };
    }
    if (Object.keys(merged).length > 0) return merged;
    const first = schema.allOf[0];
    return schemaToExample(first, components, depth + 1);
  }

  if (schema.oneOf?.length) {
    return schemaToExample(schema.oneOf[0], components, depth + 1);
  }
  if (schema.anyOf?.length) {
    return schemaToExample(schema.anyOf[0], components, depth + 1);
  }

  const type = Array.isArray(schema.type)
    ? schema.type.find((t) => t !== "null") ?? schema.type[0]
    : schema.type;

  switch (type) {
    case "object": {
      const props = schema.properties ?? {};
      const required = new Set(schema.required ?? []);
      const out = {};
      for (const [key, propSchema] of Object.entries(props)) {
        if (!required.has(key)) continue;
        const value = schemaToExample(propSchema, components, depth + 1);
        out[key] = value ?? placeholderForSchema(propSchema, components, depth + 1);
      }
      return out;
    }
    case "array": {
      const item = schemaToExample(schema.items, components, depth + 1);
      return item === undefined ? [] : [item];
    }
    case "string":
      return schema.format === "date-time" ? "2024-01-01T00:00:00.000Z" : "string";
    case "integer":
    case "number":
      return 1;
    case "boolean":
      return true;
    default:
      return undefined;
  }
}

function placeholderForSchema(schema, components, depth = 0) {
  if (!schema || depth > MAX_SCHEMA_DEPTH) return "value";
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, components);
    return placeholderForSchema(resolved, components, depth + 1);
  }
  const type = Array.isArray(schema.type)
    ? schema.type.find((t) => t !== "null") ?? "string"
    : schema.type;
  if (type === "number" || type === "integer") return 1;
  if (type === "boolean") return true;
  if (type === "array") return [];
  if (type === "object") return {};
  return "string";
}

function paramExample(param, components) {
  const schema = mergeSchemas(param.schema, param.content?.["application/json"]?.schema);
  const fromSchema = schemaToExample(schema, components);
  if (fromSchema !== undefined) return fromSchema;
  if (param.example !== undefined) return param.example;
  if (param.name) return `{${param.name}}`;
  return "value";
}

function escapeShell(value) {
  return String(value).replace(/'/g, `'\\''`);
}

function buildUrl(pathKey, pathParams, queryParams, components) {
  let url = pathKey;
  for (const param of pathParams) {
    const value = encodeURIComponent(String(paramExample(param, components)));
    url = url.replace(`{${param.name}}`, value);
  }

  const search = new URLSearchParams();
  for (const param of queryParams) {
    const value = paramExample(param, components);
    if (value === undefined || value === null) continue;
    search.set(param.name, String(value));
  }
  const qs = search.toString();
  return qs ? `${url}?${qs}` : url;
}

function resolveSecurityRequirements(operation, doc) {
  const requirements = operation.security ?? doc.security ?? [];
  if (!Array.isArray(requirements) || requirements.length === 0) return [];

  const schemes = doc.components?.securitySchemes ?? {};
  const headers = [];

  for (const requirement of requirements) {
    for (const [schemeName] of Object.entries(requirement)) {
      const scheme = schemes[schemeName];
      if (!scheme) continue;

      if (scheme.type === "http" && scheme.scheme === "bearer") {
        const env = HEADER_ENV.Authorization;
        headers.push({
          name: "Authorization",
          curl: `Authorization: Bearer $${env}`,
          node: `Authorization: \`Bearer \${process.env.${env}}\``,
          python: `"Authorization": f"Bearer {os.environ['${env}']}"`,
          java: `.header("Authorization", "Bearer " + System.getenv("${env}"))`,
          php: `'Authorization: Bearer ' . getenv('${env}')`,
        });
        continue;
      }

      if (scheme.type === "apiKey" && scheme.in === "header" && scheme.name) {
        const envKey = HEADER_ENV[scheme.name];
        if (scheme.name === "X-Fluide-Client-Id") {
          headers.push({
            name: scheme.name,
            curl: `${scheme.name}: fluide-developer`,
            node: `'${scheme.name}': 'fluide-developer'`,
            python: `"${scheme.name}": "fluide-developer"`,
            java: `.header("${scheme.name}", "fluide-developer")`,
            php: `'${scheme.name}: fluide-developer'`,
          });
        } else if (envKey) {
          headers.push({
            name: scheme.name,
            curl: `${scheme.name}: $${envKey}`,
            node: `'${scheme.name}': process.env.${envKey}`,
            python: `"${scheme.name}": os.environ["${envKey}"]`,
            java: `.header("${scheme.name}", System.getenv("${envKey}"))`,
            php: `'${scheme.name}: ' . getenv('${envKey}')`,
          });
        } else {
          headers.push({
            name: scheme.name,
            curl: `${scheme.name}: your_${scheme.name}`,
            node: `'${scheme.name}': 'your_${scheme.name}'`,
            python: `"${scheme.name}": "your_${scheme.name}"`,
            java: `.header("${scheme.name}", "your_${scheme.name}")`,
            php: `'${scheme.name}: your_${scheme.name}'`,
          });
        }
      }
    }
  }

  const seen = new Set();
  return headers.filter((h) => {
    if (seen.has(h.name)) return false;
    seen.add(h.name);
    return true;
  });
}

function requestBodyExample(operation, components) {
  const body = operation.requestBody;
  if (!body?.content) return undefined;

  const json =
    body.content["application/json"] ??
    body.content["multipart/form-data"] ??
    Object.values(body.content)[0];
  if (!json?.schema) return undefined;

  const example = schemaToExample(json.schema, components);
  if (example !== undefined) return example;

  const schema = json.schema.$ref
    ? resolveRef(json.schema.$ref, components)
    : json.schema;
  if (!schema?.properties) return {};

  const required = new Set(schema.required ?? []);
  const out = {};
  for (const [key, propSchema] of Object.entries(schema.properties)) {
    if (!required.has(key)) continue;
    out[key] = placeholderForSchema(propSchema, components);
  }
  return Object.keys(out).length > 0 ? out : {};
}

function buildCurlSample({ operation, pathKey, method, serverUrl, doc }) {
  const components = doc.components ?? {};
  const pathParams = (operation.parameters ?? []).filter((p) => p.in === "path");
  const queryParams = (operation.parameters ?? []).filter(
    (p) => p.in === "query" && p.required,
  );
  const relativeUrl = buildUrl(pathKey, pathParams, queryParams, components);
  const url = `$FLUIDE_BASE_URL${relativeUrl}`;
  const upperMethod = method.toUpperCase();
  const lines = [`curl -sS -X ${upperMethod} "${url}" \\`];

  for (const header of resolveSecurityRequirements(operation, doc)) {
    lines.push(`  -H "${header.curl}" \\`);
  }

  const body = requestBodyExample(operation, components);
  if (body !== undefined && ["post", "put", "patch"].includes(method)) {
    const json = JSON.stringify(body);
    lines.push(`  -H "Content-Type: application/json" \\`);
    lines.push(`  -d '${escapeShell(json)}'`);
  } else {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/ \\$/, "");
  }

  return lines.join("\n");
}

function buildNodeSample({ operation, pathKey, method, serverUrl, doc }) {
  const components = doc.components ?? {};
  const pathParams = (operation.parameters ?? []).filter((p) => p.in === "path");
  const queryParams = (operation.parameters ?? []).filter(
    (p) => p.in === "query" && p.required,
  );
  const relativeUrl = buildUrl(pathKey, pathParams, queryParams, components);
  const upperMethod = method.toUpperCase();
  const headerLines = resolveSecurityRequirements(operation, doc).map(
    (h) => `    ${h.node},`,
  );

  const body = requestBodyExample(operation, components);
  const hasBody =
    body !== undefined && ["post", "put", "patch"].includes(method);

  const lines = [
    "const baseUrl = process.env.FLUIDE_BASE_URL;",
    "",
    `const response = await fetch(\`\${baseUrl}${relativeUrl}\`, {`,
    `  method: '${upperMethod}',`,
  ];

  if (headerLines.length > 0 || hasBody) {
    lines.push("  headers: {");
    lines.push(...headerLines);
    if (hasBody) {
      lines.push("    'Content-Type': 'application/json',");
    }
    lines.push("  },");
  }

  if (hasBody) {
    lines.push(`  body: JSON.stringify(${JSON.stringify(body)}),`);
  }

  lines.push("});");
  lines.push("");
  lines.push("if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);");
  lines.push("console.log(await response.json());");

  return lines.join("\n");
}

function buildPythonSample({ operation, pathKey, method, doc }) {
  const components = doc.components ?? {};
  const pathParams = (operation.parameters ?? []).filter((p) => p.in === "path");
  const queryParams = (operation.parameters ?? []).filter(
    (p) => p.in === "query" && p.required,
  );
  const relativeUrl = buildUrl(pathKey, pathParams, queryParams, components);
  const upperMethod = method.toLowerCase();
  const headerLines = resolveSecurityRequirements(operation, doc).map(
    (h) => `        ${h.python},`,
  );
  const body = requestBodyExample(operation, components);
  const hasBody =
    body !== undefined && ["post", "put", "patch"].includes(method);

  const lines = [
    "import os",
    "import requests",
    "",
    'base_url = os.environ["FLUIDE_BASE_URL"]',
    "headers = {",
    ...headerLines,
    "}",
    "",
    `response = requests.${upperMethod}(`,
    `    f"{base_url}${relativeUrl}",`,
    "    headers=headers,",
  ];

  if (hasBody) {
    lines.push(`    json=${JSON.stringify(body)},`);
  }

  lines.push("    timeout=30,");
  lines.push(")");
  lines.push("response.raise_for_status()");
  lines.push("print(response.json())");

  return lines.join("\n");
}

function buildJavaSample({ operation, pathKey, method, doc }) {
  const components = doc.components ?? {};
  const pathParams = (operation.parameters ?? []).filter((p) => p.in === "path");
  const queryParams = (operation.parameters ?? []).filter(
    (p) => p.in === "query" && p.required,
  );
  const relativeUrl = buildUrl(pathKey, pathParams, queryParams, components);
  const upperMethod = method.toUpperCase();
  const headerLines = resolveSecurityRequirements(operation, doc).map(
    (h) => `    ${h.java}`,
  );
  const body = requestBodyExample(operation, components);
  const hasBody =
    body !== undefined && ["post", "put", "patch"].includes(method);

  const lines = [
    "import java.net.URI;",
    "import java.net.http.HttpClient;",
    "import java.net.http.HttpRequest;",
    "import java.net.http.HttpResponse;",
    "",
    'String baseUrl = System.getenv("FLUIDE_BASE_URL");',
    "HttpClient client = HttpClient.newHttpClient();",
    "HttpRequest.Builder builder = HttpRequest.newBuilder()",
    `    .uri(URI.create(baseUrl + "${relativeUrl}"))`,
    ...headerLines,
  ];

  if (hasBody) {
    lines.push('    .header("Content-Type", "application/json")');
    lines.push(
      `    .${upperMethod}(HttpRequest.BodyPublishers.ofString(${JSON.stringify(JSON.stringify(body))}))`,
    );
  } else {
    lines.push(`    .${upperMethod}(HttpRequest.BodyPublishers.noBody())`);
  }

  lines.push("    .build();");
  lines.push("HttpResponse<String> response = client.send(builder.build(), HttpResponse.BodyHandlers.ofString());");
  lines.push('if (response.statusCode() >= 400) throw new RuntimeException("HTTP " + response.statusCode() + ": " + response.body());');
  lines.push("System.out.println(response.body());");

  return lines.join("\n");
}

function buildPhpSample({ operation, pathKey, method, doc }) {
  const components = doc.components ?? {};
  const pathParams = (operation.parameters ?? []).filter((p) => p.in === "path");
  const queryParams = (operation.parameters ?? []).filter(
    (p) => p.in === "query" && p.required,
  );
  const relativeUrl = buildUrl(pathKey, pathParams, queryParams, components);
  const upperMethod = method.toUpperCase();
  const headerLines = resolveSecurityRequirements(operation, doc).map(
    (h) => `        ${h.php},`,
  );
  const body = requestBodyExample(operation, components);
  const hasBody =
    body !== undefined && ["post", "put", "patch"].includes(method);

  const lines = [
    "<?php",
    '$baseUrl = getenv("FLUIDE_BASE_URL");',
    `$ch = curl_init($baseUrl . "${relativeUrl}");`,
    "curl_setopt_array($ch, [",
    "    CURLOPT_RETURNTRANSFER => true,",
    `    CURLOPT_CUSTOMREQUEST => '${upperMethod}',`,
    "    CURLOPT_HTTPHEADER => [",
    ...headerLines,
  ];

  if (hasBody) {
    lines.push('        \'Content-Type: application/json\',');
    lines.push(`    ],`);
    lines.push(`    CURLOPT_POSTFIELDS => ${JSON.stringify(JSON.stringify(body))},`);
  } else {
    lines.push("    ],");
  }

  lines.push("]);");
  lines.push("$response = curl_exec($ch);");
  lines.push("if ($response === false) throw new RuntimeException(curl_error($ch));");
  lines.push("$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);");
  lines.push('if ($status >= 400) throw new RuntimeException("HTTP $status: $response");');
  lines.push("echo $response;");

  return lines.join("\n");
}

function hasNodeSample(operation) {
  const samples = operation["x-codeSamples"];
  if (!Array.isArray(samples)) return false;
  return samples.some((s) => {
    const lang = String(s?.lang ?? "").toLowerCase();
    return lang === "node" || lang === "nodejs" || lang === "node.js";
  });
}

export function injectCodeSamples(doc) {
  const serverUrl = doc.servers?.[0]?.url ?? DEFAULT_FLUIDE_API_BASE_URL;
  const paths = {};

  for (const [pathKey, pathItem] of Object.entries(doc.paths ?? {})) {
    const nextPathItem = { ...pathItem };
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method) || !operation || typeof operation !== "object") {
        continue;
      }

      const existing = Array.isArray(operation["x-codeSamples"])
        ? operation["x-codeSamples"].filter((s) => {
            const lang = String(s?.lang ?? "").toLowerCase();
            return !MANAGED_SAMPLE_LANGS.has(lang);
          })
        : [];

      const sampleArgs = { operation, pathKey, method, serverUrl, doc };
      const curl = buildCurlSample(sampleArgs);
      const node = buildNodeSample(sampleArgs);
      const python = buildPythonSample(sampleArgs);
      const java = buildJavaSample(sampleArgs);
      const php = buildPhpSample(sampleArgs);

      nextPathItem[method] = {
        ...operation,
        "x-codeSamples": [
          { lang: "bash", label: "cURL", source: curl },
          { lang: "node", label: "Node.js", source: node },
          { lang: "python", label: "Python", source: python },
          { lang: "java", label: "Java", source: java },
          { lang: "php", label: "PHP", source: php },
          ...existing,
        ],
      };
    }
    paths[pathKey] = nextPathItem;
  }

  return { ...doc, paths };
}

/** Report operations missing Node.js x-codeSamples (for CI / manual audit). */
export function auditCodeSamples(doc) {
  const missing = [];
  for (const [pathKey, pathItem] of Object.entries(doc.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method) || !operation || typeof operation !== "object") {
        continue;
      }
      if (!hasNodeSample(operation)) {
        missing.push(`${method.toUpperCase()} ${pathKey}`);
      }
    }
  }
  return missing;
}
