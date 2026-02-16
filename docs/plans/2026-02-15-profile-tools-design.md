# Profile Retrieval and Refinement MCP Tools Design

**Story:** M008-E002-S004
**Date:** 2026-02-15
**Status:** brainstorm

## Problem

The MCP server needs tools that let AI assistants read, update, and browse product profiles stored via the storage adapter. These are the primary conversational refinement tools -- once a scan produces a profile, users refine it through natural language, and the AI assistant uses these tools to read the current state, drill into a specific definition, update it, and verify the result.

## Context

### What exists today

The current `server/tools/products.ts` registers four tools against the Convex backend:
- `create_product` -- creates a product workspace
- `list_products` -- lists products for the authenticated user
- `scan_product` -- kicks off website crawling
- `get_scan_status` -- polls scan progress

The `convex/productProfiles.ts` file provides the CRUD layer: `create`, `get`, `updateSection`, `validateSection`, `remove`. Profiles have 10 sections: 6 top-level (`identity`, `revenue`, `entities`, `journey`, `outcomes`, `metrics`) and 4 definition sub-sections (`activation`, `firstValue`, `active`, `churn`). Completeness and confidence are automatically recalculated on every update.

### What this story adds

Four new MCP tools in `packages/mcp-server/` that read and write through the `StorageAdapter` interface (not Convex directly):
1. `get_profile` -- retrieve a full profile
2. `get_definition` -- retrieve a single definition section
3. `update_definition` -- validate and save a definition change
4. `list_products` -- list all stored products with metadata

## Design

### Principle: Tools return markdown, not JSON

AI assistants display tool results to users. Raw JSON is noisy. Every tool returns human-readable markdown with structured headings, tables, and bullet lists. The AI assistant can parse markdown just as well as JSON, and users see clean output if the assistant surfaces it directly.

### Principle: Granular reads, granular writes

`get_profile` returns the full picture for orientation. `get_definition` zooms into one section for focused work. `update_definition` writes one section at a time with validation. This matches how a conversation naturally flows: "Show me the profile" -> "What's my activation definition?" -> "Change the criteria to ..."

### Principle: No pagination needed

A user will have single-digit products. `list_products` returns all of them. No cursor, no offset, no page size parameter. If this changes later, add it then.

### Tool Definitions

#### 1. `list_products`

**Purpose:** Show what products are stored so the user can pick one.

```typescript
{
  name: "list_products",
  title: "List Products",
  description: "List all your product profiles with completeness status.",
  inputSchema: {} // no args
}
```

**Handler:**
```typescript
async function handleListProducts(storage: StorageAdapter): Promise<ToolResult> {
  const products = await storage.list();

  if (products.length === 0) {
    return text("No products found. Use scan_product to analyze a website first.");
  }

  const lines = products.map(p =>
    `- **${p.name}** (${p.url}) -- ${Math.round(p.completeness * 100)}% complete, ` +
    `confidence ${Math.round(p.overallConfidence * 100)}% -- updated ${formatRelative(p.updatedAt)}`
  );

  return text(`## Your Products\n\n${lines.join("\n")}`);
}
```

**Returns:** Markdown list with name, URL, completeness percentage, confidence percentage, and last-updated timestamp.

#### 2. `get_profile`

**Purpose:** Retrieve the full profile for a product. Used for orientation and overview.

```typescript
{
  name: "get_profile",
  title: "Get Product Profile",
  description:
    "Retrieve the full product profile including identity, revenue, entities, journey, definitions, outcomes, and metrics. " +
    "Use this to understand the current state of a product's analysis.",
  inputSchema: {
    type: "object",
    properties: {
      productId: {
        type: "string",
        description: "Product ID (from list_products). If omitted and only one product exists, uses that one.",
      },
    },
    required: [], // optional -- auto-resolves if only one product
  },
}
```

**Handler logic:**
1. If `productId` is provided, load that profile.
2. If omitted, call `storage.list()`. If exactly one product, use it. If zero or multiple, return an error asking the user to specify.
3. Return the full profile rendered as markdown.

**Auto-resolve rationale:** Most users will have one product. Requiring the ID every time adds friction to every single tool call. The "if only one, use it" pattern removes that friction while remaining unambiguous when multiple exist.

**Returns:** Markdown document with sections:

```markdown
## Acme SaaS -- Product Profile

**Completeness:** 70% | **Confidence:** 0.82

### Identity
- **Product:** Acme SaaS
- **Target Customer:** Engineering teams
- **Business Model:** B2B SaaS
- **Confidence:** 0.85

### Revenue
- **Model:** subscription
- **Free Tier:** Yes
- **Tiers:** Free ($0), Pro ($29/mo), Enterprise (custom)
- **Confidence:** 0.7

### Definitions

#### Activation (0.85 confidence)
**Levels:**
| Level | Name | Signal | Criteria |
|-------|------|--------|----------|
| 1 | Explorer | weak | view_page x1 within first_7d |
| 2 | Creator | medium | create_item x1 |
| 3 | Collaborator | strong | share_item x1, invite_member x1 within first_14d |
**Primary activation level:** 3 (Collaborator)

#### First Value (0.6 confidence)
- completed_onboarding, created_first_project
- Time window: first_7d

[...other sections...]

### Missing Sections
- outcomes (not yet analyzed)
- metrics (not yet analyzed)
```

Sections that are `null`/empty are listed under "Missing Sections" so the user knows what remains.

#### 3. `get_definition`

**Purpose:** Retrieve a single definition section for focused review and refinement.

```typescript
{
  name: "get_definition",
  title: "Get Definition",
  description:
    "Retrieve a specific definition section from a product profile. " +
    "Types: activation, firstValue, active, atRisk, churn. " +
    "Also accepts top-level sections: identity, revenue, entities, journey, outcomes, metrics.",
  inputSchema: {
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
  },
}
```

**Handler logic:**
1. Resolve product (same auto-resolve as `get_profile`).
2. If `type` is a definition key (`activation`, `firstValue`, `active`, `atRisk`, `churn`), read from `profile.definitions[type]`.
3. If `type` is a top-level section, read from `profile[type]`.
4. Return the section rendered as detailed markdown, including evidence (URLs + excerpts).
5. If the section is empty, return a message like: "The activation definition has not been analyzed yet. Run scan_product first, or provide details and I'll help you define it."

**Why include evidence:** When refining a definition, the user needs to see *why* it was defined this way. Evidence (URLs, excerpts) provides that context and makes refinement more informed.

**Returns:** Detailed markdown for that single section, including:
- All fields with values
- Evidence table (URL + excerpt) when present
- Confidence score
- Source attribution (e.g., "website_analysis")

#### 4. `update_definition`

**Purpose:** Update a specific definition section with validated data.

```typescript
{
  name: "update_definition",
  title: "Update Definition",
  description:
    "Update a specific definition or section of a product profile. " +
    "The data must match the expected schema for that section type. " +
    "Types: activation, firstValue, active, atRisk, churn, identity, revenue, entities, journey, outcomes, metrics.",
  inputSchema: {
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
  },
}
```

**Handler logic:**
1. Resolve product (auto-resolve).
2. Validate `data` against the appropriate zod schema from `@basesignal/core`.
3. If validation fails, return a clear error describing what's wrong: `"Validation failed: 'criteria' must be an array of strings, got number"`.
4. Determine storage path:
   - Definition types: `definitions.${type}` (nested under definitions object)
   - Top-level types: `type` directly
5. Call `storage.save(profile)` with the updated section.
6. After saving, re-read the profile and return the updated section as confirmation markdown.

**Validation schemas** are imported from `@basesignal/core`. The core package exports zod schemas matching the Convex schema definitions. For the MCP server tools, these schemas serve as the single source of truth for what constitutes valid data.

**Merge vs. replace semantics:** `update_definition` does a full replace of the specified section. The AI assistant is responsible for reading the current value (via `get_definition`), merging changes, and writing the result back. This keeps the tool simple and predictable -- no partial-update ambiguity.

**Returns:**
```markdown
## Updated: Activation Definition

**Levels:**
| Level | Name | Signal | Criteria |
|-------|------|--------|----------|
| 1 | Explorer | weak | view_page x1 within first_7d |
| 2 | Creator | strong | create_item x1 |

**Primary activation level:** 2 (Creator)
**Confidence:** 0.85

Completeness: 70% -> 80%
```

### Implementation Structure

```
packages/mcp-server/
  src/
    tools/
      index.ts           # registerTools(server, deps)
      listProducts.ts    # list_products handler
      getProfile.ts      # get_profile handler
      getDefinition.ts   # get_definition handler
      updateDefinition.ts # update_definition handler
      formatters.ts      # Shared markdown formatting functions
    types.ts             # ToolDeps { storage, llmProvider? }
```

**Dependency injection:** Each tool receives a `ToolDeps` object containing the storage adapter. This is passed during registration, not imported globally.

```typescript
interface ToolDeps {
  storage: StorageAdapter;
}

export function registerProfileTools(server: McpServer, deps: ToolDeps) {
  server.registerTool("list_products", listProductsMeta, handleListProducts(deps));
  server.registerTool("get_profile", getProfileMeta, handleGetProfile(deps));
  server.registerTool("get_definition", getDefinitionMeta, handleGetDefinition(deps));
  server.registerTool("update_definition", updateDefinitionMeta, handleUpdateDefinition(deps));
}
```

This mirrors the existing `registerProductTools(server)` pattern from `server/tools/products.ts` but replaces the global `getConvexClient()` with an injected adapter.

### Markdown Formatters

A small set of pure functions that render profile data as markdown:

```typescript
// formatters.ts

export function formatProfileOverview(profile: ProductProfile): string { ... }
export function formatSection(type: string, data: unknown): string { ... }
export function formatEvidence(evidence: Array<{url: string; excerpt: string}>): string { ... }
export function formatActivation(activation: ActivationDefinition): string { ... }
export function formatCompleteness(before: number, after: number): string { ... }
```

These are pure functions, easy to test in isolation. Each tool handler composes them.

### Error Handling

All errors return `{ isError: true }` with a descriptive text message. Categories:

| Error | Message Pattern |
|-------|----------------|
| No products | "No products found. Use scan_product to analyze a website first." |
| Multiple products, no ID | "You have N products. Please specify a productId: [list]" |
| Product not found | "No product found with ID 'xxx'. Use list_products to see available products." |
| Section empty | "The [type] definition has not been analyzed yet." |
| Validation failed | "Validation failed for [type]: [zod error message]" |
| Storage error | "Failed to save: [error]" |

### What This Design Does NOT Include

- **Versioning/history:** The story asks about versioning. The storage adapter does not track versions. Each `save()` overwrites the previous state. If we need version history later, it belongs in the storage adapter, not in the MCP tools. Not needed now.
- **Pagination on list_products:** Single-digit products per user. Not needed.
- **Authentication:** The self-hosted MCP server runs locally. No auth layer needed. (The hosted `server/` layer wraps these same tools with Clerk auth.)
- **Re-running lenses as part of refinement:** The `update_definition` tool saves user-provided data. Re-running the scan/analysis pipeline is a separate action (`scan_product`). Refinement means the human corrects the data, not the system re-runs extraction.
- **Search on list_products:** With single-digit product counts, search is unnecessary. The `StorageAdapter.search()` method exists if needed later.

## Expert Review

### Technical Architect Assessment

The auto-resolve pattern (omit productId when only one product exists) reduces tool-call friction for the common case without introducing ambiguity. The replace-not-merge semantics for `update_definition` keeps the tool boundary clean -- the AI is responsible for merging, which it does naturally in conversation context. Dependency injection via `ToolDeps` makes testing straightforward: inject a mock storage adapter.

One concern: the `get_definition` tool accepts both definition sub-types and top-level section types. This broadens its name beyond "definition." Consider whether this should just be called `get_section`. However, the story spec uses `get_definition`, and the expanded scope is natural for users who won't distinguish between "definition" and "section." Keeping one tool with a broader scope is simpler than two tools with narrower scope.

### Simplification Reviewer Verdict: APPROVED

**What was removed:**
- Pagination -- unnecessary for single-digit counts
- Version history -- belongs in storage adapter, not tool layer
- Search -- list is sufficient at current scale
- Partial update/merge -- full replace is simpler and more predictable
- Re-run-lenses refinement -- out of scope, separate tool

**What remains is essential:**
- 4 tools matching the natural conversation flow (list -> read -> zoom -> update)
- Markdown output for human readability
- Validation before save
- Auto-resolve for the single-product case

**Nothing feels bolted-on.** The design follows the existing pattern (tools.ts + Convex) but replaces Convex with the storage adapter. The formatter functions are the only new concept, and they serve a clear purpose.

## Acceptance Criteria Mapping

| Criterion | Tool | Covered |
|-----------|------|---------|
| get_profile returns full profile or lists products | `get_profile` with auto-resolve | Yes |
| get_definition accepts type and returns section | `get_definition` with enum | Yes |
| update_definition validates with zod and saves | `update_definition` with core schemas | Yes |
| list_products returns all profiles with metadata | `list_products` | Yes |
| Validation rejects invalid data | `update_definition` error path | Yes |

## Testing Strategy

- **Registration tests** (like existing `products.test.ts`): Verify all 4 tools are registered with correct metadata.
- **Handler tests with mock storage:** Inject an in-memory `StorageAdapter` implementation. Test each tool handler in isolation:
  - `list_products`: empty list, single product, multiple products
  - `get_profile`: auto-resolve single, error on multiple, render all sections, handle missing sections
  - `get_definition`: each section type, empty section, invalid type
  - `update_definition`: valid data saves, invalid data returns error, completeness updates
- **Formatter tests:** Pure function tests for each markdown formatter.
