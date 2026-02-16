# Implementation Plan: Profile Retrieval and Refinement MCP Tools

**Story:** M008-E002-S004
**Design:** [2026-02-15-profile-tools-design.md](./2026-02-15-profile-tools-design.md)
**Date:** 2026-02-15

## Prerequisites

This story depends on two packages that do not yet exist:

- **M008-E002-S001** (`packages/mcp-server/`): MCP server skeleton with `createServer()`, `ToolContext`, `registerTools()`, and `ping` tool. Provides `ServerConfig`, `StorageAdapter` (initially empty interface), and `ToolContext` types.
- **M008-E004-S001** (`packages/storage/`): `StorageAdapter` interface with `save()`, `load()`, `list()`, `delete()`, `search()`, `close()`. Also exports `ProfileSummary` type with `{ id, name, url, completeness, updatedAt }`.

Additionally, the `@basesignal/core` package (M008-E001-S002 / S003) provides `ProductProfile` types and zod validation schemas. This plan assumes those packages exist at implementation time. If they do not, stub the minimal types needed and refine when the dependencies land.

## Task Breakdown

### Task 1: Create `formatters.ts` -- pure markdown formatting functions

**File:** `packages/mcp-server/src/tools/formatters.ts`

**What:** A module of pure functions that transform profile data into human-readable markdown. These have no side effects, no storage dependency, and are trivially testable.

**Functions to implement:**

```typescript
export function formatRelativeTime(timestamp: number): string
```
Simple relative time formatter (e.g., "2 hours ago", "3 days ago"). Use manual calculation against `Date.now()` -- no `date-fns` dependency in the mcp-server package. Thresholds: seconds, minutes, hours, days, weeks. Beyond 30 days, show ISO date.

```typescript
export function formatProfileOverview(profile: ProductProfile): string
```
Renders the full profile as a markdown document. Structure:
- `## {productName} -- Product Profile`
- `**Completeness:** {n}% | **Confidence:** {n}%`
- Each populated section gets a `### Section` heading with key fields
- Identity: productName, targetCustomer, businessModel, confidence
- Revenue: model, hasFreeTier, tier names, confidence
- Entities: count of items, count of relationships, confidence
- Journey: stage names in order, confidence
- Definitions: each definition type (activation, firstValue, active, atRisk, churn) with details
  - Activation has special formatting: if multi-level, render a markdown table of levels
- Outcomes: count of items, confidence
- Metrics: count of items, confidence
- Missing sections listed under `### Missing Sections`

```typescript
export function formatSection(type: string, data: unknown): string
```
Renders a single section as detailed markdown, including all fields and evidence. Dispatches to type-specific sub-formatters. For definitions, includes the evidence table. For top-level sections, includes evidence + confidence.

```typescript
export function formatEvidence(evidence: Array<{url: string; excerpt: string}>): string
```
Renders evidence as a markdown table: `| URL | Excerpt |` with rows. Returns empty string if no evidence.

```typescript
export function formatActivation(data: unknown): string
```
Special formatter for activation definitions. Handles both legacy format (flat criteria array) and multi-level format (levels array with signal strength, criteria objects). For multi-level, renders the table from the design doc.

```typescript
export function formatCompletenessChange(before: number, after: number): string
```
Returns e.g., `Completeness: 70% -> 80%` or `Completeness: 80% (unchanged)`.

**Tests:** `packages/mcp-server/src/tools/formatters.test.ts`
- `formatRelativeTime`: timestamps for just now, minutes ago, hours ago, days ago, old date
- `formatProfileOverview`: full profile, partial profile (missing sections), empty profile
- `formatSection`: each section type, empty section
- `formatEvidence`: with evidence, empty array
- `formatActivation`: legacy format, multi-level format
- `formatCompletenessChange`: increase, decrease, no change

**Estimated lines:** ~200 implementation, ~150 tests

---

### Task 2: Create `resolveProduct.ts` -- shared product auto-resolution helper

**File:** `packages/mcp-server/src/tools/resolveProduct.ts`

**What:** A helper function that implements the "auto-resolve product" pattern used by `get_profile`, `get_definition`, and `update_definition`. This avoids duplicating the resolution logic in three places.

```typescript
import type { StorageAdapter, ProductProfile } from "../types.js";

interface ResolveResult {
  success: true;
  profile: ProductProfile;
  id: string;
} | {
  success: false;
  error: string;
}

export async function resolveProduct(
  storage: StorageAdapter,
  productId?: string
): Promise<ResolveResult>
```

**Logic:**
1. If `productId` is provided, call `storage.load(productId)`. If null, return error: `"No product found with ID '{id}'. Use list_products to see available products."`
2. If `productId` is omitted, call `storage.list()`:
   - Zero products: error `"No products found. Use scan_product to analyze a website first."`
   - Exactly one: `storage.load(summaries[0].id)` and return it
   - Multiple: error listing available products: `"You have N products. Please specify a productId:\n- **{name}** ({url}) -- ID: {id}\n..."`

**Tests:** `packages/mcp-server/src/tools/resolveProduct.test.ts`
- Resolves by explicit ID
- Error on invalid ID
- Auto-resolves single product
- Error on zero products
- Error on multiple products (shows list)

**Estimated lines:** ~40 implementation, ~80 tests

---

### Task 3: Create `listProducts.ts` -- `list_products` tool handler

**File:** `packages/mcp-server/src/tools/listProducts.ts`

**What:** The `list_products` MCP tool. No arguments. Returns markdown list of all products.

**Structure:**
```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDeps } from "./types.js";

export const listProductsMeta = {
  title: "List Products",
  description: "List all your product profiles with completeness status.",
};

export function handleListProducts(deps: ToolDeps) {
  return async () => {
    const products = await deps.storage.list();
    // ... format and return
  };
}

export function registerListProductsTool(server: McpServer, deps: ToolDeps) {
  server.registerTool("list_products", listProductsMeta, handleListProducts(deps));
}
```

**Handler behavior:**
- Calls `storage.list()` to get `ProfileSummary[]`
- If empty: return text `"No products found. Use scan_product to analyze a website first."`
- Otherwise: render markdown list with name (bold), URL, completeness %, and relative time since updated
- Return `{ content: [{ type: "text", text: markdownOutput }] }`

**Note on `overallConfidence`:** The design doc shows confidence in the list output, but `ProfileSummary` from the storage interface only has `{ id, name, url, completeness, updatedAt }` -- no `overallConfidence`. Two options: (a) load full profiles to get confidence, or (b) omit confidence from the list view. Choose (b) for now -- `list_products` is for orientation, not detailed analysis. Confidence is visible in `get_profile`. If the `ProfileSummary` type later gains `overallConfidence`, add it then.

**Tests:** `packages/mcp-server/src/tools/listProducts.test.ts`
- Registration test: tool is registered with correct name and metadata
- Empty list: returns "No products found" message
- Single product: returns markdown with name, URL, completeness
- Multiple products: returns markdown list with all products
- Output is text, not JSON

**Estimated lines:** ~40 implementation, ~70 tests

---

### Task 4: Create `getProfile.ts` -- `get_profile` tool handler

**File:** `packages/mcp-server/src/tools/getProfile.ts`

**What:** The `get_profile` MCP tool. Optional `productId` argument. Returns full profile as markdown.

**Input schema:**
```typescript
{
  type: "object",
  properties: {
    productId: {
      type: "string",
      description: "Product ID (from list_products). If omitted and only one product exists, uses that one.",
    },
  },
  required: [],
}
```

**Handler behavior:**
1. Call `resolveProduct(deps.storage, args.productId)` from Task 2
2. If resolution fails, return `{ content: [{ type: "text", text: error }], isError: true }`
3. If success, call `formatProfileOverview(profile)` from Task 1
4. Return `{ content: [{ type: "text", text: markdownOutput }] }`

**Tests:** `packages/mcp-server/src/tools/getProfile.test.ts`
- Registration test: correct metadata, optional productId
- Auto-resolve single product: omit productId, one product in storage, returns full profile
- Explicit productId: loads correct product
- Error: multiple products, no productId specified
- Error: no products
- Error: invalid productId
- Output includes all populated sections
- Output lists missing sections

**Estimated lines:** ~50 implementation, ~100 tests

---

### Task 5: Create `getDefinition.ts` -- `get_definition` tool handler

**File:** `packages/mcp-server/src/tools/getDefinition.ts`

**What:** The `get_definition` MCP tool. Requires `type`, optional `productId`. Returns a single section's detailed markdown.

**Input schema:**
```typescript
{
  type: "object",
  properties: {
    productId: {
      type: "string",
      description: "Product ID (from list_products). If omitted, auto-resolves when only one product exists.",
    },
    type: {
      type: "string",
      description: "Section type: activation, firstValue, active, atRisk, churn, identity, revenue, entities, journey, outcomes, or metrics.",
      enum: [
        "activation", "firstValue", "active", "atRisk", "churn",
        "identity", "revenue", "entities", "journey", "outcomes", "metrics",
      ],
    },
  },
  required: ["type"],
}
```

**Handler behavior:**
1. Call `resolveProduct(deps.storage, args.productId)`
2. If resolution fails, return error
3. Determine data location:
   - Definition types (`activation`, `firstValue`, `active`, `atRisk`, `churn`): read from `profile.definitions?.[type]`
   - Top-level types (`identity`, `revenue`, `entities`, `journey`, `outcomes`, `metrics`): read from `profile[type]`
4. If section data is null/undefined: return text `"The {type} definition has not been analyzed yet. Run scan_product first, or provide details and I'll help you define it."`
5. Otherwise: call `formatSection(type, data)` and return the markdown

**Tests:** `packages/mcp-server/src/tools/getDefinition.test.ts`
- Registration test: correct metadata, required `type` param
- Returns activation definition with evidence
- Returns top-level section (identity)
- Returns empty section message for null section
- Auto-resolves product when omitted
- Error on invalid productId
- Each definition type routes correctly (definitions.activation vs profile.identity)
- Multi-level activation format renders correctly

**Estimated lines:** ~60 implementation, ~120 tests

---

### Task 6: Create `updateDefinition.ts` -- `update_definition` tool handler

**File:** `packages/mcp-server/src/tools/updateDefinition.ts`

**What:** The `update_definition` MCP tool. Requires `type` and `data`, optional `productId`. Validates data, saves, and returns confirmation.

**Input schema:**
```typescript
{
  type: "object",
  properties: {
    productId: {
      type: "string",
      description: "Product ID. If omitted, auto-resolves when only one product exists.",
    },
    type: {
      type: "string",
      description: "Section to update.",
      enum: [
        "activation", "firstValue", "active", "atRisk", "churn",
        "identity", "revenue", "entities", "journey", "outcomes", "metrics",
      ],
    },
    data: {
      type: "object",
      description: "The new data for this section. Must match the section's schema.",
    },
  },
  required: ["type", "data"],
}
```

**Handler behavior:**
1. Call `resolveProduct(deps.storage, args.productId)`
2. If resolution fails, return error
3. Validate `args.data` against the zod schema for `args.type` from `@basesignal/core`:
   - Import section-specific schemas (e.g., `identitySchema`, `activationDefinitionSchema`)
   - Call `schema.safeParse(args.data)`
   - If validation fails: return `{ isError: true }` with message `"Validation failed for {type}: {zodErrorMessage}"`
   - Format zod errors into human-readable strings with field paths
4. Record `beforeCompleteness = profile.completeness`
5. Apply the update to the profile:
   - Definition types: `profile.definitions = { ...profile.definitions, [type]: validatedData }`
   - Top-level types: `profile[type] = validatedData`
6. Recalculate completeness and confidence (use the same calculation logic from `productProfiles.ts`, extracted into a shared utility or duplicated simply)
7. Update `profile.updatedAt = Date.now()`
8. Call `storage.save(profile)`
9. Re-read: call `storage.load(id)` to get the saved state
10. Return confirmation markdown:
    - `## Updated: {Type} Definition`
    - Rendered section via `formatSection(type, data)`
    - Completeness change via `formatCompletenessChange(before, after)`

**Validation schema mapping:**

The tool needs a mapping from section type string to zod schema. This should be a simple object:

```typescript
import {
  identitySchema,
  revenueSchema,
  entitiesSchema,
  journeySchema,
  outcomesSchema,
  metricsSchema,
  activationDefinitionSchema,
  firstValueDefinitionSchema,
  activeDefinitionSchema,
  atRiskDefinitionSchema,
  churnDefinitionSchema,
} from "@basesignal/core";

const sectionSchemas: Record<string, ZodSchema> = {
  identity: identitySchema,
  revenue: revenueSchema,
  entities: entitiesSchema,
  journey: journeySchema,
  outcomes: outcomesSchema,
  metrics: metricsSchema,
  activation: activationDefinitionSchema,
  firstValue: firstValueDefinitionSchema,
  active: activeDefinitionSchema,
  atRisk: atRiskDefinitionSchema,
  churn: churnDefinitionSchema,
};
```

If `@basesignal/core` does not export individual section schemas yet (M008-E001-S003 may not be implemented), create minimal inline zod schemas matching the Convex validators from `convex/schema.ts` as a temporary measure. Mark with a `// TODO: import from @basesignal/core when available` comment.

**Tests:** `packages/mcp-server/src/tools/updateDefinition.test.ts`
- Registration test: correct metadata, required `type` and `data` params
- Valid update saves and returns confirmation markdown
- Completeness change shown in output (e.g., 60% -> 70%)
- Invalid data returns validation error with field path
- Missing required fields in data returns clear error
- Auto-resolves product when omitted
- Error on invalid productId
- Definition type writes to `definitions.{type}`
- Top-level type writes directly to `profile.{type}`
- Re-read after save confirms data persisted

**Estimated lines:** ~100 implementation, ~150 tests

---

### Task 7: Create `types.ts` -- shared tool dependency types

**File:** `packages/mcp-server/src/tools/types.ts`

**What:** The `ToolDeps` interface and any shared MCP tool result helpers.

```typescript
import type { StorageAdapter } from "@basesignal/storage";

export interface ToolDeps {
  storage: StorageAdapter;
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export function text(markdown: string): ToolResult {
  return { content: [{ type: "text", text: markdown }] };
}

export function error(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}
```

**Estimated lines:** ~20 implementation, no separate tests (tested through tool tests)

---

### Task 8: Wire tools into registration and update `tools/index.ts`

**File:** `packages/mcp-server/src/tools/index.ts`

**What:** Update the existing `registerTools()` function to also register the four profile tools. Pass `ToolDeps` through from the context.

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPingTool } from "./ping.js";
import { registerListProductsTool } from "./listProducts.js";
import { registerGetProfileTool } from "./getProfile.js";
import { registerGetDefinitionTool } from "./getDefinition.js";
import { registerUpdateDefinitionTool } from "./updateDefinition.js";
import type { ToolContext } from "../types.js";

export function registerTools(server: McpServer, context: ToolContext) {
  registerPingTool(server);

  if (context.storage) {
    const deps = { storage: context.storage };
    registerListProductsTool(server, deps);
    registerGetProfileTool(server, deps);
    registerGetDefinitionTool(server, deps);
    registerUpdateDefinitionTool(server, deps);
  }
}
```

The profile tools only register if a storage adapter is provided. This is consistent with the skeleton design where storage is optional.

**Tests:** Update `packages/mcp-server/src/tools/index.test.ts`
- Without storage: only ping registered
- With storage: all 5 tools registered (ping + 4 profile tools)
- Tool count matches expected (5 with storage)

**Estimated lines:** ~20 implementation, ~40 tests

---

### Task 9: Create mock storage adapter for testing

**File:** `packages/mcp-server/src/tools/__tests__/mockStorage.ts`

**What:** An in-memory `StorageAdapter` implementation used by all tool handler tests. This avoids each test file creating its own mock.

```typescript
import type { StorageAdapter, ProfileSummary, ProductProfile } from "@basesignal/storage";

export class MockStorage implements StorageAdapter {
  private profiles: Map<string, ProductProfile> = new Map();
  private nextId = 1;

  async save(profile: ProductProfile): Promise<string> {
    const id = profile.id ?? `mock-${this.nextId++}`;
    const now = Date.now();
    this.profiles.set(id, {
      ...profile,
      id,
      updatedAt: now,
      createdAt: profile.createdAt ?? now,
    });
    return id;
  }

  async load(id: string): Promise<ProductProfile | null> {
    return this.profiles.get(id) ?? null;
  }

  async list(): Promise<ProfileSummary[]> {
    return Array.from(this.profiles.values()).map((p) => ({
      id: p.id!,
      name: p.identity?.productName ?? "",
      url: p.metadata?.url ?? "",
      completeness: p.completeness ?? 0,
      updatedAt: p.updatedAt ?? 0,
    }));
  }

  async delete(id: string): Promise<boolean> {
    return this.profiles.delete(id);
  }

  async search(query: string): Promise<ProfileSummary[]> {
    const all = await this.list();
    const lower = query.toLowerCase();
    return all.filter(
      (s) => s.name.toLowerCase().includes(lower) || s.url.toLowerCase().includes(lower)
    );
  }

  close(): void {}
}
```

Also export a `makeTestProfile` factory function:

```typescript
export function makeTestProfile(overrides: Partial<ProductProfile> = {}): ProductProfile {
  return {
    identity: {
      productName: "Test Product",
      description: "A test product",
      targetCustomer: "Developers",
      businessModel: "B2B SaaS",
      confidence: 0.85,
      evidence: [],
    },
    completeness: 0.1,
    overallConfidence: 0.85,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  } as ProductProfile;
}
```

**Estimated lines:** ~60 implementation

---

## Implementation Order

The tasks should be implemented in this sequence due to dependencies:

```
Task 7 (types.ts)           -- no deps, provides ToolDeps/helpers
    |
    v
Task 1 (formatters.ts)      -- no deps, pure functions
    |
    v
Task 9 (mockStorage.ts)     -- no deps, needed for all handler tests
    |
    v
Task 2 (resolveProduct.ts)  -- depends on ToolDeps and storage interface
    |
    v
Task 3 (listProducts.ts)  --+
Task 4 (getProfile.ts)    --+-- depend on resolveProduct + formatters
Task 5 (getDefinition.ts) --+
    |
    v
Task 6 (updateDefinition.ts) -- depends on resolveProduct + formatters + validation schemas
    |
    v
Task 8 (index.ts wiring)    -- depends on all tool files existing
```

Tasks 3, 4, and 5 are independent of each other and can be implemented in any order (or in parallel).

## File Summary

New files to create:

| File | Purpose |
|------|---------|
| `packages/mcp-server/src/tools/types.ts` | `ToolDeps`, `ToolResult`, `text()`, `error()` helpers |
| `packages/mcp-server/src/tools/formatters.ts` | Pure markdown formatting functions |
| `packages/mcp-server/src/tools/formatters.test.ts` | Tests for formatters |
| `packages/mcp-server/src/tools/resolveProduct.ts` | Product auto-resolution helper |
| `packages/mcp-server/src/tools/resolveProduct.test.ts` | Tests for resolveProduct |
| `packages/mcp-server/src/tools/listProducts.ts` | `list_products` tool handler |
| `packages/mcp-server/src/tools/listProducts.test.ts` | Tests for list_products |
| `packages/mcp-server/src/tools/getProfile.ts` | `get_profile` tool handler |
| `packages/mcp-server/src/tools/getProfile.test.ts` | Tests for get_profile |
| `packages/mcp-server/src/tools/getDefinition.ts` | `get_definition` tool handler |
| `packages/mcp-server/src/tools/getDefinition.test.ts` | Tests for get_definition |
| `packages/mcp-server/src/tools/updateDefinition.ts` | `update_definition` tool handler |
| `packages/mcp-server/src/tools/updateDefinition.test.ts` | Tests for update_definition |
| `packages/mcp-server/src/tools/__tests__/mockStorage.ts` | In-memory mock storage for tests |

Files to modify:

| File | Change |
|------|--------|
| `packages/mcp-server/src/tools/index.ts` | Add profile tool registration with storage guard |

## Acceptance Criteria Verification

| Criterion | Task | How Verified |
|-----------|------|--------------|
| get_profile returns full profile or lists products | Task 4 | Handler test: auto-resolve single, error on multiple with list |
| get_definition accepts type and returns section | Task 5 | Handler test: each type returns correct section data |
| update_definition validates with zod and saves | Task 6 | Handler test: valid data saves, invalid data returns zod error |
| list_products returns all profiles with metadata | Task 3 | Handler test: multiple products, all metadata present |
| Validation rejects invalid data | Task 6 | Handler test: missing required field, wrong type, bad nested value |

## Edge Cases to Test

- **Empty profile (no sections populated):** `get_profile` should show "Missing Sections" for all 10 sections
- **Legacy activation format:** `get_definition` with activation that has flat criteria array (not levels)
- **Multi-level activation format:** `get_definition` with activation that has levels array
- **Updating a definition that was previously null:** Completeness should increase
- **Updating a section with the same data:** Completeness should stay the same
- **Zod validation with extra fields:** Should either strip or reject (depends on schema strictness -- prefer strip with `.passthrough()` for forward compatibility)
- **ProductId that looks valid but does not exist in storage:** Should return clear "not found" error, not a crash
- **Very long product names/URLs:** Markdown output should handle gracefully (no truncation needed, just verify no crashes)

## Dependencies on External Packages

| Package | Import | Status |
|---------|--------|--------|
| `@modelcontextprotocol/sdk` | `McpServer` type | Available (already in project) |
| `@basesignal/storage` | `StorageAdapter`, `ProfileSummary` | Pending (M008-E004-S001) |
| `@basesignal/core` | `ProductProfile` types, zod schemas | Pending (M008-E001-S002, S003) |

**Fallback strategy if dependencies are not ready:** Define minimal local types in `packages/mcp-server/src/tools/types.ts` that mirror the expected interfaces. Add `// TODO: import from @basesignal/{core,storage} when available` comments. When the real packages land, replace local types with imports. The mock storage in tests is self-contained and works regardless.
