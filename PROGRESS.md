# Progress Log

## Reusable Patterns

<!-- Patterns promoted from session logs that apply broadly -->

*No patterns yet - they'll be added as we learn from implementations.*

---

## Session Log

<!-- New entries are added below this line -->

### 2026-02-07 - Story M003-E001-S003: Implement Batch 2 Lenses (Info, Decision, State)

**Files Changed:**
- `convex/analysis/lenses/types.ts` - New: LensType, ConfidenceLevel, LensCandidate, LensResult types (inline until S001 merge)
- `convex/analysis/lenses/shared.ts` - New: shared utilities (truncateContent, buildPageContext, extractJson, parseLensResponse, callClaude)
- `convex/analysis/lenses/extractInfoAsymmetry.ts` - New: internalAction extracting information asymmetries from crawled pages
- `convex/analysis/lenses/extractDecisionEnablement.ts` - New: internalAction extracting decision enablement candidates
- `convex/analysis/lenses/extractStateTransitions.ts` - New: internalAction extracting user state transitions
- `convex/analysis/lenses/shared.test.ts` - 26 tests for shared utilities
- `convex/analysis/lenses/extractInfoAsymmetry.test.ts` - 16 tests for info asymmetry lens
- `convex/analysis/lenses/extractDecisionEnablement.test.ts` - 13 tests for decision enablement lens
- `convex/analysis/lenses/extractStateTransitions.test.ts` - 14 tests for state transitions lens

**Learnings:**
- Shared utilities (truncation, page context, JSON extraction, response parsing) eliminate ~60% of boilerplate per lens
- `parseLensResponse` validates shared fields (name, description, role, confidence, source_urls) plus a lens-specific field — single validation function for all lens types
- `crypto.randomUUID()` works in Convex runtime for generating candidate IDs
- Confidence normalization handles both string ("high"/"medium"/"low") and numeric (0-1 range) from Claude responses
- Claude Sonnet at temp 0.2 is the right choice for inference-heavy lenses (vs Haiku for extraction-only lenses like activation)

**Patterns Discovered:**
- Lens extractor pattern: PAGE_TYPES constant → filter function → knowledge context builder → batch1 context builder → system prompt → internalAction handler
- Each lens has a distinct set of page types: Info Asymmetry (features, customers, help, homepage, solutions), Decision Enablement (features, solutions, customers, homepage), State Transitions (customers, features, onboarding, help, homepage)
- Knowledge context varies per lens domain: Info Asymmetry uses identity+entities+revenue, Decision Enablement uses identity+entities+journey, State Transitions uses identity+entities+journey+activation definitions
- Optional batch1Results parameter allows richer inference when Batch 1 (capability/effort) results are available

**Gotchas:**
- S001 types (basesignal-6ab) was marked closed but types weren't in the codebase — created inline types.ts with TODO comment
- Pre-existing test failures (10 tests: AddEntityDialog, AddActivityModal, TrackingMaturityScreen timeouts + convex-test "Write outside of transaction") unchanged

### 2026-02-06 - Story M002-E001-S003: Backward Compatibility Tests for Activation Schema

**Files Changed:**
- `convex/schema.ts` - Updated `definitions.activation` to `v.union` supporting both legacy (criteria: string[]) and new multi-level (levels array with signalStrength enum) formats
- `convex/productProfiles.ts` - Updated `calculateCompletenessAndConfidence` to use `overallConfidence` for multi-level format, falling back to `confidence` for legacy
- `convex/productProfiles.test.ts` - Added 6 backward compatibility tests in new `activation backward compatibility` describe block

**Learnings:**
- Convex `v.union` cleanly supports backward-compatible schema evolution — both old and new shapes validated at DB write time
- `updateSectionInternal` uses `v.any()` for the data arg, but `ctx.db.patch` still validates against the schema definition, so invalid `signalStrength` values are rejected at persistence
- The `overallConfidence ?? confidence` fallback pattern in completeness calculation handles both formats without needing format detection

**Patterns Discovered:**
- Schema evolution via `v.union`: wrapping old and new object shapes in `v.union` lets them coexist without migration
- `setupProfileWithDirectInsert` helper pattern for tests that need raw DB access without auth overhead

**Gotchas:**
- S001 and S002 (schema + section handling) were prerequisites that hadn't been implemented — had to implement them before writing the backward compatibility tests

### 2026-02-04 - Story M001-E001-S001: Extract Core Identity from Crawled Pages

**Files Changed:**
- `convex/crawledPages.ts` - Added `listByProductInternal` internalQuery (auth-free page retrieval for actions)
- `convex/crawledPages.test.ts` - Added test for listByProductInternal
- `convex/productProfiles.ts` - Added `createInternal`, `getInternal`, `updateSectionInternal` (auth-free internals for actions)
- `convex/productProfiles.test.ts` - Added 3 tests for internal functions
- `convex/analysis/extractIdentity.ts` - New: `extractIdentity` internalAction + pure helper functions
- `convex/analysis/extractIdentity.test.ts` - New: 19 tests for helper functions (filtering, truncation, parsing, evidence)

**Learnings:**
- Pure helper functions exported from action files can be unit tested without Convex runtime
- Claude Haiku model ID is `claude-haiku-4-20250414` for the latest Haiku
- `internalAction` + `internalMutation` + `internalQuery` is the right pattern for action pipelines that bypass user auth
- JSON extraction from LLM responses needs to handle code fences (`json...`) and raw JSON

**Patterns Discovered:**
- Analysis action pattern: fetch pages (internalQuery) → filter/prepare (pure functions) → LLM call → parse (pure function) → store (internalMutation)
- Separating pure helpers from Convex runtime makes them independently testable with standard Vitest
- Content truncation preserving whole lines prevents mid-word cuts in LLM context

**Gotchas:**
- Pre-existing UI test timeouts (AddEntityDialog, AddActivityModal, TrackingMaturityScreen) and "Write outside of transaction" errors from convex-test still present - unrelated to this work

### 2026-02-04 - Story M001-E001-S002: Extract Revenue Architecture

**Files Changed:**
- `convex/crawledPages.ts` - Added `listByProductInternal` internalQuery for auth-free page retrieval
- `convex/productProfiles.ts` - Added `getInternal` internalQuery and `updateSectionInternal` internalMutation
- `convex/extractRevenue.ts` - New: `extractRevenue` internalAction with Claude Haiku extraction
- `convex/extractRevenue.test.ts` - 20 tests: pure functions (selectPages, buildPageContext, parseExtractionResponse) + Convex internal query/mutation integration

**Learnings:**
- `internalQuery` follows the same pattern as `internalMutation` — import from `_generated/server`, no auth checks needed
- Two-tier page selection (pricing → homepage+features → all) with confidence multipliers works well for degrading gracefully
- Claude Haiku is sufficient for structured JSON extraction from pricing pages — no need for larger models
- `parseExtractionResponse` should handle JSON embedded in surrounding text (Claude sometimes adds preamble)
- Confidence adjustment by page tier (high=1.0, medium=0.8, low=0.6 multiplier) provides honest quality signals

**Patterns Discovered:**
- Internal query/mutation pair for extraction pipelines: `getInternal` + `updateSectionInternal` avoids auth overhead when called from internalActions
- `updateSectionInternal` auto-creates profile if missing — simplifies extraction action logic
- Pure function extraction (selectPages, buildPageContext, parseExtractionResponse) enables comprehensive unit testing without mocking external services
- Evidence tracking from extraction: use page URL + title as evidence entries

**Gotchas:**
- Worktree needs `npm install` — node_modules not shared between worktrees
- Pre-existing UI test failures (10 tests in AddEntityDialog, AddActivityModal, FirstValueSection, TrackingMaturityScreen) still present — unrelated to extraction changes

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
