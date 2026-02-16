# Implementation Plan: Analysis Pipeline Integration

**Task:** basesignal-hgx (M008-E002-S002)
**Design:** docs/plans/2026-02-15-analysis-pipeline-integration-design.md

## Context

Integrate the full analysis pipeline into `packages/mcp-server/src/analysis/`: 7 lens extractors, convergence (validation, clustering, merge/tier), and 3 output generators. Every function that currently uses `ctx.runQuery` or `new Anthropic()` becomes a plain async function accepting `(pages, llm)`. Pure utility functions are imported from `@basesignal/core` (E001-S005/S006). The pipeline is data-in, data-out with no I/O inside.

## Dependencies

This story depends on three upstream stories:

| Dependency | What it provides | Fallback if not yet done |
|---|---|---|
| **M008-E001-S005** (analysis utilities) | `@basesignal/core` exports: `computeTfIdfVectors`, `cosineSimilarity`, `clusterCandidatesCore`, `UnionFind`, `buildCluster`, `canMerge`, `sameLens`, `candidateText`, `runValidationPipeline`, deterministic check functions | Define local copies in `analysis/convergence/` and replace with imports later |
| **M008-E001-S006** (convergence/tiering) | `@basesignal/core` exports: `assignTier`, `directMerge`, `capTierDistribution`, `validateConvergenceQuality`, convergence types | Same fallback -- define locally |
| **M008-E002-S001** (MCP server skeleton) | `packages/mcp-server/` package exists with `package.json`, build config | Create the analysis subdirectory structure; if package does not exist, create a minimal `packages/mcp-server/package.json` |
| **M008-E004-S003** (LLM provider) | `LlmProvider` interface and `LlmMessage`, `LlmOptions` types | Define the interface locally in `analysis/types.ts` |

If any dependency is not yet implemented, define local types/functions and add a `// TODO: import from @basesignal/core when E001-S005 lands` comment.

## File Structure

All files go under `packages/mcp-server/src/analysis/`:

```
packages/mcp-server/src/analysis/
  pipeline.ts              -- runAnalysisPipeline()
  types.ts                 -- PipelineInput, PipelineResult, ProgressEvent, CrawledPage, LlmProvider (if not from core)
  identity.ts              -- extractIdentity()
  activation-levels.ts     -- extractActivationLevels()
  lenses/
    index.ts               -- runAllLenses(), runLensBatch1(), runLensBatch2()
    shared.ts              -- buildPageContext(), buildProfileContext(), filterPages() (or import from core)
    capability-mapping.ts  -- extractCapabilityMapping() + SYSTEM_PROMPT + parser
    effort-elimination.ts  -- extractEffortElimination() + SYSTEM_PROMPT + parser
    time-compression.ts    -- extractTimeCompression() + SYSTEM_PROMPT + parser
    artifact-creation.ts   -- extractArtifactCreation() + SYSTEM_PROMPT + parser
    info-asymmetry.ts      -- extractInfoAsymmetry() + SYSTEM_PROMPT + parser
    decision-enablement.ts -- extractDecisionEnablement() + SYSTEM_PROMPT + parser
    state-transitions.ts   -- extractStateTransitions() + SYSTEM_PROMPT + parser
  convergence/
    index.ts               -- runConvergence()
    validate.ts            -- runValidationPipeline() wrapper + applyLlmReview()
    cluster.ts             -- clusterCandidatesLLM()
    converge.ts            -- convergeAndTier() + directMerge wrapper
    quality.ts             -- re-export or wrapper for validateConvergenceQuality()
  outputs/
    index.ts               -- generateAllOutputs()
    icp-profiles.ts        -- generateICPProfiles() + aggregateRoles() + prompt + parser
    activation-map.ts      -- generateActivationMap() + prompt + parser
    measurement-spec.ts    -- generateMeasurementSpec() + prompt + parser
```

Plus test files mirroring the structure:

```
packages/mcp-server/src/analysis/
  __tests__/
    pipeline.test.ts           -- Full integration test with mock LLM
    identity.test.ts
    activation-levels.test.ts
    lenses/
      capability-mapping.test.ts  -- Parser tests
      shared.test.ts
      index.test.ts               -- Batch orchestration
    convergence/
      validate.test.ts
      cluster.test.ts
      converge.test.ts
    outputs/
      icp-profiles.test.ts
      activation-map.test.ts
      measurement-spec.test.ts
    fixtures/
      mock-llm.ts              -- Mock LlmProvider
      pages.ts                 -- Sample CrawledPage[] fixtures
      responses.ts             -- Canned LLM response strings
```

## Implementation Steps

### Step 1: Create `analysis/types.ts` -- Pipeline I/O types

Define all pipeline-level types. If `LlmProvider` is not yet available from `@basesignal/core`, define it here.

```typescript
// Pipeline input/output types

export interface CrawledPage {
  url: string;
  title?: string;
  pageType: string;
  content: string;
}

export interface ProductContext {
  name?: string;
  description?: string;
  targetCustomer?: string;
}

export interface PipelineInput {
  pages: CrawledPage[];
  productContext?: ProductContext;
}

// LlmProvider interface (from E004-S003 or local definition)
export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LlmProvider {
  complete(messages: LlmMessage[], options?: LlmOptions): Promise<string>;
}

// Progress reporting
export type ProgressPhase =
  | 'identity'
  | 'activation_levels'
  | 'lenses_batch1'
  | 'lenses_batch2'
  | 'validation'
  | 'clustering'
  | 'convergence'
  | 'outputs_icp'
  | 'outputs_activation_map'
  | 'outputs_measurement_spec';

export interface ProgressEvent {
  phase: ProgressPhase;
  status: 'started' | 'completed' | 'failed';
  detail?: string;
}

export type OnProgress = (event: ProgressEvent) => void;

// Pipeline error
export interface PipelineError {
  phase: string;
  step: string;
  message: string;
}

// Pipeline result (references types from lenses/convergence/outputs)
// Forward-declared; concrete types imported from sub-modules
export interface PipelineResult {
  identity: IdentityResult | null;
  activation_levels: ActivationLevelsResult | null;
  lens_candidates: LensCandidate[];
  convergence: ConvergenceResult | null;
  outputs: {
    icp_profiles: ICPProfile[];
    activation_map: ActivationMap | null;
    measurement_spec: MeasurementSpec | null;
  };
  errors: PipelineError[];
  execution_time_ms: number;
}
```

Import the referenced result types from their sub-module files (LensCandidate from lenses, ConvergenceResult from convergence, output types from outputs). These types are copies of the existing Convex types minus the Convex-specific `Id<>` fields. Where possible, import from `@basesignal/core`.

**Tests:** No tests for types -- they are compile-time only.

---

### Step 2: Create `analysis/lenses/shared.ts` -- Shared lens utilities

Copy the pure functions from `convex/analysis/lenses/shared.ts` and the per-lens common patterns:

```typescript
import type { CrawledPage, LlmProvider, LlmMessage } from '../types';

// Constants
export const MAX_CONTENT_PER_PAGE = 15_000;
export const MAX_TOTAL_CONTENT = 40_000;

// Copy from convex/analysis/lenses/shared.ts:
// - truncateContent()
// - buildPageContext()  (accept CrawledPage[] instead of Doc<"crawledPages">[])
// - extractJson()
// - parseLensResponse()
// - normalizeConfidence()

// New utility: generic filterPages
export function filterPages(
  pages: CrawledPage[],
  allowedTypes: string[],
  priority: Record<string, number>,
): CrawledPage[] {
  return pages
    .filter((p) => allowedTypes.includes(p.pageType))
    .sort((a, b) => (priority[a.pageType] ?? 99) - (priority[b.pageType] ?? 99));
}

// New utility: build profile context string from ProductContext
export function buildProductContextString(ctx?: {
  name?: string;
  description?: string;
  targetCustomer?: string;
}): string {
  if (!ctx) return '';
  const parts: string[] = [];
  if (ctx.name) parts.push(`Product: ${ctx.name}`);
  if (ctx.description) parts.push(`Description: ${ctx.description}`);
  if (ctx.targetCustomer) parts.push(`Target: ${ctx.targetCustomer}`);
  return parts.join('\n');
}
```

The key change from the Convex originals: the page type (`CrawledPage` with `string` fields) replaces `Doc<"crawledPages">`. The function bodies are identical.

**Tests in `shared.test.ts`:** Copy relevant tests from `convex/analysis/lenses/shared.test.ts`, adapting imports:
- `truncateContent` preserves whole lines
- `buildPageContext` respects max limits
- `extractJson` handles code fences and raw JSON
- `parseLensResponse` validates required fields
- `filterPages` sorts by priority
- `buildProductContextString` handles missing fields

---

### Step 3: Extract 4 Batch 1 lens functions

For each of the 4 Batch 1 lenses, create one file following this pattern. Using `capability-mapping.ts` as the template:

**File: `analysis/lenses/capability-mapping.ts`**

```typescript
import type { CrawledPage, LlmProvider, ProductContext } from '../types';
import type { LensCandidate, LensResult } from './lens-types'; // local type file
import { filterPages, buildPageContext, buildProductContextString, extractJson } from './shared';

// PAGE_TYPES, PAGE_PRIORITY: copy verbatim from convex/analysis/lenses/extractCapabilityMapping.ts
const PAGE_TYPES = ['features', 'customers', 'homepage', 'about', 'help'];
const PAGE_PRIORITY: Record<string, number> = { features: 0, customers: 1, homepage: 2, about: 3, help: 4 };

// CAPABILITY_MAPPING_SYSTEM_PROMPT: copy verbatim from lines 111-163
export const CAPABILITY_MAPPING_SYSTEM_PROMPT = `...`; // exact copy

// parseCapabilityMappingResponse: copy verbatim from lines 167-218
export function parseCapabilityMappingResponse(responseText: string): LensCandidate[] {
  // ... exact copy of parser logic
}

// Decoupled extractor function
export async function extractCapabilityMapping(
  pages: CrawledPage[],
  llm: LlmProvider,
  productContext?: ProductContext,
): Promise<LensResult> {
  const startTime = Date.now();

  const relevantPages = filterPages(pages, PAGE_TYPES, PAGE_PRIORITY);
  if (relevantPages.length === 0) {
    throw new Error('No capability-relevant pages found');
  }

  const pageContext = buildPageContext(relevantPages);
  const profileContext = buildProductContextString(productContext);

  const userMessage = profileContext
    ? `${profileContext}\n\nAnalyze these pages for capability mapping:\n\n${pageContext}`
    : `Analyze these pages for capability mapping:\n\n${pageContext}`;

  const responseText = await llm.complete(
    [
      { role: 'system', content: CAPABILITY_MAPPING_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    { temperature: 0.2 },
  );

  const candidates = parseCapabilityMappingResponse(responseText);

  return {
    lens: 'capability_mapping',
    candidates,
    candidate_count: candidates.length,
    execution_time_ms: Date.now() - startTime,
  };
}
```

**What changes from the Convex original:**
1. `ctx.runQuery(internal.crawledPages.listByProductInternal, ...)` -- removed. Pages are a parameter.
2. `ctx.runQuery(internal.productProfiles.getInternal, ...)` -- removed. Product context is a parameter.
3. `callClaude({ system, user })` -- replaced with `llm.complete([{role:'system',...},{role:'user',...}], opts)`.
4. `internalAction` wrapper -- removed. Plain `export async function`.
5. `buildProfileContext(profile)` -- replaced with `buildProductContextString(productContext)`. The old function took a full Convex profile and pulled out identity/entities/outcomes. The new one takes a simplified `ProductContext` (name, description, targetCustomer).

**What does NOT change:** System prompt text, parser logic, page filtering logic, page priority order, response validation.

Repeat for the other 3 Batch 1 lenses, applying the same pattern:

| File | Source | System prompt const | Parser function | Page types |
|---|---|---|---|---|
| `effort-elimination.ts` | `convex/.../extractEffortElimination.ts` | `EFFORT_ELIMINATION_SYSTEM_PROMPT` | `parseEffortEliminationResponse` | features, customers, homepage, about, pricing |
| `time-compression.ts` | `convex/.../extractTimeCompression.ts` | `TIME_COMPRESSION_SYSTEM_PROMPT` | `parseTimeCompressionResponse` | features, customers, homepage, about, help |
| `artifact-creation.ts` | `convex/.../extractArtifactCreation.ts` | `ARTIFACT_CREATION_SYSTEM_PROMPT` | `parseArtifactCreationResponse` | features, customers, homepage, help |

Each follows the same pattern: remove Convex wrappers, accept `(pages, llm, productContext?)`, copy prompt and parser verbatim.

**Tests per lens (e.g., `capability-mapping.test.ts`):**
- Parser accepts valid JSON array and returns LensCandidate[]
- Parser rejects missing required fields (name, description, role, source_urls, lens-specific field)
- Parser handles code fences around JSON
- Parser normalizes confidence values

---

### Step 4: Extract 3 Batch 2 lens functions

Batch 2 lenses have an additional parameter: `batch1Context` (a record of Batch 1 results used to inform the extraction). The pattern is similar but adds the context injection.

**File: `analysis/lenses/info-asymmetry.ts`**

```typescript
import type { CrawledPage, LlmProvider, ProductContext } from '../types';
import type { LensResult, LensCandidate } from './lens-types';
import { filterPages, buildPageContext, buildProductContextString, parseLensResponse } from './shared';

const PAGE_TYPES = ['features', 'customers', 'help', 'homepage', 'solutions'];
const PAGE_PRIORITY: Record<string, number> = { features: 0, customers: 1, help: 2, homepage: 3, solutions: 4 };

// Copy SYSTEM_PROMPT verbatim from convex/.../extractInfoAsymmetry.ts

// Copy buildBatch1Context() from the Convex file
export function buildBatch1Context(
  batch1Results: Record<string, { candidates: Array<{ name: string; description: string }> }> | undefined,
): string { /* ... exact copy ... */ }

export async function extractInfoAsymmetry(
  pages: CrawledPage[],
  llm: LlmProvider,
  batch1Context?: Record<string, { candidates: Array<{ name: string; description: string }> }>,
  productContext?: ProductContext,
): Promise<LensResult> {
  const startTime = Date.now();
  const filtered = filterPages(pages, PAGE_TYPES, PAGE_PRIORITY);
  if (filtered.length === 0) throw new Error('No info-asymmetry-relevant pages found');

  const pageContext = buildPageContext(filtered);
  const profileCtx = buildProductContextString(productContext);
  const b1Ctx = buildBatch1Context(batch1Context);

  let userMessage = '';
  if (profileCtx) userMessage += profileCtx + '\n\n';
  if (b1Ctx) userMessage += b1Ctx + '\n\n';
  userMessage += `Analyze these pages for information asymmetries:\n\n${pageContext}`;

  const responseText = await llm.complete(
    [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userMessage }],
    { temperature: 0.2 },
  );

  const candidates = parseLensResponse(responseText, 'info_asymmetry', 'information_gained');

  return {
    lens: 'info_asymmetry',
    candidates,
    candidate_count: candidates.length,
    execution_time_ms: Date.now() - startTime,
  };
}
```

**Key difference from Batch 1:** Batch 2 lenses receive `batch1Context` and use the shared `parseLensResponse()` from `shared.ts` instead of lens-specific parsers. The Convex originals also use `buildKnowledgeContext(profile)` which reads full profile data -- we replace this with `buildProductContextString(productContext)` since we have a simplified input.

Repeat for:
| File | Source | Page types |
|---|---|---|
| `decision-enablement.ts` | `convex/.../extractDecisionEnablement.ts` | features, solutions, customers, homepage |
| `state-transitions.ts` | `convex/.../extractStateTransitions.ts` | customers, features, onboarding, help, homepage |

**Tests per Batch 2 lens:**
- Same parser tests as Batch 1 (parseLensResponse is generic, tested in shared.test.ts)
- `buildBatch1Context` produces expected format with lens findings
- `buildBatch1Context` returns empty string when no batch1Results

---

### Step 5: Create `analysis/lenses/index.ts` -- Lens orchestration

```typescript
import type { CrawledPage, LlmProvider, ProductContext } from '../types';
import type { LensResult, LensCandidate } from './lens-types';
import { extractCapabilityMapping } from './capability-mapping';
import { extractEffortElimination } from './effort-elimination';
import { extractTimeCompression } from './time-compression';
import { extractArtifactCreation } from './artifact-creation';
import { extractInfoAsymmetry } from './info-asymmetry';
import { extractDecisionEnablement } from './decision-enablement';
import { extractStateTransitions } from './state-transitions';

// Re-export buildBatch1ContextSummary from convex orchestrate.ts
export function buildBatch1ContextSummary(
  batch1Results: LensResult[],
): Record<string, { candidates: Array<{ name: string; description: string }> }> {
  // Copy from convex/analysis/lenses/orchestrate.ts lines 23-38
}

export interface AllLensesResult {
  batch1Results: LensResult[];
  batch2Results: LensResult[];
  allCandidates: LensCandidate[];
  errors: Array<{ lens: string; error: string }>;
  execution_time_ms: number;
}

export async function runAllLenses(
  pages: CrawledPage[],
  llm: LlmProvider,
  productContext?: ProductContext,
): Promise<AllLensesResult> {
  const startTime = Date.now();
  const errors: Array<{ lens: string; error: string }> = [];

  // Batch 1: 4 parallel lenses
  const batch1Settled = await Promise.allSettled([
    extractCapabilityMapping(pages, llm, productContext),
    extractEffortElimination(pages, llm, productContext),
    extractTimeCompression(pages, llm, productContext),
    extractArtifactCreation(pages, llm, productContext),
  ]);

  const batch1Results: LensResult[] = [];
  const batch1Names = ['capability_mapping', 'effort_elimination', 'time_compression', 'artifact_creation'];
  for (let i = 0; i < batch1Settled.length; i++) {
    const result = batch1Settled[i];
    if (result.status === 'fulfilled') {
      batch1Results.push(result.value);
    } else {
      errors.push({ lens: batch1Names[i], error: String(result.reason) });
    }
  }

  // Build Batch 1 context for Batch 2
  const batch1Context = buildBatch1ContextSummary(batch1Results);

  // Batch 2: 3 parallel lenses with Batch 1 context
  const batch2Settled = await Promise.allSettled([
    extractInfoAsymmetry(pages, llm, batch1Context, productContext),
    extractDecisionEnablement(pages, llm, batch1Context, productContext),
    extractStateTransitions(pages, llm, batch1Context, productContext),
  ]);

  const batch2Results: LensResult[] = [];
  const batch2Names = ['info_asymmetry', 'decision_enablement', 'state_transitions'];
  for (let i = 0; i < batch2Settled.length; i++) {
    const result = batch2Settled[i];
    if (result.status === 'fulfilled') {
      batch2Results.push(result.value);
    } else {
      errors.push({ lens: batch2Names[i], error: String(result.reason) });
    }
  }

  const allCandidates = [...batch1Results, ...batch2Results].flatMap(r => r.candidates);

  return {
    batch1Results,
    batch2Results,
    allCandidates,
    errors,
    execution_time_ms: Date.now() - startTime,
  };
}
```

**Tests in `lenses/index.test.ts`:**
- With mock LLM returning valid JSON for all lenses, `runAllLenses` returns 7 lens results
- If one Batch 1 lens fails, the other 3 succeed and Batch 2 still runs with partial context
- If a Batch 2 lens fails, the error is captured but candidates from other lenses are returned
- `buildBatch1ContextSummary` produces correct structure with top 5 candidates per lens

---

### Step 6: Create `analysis/convergence/validate.ts`

This wraps the pure `runValidationPipeline` (imported from `@basesignal/core` or copied locally) and the LLM-dependent `applyLlmReview`.

```typescript
import type { LlmProvider } from '../types';
// Import pure functions from @basesignal/core (or local copies)
import {
  runValidationPipeline,
  buildKnownFeaturesSet,
  type ValidatedCandidate,
  type LensResult,
} from './core-imports'; // placeholder for @basesignal/core

// Copy VALIDATION_SYSTEM_PROMPT from convex/.../validateCandidates.ts
// Copy buildLlmPrompt from convex/.../validateCandidates.ts
// Copy parseLlmResponse from convex/.../validateCandidates.ts

export async function applyLlmReview(
  results: ValidatedCandidate[],
  flaggedCandidates: Array<{
    id: string; name: string; description: string; lens: string; flags: string[];
  }>,
  knownFeatures: Set<string>,
  llm: LlmProvider,
): Promise<ValidatedCandidate[]> {
  if (flaggedCandidates.length === 0) return results;

  const prompt = buildLlmPrompt(flaggedCandidates, Array.from(knownFeatures));

  try {
    const responseText = await llm.complete(
      [
        { role: 'system', content: VALIDATION_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      { model: 'haiku', temperature: 0.2, maxTokens: 2048 },
    );

    const llmResults = parseLlmResponse(responseText);
    // Apply results back to validated candidates -- same logic as convex original
    for (const llmResult of llmResults) {
      const idx = results.findIndex((r) => r.id === llmResult.id);
      if (idx === -1) continue;
      // ... same application logic ...
    }
  } catch {
    // Graceful degradation: keep deterministic flags
  }

  return results;
}
```

**What changes:** `new Anthropic({ apiKey }).messages.create(...)` becomes `llm.complete(messages, opts)`.

**Tests in `convergence/validate.test.ts`:**
- Pure `runValidationPipeline` tests are imported/copied from existing `validateCandidates.test.ts`
- `applyLlmReview` with mock LLM that returns valid JSON actions
- `applyLlmReview` gracefully degrades when LLM throws

---

### Step 7: Create `analysis/convergence/cluster.ts`

```typescript
import type { LlmProvider } from '../types';
import { buildClusteringPrompt, parseClusteringResponse, CLUSTERING_SYSTEM_PROMPT } from './prompts';
// Import pure fallback from @basesignal/core
import { clusterCandidatesCore } from './core-imports';

export async function clusterCandidatesLLM(
  candidates: ValidatedCandidate[],
  llm: LlmProvider,
): Promise<CandidateCluster[]> {
  if (candidates.length === 0) return [];

  const responseText = await llm.complete(
    [
      { role: 'system', content: CLUSTERING_SYSTEM_PROMPT },
      { role: 'user', content: buildClusteringPrompt(candidates) },
    ],
    { temperature: 0.2, maxTokens: 4096 },
  );

  return parseClusteringResponse(responseText, candidates);
}
```

Copy `CLUSTERING_SYSTEM_PROMPT`, `buildClusteringPrompt`, and `parseClusteringResponse` from `convex/analysis/convergence/clusterCandidates.ts`. These are already pure functions -- only the LLM call mechanism changes.

**Tests:** Copy `parseClusteringResponse` tests from `clusterCandidates.test.ts`. Add:
- `clusterCandidatesLLM` with mock LLM returning valid cluster JSON
- Empty input returns `[]`

---

### Step 8: Create `analysis/convergence/converge.ts`

```typescript
import type { LlmProvider } from '../types';
import type { CandidateCluster, ValueMoment, ConvergenceResult } from './convergence-types';

// Copy from convex/.../convergeAndTier.ts:
// - assignTier()
// - parseMergeResponse()
// - directMerge()
// - capTierDistribution()
// - MERGE_SYSTEM_PROMPT
// - buildMergePrompt()
// Or import from @basesignal/core if available

export async function convergeAndTier(
  clusters: CandidateCluster[],
  llm: LlmProvider,
): Promise<ValueMoment[]> {
  const results = await Promise.allSettled(
    clusters.map(async (cluster): Promise<ValueMoment> => {
      const responseText = await llm.complete(
        [
          { role: 'system', content: MERGE_SYSTEM_PROMPT },
          { role: 'user', content: buildMergePrompt(cluster) },
        ],
        { temperature: 0.2, maxTokens: 4096 },
      );

      const parsed = parseMergeResponse(responseText);

      return {
        id: `moment-${cluster.cluster_id}`,
        name: parsed.name,
        description: parsed.description,
        tier: assignTier(cluster.lens_count),
        lenses: cluster.lenses,
        lens_count: cluster.lens_count,
        roles: parsed.roles,
        product_surfaces: parsed.product_surfaces,
        contributing_candidates: cluster.candidates.map((c) => c.id),
      };
    }),
  );

  return results.map((result, i) => {
    if (result.status === 'fulfilled') return result.value;
    console.warn(`LLM merge failed for cluster ${clusters[i].cluster_id}, using directMerge fallback`);
    return directMerge(clusters[i]);
  });
}
```

**What changes:** `client.messages.create(...)` becomes `llm.complete(messages, opts)`. The `Anthropic.TextBlock` extraction is unnecessary since `llm.complete` returns a plain string.

**Tests in `convergence/converge.test.ts`:**
- `assignTier` maps lens counts correctly (copy from `convergeAndTier.test.ts`)
- `parseMergeResponse` validates required fields (copy existing tests)
- `directMerge` produces fallback ValueMoment (copy existing tests)
- `capTierDistribution` enforces T1 max 3, T3 max 20 (copy existing tests)
- `convergeAndTier` with mock LLM returning valid merge JSON
- `convergeAndTier` falls back to `directMerge` when LLM throws

---

### Step 9: Create `analysis/convergence/index.ts` -- Convergence orchestration

```typescript
import type { LlmProvider, OnProgress, PipelineError } from '../types';
import type { LensResult } from '../lenses/lens-types';
import type { ConvergenceResult, ValidatedCandidate } from './convergence-types';
import { runValidationPipeline } from './validate';
import { clusterCandidatesLLM } from './cluster';
import { clusterCandidatesCore } from './core-imports'; // fallback
import { convergeAndTier } from './converge';
import { capTierDistribution, validateConvergenceQuality } from './quality';

export async function runConvergence(
  lensResults: LensResult[],
  llm: LlmProvider,
  knownFeatures?: Set<string>,
  progress?: OnProgress,
): Promise<ConvergenceResult> {
  const features = knownFeatures ?? new Set<string>();

  // 1. Validation
  progress?.({ phase: 'validation', status: 'started' });
  const validated = runValidationPipeline(lensResults, features);
  const active = validated.filter(c => c.validation_status !== 'removed');
  progress?.({ phase: 'validation', status: 'completed', detail: `${active.length} active candidates` });

  // 2. Clustering (LLM first, TF-IDF fallback)
  progress?.({ phase: 'clustering', status: 'started' });
  let clusters;
  try {
    clusters = await clusterCandidatesLLM(active, llm);
  } catch {
    clusters = clusterCandidatesCore(active);
  }
  progress?.({ phase: 'clustering', status: 'completed', detail: `${clusters.length} clusters` });

  // 3. Converge and tier
  progress?.({ phase: 'convergence', status: 'started' });
  const rawMoments = await convergeAndTier(clusters, llm);
  const valueMoments = capTierDistribution(rawMoments);
  progress?.({ phase: 'convergence', status: 'completed', detail: `${valueMoments.length} moments` });

  // 4. Build result with stats
  const result: ConvergenceResult = {
    value_moments: valueMoments,
    clusters,
    stats: {
      total_candidates: active.length,
      total_clusters: clusters.length,
      total_moments: valueMoments.length,
      tier_1_count: valueMoments.filter(m => m.tier === 1).length,
      tier_2_count: valueMoments.filter(m => m.tier === 2).length,
      tier_3_count: valueMoments.filter(m => m.tier === 3).length,
    },
  };

  // 5. Quality validation (non-blocking)
  try {
    result.quality = validateConvergenceQuality(result);
  } catch { /* ignore */ }

  return result;
}
```

**Tests:**
- Full convergence with mock LLM: lensResults in, ConvergenceResult out
- Clustering falls back to TF-IDF when LLM throws
- Quality report is attached

---

### Step 10: Create `analysis/identity.ts`

```typescript
import type { CrawledPage, LlmProvider } from './types';

// Copy from convex/analysis/extractIdentity.ts:
// - filterIdentityPages()
// - buildPageContext() (or import from lenses/shared)
// - parseIdentityResponse()
// - SYSTEM_PROMPT

export interface IdentityResult {
  productName: string;
  description: string;
  targetCustomer: string;
  businessModel: string;
  industry?: string;
  companyStage?: string;
  confidence: number;
  evidence: Array<{ url: string; excerpt: string }>;
}

export async function extractIdentity(
  pages: CrawledPage[],
  llm: LlmProvider,
): Promise<IdentityResult> {
  const identityPages = filterIdentityPages(pages);
  if (identityPages.length === 0) throw new Error('No homepage, about, or features pages found');

  const pageContext = buildPageContext(identityPages);

  const responseText = await llm.complete(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Extract the core identity from these website pages:\n\n${pageContext}` },
    ],
    { model: 'haiku', maxTokens: 1024 },
  );

  return parseIdentityResponse(responseText);
}
```

**Tests:** Copy parser tests from `extractIdentity.test.ts`.

---

### Step 11: Create `analysis/activation-levels.ts`

```typescript
import type { CrawledPage, LlmProvider, ProductContext } from './types';

// Copy from convex/analysis/extractActivationLevels.ts:
// - types: SignalStrength, ActivationCriterion, ActivationLevel, ActivationLevelsResult
// - filterActivationPages()
// - buildActivationPageContext()
// - ACTIVATION_SYSTEM_PROMPT
// - parseActivationLevelsResponse()

export async function extractActivationLevels(
  pages: CrawledPage[],
  llm: LlmProvider,
  productContext?: ProductContext,
): Promise<ActivationLevelsResult> {
  const activationPages = filterActivationPages(pages);
  if (activationPages.length === 0) throw new Error('No activation-relevant pages found');

  const pageContext = buildActivationPageContext(activationPages);

  let identityContext = '';
  if (productContext?.name) {
    identityContext = `Product: ${productContext.name}`;
    if (productContext.description) identityContext += `\nDescription: ${productContext.description}`;
    if (productContext.targetCustomer) identityContext += `\nTarget customer: ${productContext.targetCustomer}`;
  }

  const userMessage = identityContext
    ? `${identityContext}\n\nExtract activation levels from:\n\n${pageContext}`
    : `Extract activation levels from:\n\n${pageContext}`;

  const responseText = await llm.complete(
    [
      { role: 'system', content: ACTIVATION_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    { model: 'haiku', maxTokens: 2048 },
  );

  return parseActivationLevelsResponse(responseText);
}
```

**Tests:** Copy parser tests from `extractActivationLevels.test.ts`.

---

### Step 12: Create output generators

**File: `analysis/outputs/icp-profiles.ts`**

Copy from `convex/analysis/outputs/generateICPProfiles.ts`:
- `ICP_SYSTEM_PROMPT`
- `RoleInput` type
- `buildICPPrompt()`
- `parseICPProfiles()`
- `aggregateRoles()` (inline helper)

```typescript
export async function generateICPProfiles(
  valueMoments: ValueMoment[],
  targetCustomer: string,
  llm: LlmProvider,
): Promise<ICPProfile[]> {
  const roles = aggregateRoles(valueMoments);
  const prompt = buildICPPrompt(roles, targetCustomer);

  const responseText = await llm.complete(
    [
      { role: 'system', content: ICP_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.3 },
  );

  return parseICPProfiles(responseText);
}
```

**File: `analysis/outputs/activation-map.ts`**

Copy from `convex/analysis/outputs/generateActivationMap.ts`:
- `ACTIVATION_MAP_SYSTEM_PROMPT`
- `buildActivationMapUserPrompt()`
- `parseActivationMapResponse()`
- Types: `ActivationMapStage`, `ActivationMapTransition`, `ActivationMap`

```typescript
export async function generateActivationMap(
  activationLevels: ActivationLevel[],
  valueMoments: ValueMoment[],
  primaryActivation: number,
  llm: LlmProvider,
): Promise<ActivationMap> {
  const userPrompt = buildActivationMapUserPrompt(activationLevels, valueMoments, primaryActivation);
  const responseText = await llm.complete(
    [
      { role: 'system', content: ACTIVATION_MAP_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.2 },
  );
  return parseActivationMapResponse(responseText);
}
```

**File: `analysis/outputs/measurement-spec.ts`**

Copy from `convex/analysis/outputs/generateMeasurementSpec.ts`:
- `MEASUREMENT_SPEC_SYSTEM_PROMPT`
- `buildMeasurementSpecPrompt()`
- `parseMeasurementSpecResponse()`
- All helper parsers: `parseEntities`, `parseUserStateModel`, `computePerspectiveDistribution`
- Types from `outputs/types.ts`

```typescript
export async function generateMeasurementSpec(
  inputData: MeasurementInputData,
  llm: LlmProvider,
): Promise<MeasurementSpec> {
  const { system, user } = buildMeasurementSpecPrompt(inputData);
  const responseText = await llm.complete(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { temperature: 0.2 },
  );
  return parseMeasurementSpecResponse(responseText);
}
```

**Tests per output generator:** Copy parser tests from the corresponding Convex test files. The parsers are pure functions and their tests transfer directly.

---

### Step 13: Create `analysis/outputs/index.ts` -- Output orchestration

```typescript
import type { LlmProvider, OnProgress, PipelineError } from '../types';

export interface OutputsResult {
  icp_profiles: ICPProfile[];
  activation_map: ActivationMap | null;
  measurement_spec: MeasurementSpec | null;
}

export async function generateAllOutputs(
  convergence: ConvergenceResult,
  activationLevels: ActivationLevelsResult | null,
  identity: IdentityResult | null,
  llm: LlmProvider,
  progress?: OnProgress,
  errors?: PipelineError[],
): Promise<OutputsResult> {
  const result: OutputsResult = {
    icp_profiles: [],
    activation_map: null,
    measurement_spec: null,
  };

  // 1. ICP profiles
  progress?.({ phase: 'outputs_icp', status: 'started' });
  try {
    result.icp_profiles = await generateICPProfiles(
      convergence.value_moments,
      identity?.targetCustomer ?? '',
      llm,
    );
    progress?.({ phase: 'outputs_icp', status: 'completed', detail: `${result.icp_profiles.length} profiles` });
  } catch (e) {
    progress?.({ phase: 'outputs_icp', status: 'failed', detail: String(e) });
    errors?.push({ phase: 'outputs', step: 'icp_profiles', message: String(e) });
  }

  // 2. Activation map (requires activation levels)
  if (activationLevels) {
    progress?.({ phase: 'outputs_activation_map', status: 'started' });
    try {
      result.activation_map = await generateActivationMap(
        activationLevels.levels,
        convergence.value_moments,
        activationLevels.primaryActivation,
        llm,
      );
      progress?.({ phase: 'outputs_activation_map', status: 'completed' });
    } catch (e) {
      progress?.({ phase: 'outputs_activation_map', status: 'failed', detail: String(e) });
      errors?.push({ phase: 'outputs', step: 'activation_map', message: String(e) });
    }
  }

  // 3. Measurement spec (uses ICP and activation map)
  progress?.({ phase: 'outputs_measurement_spec', status: 'started' });
  try {
    const inputData = assembleMeasurementInput(
      convergence, activationLevels, result.icp_profiles, result.activation_map,
    );
    result.measurement_spec = await generateMeasurementSpec(inputData, llm);
    progress?.({ phase: 'outputs_measurement_spec', status: 'completed' });
  } catch (e) {
    progress?.({ phase: 'outputs_measurement_spec', status: 'failed', detail: String(e) });
    errors?.push({ phase: 'outputs', step: 'measurement_spec', message: String(e) });
  }

  return result;
}
```

The `assembleMeasurementInput` helper constructs `MeasurementInputData` from the pipeline's intermediate results, equivalent to `aggregateMeasurementInputsCore` but operating on in-memory data rather than a DB profile.

---

### Step 14: Create `analysis/pipeline.ts` -- Top-level orchestrator

```typescript
import type { PipelineInput, PipelineResult, PipelineError, LlmProvider, OnProgress } from './types';
import { extractIdentity } from './identity';
import { extractActivationLevels } from './activation-levels';
import { runAllLenses } from './lenses';
import { runConvergence } from './convergence';
import { generateAllOutputs } from './outputs';

function settledOrError<T>(
  result: PromiseSettledResult<T>,
  phase: string,
  step: string,
  errors: PipelineError[],
): T | null {
  if (result.status === 'fulfilled') return result.value;
  errors.push({ phase, step, message: String(result.reason) });
  return null;
}

export async function runAnalysisPipeline(
  input: PipelineInput,
  llm: LlmProvider,
  onProgress?: OnProgress,
): Promise<PipelineResult> {
  const progress = onProgress ?? (() => {});
  const errors: PipelineError[] = [];
  const start = Date.now();

  if (input.pages.length === 0) {
    return {
      identity: null,
      activation_levels: null,
      lens_candidates: [],
      convergence: null,
      outputs: { icp_profiles: [], activation_map: null, measurement_spec: null },
      errors: [{ phase: 'input', step: 'validate', message: 'No pages provided' }],
      execution_time_ms: Date.now() - start,
    };
  }

  // Phase 1: Identity + Activation Levels (parallel, independent)
  progress({ phase: 'identity', status: 'started' });
  progress({ phase: 'activation_levels', status: 'started' });

  const [identityResult, activationResult] = await Promise.allSettled([
    extractIdentity(input.pages, llm),
    extractActivationLevels(input.pages, llm, input.productContext),
  ]);

  const identity = settledOrError(identityResult, 'identity', 'extract', errors);
  if (identity) progress({ phase: 'identity', status: 'completed' });
  else progress({ phase: 'identity', status: 'failed' });

  const activation_levels = settledOrError(activationResult, 'activation_levels', 'extract', errors);
  if (activation_levels) progress({ phase: 'activation_levels', status: 'completed' });
  else progress({ phase: 'activation_levels', status: 'failed' });

  // Build product context from identity result (enriches lens extraction)
  const productContext = identity
    ? { name: identity.productName, description: identity.description, targetCustomer: identity.targetCustomer }
    : input.productContext;

  // Phase 2: Lens extraction (Batch 1 -> Batch 2)
  const lensResult = await runAllLenses(input.pages, llm, productContext);
  for (const err of lensResult.errors) {
    errors.push({ phase: 'lenses', step: err.lens, message: err.error });
  }

  // Phase 3: Convergence (validation -> clustering -> merge/tier)
  let convergence = null;
  const allLensResults = [...lensResult.batch1Results, ...lensResult.batch2Results];
  if (allLensResults.length > 0) {
    try {
      convergence = await runConvergence(allLensResults, llm, undefined, progress);
    } catch (e) {
      errors.push({ phase: 'convergence', step: 'full', message: String(e) });
    }
  }

  // Phase 4: Output generation
  let outputs = { icp_profiles: [] as any[], activation_map: null as any, measurement_spec: null as any };
  if (convergence) {
    outputs = await generateAllOutputs(convergence, activation_levels, identity, llm, progress, errors);
  }

  return {
    identity,
    activation_levels,
    lens_candidates: lensResult.allCandidates,
    convergence,
    outputs,
    errors,
    execution_time_ms: Date.now() - start,
  };
}
```

---

### Step 15: Write integration test and mock LLM provider

**File: `__tests__/fixtures/mock-llm.ts`**

```typescript
import type { LlmProvider, LlmMessage, LlmOptions } from '../../types';

// Canned responses keyed by a substring in the system prompt
const FIXTURE_RESPONSES: Array<{ match: string; response: string }> = [
  { match: 'Capability Mapping', response: JSON.stringify([/* 2 sample candidates */]) },
  { match: 'Effort Elimination', response: JSON.stringify([/* 2 sample candidates */]) },
  { match: 'Time Compression', response: JSON.stringify([/* 2 sample candidates */]) },
  { match: 'Artifact Creation', response: JSON.stringify([/* 2 sample candidates */]) },
  { match: 'Information Asymmetry', response: JSON.stringify([/* 2 sample candidates */]) },
  { match: 'Decision Enablement', response: JSON.stringify([/* 2 sample candidates */]) },
  { match: 'State Transitions', response: JSON.stringify([/* 2 sample candidates */]) },
  { match: 'Extract the core identity', response: JSON.stringify({ /* identity fixture */ }) },
  { match: 'activation progression', response: JSON.stringify({ /* activation fixture */ }) },
  { match: 'grouping value moment candidates', response: JSON.stringify([/* cluster fixture */]) },
  { match: 'merging value moment candidates', response: JSON.stringify({ /* merge fixture */ }) },
  { match: 'Ideal Customer Profiles', response: JSON.stringify([/* ICP fixture */]) },
  { match: 'activation map', response: JSON.stringify({ /* activation map fixture */ }) },
  { match: 'measurement specification', response: JSON.stringify({ /* measurement spec fixture */ }) },
  { match: 'Review flagged', response: JSON.stringify([/* validation review fixture */]) },
];

export function createMockLlm(): LlmProvider & { callCount: number; calls: Array<{ messages: LlmMessage[]; options?: LlmOptions }> } {
  const state = {
    callCount: 0,
    calls: [] as Array<{ messages: LlmMessage[]; options?: LlmOptions }>,
  };

  return {
    ...state,
    async complete(messages: LlmMessage[], options?: LlmOptions): Promise<string> {
      state.callCount++;
      state.calls.push({ messages, options });

      const systemPrompt = messages.find(m => m.role === 'system')?.content ?? '';
      for (const fixture of FIXTURE_RESPONSES) {
        if (systemPrompt.includes(fixture.match)) return fixture.response;
      }
      return '[]'; // fallback
    },
  };
}
```

**File: `__tests__/pipeline.test.ts`**

```typescript
describe('runAnalysisPipeline', () => {
  it('runs the full pipeline and returns PipelineResult', async () => {
    const mockLlm = createMockLlm();
    const input: PipelineInput = {
      pages: [
        { url: 'https://example.com', title: 'Home', pageType: 'homepage', content: 'Example product...' },
        { url: 'https://example.com/features', title: 'Features', pageType: 'features', content: 'Feature list...' },
      ],
    };

    const result = await runAnalysisPipeline(input, mockLlm);

    expect(result.identity).not.toBeNull();
    expect(result.activation_levels).not.toBeNull();
    expect(result.lens_candidates.length).toBeGreaterThan(0);
    expect(result.convergence).not.toBeNull();
    expect(result.outputs.icp_profiles.length).toBeGreaterThan(0);
    expect(result.execution_time_ms).toBeGreaterThan(0);
    // ~28-38 LLM calls expected
    expect(mockLlm.callCount).toBeGreaterThan(10);
  });

  it('returns partial results when identity extraction fails', async () => {
    // Mock that throws on identity prompt
    // Assert: identity is null, other phases still produce results
  });

  it('returns empty result when no pages provided', async () => {
    const result = await runAnalysisPipeline({ pages: [] }, createMockLlm());
    expect(result.errors).toHaveLength(1);
    expect(result.lens_candidates).toHaveLength(0);
  });

  it('reports progress for each phase', async () => {
    const events: ProgressEvent[] = [];
    await runAnalysisPipeline(input, mockLlm, (event) => events.push(event));
    expect(events.some(e => e.phase === 'identity')).toBe(true);
    expect(events.some(e => e.phase === 'lenses_batch1')).toBe(true);
    expect(events.some(e => e.phase === 'convergence')).toBe(true);
  });
});
```

---

### Step 16: Create lens type definitions

**File: `analysis/lenses/lens-types.ts`**

Copy `LensType`, `LensCandidate`, `LensResult`, `AllLensesResult`, and `ConfidenceLevel` from `convex/analysis/lenses/types.ts`. These types are identical -- no Convex-specific fields.

If `@basesignal/core` already exports these (from E001-S002), import instead of duplicating.

---

## Order of Implementation

| # | What | Depends on | Estimated LOC |
|---|---|---|---|
| 1 | `types.ts` | nothing | ~80 |
| 2 | `lenses/lens-types.ts` | nothing | ~50 |
| 3 | `lenses/shared.ts` + tests | types.ts | ~120 + ~80 tests |
| 4 | 4 Batch 1 lens files + tests | shared.ts, lens-types.ts | 4 x ~100 + 4 x ~50 tests |
| 5 | 3 Batch 2 lens files + tests | shared.ts, lens-types.ts | 3 x ~90 + 3 x ~40 tests |
| 6 | `lenses/index.ts` + test | all lens files | ~100 + ~60 tests |
| 7 | `convergence/validate.ts` + test | types.ts, core imports | ~120 + ~50 tests |
| 8 | `convergence/cluster.ts` + test | types.ts, core imports | ~60 + ~40 tests |
| 9 | `convergence/converge.ts` + test | types.ts, core imports | ~150 + ~80 tests |
| 10 | `convergence/quality.ts` | core imports | ~20 (re-export) |
| 11 | `convergence/index.ts` + test | all convergence files | ~80 + ~40 tests |
| 12 | `identity.ts` + test | types.ts, shared.ts | ~80 + ~40 tests |
| 13 | `activation-levels.ts` + test | types.ts | ~100 + ~50 tests |
| 14 | `outputs/icp-profiles.ts` + test | types.ts | ~120 + ~60 tests |
| 15 | `outputs/activation-map.ts` + test | types.ts | ~120 + ~60 tests |
| 16 | `outputs/measurement-spec.ts` + test | types.ts | ~200 + ~80 tests |
| 17 | `outputs/index.ts` + test | all output files | ~80 + ~30 tests |
| 18 | `pipeline.ts` + test | everything above | ~100 + ~60 tests |
| 19 | Mock LLM fixtures | types.ts | ~80 |
| 20 | Integration test | pipeline.ts, mock LLM | ~100 |

**Total estimated:** ~2,200 LOC production + ~1,000 LOC tests.

## Files Changed

| File | Change |
|---|---|
| `packages/mcp-server/src/analysis/types.ts` | **NEW** -- Pipeline I/O types, LlmProvider interface |
| `packages/mcp-server/src/analysis/pipeline.ts` | **NEW** -- Top-level `runAnalysisPipeline()` |
| `packages/mcp-server/src/analysis/identity.ts` | **NEW** -- `extractIdentity()` |
| `packages/mcp-server/src/analysis/activation-levels.ts` | **NEW** -- `extractActivationLevels()` |
| `packages/mcp-server/src/analysis/lenses/lens-types.ts` | **NEW** -- LensCandidate, LensResult, LensType |
| `packages/mcp-server/src/analysis/lenses/shared.ts` | **NEW** -- buildPageContext, extractJson, parseLensResponse |
| `packages/mcp-server/src/analysis/lenses/capability-mapping.ts` | **NEW** -- extractCapabilityMapping() |
| `packages/mcp-server/src/analysis/lenses/effort-elimination.ts` | **NEW** -- extractEffortElimination() |
| `packages/mcp-server/src/analysis/lenses/time-compression.ts` | **NEW** -- extractTimeCompression() |
| `packages/mcp-server/src/analysis/lenses/artifact-creation.ts` | **NEW** -- extractArtifactCreation() |
| `packages/mcp-server/src/analysis/lenses/info-asymmetry.ts` | **NEW** -- extractInfoAsymmetry() |
| `packages/mcp-server/src/analysis/lenses/decision-enablement.ts` | **NEW** -- extractDecisionEnablement() |
| `packages/mcp-server/src/analysis/lenses/state-transitions.ts` | **NEW** -- extractStateTransitions() |
| `packages/mcp-server/src/analysis/lenses/index.ts` | **NEW** -- runAllLenses() |
| `packages/mcp-server/src/analysis/convergence/validate.ts` | **NEW** -- applyLlmReview() |
| `packages/mcp-server/src/analysis/convergence/cluster.ts` | **NEW** -- clusterCandidatesLLM() |
| `packages/mcp-server/src/analysis/convergence/converge.ts` | **NEW** -- convergeAndTier() |
| `packages/mcp-server/src/analysis/convergence/quality.ts` | **NEW** -- re-export validateConvergenceQuality |
| `packages/mcp-server/src/analysis/convergence/index.ts` | **NEW** -- runConvergence() |
| `packages/mcp-server/src/analysis/outputs/icp-profiles.ts` | **NEW** -- generateICPProfiles() |
| `packages/mcp-server/src/analysis/outputs/activation-map.ts` | **NEW** -- generateActivationMap() |
| `packages/mcp-server/src/analysis/outputs/measurement-spec.ts` | **NEW** -- generateMeasurementSpec() |
| `packages/mcp-server/src/analysis/outputs/index.ts` | **NEW** -- generateAllOutputs() |
| Test files (20 files) | **NEW** -- Per-function unit tests + integration test |

No changes to existing files in `convex/analysis/`.

## Risks

1. **Prompt drift.** System prompts are copied verbatim from Convex originals. Once copied, they evolve independently. Accept this tradeoff for now; consider a shared-prompts package later.

2. **Type alignment.** The convergence types (`ValidatedCandidate`, `CandidateCluster`, `ValueMoment`) in `convex/analysis/convergence/types.ts` use `LensType` with old lens names (`jtbd`, `outcomes`, `pains`, `gains`, `alternatives`, `workflows`, `emotions`) that differ from the actual 7-lens names (`capability_mapping`, `effort_elimination`, etc.). The MCP pipeline should use the actual lens names. Need to define the correct `LensType` union in `lens-types.ts`.

3. **MeasurementInputData fields.** The `buildMeasurementSpecPrompt` in the Convex code references `activation_event_templates` and `value_event_templates` which are assembled by the `aggregateMeasurementInputs` action. The pipeline must either replicate this assembly or simplify the measurement input to just the core 4 fields. Given that templates are pre-computed suggestions, the pipeline should compute them inline in the `assembleMeasurementInput` helper.

4. **Concurrency limits.** Convergence merge runs one LLM call per cluster (typically 15-30 parallel calls). Add a concurrency limit utility (e.g., `pLimit(4)`) to avoid rate-limiting from LLM providers. Default to 4 concurrent LLM calls.

5. **Model selection hints.** The `LlmOptions.model` field uses strings like `'haiku'` as hints, not exact model IDs. The LlmProvider implementation maps these to actual model IDs. If the provider ignores the hint, all calls use the default model, which is acceptable.

## Verification Checklist

- [ ] `npm test` passes with all new test files
- [ ] No imports from `convex/`, `@anthropic-ai/sdk`, `@clerk/`, or `express` in `packages/mcp-server/src/analysis/`
- [ ] Every function that calls an LLM accepts `LlmProvider` as a parameter
- [ ] Integration test runs the full pipeline with mock LLM and produces a valid `PipelineResult`
- [ ] All 7 lenses are covered (capability_mapping, effort_elimination, time_compression, artifact_creation, info_asymmetry, decision_enablement, state_transitions)
- [ ] Batch 1 runs in parallel, Batch 2 runs after Batch 1 with context
- [ ] Pipeline returns partial results when individual phases fail
- [ ] Progress callback fires for each phase
