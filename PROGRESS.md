# Progress Log

## Reusable Patterns

<!-- Patterns promoted from session logs that apply broadly -->

*No patterns yet - they'll be added as we learn from implementations.*

---

## Session Log

<!-- New entries are added below this line -->

### 2026-02-23 - Task basesignal-c90: Add test for moment ID deduplication across clusters

**Files Changed:**
- `packages/core/src/analysis/convergence.test.ts` - Added 2 tests in `converge` describe block: directMerge dedup (no LLM) and LLM-path dedup
- `packages/mcp-server/src/analysis/__tests__/convergence/converge.test.ts` - Added 1 test in `convergeAndTier` describe block: LLM dedup via mock that returns same MERGE_RESPONSE name

**Learnings:**
- The `converge()` function uses a `Set<string>` (`usedIds`) to track assigned IDs and passes it to `momentIdFromName()` which appends `-2`, `-3`, etc. for collisions
- Both the no-LLM path (directMerge) and the LLM path converge on the same dedup mechanism via `momentIdFromName(name, usedIds)`
- The mcp-server `convergeAndTier()` uses the same pattern — `usedIds` Set with sequential assignment

**Patterns Discovered:**
- Mock LLM in mcp-server always returns the same `MERGE_RESPONSE` for merge prompts, making dedup testing natural — just pass two clusters

**Gotchas:**
- Worktree needs `npm install` and `npm run build` — node_modules not shared and mcp-server tests need @basesignal/core built

### 2026-02-23 - Task basesignal-hp5: Consolidate LlmProvider type definition across core and mcp-server

**Files Changed:**
- `packages/core/src/analysis/convergence.ts` - Removed local `type LlmProvider` function type; imported `LlmProvider` from `../llm/types` and `callLlm` from `../llm/helpers`; updated `converge()` to use `callLlm()` instead of calling provider as a function
- `packages/core/src/analysis/index.ts` - Removed `type LlmProvider` from convergence re-export block (now exported via `../llm`)
- `packages/core/src/index.ts` - Removed `type LlmProvider as ConvergenceLlmFn` alias
- `packages/mcp-server/src/types.ts` - Replaced empty `interface LlmProvider {}` skeleton with re-export of `LlmProvider` from `@basesignal/core`
- `packages/cli/src/program.ts` - Changed `getProvider()` from returning empty object to using `createProviderFromEnv()` from `@basesignal/core`; made async
- `packages/cli/src/commands/serve.ts` - Updated `getProvider` parameter type to accept `Promise<LlmProvider>`; await the result
- `packages/core/src/analysis/convergence.test.ts` - Updated all mock providers from bare functions to `{ complete: async () => ... }` shape; changed import source from `./convergence` to `../llm/types`

**Learnings:**
- The `callLlm()` helper in `core/llm/helpers.ts` bridges the gap between the simple `(prompt, system)` calling convention and the `complete(messages, options)` interface cleanly
- Re-export pattern (`type X = _X`) is already established in mcp-server for `StorageAdapter` — using the same pattern for `LlmProvider` keeps consistency

**Patterns Discovered:**
- Type consolidation pattern: when multiple packages define the same type, keep it in the lowest-level package (core) and re-export through higher-level packages (mcp-server) for consumer convenience
- The `callLlm()` helper serves as a stable bridge for code that uses the simpler `(prompt, system)` calling convention

**Gotchas:**
- Changing `LlmProvider` from empty interface to one with `complete()` method means CLI's `getProvider()` returning `{}` no longer type-checks — must provide a real provider implementation

### 2026-02-22 - Story M010-E003-S004: CLI Display and End-to-End Pipeline Test

**Files Changed:**
- `packages/core/src/types/outputs.ts` - Added `StateCriterion`, `LifecycleState`, `StateTransition`, `LifecycleStatesResult` types; added `lifecycle_states?` to `OutputGenerationResult`
- `packages/core/src/index.ts` - Exported 4 new lifecycle state types
- `packages/mcp-server/src/analysis/outputs/lifecycle-states.ts` - New: `generateLifecycleStates()` with prompt builder and response parser
- `packages/mcp-server/src/analysis/types.ts` - Added `outputs_lifecycle_states` to `ProgressPhase`; added `lifecycle_states` to `PipelineOutputs`
- `packages/mcp-server/src/analysis/outputs/index.ts` - Added `lifecycle_states` to `OutputsResult`; wired `generateLifecycleStates` into `generateAllOutputs` (step 4, after measurement spec)
- `packages/mcp-server/src/analysis/pipeline.ts` - Added `lifecycle_states: null` to empty result defaults
- `packages/mcp-server/src/analysis/__tests__/fixtures/responses.ts` - Added `LIFECYCLE_STATES_RESPONSE` (7 states, 2 transitions, confidence 0.75)
- `packages/mcp-server/src/analysis/__tests__/fixtures/mock-llm.ts` - Added routing entry for "lifecycle states" prompt match
- `packages/mcp-server/src/analysis/__tests__/pipeline.test.ts` - Added lifecycle_states assertions (non-null, 7+ states, canonical names, transitions, confidence, progress event, null on empty)
- `packages/cli/src/formatters.ts` - Added lifecycle states to `formatSummary()` (multi-line listing) and `formatMarkdown()` (state table)
- `packages/cli/src/formatters.test.ts` - Added lifecycle_states to fullProfile fixture; added 4 tests (summary present/absent, markdown present/absent)
- `packages/cli/src/commands/scan.ts` - Attached `lifecycle_states` to profile object; persisted as `outputs/lifecycle-states.json`

**Learnings:**
- Upstream M010-E001/E002/E003-S001-S002 stories hadn't been merged, requiring this story to implement the full lifecycle states infrastructure (types, generator, pipeline wiring) alongside the CLI display scope
- The `ProductProfile` type in storage has `[key: string]: unknown` index signature, so `lifecycle_states` works as an additional field without type changes
- Mock LLM routing uses substring matching — "lifecycle states" in the system prompt is sufficient for routing

**Patterns Discovered:**
- Generator guard pattern in `generateAllOutputs`: `if (activationLevels && result.activation_map)` gates lifecycle states on having both activation levels AND a generated activation map
- CLI formatter guard pattern: `if (lifecycleStates?.states)` with inline type cast matches existing journey/revenue pattern
- Multi-line listing in summary format matches journey stages pattern — state names with time windows provide actionable context

**Gotchas:**
- The `lifecycle_states` response needs "lifecycle states" in the system prompt to match mock routing — the `LIFECYCLE_STATES_SYSTEM_PROMPT` constant includes this naturally

### 2026-02-13 - Story M007-E003-S002: Update Types and Validation for Property Inheritance and Heartbeat

**Files Changed:**
- `convex/analysis/outputs/types.ts` - Added `isHeartbeat: boolean` to EntityDefinition; added `Perspective` type ("customer" | "product" | "interaction") and `perspective` field to TrackingEvent; added `UserStateCriterion` and `UserState` interfaces; added `userStateModel: UserState[]` and `warnings?: string[]` to MeasurementSpec; made `entity_id` required on TrackingEvent; made `entities` required on MeasurementSpec; consolidated duplicate interface definitions
- `convex/analysis/outputs/generateMeasurementSpec.ts` - Updated system prompt for isHeartbeat, perspective, userStateModel; added heartbeat count validation (exactly 1); added perspective validation on events; added property duplication warning logic; added `parseUserStateModel()` for validating 5 required user states (new, activated, active, at_risk, dormant); parser now returns warnings array
- `convex/analysis/outputs/types.test.ts` - Added tests for Perspective, UserStateCriterion, UserState, isHeartbeat, perspective on TrackingEvent, userStateModel and warnings on MeasurementSpec; removed obsolete tests for optional entity_id/entities
- `convex/analysis/outputs/generateMeasurementSpec.test.ts` - Added heartbeat validation tests (4), perspective validation tests (4), property duplication warning tests (3), parseUserStateModel tests (8), missing userStateModel test; updated all fixtures with isHeartbeat, perspective, userStateModel
- `convex/analysis/outputs/orchestrate.test.ts` - Updated fixtures with isHeartbeat, perspective, userStateModel
- `src/components/product-profile/MeasurementSpecSection.test.tsx` - Updated fixtures with isHeartbeat, perspective, userStateModel; reassigned ungrouped events to entities

**Learnings:**
- Pre-existing duplicate interface definitions in types.ts (EntityDefinition defined twice, entity_id both required and optional, entities both required and optional) — consolidating them is necessary when making fields required
- Property duplication warnings (event props sharing names with parent entity props) are intentionally non-blocking — stored in `warnings?: string[]` rather than throwing
- `isHeartbeat === true` pattern handles backward compatibility when field may be missing from older LLM responses

**Patterns Discovered:**
- Warning vs error distinction: validation errors (wrong heartbeat count, invalid perspective, bad user state model) throw immediately; warnings (property name duplication) collect into an array and are returned alongside the parsed result
- Required user state names as a constant set enables both validation and clear error messages about which names are expected

**Gotchas:**
- Making entity_id required on TrackingEvent broke "ungrouped events" test in MeasurementSpecSection — resolved by assigning all test events to entities
- Pre-existing "Write outside of transaction" convex-test errors from scheduled functions still present — unrelated to this work

### 2026-02-12 - Story M006-E004-S001: Extend Measurement Spec Types for Entity Definitions

**Files Changed:**
- `convex/analysis/outputs/types.ts` - Added `EntityProperty`, `EntityDefinition` interfaces; added `isRequired` to `EventProperty`; added optional `entity_id` to `TrackingEvent`; restructured `MeasurementSpec` with nested `coverage` object and optional `entities` field
- `convex/analysis/outputs/generateMeasurementSpec.ts` - Fixed parser to use `isRequired` instead of `required` on EventProperty; added `entity_id` pass-through on parsed events
- `convex/analysis/outputs/generateMeasurementSpec.test.ts` - Added 7 tests: isRequired field parsing (3), optional entities (2), optional entity_id (2)
- `convex/analysis/outputs/types.test.ts` - Updated existing tests for new `isRequired` field and nested `coverage`; added 7 new tests for EntityProperty, EntityDefinition, TrackingEvent entity_id, MeasurementSpec entities
- `convex/analysis/outputs/orchestrate.test.ts` - Updated mock MeasurementSpec to use nested `coverage` and `isRequired` on EventProperty
- `src/components/product-profile/MeasurementSpecSection.test.tsx` - Updated mock MeasurementSpec to use nested `coverage`

**Learnings:**
- Pre-existing type drift: the parser already returned `coverage: { ... }` (nested object) while the type had flat fields — the type was the one out of sync, not the parser
- Pre-existing field name drift: parser was producing `required` on EventProperty while schema uses `isRequired` — both the type and parser needed alignment
- When fixing type drift, downstream test files need updating too — grep for the old field names across the whole codebase

**Patterns Discovered:**
- Entity types (EntityProperty vs EventProperty) are separate interfaces even though they share the same shape — they model different domain concepts (entity schema vs event payload)
- Optional fields (`entities?: EntityDefinition[]`, `entity_id?: string`) maintain backward compatibility — existing specs without entities continue to type-check

**Gotchas:**
- Worktree needs `npm install` — node_modules not shared between worktrees
- MeasurementSpecSection component doesn't reference `coverage` or `isRequired` directly (only uses `total_events`, `confidence`, event names/categories), but its test fixture needed updating

### 2026-02-11 - Story M005-E004-S001: Build MeasurementSpecSection Component

**Files Changed:**
- `src/components/product-profile/MeasurementSpecSection.tsx` - New: MeasurementSpecSection component with summary bar, category-grouped events, collapsible rows with property details, empty state
- `src/components/product-profile/MeasurementSpecSection.test.tsx` - New: 7 tests covering empty state, summary stats, category grouping, event details, collapsible properties

**Learnings:**
- Radix Collapsible works well outside of table rows — using grid-based layout with CollapsibleTrigger on a button avoids the div-in-tbody hydration issue
- JavaScript default parameters apply when the argument is `undefined`, so `setup(undefined)` with a default param silently uses the default — use `arguments.length` check for explicit undefined handling in tests

**Patterns Discovered:**
- Category color map pattern: `Record<string, { bg: string; text: string }>` with a default fallback for unknown categories
- Event grouping via reduce into `Record<string, TrackingEvent[]>` is clean and avoids sorting/re-sorting
- Grid-based "table" layout (CSS grid instead of HTML table) works better with Radix Collapsible since it avoids DOM nesting issues

**Gotchas:**
- `setup(undefined)` in vitest will trigger default parameter values — need explicit `arguments.length` check to test undefined prop behavior

### 2026-02-08 - Story M004-E004-S003: Measurement Spec Test Action

**Files Changed:**
- `convex/analysis/outputs/types.ts` - Cherry-picked from S002: MeasurementSpec, TrackingEvent, EventProperty, MeasurementInputData, ICPProfile, ActivationMap types
- `convex/analysis/outputs/aggregateMeasurementInputs.ts` - Cherry-picked from S002: stub aggregator that fetches value moments, activation levels, ICP profiles from product profile
- `convex/analysis/outputs/generateMeasurementSpec.ts` - Cherry-picked S002 internalAction + added `testGenerateMeasurementSpec` public action with timing, category counting, and dashboard logging
- `convex/analysis/outputs/generateMeasurementSpec.test.ts` - Cherry-picked S002 tests (41) + added 6 new return-shape tests for the test action

**Learnings:**
- Public test action pattern is thin: wrap internalAction call with timing + enriched return. Same pattern as `testRunAllLenses` in orchestrate.ts
- Category count reduce is simple enough to inline — extracting a utility would be over-engineering for a single-use computation
- Testing the reduce logic via a duplicated helper function in tests avoids needing Convex runtime for pure computation verification

**Patterns Discovered:**
- Test action pattern: `action` wraps `internalAction` via `ctx.runAction(internal...)`, adds `Date.now()` timing, computes derived fields, logs summary, returns enriched result
- Return-shape testing: duplicate the pure computation in test code to verify the logic independently from the Convex action runtime

**Gotchas:**
- S002 dependency files need to be cherry-picked since the S002 branch hasn't been merged to main yet
- Pre-existing UI test timeouts (AddActivityModal, AddEntityDialog, TrackingMaturityScreen) still present — unrelated to this work

### 2026-02-07 - Story M003-E001-S004: Lens Orchestration Pipeline

**Files Changed:**
- `convex/analysis/lenses/types.ts` - Added `AllLensesResult` interface with productId, candidates, per_lens timing, total_candidates, execution_time_ms, and errors fields
- `convex/analysis/lenses/orchestrate.ts` - New: `runAllLenses` internalAction + `testRunAllLenses` public action. Runs Batch 1 (4 lenses) in parallel via Promise.allSettled, builds context summary, then Batch 2 (3 lenses) in parallel with context
- `convex/analysis/lenses/orchestrate.test.ts` - New: 15 tests for orchestrator helper functions (buildBatch1ContextSummary, processSettledResults, AllLensesResult type, batch configuration)
- `convex/analysis/lenses/shared.ts` - Fixed `parseLensResponse` to set the `lens` field on candidates (was missing)
- `convex/analysis/lenses/extractInfoAsymmetry.ts` - Fixed return type to match `LensResult` interface (was using `lensType` + `overallConfidence`)
- `convex/analysis/lenses/extractDecisionEnablement.ts` - Fixed return type to match `LensResult` interface
- `convex/analysis/lenses/extractStateTransitions.ts` - Fixed return type to match `LensResult` interface
- `convex/analysis/lenses/*.ts` (all Batch 1 + Batch 2 files) - Cherry-picked from dependency branches

**Learnings:**
- Cherry-picking files from multiple worktree branches via `git checkout <branch> -- <path>` is effective for bringing in dependency work
- Batch 2 branch had divergent types.ts (different LensType values, different LensResult fields) — Batch 1 branch matched the canonical S001 spec
- `parseLensResponse` in shared.ts was not setting the `lens` field on `LensCandidate` — needed to be added as it's a required field in the type
- `Promise.allSettled` + `processSettledResults` pattern cleanly separates error collection from result processing
- Batch 2 lenses accept `batch1Results: v.any()` which makes passing structured context objects from the orchestrator straightforward

**Patterns Discovered:**
- Orchestrator pattern: separate pure helper functions (buildBatch1ContextSummary, processSettledResults) from the Convex action for testability
- Cross-branch dependency resolution: checkout files from dependency branches, fix incompatibilities, then build new functionality on top
- Context passing between batches: pass structured objects (not strings) that downstream lenses format themselves via their own `buildBatch1Context`

**Gotchas:**
- Pre-existing UI test timeouts (AddActivityModal, AddEntityDialog, TrackingMaturityScreen) still present — unrelated to this work
- Pre-existing "Write outside of transaction" convex-test errors from scheduled functions
- Worktree needs `npm install` — node_modules not shared between worktrees

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
