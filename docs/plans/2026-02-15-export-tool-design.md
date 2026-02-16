# export_profile MCP Tool Design

## Overview

Implement an `export_profile` MCP tool that converts a stored `ProductProfile` into markdown or JSON format. The format conversion logic lives in `packages/core/src/export.ts` (shared between MCP server and future CLI). The tool returns content inline as an MCP text response -- no file I/O.

## Problem Statement

After scanning a product and refining its profile through conversation, users need to get the data out. They want to paste a profile into a Notion doc, share it with a colleague as JSON, or save it locally. The MCP tool is the interface: the AI assistant calls `export_profile`, gets back formatted text, and relays it to the user.

## Expert Perspectives

### Technical Architect

The core question is: where does the formatting logic live? It must be in `@basesignal/core`, not in the MCP server. The MCP tool is a thin handler that calls `storage.load(id)` then `formatProfile(profile, format)`. Two formats are sufficient: JSON (the profile as-is with `basesignal_version`) and Markdown (a readable document). CSV is a trap -- a ProductProfile is a deeply nested document, not a table. The formatting functions are pure (profile in, string out), which makes them trivially testable without any MCP or storage dependencies.

### Simplification Reviewer

**Verdict: APPROVED** -- with cuts.

What to keep:
- Two formats: `json` and `markdown`. That is the minimum.
- Formatting logic in `@basesignal/core`. Correct location.
- Inline response (return the text, not a file). MCP tools return text content.
- Graceful handling of missing sections. A partial profile is still exportable.

What to cut:
- **No CSV format.** A ProductProfile has nested arrays, objects-within-objects, confidence scores per section. CSV would require flattening decisions that vary by use case. Anyone who needs CSV can transform the JSON export.
- **No template system.** A single hardcoded Markdown template is simpler, more predictable, and easier to maintain than a configurable template engine. If someone wants different formatting, they transform the Markdown output or use JSON and format it themselves.
- **No file output.** MCP tools return text content to the AI assistant. File writing is the user's responsibility (or the CLI's, in a different story). The tool should not write to disk.
- **No `sections` filter parameter.** The full profile is small enough to always export in full. Section filtering adds parameter complexity for marginal value -- the AI assistant can excerpt what it needs from the full export.

What to watch:
- Markdown template length. Keep it comprehensive but not overwhelming. If it exceeds ~200 lines for a full profile, something is over-detailed.

## Proposed Solution

### Tool Registration

```typescript
// packages/mcp-server/src/tools/export.ts

export function registerExportTool(server: McpServer, storage: StorageAdapter) {
  server.registerTool(
    "export_profile",
    {
      title: "Export Product Profile",
      description:
        "Export a product profile as markdown or JSON. " +
        "Use 'markdown' for readable documents, 'json' for programmatic use.",
      inputSchema: {
        type: "object" as const,
        properties: {
          productId: {
            type: "string",
            description: "Product ID (from list_products)",
          },
          format: {
            type: "string",
            enum: ["markdown", "json"],
            description: "Export format: 'markdown' for readable document, 'json' for structured data",
          },
        },
        required: ["productId", "format"],
      },
    },
    async (args: { productId: string; format: "markdown" | "json" }) => {
      const profile = await storage.load(args.productId);
      if (!profile) {
        return {
          content: [{ type: "text" as const, text: "Product not found." }],
          isError: true,
        };
      }

      const output =
        args.format === "json"
          ? exportProfileAsJson(profile)
          : exportProfileAsMarkdown(profile);

      return {
        content: [{ type: "text" as const, text: output }],
      };
    }
  );
}
```

Two parameters. No options, no configuration. The handler is five lines of logic.

### Format Functions (packages/core)

Both functions live in `packages/core/src/export.ts`. They are pure functions: `ProductProfile` in, `string` out.

#### JSON Export

```typescript
// packages/core/src/export.ts

import type { ProductProfile } from "./types";

/**
 * Export a ProductProfile as a JSON string.
 * Includes basesignal_version for schema compatibility.
 */
export function exportProfileAsJson(profile: ProductProfile): string {
  return JSON.stringify(
    {
      basesignal_version: profile.basesignal_version ?? "1.0",
      ...profile,
    },
    null,
    2
  );
}
```

That is the entire JSON export. `JSON.stringify` with indentation. The `basesignal_version` field ensures consumers can check schema compatibility (from M008-E001-S004).

#### Markdown Export

```typescript
/**
 * Export a ProductProfile as a readable Markdown document.
 * Missing sections are noted with a placeholder, not omitted.
 */
export function exportProfileAsMarkdown(profile: ProductProfile): string {
  const lines: string[] = [];

  // Header
  const name = profile.identity?.productName ?? profile.metadata?.name ?? "Unknown Product";
  lines.push(`# ${name} - Product Profile`);
  lines.push("");
  if (profile.metadata?.url) {
    lines.push(`**URL:** ${profile.metadata.url}`);
  }
  lines.push(`**Completeness:** ${Math.round((profile.completeness ?? 0) * 100)}%`);
  lines.push(`**Overall Confidence:** ${Math.round((profile.overallConfidence ?? 0) * 100)}%`);
  lines.push(`**Schema Version:** ${profile.basesignal_version ?? "1.0"}`);
  lines.push("");

  // Core Identity
  lines.push("## Core Identity");
  lines.push("");
  if (profile.identity) {
    const id = profile.identity;
    lines.push(`**Description:** ${id.description}`);
    lines.push(`**Target Customer:** ${id.targetCustomer}`);
    lines.push(`**Business Model:** ${id.businessModel}`);
    if (id.industry) lines.push(`**Industry:** ${id.industry}`);
    if (id.companyStage) lines.push(`**Company Stage:** ${id.companyStage}`);
    lines.push(`**Confidence:** ${Math.round(id.confidence * 100)}%`);
    appendEvidence(lines, id.evidence);
  } else {
    lines.push("*Not yet analyzed.*");
  }
  lines.push("");

  // Revenue Architecture
  lines.push("## Revenue Architecture");
  lines.push("");
  if (profile.revenue) {
    const rev = profile.revenue;
    lines.push(`**Model:** ${rev.model}`);
    if (rev.billingUnit) lines.push(`**Billing Unit:** ${rev.billingUnit}`);
    lines.push(`**Free Tier:** ${rev.hasFreeTier ? "Yes" : "No"}`);
    if (rev.tiers.length > 0) {
      lines.push("");
      lines.push("### Pricing Tiers");
      lines.push("");
      for (const tier of rev.tiers) {
        lines.push(`- **${tier.name}** (${tier.price}): ${tier.features.join(", ")}`);
      }
    }
    if (rev.expansionPaths.length > 0) {
      lines.push("");
      lines.push("**Expansion Paths:** " + rev.expansionPaths.join(", "));
    }
    if (rev.contractionRisks.length > 0) {
      lines.push("**Contraction Risks:** " + rev.contractionRisks.join(", "));
    }
    lines.push(`**Confidence:** ${Math.round(rev.confidence * 100)}%`);
    appendEvidence(lines, rev.evidence);
  } else {
    lines.push("*Not yet analyzed.*");
  }
  lines.push("");

  // Entity Model
  lines.push("## Entity Model");
  lines.push("");
  if (profile.entities) {
    const ent = profile.entities;
    for (const item of ent.items) {
      lines.push(`- **${item.name}** (${item.type}): ${item.properties.join(", ")}`);
    }
    if (ent.relationships.length > 0) {
      lines.push("");
      lines.push("### Relationships");
      lines.push("");
      for (const rel of ent.relationships) {
        lines.push(`- ${rel.from} --[${rel.type}]--> ${rel.to}`);
      }
    }
    lines.push(`**Confidence:** ${Math.round(ent.confidence * 100)}%`);
    appendEvidence(lines, ent.evidence);
  } else {
    lines.push("*Not yet analyzed.*");
  }
  lines.push("");

  // Journey Stages
  lines.push("## Journey");
  lines.push("");
  if (profile.journey) {
    const j = profile.journey;
    const sorted = [...j.stages].sort((a, b) => a.order - b.order);
    for (const stage of sorted) {
      lines.push(`${stage.order}. **${stage.name}** - ${stage.description}`);
    }
    lines.push(`**Confidence:** ${Math.round(j.confidence * 100)}%`);
    appendEvidence(lines, j.evidence);
  } else {
    lines.push("*Not yet analyzed.*");
  }
  lines.push("");

  // Definitions
  lines.push("## Definitions");
  lines.push("");
  if (profile.definitions) {
    const defs = profile.definitions;
    for (const [key, label] of [
      ["activation", "Activation"],
      ["firstValue", "First Value"],
      ["active", "Active User"],
      ["atRisk", "At Risk"],
      ["churn", "Churn"],
    ] as const) {
      const def = defs[key];
      if (def) {
        lines.push(`### ${label}`);
        lines.push("");
        // Handle multi-level activation format
        if ("levels" in def) {
          for (const level of def.levels) {
            lines.push(`**Level ${level.level}: ${level.name}** (${level.signalStrength} signal)`);
            for (const c of level.criteria) {
              lines.push(`  - ${c.action} (x${c.count}${c.timeWindow ? ` in ${c.timeWindow}` : ""})`);
            }
            lines.push(`  Confidence: ${Math.round(level.confidence * 100)}%`);
          }
          lines.push(`**Overall Confidence:** ${Math.round(def.overallConfidence * 100)}%`);
        } else {
          // Legacy flat format
          lines.push(`**Criteria:** ${def.criteria.join(", ")}`);
          if ("timeWindow" in def && def.timeWindow) {
            lines.push(`**Time Window:** ${def.timeWindow}`);
          }
          if ("description" in def && def.description) {
            lines.push(`**Description:** ${def.description}`);
          }
          lines.push(`**Reasoning:** ${def.reasoning}`);
          lines.push(`**Confidence:** ${Math.round(def.confidence * 100)}%`);
          lines.push(`**Source:** ${def.source}`);
          appendEvidence(lines, def.evidence);
        }
        lines.push("");
      }
    }
    // Check if all definitions are missing
    const hasAny = ["activation", "firstValue", "active", "atRisk", "churn"].some(
      (k) => defs[k as keyof typeof defs]
    );
    if (!hasAny) {
      lines.push("*No definitions yet.*");
      lines.push("");
    }
  } else {
    lines.push("*Not yet analyzed.*");
    lines.push("");
  }

  // Outcomes
  lines.push("## Outcomes");
  lines.push("");
  if (profile.outcomes) {
    for (const item of profile.outcomes.items) {
      lines.push(`- **${item.description}** (${item.type}) - linked to: ${item.linkedFeatures.join(", ")}`);
    }
    lines.push(`**Confidence:** ${Math.round(profile.outcomes.confidence * 100)}%`);
    appendEvidence(lines, profile.outcomes.evidence);
  } else {
    lines.push("*Not yet analyzed.*");
  }
  lines.push("");

  // Metrics
  lines.push("## Metrics");
  lines.push("");
  if (profile.metrics) {
    for (const item of profile.metrics.items) {
      const parts = [`**${item.name}** (${item.category})`];
      if (item.formula) parts.push(`Formula: ${item.formula}`);
      if (item.linkedTo.length > 0) parts.push(`Linked to: ${item.linkedTo.join(", ")}`);
      lines.push(`- ${parts.join(" | ")}`);
    }
    lines.push(`**Confidence:** ${Math.round(profile.metrics.confidence * 100)}%`);
    appendEvidence(lines, profile.metrics.evidence);
  } else {
    lines.push("*Not yet analyzed.*");
  }
  lines.push("");

  // Footer
  lines.push("---");
  lines.push(`*Exported from Basesignal on ${new Date().toISOString().split("T")[0]}*`);

  return lines.join("\n");
}

/** Append evidence sources as a collapsible detail block. */
function appendEvidence(
  lines: string[],
  evidence: Array<{ url: string; excerpt: string }> | undefined
): void {
  if (!evidence || evidence.length === 0) return;
  lines.push("");
  lines.push("<details><summary>Evidence</summary>");
  lines.push("");
  for (const e of evidence) {
    lines.push(`- [${e.url}](${e.url}): "${e.excerpt}"`);
  }
  lines.push("");
  lines.push("</details>");
}
```

The Markdown template follows the same section order as the Convex schema and the ProductProfilePage UI tabs. Each section shows:
1. The structured data in a readable format
2. The confidence score
3. Evidence sources in a collapsible `<details>` block (so they don't overwhelm the document)

Missing sections print "*Not yet analyzed.*" rather than being omitted. This makes incomplete profiles honest about their gaps.

### Package Structure

```
packages/core/src/
  export.ts              # exportProfileAsJson(), exportProfileAsMarkdown()
  export.test.ts         # Tests for both format functions

packages/mcp-server/src/tools/
  export.ts              # registerExportTool() - thin handler
  export.test.ts         # Tests for tool registration and error handling
```

### Test Plan

#### Core export tests (packages/core/src/export.test.ts)

```typescript
// 1. JSON export includes basesignal_version
test("exportProfileAsJson includes basesignal_version", () => {
  const json = exportProfileAsJson(fullProfile);
  const parsed = JSON.parse(json);
  expect(parsed.basesignal_version).toBe("1.0");
});

// 2. JSON export is valid JSON that roundtrips
test("exportProfileAsJson produces valid parseable JSON", () => {
  const json = exportProfileAsJson(fullProfile);
  expect(() => JSON.parse(json)).not.toThrow();
});

// 3. Markdown includes all populated sections
test("exportProfileAsMarkdown includes all sections for full profile", () => {
  const md = exportProfileAsMarkdown(fullProfile);
  expect(md).toContain("## Core Identity");
  expect(md).toContain("## Revenue Architecture");
  expect(md).toContain("## Entity Model");
  expect(md).toContain("## Journey");
  expect(md).toContain("## Definitions");
  expect(md).toContain("## Outcomes");
  expect(md).toContain("## Metrics");
});

// 4. Markdown shows confidence scores
test("exportProfileAsMarkdown shows confidence per section", () => {
  const md = exportProfileAsMarkdown(fullProfile);
  expect(md).toMatch(/\*\*Confidence:\*\* \d+%/);
});

// 5. Markdown includes evidence
test("exportProfileAsMarkdown includes evidence sources", () => {
  const md = exportProfileAsMarkdown(fullProfile);
  expect(md).toContain("<details><summary>Evidence</summary>");
});

// 6. Partial profile: missing sections show placeholder
test("exportProfileAsMarkdown handles partial profiles gracefully", () => {
  const partial = { completeness: 0.3, overallConfidence: 0.5 };
  const md = exportProfileAsMarkdown(partial as ProductProfile);
  expect(md).toContain("*Not yet analyzed.*");
  expect(md).not.toContain("undefined");
  expect(md).not.toContain("null");
});

// 7. Empty profile does not throw
test("exportProfileAsMarkdown handles empty profile", () => {
  const empty = { completeness: 0, overallConfidence: 0 };
  expect(() => exportProfileAsMarkdown(empty as ProductProfile)).not.toThrow();
});

// 8. Multi-level activation format renders correctly
test("exportProfileAsMarkdown renders multi-level activation definitions", () => {
  const md = exportProfileAsMarkdown(profileWithMultiLevelActivation);
  expect(md).toContain("Level 1:");
  expect(md).toContain("signal");
});
```

#### MCP tool tests (packages/mcp-server/src/tools/export.test.ts)

```typescript
// 1. Tool accepts { productId, format: 'markdown' }
// 2. Tool accepts { productId, format: 'json' }
// 3. Returns isError: true when product not found
// 4. Returns markdown string for format: 'markdown'
// 5. Returns valid JSON string for format: 'json'
```

## Key Decisions

1. **Two formats, not three.** JSON and Markdown cover all realistic use cases. JSON for programmatic consumption (import into other tools, validate against schema). Markdown for human reading (paste into docs, share in Slack, display in AI conversations). CSV is fundamentally wrong for nested documents.

2. **Inline response, not file output.** MCP tools return text content to the AI assistant. The assistant can then display it, save it, or transform it. File writing introduces permissions, path resolution, and OS-specific concerns that belong in the CLI (a separate story), not in the MCP tool.

3. **No template system.** A single hardcoded template function is simpler to test, debug, and maintain than a template engine with partials and conditionals. The template changes when the schema changes -- they are coupled by design, and coupling by design is acceptable.

4. **No section filtering.** The full profile export is small enough (a few KB of JSON, a few hundred lines of Markdown) that always exporting everything is the right default. The AI assistant can excerpt what it needs from the full output. Adding a `sections` parameter doubles the test surface for no real user benefit.

5. **Formatting logic in @basesignal/core.** The MCP tool handler should be a thin wrapper. The formatting functions are pure and reusable -- the CLI export command (future story) will call the same functions. This keeps the MCP server package focused on tool registration and handler wiring.

6. **Evidence in collapsible blocks.** Evidence URLs and excerpts are valuable for provenance but noisy for quick reading. HTML `<details>` tags work in GitHub, Notion, and most Markdown renderers. They degrade gracefully to visible text in renderers that do not support them.

7. **"Not yet analyzed" over omission.** When a section is missing from a partial profile, the Markdown export says "*Not yet analyzed.*" rather than skipping the heading entirely. This makes the profile structure visible even when incomplete, and helps users understand what a full profile looks like.

## What This Does NOT Do

- **No file export.** The tool returns text inline. File writing is a CLI concern (M008-E005).
- **No CSV format.** ProductProfile is a nested document, not tabular data.
- **No template engine.** The Markdown format is hardcoded. No Handlebars, no Mustache, no EJS.
- **No section filtering.** Always exports the full profile.
- **No format detection.** The user must specify `format` explicitly. No auto-detection from file extension or content negotiation.
- **No streaming.** Profile export is fast enough to return synchronously. No need for progress notifications.

## Verification Steps

1. `exportProfileAsJson(fullProfile)` produces valid JSON with `basesignal_version`
2. `JSON.parse(exportProfileAsJson(profile))` roundtrips without data loss
3. `exportProfileAsMarkdown(fullProfile)` contains all section headings
4. `exportProfileAsMarkdown(fullProfile)` contains confidence scores for each section
5. `exportProfileAsMarkdown(fullProfile)` contains evidence in collapsible blocks
6. `exportProfileAsMarkdown(partialProfile)` shows "*Not yet analyzed.*" for missing sections
7. `exportProfileAsMarkdown(emptyProfile)` does not throw
8. MCP tool returns `isError: true` when product ID is not found
9. MCP tool returns markdown text when format is `markdown`
10. MCP tool returns JSON text when format is `json`

## Success Criteria

- `export_profile` tool is registered and accepts `{ productId, format: 'markdown' | 'json' }`
- Markdown export produces a well-structured document with sections for each profile area
- JSON export produces a valid ProductProfile JSON matching the schema (with `basesignal_version`)
- Markdown includes confidence scores and evidence sources for each section
- Export works for partial profiles (missing sections are noted, not errored)
- Formatting logic lives in `packages/core/src/export.ts`, not in the MCP server
- All tests pass
