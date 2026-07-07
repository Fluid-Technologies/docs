#!/usr/bin/env node
/**
 * Generate guides/index.mdx from guides/catalog.mjs
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { GUIDE_CATEGORIES, GUIDES } from "../guides/catalog.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const OUT = path.join(ROOT, "guides/index.mdx");

function card(guide) {
  return `  <Card title="${guide.title}" icon="${guide.icon}" href="/guides/${guide.slug}">
    ${guide.description}
  </Card>`;
}

function section(category) {
  const guides = GUIDES.filter(
    (g) => g.categoryId === category.id && g.status === "published",
  );
  if (guides.length === 0) return "";
  return `## ${category.label}

<CardGroup cols={2}>
${guides.map(card).join("\n")}
</CardGroup>

`;
}

const body = `---
title: How-to guides
description: Task-oriented integration guides for Fluide Connect — the API counterpart to Fluide Business help articles.
---

# How-to guides

These guides walk through **specific integration tasks** end to end: prerequisites, API sequence, headers, and troubleshooting. They mirror the [Fluide Business help center](https://app.fluidehr.com/help) but are written for **developers** calling Fluide APIs.

<Info>
**Quickstarts** verify connectivity and your first call. **Guides** go deeper on a single feature or cross-product workflow.
</Info>

## Guide structure

| Section | Purpose |
| --- | --- |
| **Overview** | What you will accomplish |
| **Prerequisites** | Credentials, permissions, existing data |
| **Steps** | Numbered API sequence with curl examples |
| **Tips** | Conventions and optimizations |
| **Troubleshooting** | Common errors and fixes |
| **Related** | API reference and adjacent guides |

<Note>
**Partner integrations:** include \`X-Workspace-Id\` and \`X-Acting-Company-Id\` on product API calls. See [Multi-tenancy](/getting-started/multi-tenancy).
</Note>

---

${GUIDE_CATEGORIES.map(section).join("---\n\n")}

<CardGroup cols={2}>
  <Card title="Multi-tenancy" icon="building" href="/getting-started/multi-tenancy">
    Organization vs partner tenancy models.
  </Card>
  <Card title="API reference" icon="code" href="/api-reference">
    Full endpoint schemas and playground.
  </Card>
</CardGroup>
`;

await writeFile(OUT, body);
console.log(`✓ wrote ${OUT}`);
