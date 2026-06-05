#!/usr/bin/env node
/**
 * Compare current openapi/*.json against a baseline and report API doc drift.
 *
 * Usage:
 *   node scripts/diff-openapi.mjs              # compare to openapi/.baseline/
 *   node scripts/diff-openapi.mjs --save       # refresh baseline after a release
 *   node scripts/diff-openapi.mjs --json       # machine-readable output
 */
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const CURRENT_DIR = path.join(ROOT, "openapi");
const BASELINE_DIR = path.join(CURRENT_DIR, ".baseline");

const SPECS = [
  "fluide-auth.json",
  "fluide-hr.json",
  "fluide-payroll.json",
  "fluide-pay.json",
  "fluide-books.json",
  "fluide-utils.json",
];

const saveBaseline = process.argv.includes("--save");
const jsonOut = process.argv.includes("--json");

function operationKey(pathKey, method) {
  return `${method.toUpperCase()} ${pathKey}`;
}

function collectOperations(doc) {
  const ops = new Map();
  for (const [pathKey, pathItem] of Object.entries(doc.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!operation || typeof operation !== "object") continue;
      if (!["get", "post", "put", "patch", "delete", "head", "options"].includes(method)) {
        continue;
      }
      const key = operationKey(pathKey, method);
      ops.set(key, {
        path: pathKey,
        method: method.toUpperCase(),
        operationId: operation.operationId ?? null,
        summary: operation.summary ?? null,
        deprecated: Boolean(operation.deprecated),
        tags: operation.tags ?? [],
        responseSchemas: extractResponseSchemas(operation),
        requestSchema: extractRequestSchema(operation),
      });
    }
  }
  return ops;
}

function extractRequestSchema(operation) {
  const content = operation.requestBody?.content?.["application/json"]?.schema;
  if (!content) return null;
  return schemaFingerprint(content);
}

function extractResponseSchemas(operation) {
  const out = {};
  for (const [status, response] of Object.entries(operation.responses ?? {})) {
    const schema = response?.content?.["application/json"]?.schema;
    if (schema) out[status] = schemaFingerprint(schema);
  }
  return out;
}

/** Stable string for shallow schema comparison (not a full JSON Schema diff). */
function schemaFingerprint(schema, depth = 0) {
  if (!schema || depth > 4) return "?";
  if (schema.$ref) return schema.$ref;
  if (schema.type === "array") {
    return `array<${schemaFingerprint(schema.items, depth + 1)}>`;
  }
  if (schema.type === "object" || schema.properties) {
    const props = Object.keys(schema.properties ?? {}).sort();
    const required = [...(schema.required ?? [])].sort();
    return `object{${props.join(",")}}!${required.join(",")}`;
  }
  return schema.type ?? schema.format ?? "unknown";
}

function diffOperations(before, after) {
  const added = [];
  const removed = [];
  const deprecated = [];
  const undeprecated = [];
  const responseChanges = [];

  for (const [key, op] of after) {
    if (!before.has(key)) added.push(op);
    else if (!before.get(key).deprecated && op.deprecated) deprecated.push(op);
    else if (before.get(key).deprecated && !op.deprecated) undeprecated.push(op);
    else {
      const prev = before.get(key);
      const prevResponses = JSON.stringify(prev.responseSchemas);
      const nextResponses = JSON.stringify(op.responseSchemas);
      if (prevResponses !== nextResponses) {
        responseChanges.push({
          ...op,
          previous: prev.responseSchemas,
          current: op.responseSchemas,
        });
      }
      const prevRequest = prev.requestSchema ?? null;
      const nextRequest = op.requestSchema ?? null;
      if (prevRequest !== nextRequest) {
        responseChanges.push({
          ...op,
          change: "requestBody",
          previous: prevRequest,
          current: nextRequest,
        });
      }
    }
  }

  for (const [key, op] of before) {
    if (!after.has(key)) removed.push(op);
  }

  return { added, removed, deprecated, undeprecated, responseChanges };
}

async function readSpec(dir, file) {
  const raw = await readFile(path.join(dir, file), "utf8");
  return JSON.parse(raw);
}

async function ensureBaselineFromCurrent() {
  await mkdir(BASELINE_DIR, { recursive: true });
  for (const file of SPECS) {
    await cp(path.join(CURRENT_DIR, file), path.join(BASELINE_DIR, file));
  }
}

async function main() {
  if (saveBaseline) {
    await ensureBaselineFromCurrent();
    console.log(`Baseline saved to ${BASELINE_DIR}`);
    return;
  }

  const report = { generatedAt: new Date().toISOString(), services: {} };
  let hasBaseline = false;

  try {
    const baselineFiles = await readdir(BASELINE_DIR);
    hasBaseline = SPECS.every((f) => baselineFiles.includes(f));
  } catch {
    hasBaseline = false;
  }

  if (!hasBaseline) {
    const msg =
      "No openapi/.baseline/ yet. Run export, review changes, then:\n  node scripts/diff-openapi.mjs --save";
    if (jsonOut) {
      console.log(JSON.stringify({ error: msg }, null, 2));
    } else {
      console.log(msg);
    }
    process.exitCode = 0;
    return;
  }

  let totalChanges = 0;

  for (const file of SPECS) {
    const service = file.replace(".json", "");
    const current = await readSpec(CURRENT_DIR, file);
    const baseline = await readSpec(BASELINE_DIR, file);
    const diff = diffOperations(collectOperations(baseline), collectOperations(current));
    const changeCount =
      diff.added.length +
      diff.removed.length +
      diff.deprecated.length +
      diff.undeprecated.length +
      diff.responseChanges.length;

    totalChanges += changeCount;
    report.services[service] = diff;

    if (jsonOut || changeCount === 0) continue;

    console.log(`\n## ${service} (${changeCount} changes)`);
    if (diff.added.length) {
      console.log("\n  + New endpoints:");
      for (const op of diff.added) console.log(`    ${op.method} ${op.path}`);
    }
    if (diff.removed.length) {
      console.log("\n  - Removed endpoints (document in changelog):");
      for (const op of diff.removed) console.log(`    ${op.method} ${op.path}`);
    }
    if (diff.deprecated.length) {
      console.log("\n  ! Newly deprecated:");
      for (const op of diff.deprecated) console.log(`    ${op.method} ${op.path}`);
    }
    if (diff.undeprecated.length) {
      console.log("\n  ✓ No longer deprecated:");
      for (const op of diff.undeprecated) console.log(`    ${op.method} ${op.path}`);
    }
    if (diff.responseChanges.length) {
      console.log("\n  ~ Request/response schema changes:");
      for (const op of diff.responseChanges) {
        console.log(`    ${op.method} ${op.path}`);
      }
    }
  }

  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (totalChanges === 0) {
    console.log("No API changes since baseline.");
    return;
  }

  console.log(
    `\n${totalChanges} total change(s). Update changelog.mdx for breaking/deprecated items, then --save baseline after release.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
