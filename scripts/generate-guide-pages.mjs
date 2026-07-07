#!/usr/bin/env node
/**
 * Generate guide MDX pages from catalog. Skips files that already exist unless --force.
 */
import { access, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { GUIDES } from "../guides/catalog.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const force = process.argv.includes("--force");

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function renderGuide(g) {
  const prereq =
    g.prerequisites?.length > 0
      ? g.prerequisites.map((p) => `- ${p}`).join("\n")
      : "- API credentials — [Authorization](/getting-started/authorization)";

  const perms =
    g.permissionHints?.length > 0
      ? `\n\nRequired permissions: ${g.permissionHints.map((p) => `\`${p}\``).join(", ")}.`
      : "";

  const partnerNote = g.partnerHeaders
      ? `\n\n<Note>\nInclude acting-client headers on product API calls: \`X-Workspace-Id\` and \`X-Acting-Company-Id\`. See [Act as a client](/guides/service-partner/act-as-client).\n</Note>`
      : "";

  const steps = (g.steps ?? [])
    .map(
      (s, i) => `<Step title="${s.title}">

${s.body}

</Step>`,
    )
    .join("\n\n");

  const tips =
    g.tips?.length > 0
      ? `## Tips\n\n${g.tips.map((t) => `- ${t}`).join("\n")}`
      : "";

  const troubleshooting =
    g.troubleshooting?.length > 0
      ? `## Troubleshooting\n\n| Problem | Resolution |\n| --- | --- |\n${g.troubleshooting.map((t) => `| ${t.problem} | ${t.resolution} |`).join("\n")}`
      : "";

  const related =
    g.related?.length > 0
      ? `## Related\n\n<CardGroup cols={2}>\n${g.related
          .map((r) => {
            const href = r.startsWith("guides/") || r.startsWith("getting-started/") || r.startsWith("auth/")
              ? `/${r}`
              : `/guides/${r}`;
            const title = r.split("/").pop().replace(/-/g, " ");
            return `  <Card title="${title}" href="${href}" />`;
          })
          .join("\n")}\n</CardGroup>`
      : "";

  return `---
title: ${g.title}
description: ${g.description}
---

# ${g.title}

${g.description}${partnerNote}

## Prerequisites

${prereq}${perms}

## Steps

<Steps>

${steps}

</Steps>

${tips}

${troubleshooting}

${related}
`;
}

let created = 0;
let skipped = 0;

for (const g of GUIDES) {
  if (g.status !== "published") continue;
  const filePath = path.join(ROOT, "guides", `${g.slug}.mdx`);
  await mkdir(path.dirname(filePath), { recursive: true });
  if ((await exists(filePath)) && !force) {
    skipped++;
    continue;
  }
  await writeFile(filePath, renderGuide(g));
  created++;
  console.log(`✓ guides/${g.slug}.mdx`);
}

console.log(`Done: ${created} created, ${skipped} skipped (use --force to overwrite)`);
