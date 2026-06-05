#!/usr/bin/env node
/**
 * Copy Mintlify content from FluideConnect → Fluid-Technologies/docs deploy repo.
 *
 * Usage:
 *   git clone https://github.com/Fluid-Technologies/docs.git /tmp/docs
 *   node scripts/sync-to-docs-repo.mjs /tmp/docs
 */
import { cp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const targetArg = process.argv[2];

if (!targetArg) {
  console.error("Usage: node scripts/sync-to-docs-repo.mjs <path-to-docs-repo>");
  process.exit(1);
}

const TARGET = path.resolve(targetArg);

/** Paths copied relative to FluideConnect root. */
const SYNC_PATHS = [
  "docs.json",
  ".mintignore",
  "introduction.mdx",
  "changelog.mdx",
  "api-reference.mdx",
  "export-openapi.mjs",
  "getting-started",
  "auth",
  "hr",
  "payroll",
  "pay",
  "books",
  "utils",
  "api-reference",
  "openapi",
  "logo",
  "favicon.svg",
  "custom.css",
  "public",
  "scripts/enrich-openapi.mjs",
  "scripts/diff-openapi.mjs",
  "scripts/sync-to-docs-repo.mjs",
  "openapi/enrichment.mjs",
];

/** Starter-kit files replaced by Fluide Connect content. */
const REMOVE_STALE = [
  "index.mdx",
  "quickstart.mdx",
  "favicon.svg",
  "logo",
  "AGENTS.md",
];

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function copyPath(rel) {
  const src = path.join(ROOT, rel);
  const dest = path.join(TARGET, rel);
  if (!(await exists(src))) {
    console.warn(`- skip missing source: ${rel}`);
    return;
  }
  await mkdir(path.dirname(dest), { recursive: true });
  await cp(src, dest, { recursive: true, force: true });
  console.log(`✓ ${rel}`);
}

async function main() {
  if (!(await exists(TARGET))) {
    console.error(`Target directory does not exist: ${TARGET}`);
    process.exit(1);
  }
  if (!(await exists(path.join(TARGET, ".git")))) {
    console.error("Target must be a git checkout of Fluid-Technologies/docs");
    process.exit(1);
  }

  console.log(`Syncing Mintlify content → ${TARGET}\n`);

  for (const stale of REMOVE_STALE) {
    const p = path.join(TARGET, stale);
    if (await exists(p)) {
      await rm(p, { recursive: true, force: true });
      console.log(`✗ removed stale: ${stale}`);
    }
  }

  for (const rel of SYNC_PATHS) {
    await copyPath(rel);
  }

  const readme = `# Fluide Connect documentation (Mintlify)

This repository is the **deploy target** for Mintlify ([Git Settings](https://app.mintlify.com): \`Fluid-Technologies/docs\`, branch \`main\`).

**Do not edit here by hand.** Content is published from [FluideConnect](https://github.com/Fluid-Technologies/FluideConnect):

\`\`\`bash
# In FluideConnect
node export-openapi.mjs
node scripts/sync-to-docs-repo.mjs /path/to/docs-checkout
cd /path/to/docs-checkout && git add -A && git commit && git push
\`\`\`

CI in FluideConnect runs export + publish on merge to \`main\` when \`DOCS_REPO_PAT\` is configured.

Last sync source: FluideConnect @ ${new Date().toISOString()}
`;

  await writeFile(path.join(TARGET, "README.md"), readme, "utf8");
  console.log("✓ README.md");

  console.log("\nDone. Commit and push to main to trigger Mintlify deploy.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
