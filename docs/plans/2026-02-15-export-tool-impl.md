# Implementation Plan: export_profile MCP Tool

**Task:** basesignal-rom (M008-E002-S005)
**Design:** docs/plans/2026-02-15-export-tool-design.md

## Context

Implement an `export_profile` MCP tool that exports a stored ProductProfile as markdown or JSON. The design doc calls for formatting logic in `packages/core/src/export.ts`, but the `packages/` monorepo structure does not exist yet (M008-E001-S001 is still in `ready` status). This plan adapts the design to the current codebase structure, placing shared formatting logic in `server/lib/export.ts` with a clear migration path to `packages/core/` when the monorepo is set up.

The existing MCP server lives in `server/`, tools are registered in `server/tools/`, and all tools currently go through Convex via `getConvexClient()` with user authentication via `withUser`/`withUserArgs`.

## Approach

Three files, one Convex query, and tests:

1. **`convex/mcpProducts.ts`** -- add a `getProfile` query that returns the full profile for a product (userId-scoped)
2. **`server/lib/export.ts`** -- pure formatting functions (`exportProfileAsJson`, `exportProfileAsMarkdown`) with no dependencies on MCP, Convex, or auth
3. **`server/tools/export.ts`** -- thin MCP tool handler that loads the profile via Convex and delegates to the formatting functions
4. **`server/tools/index.ts`** -- wire up the new tool
5. **Tests** for all layers

## Implementation Steps

### Step 1: Add `getProfile` query to `convex/mcpProducts.ts`

Add a new query at the bottom of the file. This mirrors the existing `list` and `getScanStatus` patterns: accept `userId` + `productId`, verify ownership, return the profile.

```typescript
export const getProfile = query({
  args: {
    userId: v.id("users"),
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product || product.userId !== args.userId) return null;

    return await ctx.db
      .query("productProfiles")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .first();
  },
});
```

**File:** `convex/mcpProducts.ts`
**After:** the `getScanStatus` export (end of file)
**Tests:** Add to `convex/mcpProducts.test.ts` -- test it returns a profile, returns null for wrong user, returns null for missing profile.

### Step 2: Create `server/lib/export.ts` -- pure formatting functions

This file contains two pure functions. No imports from Convex, MCP, or auth. The functions accept a plain object (the profile document from Convex) and return a string.

The design doc provides the complete implementation. Adapt it to use the Convex document shape (which has no `basesignal_version` field yet -- default to `"1.0"`, and no `metadata` sub-object -- use `identity.productName` for the product name).

```typescript
// server/lib/export.ts

/**
 * Pure formatting functions for product profile export.
 * No MCP, Convex, or auth dependencies.
 *
 * When packages/core/ is created (M008-E001-S001), move this file there.
 */

/**
 * Export a product profile as a formatted JSON string.
 * Includes basesignal_version for forward compatibility.
 */
export function exportProfileAsJson(profile: Record<string, unknown>): string {
  return JSON.stringify(
    {
      basesignal_version: "1.0",
      ...profile,
    },
    null,
    2
  );
}

/**
 * Export a product profile as a readable Markdown document.
 * Missing sections show "*Not yet analyzed.*" rather than being omitted.
 */
export function exportProfileAsMarkdown(profile: Record<string, unknown>): string {
  const lines: string[] = [];

  // Header
  const identity = profile.identity as Record<string, unknown> | undefined;
  const name = (identity?.productName as string) ?? "Unknown Product";
  lines.push(`# ${name} - Product Profile`);
  lines.push("");
  lines.push(`**Completeness:** ${Math.round(((profile.completeness as number) ?? 0) * 100)}%`);
  lines.push(`**Overall Confidence:** ${Math.round(((profile.overallConfidence as number) ?? 0) * 100)}%`);
  lines.push(`**Schema Version:** 1.0`);
  lines.push("");

  // Core Identity
  lines.push("## Core Identity");
  lines.push("");
  if (identity) {
    lines.push(`**Description:** ${identity.description}`);
    lines.push(`**Target Customer:** ${identity.targetCustomer}`);
    lines.push(`**Business Model:** ${identity.businessModel}`);
    if (identity.industry) lines.push(`**Industry:** ${identity.industry}`);
    if (identity.companyStage) lines.push(`**Company Stage:** ${identity.companyStage}`);
    lines.push(`**Confidence:** ${Math.round((identity.confidence as number) * 100)}%`);
    appendEvidence(lines, identity.evidence as Evidence[] | undefined);
  } else {
    lines.push("*Not yet analyzed.*");
  }
  lines.push("");

  // Revenue Architecture section
  // ... (follow design doc pattern for revenue, entities, journey, definitions, outcomes, metrics)

  // Footer
  lines.push("---");
  lines.push(`*Exported from Basesignal on ${new Date().toISOString().split("T")[0]}*`);

  return lines.join("\n");
}
```

The full implementation follows the design doc's `exportProfileAsMarkdown` function exactly, adapted for the `Record<string, unknown>` type instead of `ProductProfile` (since the core types package does not exist yet). Each section (Revenue Architecture, Entity Model, Journey, Definitions, Outcomes, Metrics) follows the same pattern from the design doc.

The `appendEvidence` helper renders evidence in collapsible `<details>` blocks.

**Key type adaptation:** The design doc uses `ProductProfile` from `@basesignal/core`. Since that package does not exist yet, use `Record<string, unknown>` with runtime type narrowing. Add a `// TODO: Replace with ProductProfile from @basesignal/core when M008-E001-S002 lands` comment. This keeps the function body identical to the design doc -- only the parameter type changes.

**File:** `server/lib/export.ts` (new file)
**Dependencies:** None (pure functions)

### Step 3: Create `server/tools/export.ts` -- MCP tool handler

Thin wrapper that loads the profile via Convex and delegates to the formatting functions.

```typescript
// server/tools/export.ts

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withUserArgs } from "../lib/withUser.js";
import { getConvexClient } from "../lib/convex.js";
import { api } from "../../convex/_generated/api.js";
import { exportProfileAsJson, exportProfileAsMarkdown } from "../lib/export.js";

export function registerExportTool(server: McpServer) {
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
            description:
              "Export format: 'markdown' for readable document, 'json' for structured data",
          },
        },
        required: ["productId", "format"],
      },
    },
    withUserArgs(
      async (user, args: { productId: string; format: "markdown" | "json" }) => {
        const client = getConvexClient();
        const profile = await client.query(api.mcpProducts.getProfile, {
          userId: user._id as any,
          productId: args.productId as any,
        });

        if (!profile) {
          return {
            content: [
              { type: "text" as const, text: "Product not found or no profile exists yet. Run a scan first." },
            ],
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
    )
  );
}
```

**File:** `server/tools/export.ts` (new file)

### Step 4: Wire up in `server/tools/index.ts`

Add the import and registration call:

```typescript
import { registerExportTool } from "./export.js";

export function registerTools(server: McpServer) {
  registerPingTool(server);
  registerProductTools(server);
  registerExportTool(server);
}
```

**File:** `server/tools/index.ts`

### Step 5: Tests -- `server/lib/export.test.ts`

Test the pure formatting functions. These tests have zero external dependencies.

```typescript
// server/lib/export.test.ts

import { describe, it, expect } from "vitest";
import { exportProfileAsJson, exportProfileAsMarkdown } from "./export.js";

// Fixture: full profile matching the Convex productProfiles schema
const fullProfile = {
  completeness: 0.8,
  overallConfidence: 0.75,
  identity: {
    productName: "Acme Analytics",
    description: "Product analytics for SaaS teams",
    targetCustomer: "Product managers at B2B SaaS companies",
    businessModel: "SaaS subscription",
    industry: "Analytics",
    companyStage: "Growth",
    confidence: 0.9,
    evidence: [{ url: "https://acme.io", excerpt: "Built for product teams" }],
  },
  revenue: {
    model: "subscription",
    billingUnit: "seat",
    hasFreeTier: true,
    tiers: [
      { name: "Free", price: "$0", features: ["5 users", "1 project"] },
      { name: "Pro", price: "$49/mo", features: ["Unlimited users", "10 projects"] },
    ],
    expansionPaths: ["seat expansion", "plan upgrade"],
    contractionRisks: ["seat reduction"],
    confidence: 0.85,
    evidence: [{ url: "https://acme.io/pricing", excerpt: "Starting at $0" }],
  },
  entities: {
    items: [
      { name: "User", type: "actor", properties: ["email", "role"] },
      { name: "Project", type: "resource", properties: ["name", "status"] },
    ],
    relationships: [{ from: "User", to: "Project", type: "owns" }],
    confidence: 0.8,
    evidence: [],
  },
  journey: {
    stages: [
      { name: "Sign Up", description: "Create account", order: 1 },
      { name: "Setup", description: "Configure first project", order: 2 },
      { name: "First Insight", description: "See first analytics", order: 3 },
    ],
    confidence: 0.7,
    evidence: [],
  },
  definitions: {
    activation: {
      levels: [
        {
          level: 1,
          name: "Basic Setup",
          signalStrength: "weak",
          criteria: [{ action: "create_project", count: 1 }],
          reasoning: "Minimum engagement",
          confidence: 0.7,
          evidence: [],
        },
        {
          level: 2,
          name: "First Insight",
          signalStrength: "strong",
          criteria: [
            { action: "view_dashboard", count: 3, timeWindow: "7d" },
          ],
          reasoning: "Shows repeated value",
          confidence: 0.8,
          evidence: [],
        },
      ],
      primaryActivation: 2,
      overallConfidence: 0.75,
    },
    active: {
      criteria: ["Login 3+ times per week", "View dashboard"],
      timeWindow: "7 days",
      reasoning: "Regular engagement pattern",
      confidence: 0.8,
      source: "usage patterns",
      evidence: [],
    },
  },
  outcomes: {
    items: [
      {
        description: "Data-driven decisions",
        type: "business",
        linkedFeatures: ["dashboard", "reports"],
      },
    ],
    confidence: 0.7,
    evidence: [],
  },
  metrics: {
    items: [
      {
        name: "Weekly Active Users",
        category: "engagement",
        formula: "count(distinct users with session in 7d)",
        linkedTo: ["active definition"],
      },
    ],
    confidence: 0.75,
    evidence: [],
  },
};

describe("exportProfileAsJson", () => {
  it("produces valid parseable JSON", () => {
    const json = exportProfileAsJson(fullProfile);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("includes basesignal_version", () => {
    const json = exportProfileAsJson(fullProfile);
    const parsed = JSON.parse(json);
    expect(parsed.basesignal_version).toBe("1.0");
  });

  it("preserves all profile data", () => {
    const json = exportProfileAsJson(fullProfile);
    const parsed = JSON.parse(json);
    expect(parsed.identity.productName).toBe("Acme Analytics");
    expect(parsed.revenue.tiers).toHaveLength(2);
  });
});

describe("exportProfileAsMarkdown", () => {
  it("includes all section headings for full profile", () => {
    const md = exportProfileAsMarkdown(fullProfile);
    expect(md).toContain("## Core Identity");
    expect(md).toContain("## Revenue Architecture");
    expect(md).toContain("## Entity Model");
    expect(md).toContain("## Journey");
    expect(md).toContain("## Definitions");
    expect(md).toContain("## Outcomes");
    expect(md).toContain("## Metrics");
  });

  it("shows product name in title", () => {
    const md = exportProfileAsMarkdown(fullProfile);
    expect(md).toContain("# Acme Analytics - Product Profile");
  });

  it("shows confidence scores", () => {
    const md = exportProfileAsMarkdown(fullProfile);
    expect(md).toMatch(/\*\*Confidence:\*\* \d+%/);
  });

  it("includes evidence in collapsible blocks", () => {
    const md = exportProfileAsMarkdown(fullProfile);
    expect(md).toContain("<details><summary>Evidence</summary>");
    expect(md).toContain("https://acme.io");
  });

  it("renders multi-level activation definitions", () => {
    const md = exportProfileAsMarkdown(fullProfile);
    expect(md).toContain("Level 1:");
    expect(md).toContain("Level 2:");
    expect(md).toContain("signal");
  });

  it("handles partial profiles gracefully", () => {
    const partial = { completeness: 0.3, overallConfidence: 0.5 };
    const md = exportProfileAsMarkdown(partial);
    expect(md).toContain("*Not yet analyzed.*");
    expect(md).not.toContain("undefined");
    expect(md).not.toContain("null");
  });

  it("handles empty profile without throwing", () => {
    const empty = { completeness: 0, overallConfidence: 0 };
    expect(() => exportProfileAsMarkdown(empty)).not.toThrow();
  });

  it("includes footer with export date", () => {
    const md = exportProfileAsMarkdown(fullProfile);
    expect(md).toContain("Exported from Basesignal on");
  });
});
```

**File:** `server/lib/export.test.ts` (new file)

### Step 6: Tests -- `server/tools/export.test.ts`

Test tool registration and metadata. Follows the existing pattern from `ping.test.ts` and `products.test.ts`.

```typescript
// server/tools/export.test.ts

import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./index.js";

describe("export_profile tool", () => {
  function getRegisteredTools() {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerTools(server);
    return (server as any)._registeredTools;
  }

  it("registers export_profile tool", () => {
    const tools = getRegisteredTools();
    expect(Object.keys(tools)).toContain("export_profile");
  });

  it("has correct description", () => {
    const tools = getRegisteredTools();
    expect(tools["export_profile"].description).toContain("Export a product profile");
  });

  it("total tool count is correct", () => {
    const tools = getRegisteredTools();
    // ping + create_product + list_products + scan_product + get_scan_status + export_profile = 6
    expect(Object.keys(tools)).toHaveLength(6);
  });
});
```

**File:** `server/tools/export.test.ts` (new file)

**Important:** Update the existing test in `server/tools/products.test.ts` that asserts `toHaveLength(5)` to expect 6 tools instead.

### Step 7: Tests -- `convex/mcpProducts.test.ts`

Add tests for the new `getProfile` query:

```typescript
it("can get profile for a product", async () => {
  const t = convexTest(schema);
  const userId = await setupUser(t);

  const { productId } = await t.mutation(api.mcpProducts.create, {
    userId,
    name: "Acme",
    url: "https://acme.io",
  });

  // Create a profile for the product
  await t.run(async (ctx) => {
    await ctx.db.insert("productProfiles", {
      productId,
      completeness: 0.5,
      overallConfidence: 0.6,
      identity: {
        productName: "Acme",
        description: "Analytics tool",
        targetCustomer: "PMs",
        businessModel: "SaaS",
        confidence: 0.8,
        evidence: [],
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  const profile = await t.query(api.mcpProducts.getProfile, {
    userId,
    productId,
  });

  expect(profile).not.toBeNull();
  expect(profile!.completeness).toBe(0.5);
  expect(profile!.identity?.productName).toBe("Acme");
});

it("returns null profile for wrong user", async () => {
  const t = convexTest(schema);
  const userId = await setupUser(t);

  const { productId } = await t.mutation(api.mcpProducts.create, {
    userId,
    name: "Acme",
    url: "https://acme.io",
  });

  const otherUserId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: "other-clerk-id",
      email: "other@example.com",
      createdAt: Date.now(),
    });
  });

  const profile = await t.query(api.mcpProducts.getProfile, {
    userId: otherUserId,
    productId,
  });

  expect(profile).toBeNull();
});

it("returns null when no profile exists", async () => {
  const t = convexTest(schema);
  const userId = await setupUser(t);

  const { productId } = await t.mutation(api.mcpProducts.create, {
    userId,
    name: "Acme",
    url: "https://acme.io",
  });

  const profile = await t.query(api.mcpProducts.getProfile, {
    userId,
    productId,
  });

  expect(profile).toBeNull();
});
```

**File:** `convex/mcpProducts.test.ts` (append to existing describe block)

## File Manifest

| File | Action | Description |
|------|--------|-------------|
| `convex/mcpProducts.ts` | Edit | Add `getProfile` query |
| `convex/mcpProducts.test.ts` | Edit | Add 3 tests for `getProfile` |
| `server/lib/export.ts` | Create | Pure formatting functions (`exportProfileAsJson`, `exportProfileAsMarkdown`, `appendEvidence`) |
| `server/lib/export.test.ts` | Create | 8 tests for formatting functions |
| `server/tools/export.ts` | Create | MCP `export_profile` tool handler |
| `server/tools/export.test.ts` | Create | 3 tests for tool registration |
| `server/tools/index.ts` | Edit | Import and register `registerExportTool` |
| `server/tools/products.test.ts` | Edit | Update tool count assertion from 5 to 6 |

## Verification

After implementation, run:

```bash
npm test -- --run server/lib/export.test.ts
npm test -- --run server/tools/export.test.ts
npm test -- --run convex/mcpProducts.test.ts
npm test -- --run server/tools/products.test.ts
```

All tests should pass. Then run the full suite:

```bash
npm run test:run
```

## Migration Notes

When M008-E001-S001 (monorepo workspace setup) and M008-E001-S002 (type extraction) are implemented:

1. Move `server/lib/export.ts` to `packages/core/src/export.ts`
2. Replace `Record<string, unknown>` parameter types with `ProductProfile` from `@basesignal/core`
3. Update the import in `server/tools/export.ts` to point to `@basesignal/core`
4. Move tests accordingly

The function bodies should require zero changes -- only the import paths and parameter types change.
