#!/usr/bin/env node
/**
 * Sync docs.json Guides tab groups from guides/catalog.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GUIDE_CATEGORIES, getGuidesByCategory } from "../guides/catalog.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const docsPath = path.join(ROOT, "docs.json");

const docs = JSON.parse(await readFile(docsPath, "utf8"));

const guideGroups = [
  { group: "Overview", pages: ["guides/index"] },
  ...GUIDE_CATEGORIES.map((cat) => ({
    group: cat.navGroup,
    pages: getGuidesByCategory(cat.id)
      .filter((g) => g.status === "published")
      .map((g) => `guides/${g.slug}`),
  })).filter((g) => g.pages.length > 0),
];

// Access group: add auth reference pages
const accessGroup = guideGroups.find((g) => g.group === "Access & Auth");
if (accessGroup) {
  accessGroup.pages.push("auth/sso", "auth/rbac");
}

const guidesTab = docs.navigation.tabs.find((t) => t.tab === "Guides");
if (!guidesTab) {
  console.error("Guides tab not found in docs.json");
  process.exit(1);
}
guidesTab.groups = guideGroups;

// Products tab — wire orphan pages
const productsTab = docs.navigation.tabs.find((t) => t.tab === "Products");
if (productsTab) {
  for (const group of productsTab.groups) {
    if (group.group === "Auth") {
      group.pages = ["auth/overview", "auth/quickstart", "auth/sso", "auth/rbac", "auth/features"];
    }
    if (group.group === "HR") {
      group.pages = ["hr/overview", "hr/quickstart", "hr/modules", "hr/payroll-integration"];
    }
    if (group.group === "Payroll") {
      group.pages = ["payroll/overview", "payroll/quickstart", "payroll/modules", "payroll/hr-mirror"];
    }
    if (group.group === "Pay") {
      group.pages = ["pay/overview", "pay/quickstart", "pay/modules"];
    }
  }
}

await writeFile(docsPath, `${JSON.stringify(docs, null, 2)}\n`);
console.log("✓ updated docs.json Guides and Products nav from catalog");
