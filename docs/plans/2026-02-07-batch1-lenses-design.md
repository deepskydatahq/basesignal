# Batch 1 Lenses Design (Capability, Effort, Time, Artifact)

## Overview

Implement 4 independent lens extractors as Convex internalActions that discover value moment candidates from a product's crawled pages and knowledge graph profile. Each lens asks a different question about user value.

## Problem Statement

The 7-Lens Value Discovery pipeline needs its first 4 lenses (Batch 1) that can run in parallel. Each lens analyzes the same product data through a different perspective to produce value moment candidates. These candidates later feed into a convergence pipeline that clusters overlapping discoveries.

## Expert Perspectives

### Product
Each lens has a distinct "core question" and "motivational root" that shapes its prompt:

| Lens | Core Question | Motivational Root |
|------|---------------|-------------------|
| Capability Mapping | What new capacities does this product unlock that users couldn't do before? | "I can do X" (new superpower) |
| Effort Elimination | What repetitive or tedious work vanishes entirely? | "I don't waste time on Y" (relief) |
| Time Compression | What workflows become fast enough to change behavior? | "I do Z way more often" (behavioral change) |
| Artifact Creation | What tangible, shareable outputs do users create with value beyond the tool? | "I created W that others depend on" (leverage) |

**Quality test for all lenses:** "A user could explain this value moment to a peer in 1 sentence without mentioning the product name."

### Technical
Architecture follows "thin shared helpers + explicit lens files." Shared code handles only the truly identical mechanical parts (Claude API call, JSON extraction). Each lens file is self-contained and reads like a complete story — its own page filtering, prompt, and field validation are visible inline.

### Simplification Review
- Removed `extractProfileContext` helper — profile context is trivial inline formatting
- Removed separate page context builder — each lens formats its own context inline
- Simplified validation to inline field checks instead of separate parser functions
- Kept `shared.ts` with only `callClaude` and `extractJson` (identical across all 4 lenses)

## Proposed Solution

### Files

```
convex/analysis/lenses/
  shared.ts                      # callClaude + extractJson only
  extractCapabilityMapping.ts    # Lens 1 internalAction
  extractEffortElimination.ts    # Lens 2 internalAction
  extractTimeCompression.ts      # Lens 3 internalAction
  extractArtifactCreation.ts     # Lens 4 internalAction
```

Depends on S001 (`convex/analysis/lenses/types.ts`) for `LensCandidate`, `LensResult`, `LensType`. If S001 isn't merged yet, define minimal types inline with a TODO.

### shared.ts (minimal)

Two functions only:

1. **`callClaude(options)`** — Thin wrapper around Anthropic SDK. Defaults: `claude-sonnet-4-20250514`, temperature 0.15, max_tokens 4096. Returns raw text.
2. **`extractJson(text)`** — Handles `json` code fences and raw JSON. Returns parsed object.

### Each Lens File Pattern

Each lens file (~150-200 lines) follows this flow:

```
1. Fetch crawled pages via ctx.runQuery
2. Filter pages by lens-relevant types (inline)
3. Fetch product profile via ctx.runQuery
4. Build knowledge graph context (inline string formatting)
5. Build page context (inline, truncate at 50K chars total)
6. Call Claude via shared.callClaude with lens system prompt
7. Parse response via shared.extractJson
8. Validate required fields + lens-specific field (inline checks)
9. Return LensResult with candidates and timing
```

### Per-Lens Configuration

| Lens | Page Types | Profile Sections | Specific Field |
|------|-----------|-----------------|----------------|
| Capability Mapping | features, customers, homepage, about, help | identity, entities, journey, outcomes | `enabling_features: string[]` |
| Effort Elimination | features, customers, homepage, about, pricing | identity, revenue, outcomes | `effort_eliminated: string` |
| Time Compression | features, customers, homepage, about, help | identity, journey, outcomes | `time_compression: string` |
| Artifact Creation | features, customers, homepage, help | identity, entities, outcomes | `artifact_type: string` |

### Prompt Anti-Patterns (per lens)

**Capability Mapping — reject:**
- Feature lists: "create tasks" (feature, not capability)
- Abstract improvements: "better organization" (too vague)

**Effort Elimination — reject:**
- Vague savings: "faster task creation" (how much? what changes?)
- Soft benefits: "reduces overhead" (be specific)

**Time Compression — reject:**
- Minor speed bumps: "saves a click" (insignificant)
- Abstract velocity: "moves faster" (no behavioral change)

**Artifact Creation — reject:**
- Tool outputs: "generates reports" (feature, not value)
- Ephemeral states: "sets a status" (no lasting artifact)

### Error Handling

- No pages: throw (same pattern as extractActivationLevels)
- No relevant pages after filtering: throw
- Claude API error: let propagate (Convex retries)
- Parse error: throw with context
- No retry logic in lens — orchestrator (S004) handles that

### Configuration

| Setting | Value |
|---------|-------|
| Model | claude-sonnet-4-20250514 |
| Temperature | 0.15 |
| Max tokens | 4096 |
| Max page content total | 50,000 chars |
| Max per page | 15,000 chars |
| Target candidates | 8-20 (aim 12-15) |

### Downstream Compatibility

`LensCandidate` has `role` (singular string). The convergence validation pass transforms to `ValidatedCandidate` with `roles[]` and `product_surfaces[]`. Lens files don't handle this.

## Alternatives Considered

1. **4 fully standalone files (no shared.ts)** — Rejected because `callClaude` and `extractJson` are truly identical across all 4. Duplicating these creates maintenance risk.
2. **Config-driven single extractor** — Rejected because it hides lens-specific logic behind configuration, making each lens harder to understand and modify independently.

## Success Criteria

1. All 4 internalActions exist and accept productId
2. Each returns LensResult with 8-20 candidates
3. Lens-specific fields populated on every candidate
4. source_urls reference actual crawled page URLs
5. Parser unit tests pass for each lens
6. Integration test against Linear produces expected candidate counts
