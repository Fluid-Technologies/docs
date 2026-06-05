#!/usr/bin/env node
/**
 * Re-apply openapi/enrichment.mjs metadata to checked-in specs without re-fetching from services.
 * Usage: node scripts/enrich-openapi.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { enrichOpenApiSpec } from "../openapi/enrichment.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "openapi");

const SPECS = [
  { key: "fluide-auth", file: "fluide-auth.json" },
  { key: "fluide-hr", file: "fluide-hr.json" },
  { key: "fluide-payroll", file: "fluide-payroll.json" },
  { key: "fluide-pay", file: "fluide-pay.json" },
  { key: "fluide-books", file: "fluide-books.json" },
  { key: "fluide-utils", file: "fluide-utils.json" },
];

async function main() {
  for (const { key, file } of SPECS) {
    const filePath = path.join(OUT_DIR, file);
    try {
      const raw = await readFile(filePath, "utf8");
      const doc = JSON.parse(raw);
      const enriched = enrichOpenApiSpec(doc, key);
      await writeFile(filePath, `${JSON.stringify(enriched, null, 2)}\n`, "utf8");
      console.log(`✓ enriched ${file}`);
    } catch (err) {
      if (err.code === "ENOENT") {
        console.warn(`- skipped ${file} (not found — run export-openapi.mjs first)`);
        continue;
      }
      throw err;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
