# Batch 2 Lenses Design (Info Asymmetry, Decision Enablement, State Transitions)

## Overview

Three Convex `internalAction` extractors that analyze crawled product pages through inference-heavy analytical lenses. Each lens identifies value moment candidates from a unique perspective: what users learn (Info Asymmetry), what decisions become possible (Decision Enablement), and how user states change (State Transitions). These lenses benefit from optional Batch 1 context.

## Problem Statement

The 7-Lens Value Discovery pipeline needs three "why behind the what" lenses that are more inference-heavy than the Batch 1 lenses. These lenses look beyond capabilities and effort to understand the deeper transformations a product enables.

## Expert Perspectives

### Product
- These three lenses capture the transformation narrative: knowledge gaps filled, decisions unlocked, states changed
- Each lens should produce specific, product-contextualized candidates (not generic "better visibility" platitudes)
- Confidence scoring tied to evidence directness from crawled content

### Technical
- Start with three standalone files (Approach A) rather than premature shared base
- Once all 7 lenses exist, extract the true shared concerns based on real duplication patterns
- Batch 1 and Batch 2 are parallel work streams - avoid coupling

### Simplification Review
- Reviewer identified 500+ lines of duplicated infrastructure (page filtering, content truncation, response parsing)
- **Applied:** Extract truly identical utilities (`truncateContent`, `buildPageContext`, `parseLensResponse`) into `shared.ts`
- **Rejected:** Centralizing model selection, content limits, and context building into separate infrastructure files (premature for 3 files). Pre-building context in orchestrator (different story's scope). Creating Convex union types (S001's job).
- **Result:** Hybrid approach - shared utilities for identical code, lens-specific files for domain logic

## Proposed Solution

Create 4 files: one shared utility module and three lens extractors. Each lens file contains its page type constants, system prompt, knowledge graph context builder, and internalAction wiring. The shared module handles content truncation, page context formatting, and response parsing.

## Design Details

### Files to Create

```
convex/analysis/lenses/shared.ts           -- shared utilities
convex/analysis/lenses/extractInfoAsymmetry.ts
convex/analysis/lenses/extractDecisionEnablement.ts
convex/analysis/lenses/extractStateTransitions.ts
```

Plus test files for each.

### shared.ts

Contains three utilities identical across all lenses:

1. **`truncateContent(content: string, max: number): string`** - Truncates page content to limit
2. **`buildPageContext(pages: Page[], maxPerPage: number, maxTotal: number): string`** - Formats filtered pages into a context string with URL headers
3. **`parseLensResponse(responseText: string, lensType: LensType, lensField: string): LensCandidate[]`** - Extracts JSON from code fences, validates shared fields (name, description, role, confidence, source_urls), validates lens-specific field exists, assigns UUIDs, normalizes confidence

Constants: `MAX_CONTENT_PER_PAGE = 15_000`, `MAX_TOTAL_CONTENT = 40_000`

### Each Lens File Structure

```typescript
// 1. Imports (from shared.ts, types.ts, Convex, Anthropic)
// 2. PAGE_TYPES constant (lens-specific)
// 3. buildKnowledgeContext(profile) (lens-specific sections from product profile)
// 4. buildBatch1Context(batch1Results) (formats Batch 1 candidates as context)
// 5. SYSTEM_PROMPT constant (lens-specific, ~30 lines)
// 6. internalAction (fetch pages, filter, build context, call Claude, parse, return)
```

### Page Type Selection Per Lens

| Lens | Page Types | Rationale |
|------|-----------|-----------|
| Info Asymmetry | features, customers, help, homepage, solutions | Knowledge gaps evident in features, customer stories, help docs |
| Decision Enablement | features, solutions, customers, homepage | Decisions described in features/solutions, evidenced in stories |
| State Transitions | customers, features, onboarding, help, homepage | Before/after states in customer stories, onboarding shows initial transition |

### Knowledge Graph Context Per Lens

Each lens extracts different product profile sections:

- **Info Asymmetry:** identity, entities, revenue (information gating by tier)
- **Decision Enablement:** identity, entities, journey (decision points at stages)
- **State Transitions:** identity, entities, journey, activation definitions (state changes)

### Batch 1 Context

Optional `batch1Results` parameter (typed as `v.any()` in Convex args). When provided, formats Batch 1 candidates (capability_mapping, effort_elimination, time_compression, artifact_creation) as additional context injected into the Claude prompt. This helps the inference-heavy lenses build on "what" knowledge to discover "why."

### System Prompts

Each prompt defines:
- What the lens looks for (with clear definition)
- 3 concrete product examples
- JSON output schema with lens-specific field
- Confidence scoring rules (high = explicit evidence, medium = implied, low = inferred)
- Strict rules (valid JSON, unique names, real source_urls, lens field populated)

### Model Configuration

- Model: `claude-sonnet-4-20250514` (per story guidance)
- Temperature: `0.2` (precision for structured extraction)
- Max tokens: `4096`

### Storage

Lenses return `LensResult` objects - they do NOT persist results. The orchestrator (S004) handles aggregation and downstream pipeline.

## Alternatives Considered

1. **Shared base module for all 7 lenses** - Rejected per technical architect: premature abstraction when Batch 1 doesn't exist yet. The hybrid approach (shared utilities only) is a reasonable middle ground.
2. **Pre-built context from orchestrator** - Rejected: that's the orchestrator story's design scope, not this one.
3. **Convex union type validator for batch1Results** - Rejected: S001 (types) is still in-progress, using `v.any()` with runtime validation is pragmatic.

## Success Criteria

1. All three internalActions exist with productId + optional batch1Results args
2. Each produces 8-20 candidates with lens-specific fields populated
3. Candidates include source_urls linking to crawled pages
4. Output quality improves when batch1Results are provided
5. Unit tests cover page filtering, context building, response parsing
6. Integration tests verify candidate counts and field population against Linear product
