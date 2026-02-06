# Product Workspace Creation Design

## Overview

Add a `products` table to the Convex schema and expose MCP tools for creating, listing, selecting, and managing product workspaces. Products are the organizational unit for all product knowledge in Basesignal.

## Problem Statement

The MCP server needs a way to organize product knowledge per-product per-user. Users may analyze multiple products. All subsequent MCP tools (scan, profile, definitions, metrics) need to know which product they're operating on.

## Proposed Solution

### Data Model

Add a `products` table to the existing Convex schema:

```typescript
// In convex/schema.ts
products: defineTable({
  userId: v.id("users"),       // Owner
  name: v.string(),            // "Acme SaaS"
  url: v.string(),             // "https://acme.io"
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"])
```

This is intentionally minimal. Rich product data (identity, journey, definitions, metrics) will live in separate tables that reference the product ID. Those come from the scan/analysis stories (Epic 3).

### MCP Tools

Five tools for product workspace management:

**`create_product(name, url)`**
- Creates a new product workspace
- Returns the created product with its ID
- If this is the user's only product, auto-selects it as active

**`list_products()`**
- Returns all products for the authenticated user
- Each product shows: id, name, url, createdAt
- Indicates which product is currently active (if any)

**`select_product(productId)`**
- Sets the active product for this session
- Validates the product belongs to the authenticated user
- Returns confirmation with product details

**`get_active_product()`**
- Returns the currently active product, or a message saying none is selected
- Useful for the AI assistant to check context

**`delete_product(productId)`**
- Deletes a product and all associated data
- Returns confirmation
- If the deleted product was active, clears the active selection

### Active Product Session State

The MCP server maintains an in-memory map of `userId → activeProductId`:

```typescript
// In-memory session state (MCP server process)
const activeProducts = new Map<string, string>(); // userId → productId
```

**Auto-selection logic:**
- 0 products → tools requiring a product return helpful error: "Create a product first with create_product(name, url)"
- 1 product → auto-selected on any tool call that needs it; user is informed
- 2+ products → must call `select_product()` explicitly

**On server restart:** Active product state is lost. User needs to call `select_product()` again. Acceptable for MVP — the AI assistant will naturally handle this by calling `list_products()` and selecting.

### Convex Functions

```
convex/products.ts
├── create: mutation        // Create product, return ID
├── list: query             // List all products for user
├── get: query              // Get single product by ID (with ownership check)
├── remove: mutation        // Delete product (with cascade to child data)
└── update: mutation        // Update name/url (future use)
```

All functions verify the authenticated user owns the product before operating on it.

### Guard Rails

- **Ownership check**: Every product operation verifies `product.userId === currentUser._id`
- **No cross-user access**: Users can never see or modify another user's products
- **Cascade delete**: When a product is deleted, all child data (profiles, definitions, scan results) must also be deleted. For MVP, this is acceptable as a simple cascade. For production, consider soft-delete.
- **URL validation**: Basic URL format validation on `create_product`. No need to verify the URL is reachable — that's the scan step.

## Alternatives Considered

### Explicit product ID per tool call
Every MCP tool would take `productId` as a parameter instead of using session state. More stateless and predictable, but much more verbose — every single interaction requires specifying the product. The AI assistant would need to include it in every call, adding noise to conversations.

### Persistent active product (database)
Store the active product ID in the database (on the user record or a sessions table). Survives server restarts. But adds complexity for minimal benefit — the AI assistant naturally re-selects on new sessions.

### Product as part of the URL
MCP server URL includes the product: `https://mcp.basesignal.com/{productId}`. Clean for single-product use but breaks when switching products within a conversation.

## Open Questions

1. **Product limits**: Should free tier users be limited to 1 product? (Pricing question, not architecture question — easy to add later)
2. **Duplicate URLs**: Should we prevent creating two products with the same URL? (Probably not — user might want to track different aspects or compare before/after)

## Success Criteria

- User can create a product workspace via MCP tool
- User can list all their products
- User can select an active product
- All subsequent tool calls operate on the active product
- Products persist across sessions (active selection does not, but product data does)
- No cross-user access is possible
