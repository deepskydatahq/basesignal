# Analysis Pipeline Integration Design

**Story:** M008-E002-S002 -- Integrate analysis pipeline (lenses -> convergence -> outputs)
**Date:** 2026-02-15
**Status:** brainstorm -> plan

---

## Problem Statement

The full analysis pipeline currently lives in `convex/analysis/` and is deeply coupled to the Convex runtime:
- Lens extractors fetch crawled pages via `ctx.runQuery()` and call Claude directly via `@anthropic-ai/sdk`
- Convergence creates an Anthropic client from `process.env.ANTHROPIC_API_KEY`
- Output generators read from and write to Convex DB via `ctx.runMutation()`
- Orchestration uses `internalAction` to chain sub-actions

For the open source MCP server (`packages/mcp-server`), this entire pipeline must run without Convex. The pipeline needs to accept crawled content as input, use an injected LLM provider, and return results as output -- no database reads or writes inside the pipeline itself.

---

## Current Pipeline Architecture

```
orchestrate.ts (top-level)
  |
  |-- Phase 1: Identity/Revenue/Entities/Outcomes extractors (parallel)
  |     (convex/analysis/orchestrate.ts -- callExtractor + ctx.runMutation to store)
  |
  |-- Phase 1b: Activation level extraction (parallel)
  |     (convex/analysis/extractActivationLevels.ts -- ctx.runQuery pages, Anthropic SDK)
  |
  |-- Phase 1c: 7-Lens extraction (parallel batched)
  |     (convex/analysis/lenses/orchestrate.ts)
  |     |-- Batch 1 (4 parallel): capability, effort, time, artifact
  |     |-- Batch 2 (3 parallel with Batch 1 context): info, decision, state
  |     Each lens: ctx.runQuery pages -> buildPageContext -> callClaude -> parse -> LensCandidate[]
  |
  |-- Phase 2: Validation
  |     (convex/analysis/convergence/validateCandidates.ts)
  |     |-- Deterministic checks (feature-as-value, vague, marketing)
  |     |-- Within-lens dedup (TF-IDF cosine similarity)
  |     |-- LLM review for flagged candidates
  |
  |-- Phase 3: Clustering
  |     (convex/analysis/convergence/clusterCandidates.ts)
  |     |-- LLM-based semantic clustering (primary)
  |     |-- TF-IDF + Union-Find clustering (fallback)
  |
  |-- Phase 4: Convergence and tiering
  |     (convex/analysis/convergence/convergeAndTier.ts)
  |     |-- LLM merge per cluster -> ValueMoment
  |     |-- directMerge fallback
  |     |-- Tier assignment (4+ lenses = T1, 2-3 = T2, 1 = T3)
  |     |-- Cap tier distribution
  |     |-- Quality validation
  |
  |-- Phase 5: Output generation
  |     (convex/analysis/outputs/orchestrate.ts)
  |     |-- ICP profiles (LLM)
  |     |-- Activation map (LLM)
  |     |-- Measurement spec (LLM)
```

---

## Design Principles

1. **Data in, data out.** Pipeline functions accept content and return results. No I/O inside the pipeline.
2. **LLM provider as a parameter.** Every function that calls an LLM accepts an `LlmProvider` -- never instantiates one.
3. **Same code, different runtime.** The extracted functions should be mechanically identical to the Convex originals, minus the `ctx.*` calls.
4. **Progress as a callback.** Long-running pipeline reports progress via an optional callback -- the caller decides what to do with it (log, send MCP notification, update DB).
5. **Partial results on error.** If lens 3 of 7 fails, the pipeline returns the 6 that succeeded plus an error list. Same for outputs.

---

## Proposed Module Structure

```
packages/mcp-server/src/
  analysis/
    pipeline.ts              -- Top-level runAnalysisPipeline()
    types.ts                 -- PipelineInput, PipelineResult, ProgressEvent
    lenses/
      index.ts               -- runAllLenses()
      capability-mapping.ts  -- extractCapabilityMapping()
      effort-elimination.ts  -- extractEffortElimination()
      time-compression.ts    -- extractTimeCompression()
      artifact-creation.ts   -- extractArtifactCreation()
      info-asymmetry.ts      -- extractInfoAsymmetry()
      decision-enablement.ts -- extractDecisionEnablement()
      state-transitions.ts   -- extractStateTransitions()
      shared.ts              -- buildPageContext(), parseLensResponse(), extractJson()
      prompts.ts             -- All system prompts (one place to find them)
    convergence/
      index.ts               -- runConvergence()
      validate.ts            -- runDeterministicChecks(), applyLlmReview()
      cluster.ts             -- clusterCandidatesLLM(), clusterCandidatesCore()
      converge.ts            -- convergeAndTier(), directMerge()
      quality.ts             -- validateConvergenceQuality()
    outputs/
      index.ts               -- generateAllOutputs()
      icp-profiles.ts        -- generateICPProfiles()
      activation-map.ts      -- generateActivationMap()
      measurement-spec.ts    -- generateMeasurementSpec()
    extractors/
      identity.ts            -- extractIdentity()
      activation-levels.ts   -- extractActivationLevels()
```

---

## Key Interfaces

### LlmProvider (from E004-S003)

The pipeline depends on this interface, which will already exist from E004:

```typescript
interface LlmProvider {
  complete(messages: LlmMessage[], options?: LlmOptions): Promise<string>;
}

interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LlmOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}
```

### Pipeline Input

```typescript
interface CrawledPage {
  url: string;
  title?: string;
  pageType: string;
  content: string;
}

interface PipelineInput {
  pages: CrawledPage[];
  productContext?: {
    name?: string;
    description?: string;
    targetCustomer?: string;
  };
}
```

This is the minimal input. The pipeline does not fetch pages -- the caller provides them.

### Pipeline Result

```typescript
interface PipelineResult {
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

interface PipelineError {
  phase: string;
  step: string;
  message: string;
}
```

### Progress Reporting

```typescript
type ProgressPhase =
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

interface ProgressEvent {
  phase: ProgressPhase;
  status: 'started' | 'completed' | 'failed';
  detail?: string;
}

type OnProgress = (event: ProgressEvent) => void;
```

The MCP server wires this to `server.notification` (MCP progress notifications). The CLI wires it to `console.log`. Tests ignore it. The callback is optional and defaults to a no-op.

---

## Top-Level Pipeline Function

```typescript
export async function runAnalysisPipeline(
  input: PipelineInput,
  llm: LlmProvider,
  onProgress?: OnProgress,
): Promise<PipelineResult> {
  const progress = onProgress ?? (() => {});
  const errors: PipelineError[] = [];
  const start = Date.now();

  // Phase 1: Identity + Activation Levels (parallel, independent)
  progress({ phase: 'identity', status: 'started' });
  progress({ phase: 'activation_levels', status: 'started' });

  const [identityResult, activationResult] = await Promise.allSettled([
    extractIdentity(input.pages, llm),
    extractActivationLevels(input.pages, llm, input.productContext),
  ]);

  const identity = settledOrError(identityResult, 'identity', 'extract', errors);
  const activation_levels = settledOrError(activationResult, 'activation_levels', 'extract', errors);

  // Phase 2: Lens extraction (Batch 1 -> Batch 2)
  progress({ phase: 'lenses_batch1', status: 'started' });
  const batch1 = await runLensBatch1(input.pages, llm, input.productContext);
  progress({ phase: 'lenses_batch1', status: 'completed', detail: `${batch1.candidates.length} candidates` });

  progress({ phase: 'lenses_batch2', status: 'started' });
  const batch2 = await runLensBatch2(input.pages, llm, batch1, input.productContext);
  progress({ phase: 'lenses_batch2', status: 'completed', detail: `${batch2.candidates.length} candidates` });

  const allCandidates = [...batch1.candidates, ...batch2.candidates];

  // Phase 3: Validation + Clustering + Convergence
  progress({ phase: 'validation', status: 'started' });
  const validated = runValidationPipeline(batch1.results.concat(batch2.results), knownFeatures);
  progress({ phase: 'validation', status: 'completed' });

  progress({ phase: 'clustering', status: 'started' });
  let clusters;
  try {
    clusters = await clusterCandidatesLLM(validated, llm);
  } catch {
    clusters = clusterCandidatesCore(validated);
  }
  progress({ phase: 'clustering', status: 'completed' });

  progress({ phase: 'convergence', status: 'started' });
  const convergence = await convergeAndTier(clusters, llm);
  progress({ phase: 'convergence', status: 'completed' });

  // Phase 4: Output generation (sequential, each depends on previous)
  const outputs = await generateAllOutputs(convergence, activation_levels, identity, llm, progress);

  return {
    identity,
    activation_levels,
    lens_candidates: allCandidates,
    convergence,
    outputs,
    errors,
    execution_time_ms: Date.now() - start,
  };
}
```

---

## Extraction Pattern (Per Lens)

Every lens follows the same refactoring pattern. Here is capability mapping as the reference:

**Before (Convex-coupled):**
```typescript
// convex/analysis/lenses/extractCapabilityMapping.ts
export const extractCapabilityMapping = internalAction({
  args: { productId: v.id("products") },
  handler: async (ctx, args): Promise<LensResult> => {
    const pages = await ctx.runQuery(internal.crawledPages.listByProductInternal, { productId: args.productId });
    const profile = await ctx.runQuery(internal.productProfiles.getInternal, { productId: args.productId });
    const responseText = await callClaude({ system: PROMPT, user: pageContext });
    return { lens: "capability_mapping", candidates, ... };
  },
});
```

**After (decoupled):**
```typescript
// packages/mcp-server/src/analysis/lenses/capability-mapping.ts
export async function extractCapabilityMapping(
  pages: CrawledPage[],
  llm: LlmProvider,
  profileContext?: string,
): Promise<LensResult> {
  const startTime = Date.now();
  const relevantPages = filterPages(pages);
  const pageContext = buildPageContext(relevantPages);

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
    lens: "capability_mapping",
    candidates,
    candidate_count: candidates.length,
    execution_time_ms: Date.now() - startTime,
  };
}
```

**What changes:**
1. `ctx.runQuery` -> pages passed as parameter
2. `callClaude()` -> `llm.complete()` with message array
3. `internalAction` wrapper removed -- it is a plain async function
4. Return value unchanged -- `LensResult` stays the same type

**What does NOT change:**
- System prompts (copy verbatim)
- Response parsers (copy verbatim)
- Page filtering logic (copy verbatim)
- Types (imported from `@basesignal/core`)

This same pattern applies to all 7 lenses, identity extraction, activation level extraction, and all 3 output generators.

---

## Convergence Refactoring

The convergence pipeline has both pure functions and LLM-dependent functions. The split:

### Already pure (extracted in E001-S005/S006):
- `assignTier()` -- pure
- `directMerge()` -- pure
- `capTierDistribution()` -- pure
- `validateConvergenceQuality()` -- pure
- `clusterCandidatesCore()` -- pure (TF-IDF)
- `runValidationPipeline()` -- pure (deterministic checks)
- `UnionFind`, `buildCluster`, etc. -- pure

These will already live in `@basesignal/core` from E001-S005 and E001-S006.

### LLM-dependent (refactored here):
- `clusterCandidatesLLM()` -- change Anthropic client to LlmProvider
- `convergeAndTier()` -- change Anthropic client to LlmProvider
- `applyLlmReview()` -- change Anthropic client to LlmProvider

**Refactored signature:**
```typescript
export async function clusterCandidatesLLM(
  candidates: ValidatedCandidate[],
  llm: LlmProvider,
): Promise<CandidateCluster[]> {
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

The prompts and parsers do not change. Only the LLM call mechanism changes from `client.messages.create()` to `llm.complete()`.

---

## Output Generator Refactoring

The output generators currently read their inputs from the Convex DB via aggregation queries. In the MCP server pipeline, the inputs flow through the pipeline result:

**Before:**
```typescript
// generateICPProfiles reads from DB
const profile = await ctx.runQuery(internal.productProfiles.getInternal, { productId });
const convergence = profile.convergence;
```

**After:**
```typescript
// generateICPProfiles receives data directly
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

The aggregation functions (`aggregateRoles`, `aggregateICPInputsCore`, `aggregateActivationInputs`, `aggregateMeasurementInputsCore`) are already pure and can be called inline by the pipeline orchestrator.

---

## Storage Injection

Storage is NOT used inside the pipeline. The pipeline is pure: data in, data out. The MCP server tool handler saves the result:

```typescript
// In the MCP tool handler (not in the pipeline)
const result = await runAnalysisPipeline(input, llmProvider, (event) => {
  server.notification({ method: 'notifications/progress', params: event });
});

// Save to storage adapter
await storage.save({
  ...existingProfile,
  identity: result.identity,
  convergence: result.convergence,
  outputs: result.outputs,
});
```

This keeps the pipeline testable without any storage mock.

---

## Error Handling and Partial Results

The pipeline uses `Promise.allSettled` at every parallel boundary and accumulates errors:

```typescript
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
```

Rules:
- If identity extraction fails, the pipeline continues without product context
- If activation levels fail, the activation map output is skipped
- If any lens fails, the pipeline runs convergence on the remaining candidates
- If convergence fails entirely, the pipeline returns candidates but no outputs
- If an individual output generator fails, the other two still run
- The `errors` array in PipelineResult always lists what went wrong

---

## What to Reuse from @basesignal/core

These will be imported, not duplicated:

| From @basesignal/core | Used by |
|---|---|
| `LensCandidate`, `LensType`, `LensResult`, `AllLensesResult` | All lenses |
| `ValidatedCandidate`, `CandidateCluster`, `ValueMoment`, `ConvergenceResult` | Convergence |
| `ICPProfile`, `ActivationMap`, `MeasurementSpec` | Outputs |
| `ActivationLevel`, `ActivationLevelsResult` | Activation extraction + outputs |
| `clusterCandidatesCore()`, `UnionFind`, `buildCluster` | Clustering fallback |
| `runValidationPipeline()`, deterministic check functions | Validation |
| `assignTier()`, `directMerge()`, `capTierDistribution()` | Convergence |
| `validateConvergenceQuality()` | Quality checks |
| `cosineSimilarity()`, `computeTfIdfVectors()` | Dedup + clustering |
| `buildPageContext()`, `truncateContent()`, `extractJson()` | Shared utilities |
| `parseLensResponse()` | Generic lens parsing |

What lives in `packages/mcp-server` only:
- System prompts (long strings, lens-specific)
- Lens-specific response parsers (e.g., `parseCapabilityMappingResponse`)
- Pipeline orchestration (`runAnalysisPipeline`)
- Progress callback wiring
- LLM-dependent functions that call `llm.complete()`

---

## LLM Call Count

A full pipeline run makes approximately these LLM calls:

| Phase | LLM Calls | Notes |
|---|---|---|
| Identity | 1 | |
| Activation levels | 1 | |
| Lenses Batch 1 | 4 | Parallel |
| Lenses Batch 2 | 3 | Parallel |
| Validation (LLM review) | 0-1 | Only if flagged candidates exist |
| Clustering | 1 | LLM clustering (TF-IDF fallback = 0) |
| Convergence merge | N | One per cluster (typically 15-30) |
| ICP profiles | 1 | |
| Activation map | 1 | |
| Measurement spec | 1 | |
| **Total** | **~28-38** | |

This is important for progress reporting -- the caller should expect 30+ LLM calls taking 2-5 minutes total.

---

## Testing Strategy

1. **Mock LlmProvider** -- A test provider that returns canned JSON responses per system prompt pattern match.
2. **Snapshot fixtures** -- Save one real pipeline run's LLM responses as fixtures. Tests replay them.
3. **Per-function unit tests** -- Each lens extractor, parser, and convergence function gets its own test file, testing the parsing and logic independent of LLM output.
4. **Integration test** -- One test that runs the full pipeline with the mock provider and asserts the PipelineResult shape.

The mock provider:
```typescript
const mockLlm: LlmProvider = {
  async complete(messages, options) {
    const systemPrompt = messages.find(m => m.role === 'system')?.content ?? '';
    if (systemPrompt.includes('Capability Mapping')) return FIXTURE_CAPABILITY_RESPONSE;
    if (systemPrompt.includes('Effort Elimination')) return FIXTURE_EFFORT_RESPONSE;
    // ... etc
    return '[]';
  }
};
```

---

## Implementation Order

1. **Create `packages/mcp-server/src/analysis/types.ts`** -- Define PipelineInput, PipelineResult, ProgressEvent, CrawledPage
2. **Extract shared utilities** -- `buildPageContext`, `extractJson`, `parseLensResponse` into `analysis/lenses/shared.ts` (or import from `@basesignal/core` if already extracted by E001-S005)
3. **Extract lens functions** -- One file per lens, each as a plain async function accepting `(pages, llm)`. Start with capability mapping as the template, then repeat for the other 6.
4. **Create `analysis/lenses/index.ts`** -- `runAllLenses()` orchestrating Batch 1 -> Batch 2
5. **Extract convergence functions** -- `validate.ts`, `cluster.ts`, `converge.ts`, `quality.ts`. The pure ones import from `@basesignal/core`; the LLM ones accept `LlmProvider`.
6. **Create `analysis/convergence/index.ts`** -- `runConvergence()` chaining validate -> cluster -> converge
7. **Extract output generators** -- `icp-profiles.ts`, `activation-map.ts`, `measurement-spec.ts`. Each as a plain async function accepting data + LLM.
8. **Create `analysis/outputs/index.ts`** -- `generateAllOutputs()` running all three with error isolation
9. **Extract identity and activation level extractors** -- `extractors/identity.ts`, `extractors/activation-levels.ts`
10. **Create `analysis/pipeline.ts`** -- Top-level `runAnalysisPipeline()` wiring everything together
11. **Write tests** -- Mock provider, per-function tests, integration test

---

## Simplification Review

Applying the simplification reviewer's lens:

**What could be removed?**
- The `prompts.ts` centralized file is unnecessary. Keep prompts co-located with their extractors (as they are in Convex today). One file to find a prompt is better than two files to correlate.
- The `extractors/` subdirectory is over-organizing. Identity and activation level extraction can live directly in `analysis/` since there are only two of them.

**Simplified structure:**
```
packages/mcp-server/src/analysis/
  pipeline.ts              -- Top-level orchestrator
  types.ts                 -- Pipeline I/O types
  identity.ts              -- extractIdentity()
  activation-levels.ts     -- extractActivationLevels()
  lenses/
    index.ts               -- runAllLenses()
    shared.ts              -- buildPageContext, parseLensResponse
    capability-mapping.ts
    effort-elimination.ts
    time-compression.ts
    artifact-creation.ts
    info-asymmetry.ts
    decision-enablement.ts
    state-transitions.ts
  convergence/
    index.ts               -- runConvergence()
    validate.ts
    cluster.ts
    converge.ts
    quality.ts
  outputs/
    index.ts               -- generateAllOutputs()
    icp-profiles.ts
    activation-map.ts
    measurement-spec.ts
```

**Is every component essential?**
Yes. Each lens is a distinct analytical perspective. Convergence is where value moments emerge. Outputs are the deliverables users care about. The pipeline orchestrator coordinates the dependency graph between them.

**Verdict: APPROVED** -- the structure mirrors the existing Convex code 1:1, just without the runtime coupling.

---

## Risks and Open Questions

1. **Prompt drift.** Once prompts are copied into `packages/mcp-server`, they diverge from the Convex originals. Consider a `shared-prompts` package in the future, or accept that the open source version will evolve independently.

2. **LLM model selection.** The current code hardcodes `claude-sonnet-4-20250514` and `claude-haiku-4-5-20251001`. With provider injection, model selection becomes the caller's responsibility. The pipeline should use sensible defaults in `LlmOptions` but let the provider override them. Convergence merge and clustering should prefer a capable model; validation review can use a cheaper one.

3. **Concurrency limits.** Batch 1 runs 4 parallel LLM calls. Convergence merge runs N parallel calls (one per cluster). Some providers may rate-limit. Consider adding an optional `concurrency` option to the pipeline config, defaulting to 4.

4. **Response format compatibility.** OpenAI and Ollama models may not produce identical JSON formats to Claude. The parsers are defensive (code fence extraction, field validation), which helps, but different models may need prompt adjustments. This is a known tradeoff of LLM portability.

5. **Dependencies on E001 and E004.** This story depends on:
   - E001-S006 (convergence/tiering in `@basesignal/core`) -- needed for pure function imports
   - E002-S001 (MCP server skeleton) -- needed as the package location
   - E004-S003 (LLM provider interface) -- needed for the `LlmProvider` type
   If those are not yet implemented, this story can still proceed by defining local types and replacing them with imports later.
