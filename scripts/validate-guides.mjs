#!/usr/bin/env node
/**
 * Validate guide catalog, files, and docs.json nav consistency.
 */
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { GUIDES, GUIDE_CATEGORIES, getNavPages } from "../guides/catalog.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const errors = [];

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

for (const g of GUIDES.filter((x) => x.status === "published")) {
  const file = path.join(ROOT, "guides", `${g.slug}.mdx`);
  if (!(await exists(file))) {
    errors.push(`Missing MDX: guides/${g.slug}.mdx (catalog status: published)`);
  }
  if (!GUIDE_CATEGORIES.some((c) => c.id === g.categoryId)) {
    errors.push(`Unknown categoryId "${g.categoryId}" for ${g.slug}`);
  }
}

const docsPath = path.join(ROOT, "docs.json");
const docs = JSON.parse(await readFile(docsPath, "utf8"));
const navPages = new Set();

function walkNav(items) {
  for (const item of items ?? []) {
    if (typeof item === "string") navPages.add(item);
    else if (item.pages) walkNav(item.pages);
  }
}

for (const tab of docs.navigation?.tabs ?? []) {
  walkNav(tab.pages);
  for (const group of tab.groups ?? []) walkNav(group.pages);
}

const expectedNav = getNavPages();
for (const page of expectedNav) {
  if (!navPages.has(page)) {
    errors.push(`docs.json nav missing: ${page}`);
  }
}

for (const page of navPages) {
  if (page.startsWith("guides/") && page !== "guides/index") {
    const file = path.join(ROOT, `${page}.mdx`);
    if (!(await exists(file))) {
      errors.push(`docs.json references missing file: ${page}.mdx`);
    }
  }
}

if (errors.length > 0) {
  console.error("Guide validation failed:\n");
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}

console.log(`✓ ${GUIDES.filter((g) => g.status === "published").length} published guides validated`);
console.log(`✓ docs.json nav aligned with catalog`);
