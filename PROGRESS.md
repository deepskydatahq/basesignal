# Progress Log

## Reusable Patterns

<!-- Patterns promoted from session logs that apply broadly -->

*No patterns yet - they'll be added as we learn from implementations.*

---

## Session Log

<!-- New entries are added below this line -->

### 2026-02-04 - Story S005: Extract Product Outcomes from Marketing Content

**Files Changed:**
- `convex/crawledPages.ts` - Added `listByProductInternal` internalQuery for auth-free page access
- `convex/productProfiles.ts` - Added `createInternal` and `updateSectionInternal` internalMutations for pipeline use
- `convex/extractOutcomes.ts` - New: `extractOutcomes` internalAction — fetches crawled pages, calls Haiku, stores outcomes
- `convex/extractOutcomes.test.ts` - 12 tests covering prompt building, JSON parsing, and internal helper integration
- `convex/lib/extractOutcomesHelpers.ts` - Pure helper functions for prompt construction and response parsing

**Learnings:**
- Extraction actions that call external APIs (Anthropic) should separate pure logic (prompt building, parsing) from the Convex action for testability
- `convex-test` can test `internalQuery` and `internalMutation` via `t.query(internal.*)` and `t.mutation(internal.*)` without auth context
- The `internalAction` itself can't be tested in `convex-test` (needs external API), but extracting helpers makes the logic fully testable

**Patterns Discovered:**
- Extraction action pattern: `internalAction` → `createInternal` (ensure profile) → `listByProductInternal` (get pages) → Haiku call → `parseOutcomesResponse` → `updateSectionInternal` (store results)
- Helper extraction pattern: pure functions in `convex/lib/` for prompt building and response parsing — no Convex runtime deps, fully unit-testable
- Page filtering pattern: filter crawled pages to relevant types (homepage, features, customers) before sending to LLM, with fallback to all pages

**Gotchas:**
- Pre-existing lint errors in `productProfiles.ts` (`sectionValidators` and `DEFINITION_KEYS` unused) — not introduced by this change
- Pre-existing UI test failures (AddEntityDialog, AddActivityModal, TrackingMaturityScreen) — timeouts in v1 components

### 2026-01-31 - Story 1.4: Basic Data Persistence

**Files Changed:**
- `convex/schema.ts` - Added 4 new tables: products, productProfiles, scanJobs, crawledPages
- `convex/products.ts` - CRUD functions with ownership checks
- `convex/products.test.ts` - 8 tests for products CRUD and ownership
- `convex/productProfiles.ts` - Profile management with section updates and completeness calculation
- `convex/productProfiles.test.ts` - 10 tests for profiles including completeness math
- `convex/scanJobs.ts` - Scan pipeline state tracking with internal mutations
- `convex/scanJobs.test.ts` - 7 tests for scan job lifecycle
- `convex/crawledPages.ts` - Crawled content storage with 100KB truncation
- `convex/crawledPages.test.ts` - 7 tests for page storage and retrieval

**Learnings:**
- The `convex-test` `withIdentity` pattern works well for testing ownership checks
- Internal mutations (`internalMutation`) are the right pattern for pipeline operations that shouldn't be called directly by users
- Completeness calculation across nested sections (definitions sub-keys) needs careful counting

**Patterns Discovered:**
- Ownership check helper pattern: look up user by Clerk ID, then verify product ownership before any operation
- Setup helper pattern in tests: `setupUserAndProduct()` returns `{ userId, productId, asUser }` for clean test setup

**Gotchas:**
- Worktree npm install needed — `node_modules` isn't shared between worktrees
- Pre-existing test failures (9 timeout tests in v1 UI components) shouldn't block new work

### 2026-01-31 - Story 2.1: Basic Page Crawler

**Files Changed:**
- `convex/lib/urlUtils.ts` - URL validation (SSRF prevention), page classification, filtering
- `convex/lib/urlUtils.test.ts` - 31 tests for URL utilities
- `convex/scanning.ts` - Firecrawl-powered scan pipeline as internalAction
- `convex/scans.ts` - User-facing startProductScan mutation + getLatestScan query
- `convex/scans.test.ts` - 10 tests for scan mutations and queries
- `convex/scanJobs.ts` - Added createInternal mutation for action pipeline
- `package.json` - Added @mendable/firecrawl-js dependency

**Learnings:**
- Firecrawl batch scrape is async — returns a job ID, needs polling
- Convex actions can call `ctx.runMutation` with internal mutations for DB writes
- `ctx.scheduler.runAfter` is the right pattern for kicking off long-running actions from mutations
- `convex-test` doesn't handle scheduled functions cleanly — causes "Write outside of transaction" errors that are harmless

**Patterns Discovered:**
- Async scan pattern: user mutation validates + schedules → internal action runs pipeline → internal mutations update state
- URL filtering pattern: map → classify → prioritize → limit to prevent over-crawling

**Gotchas:**
- `convex-test` with `ctx.scheduler.runAfter` produces unhandled rejection errors — all test assertions still pass, but the exit code is 1 due to the noise
- Skip patterns need exact matching: `/legal/` won't match `/legal` — use `/legal` without trailing slash

### 2026-01-31 - Story 1.2: User Authentication

**Files Changed:**
- `convex/users.ts` - Added `getOrCreateByClerkId` public mutation for MCP server user resolution
- `convex/users.test.ts` - Added 3 tests for getOrCreateByClerkId (creation, idempotency, null fields)
- `server/lib/auth.ts` - New: `resolveUser()` helper calling Convex via ConvexHttpClient with in-memory cache
- `server/lib/auth.test.ts` - New: 4 tests for resolveUser (Convex calls, caching, cache clearing)
- `server/lib/withUser.ts` - New: `withUser()` and `withUserArgs()` wrappers for authenticated tool handlers
- `server/lib/withUser.test.ts` - New: 5 tests for withUser/withUserArgs (auth extraction, error handling)
- `server/tools/ping.ts` - Updated to use `withUser()`, returns Convex user identity
- `server/tools/ping.test.ts` - Updated description assertion
- `server/tsconfig.json` - Simplified to avoid pulling in unrelated convex files

**Learnings:**
- `@clerk/mcp-tools` stores the Clerk userId in `authInfo.extra.userId` (not directly on authInfo)
- MCP SDK's `AuthInfo` type is at `@modelcontextprotocol/sdk/server/auth/types.js`
- MCP tool handler return types require `[x: string]: unknown` index signature
- ConvexHttpClient calls public mutations/queries — can't use `ctx.auth.getUserIdentity()` from there
- Server tsconfig with `rootDir: "."` fails when imports reach into `convex/` — removed rootDir and outDir, use noEmit

**Patterns Discovered:**
- `withUser(handler)` pattern: wraps tool handler to auto-resolve Clerk → Convex user, returns error if unauthenticated
- `withUserArgs(handler)` variant for tools with input schemas
- In-memory user cache in resolveUser avoids repeated Convex calls per session

**Gotchas:**
- `convex/seed.ts` has a pre-existing TS2742 error that surfaces when included transitively via `_generated/api.d.ts`
- Pre-existing frontend test timeouts (8 tests) still present on main — unrelated to auth changes

### 2026-01-31 - Story 1.1: MCP Server Skeleton

**Files Changed:**
- `server/index.ts` - Express entry point with Clerk auth + Streamable HTTP transport
- `server/tools/ping.ts` - Placeholder ping tool returning server status + auth info
- `server/tools/index.ts` - Tool registration pattern (registerTools aggregator)
- `server/tools/ping.test.ts` - 2 tests for tool registration and metadata
- `server/index.test.ts` - 2 integration tests for server setup
- `server/lib/convex.ts` - Lazy ConvexHttpClient helper for future database access
- `server/tsconfig.json` - Server-specific TypeScript config
- `server/.env.example` - Environment variable template
- `package.json` - Added @modelcontextprotocol/sdk, @clerk/mcp-tools, tsx, type definitions

**Learnings:**
- `@clerk/mcp-tools/express` provides `streamableHttpHandler`, `mcpAuthClerk`, `protectedResourceHandlerClerk` — handles Streamable HTTP + OAuth in one line
- `@clerk/mcp-tools` bundles `@clerk/express` internally — no separate install needed
- MCP SDK bundles Express 5 and cors — available from `node_modules` without explicit install
- `McpServer.registerTool()` handler signature is `(extra) => ...` when no `inputSchema` provided, `(args, extra) => ...` when schema is provided
- `McpServer._registeredTools` is a plain object (not Map) — `Object.keys()` to list tools
- `better-sqlite3` fails to compile on Node 25 — use `@clerk/mcp-tools/stores/fs` for dev instead
- Clerk metadata endpoints (`protectedResourceHandlerClerk`, `authServerMetadataHandlerClerk`) read `CLERK_PUBLISHABLE_KEY` at request time, not import time — server starts without keys

**Patterns Discovered:**
- Tool registration pattern: each tool in its own file exporting `registerXTool(server)`, aggregated in `tools/index.ts` via `registerTools()`
- Lazy Convex client: `getConvexClient()` defers initialization until first use

**Gotchas:**
- `better-sqlite3` peer dep of `@clerk/mcp-tools` won't compile on Node 25 — skip it and use filesystem store for dev
- Express 5 types need `@types/express` v5 — not bundled by MCP SDK
- Pre-existing test failures (4 timeout tests in AddEntityDialog) exist on main — don't block new work
