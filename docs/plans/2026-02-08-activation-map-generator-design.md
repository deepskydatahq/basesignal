# Activation Map Generator Design

## Overview

An LLM-powered internalAction that generates an activation map from aggregated activation levels and value moments. It produces stages with trigger events, value unlocks, and drop-off risk indicators — showing how users progress through a product.

## Problem Statement

Basesignal's analysis pipeline extracts activation levels and value moments from crawled product data. The next step is synthesizing these into an actionable activation map that product teams can use to understand user progression, identify drop-off risks, and plan instrumentation.

## Expert Perspectives

### Product
- The activation map represents user transformation, not feature usage. L3 (cycle completion) is the "aha moment" where core value is realized.
- Value moments should distribute by tier: Tier 3 (basic) at early stages, Tier 1 (high-impact) at strong-signal stages where team outcomes become visible.
- Biggest drop-off risk is L1→L2 (individual to team adoption). Stages requiring behavior change are medium-high risk.
- The Linear test fixture should produce 4 stages matching explorer→workflow_learner→workflow_optimizer→product_workflow_master, with primary activation at L3.

### Technical
- Follow the self-contained data fetching pattern from `extractActivationLevels.ts` — the generator owns its data retrieval.
- Don't couple to `aggregateActivationInputs` (M004-E003-S001) at runtime. The dependency specifies what data is needed, not how to get it.
- Use existing `callClaude` and `extractJson` utilities from `lenses/shared.ts`.

### Simplification Review
- Removed `computeSuggestedMappings()` and `SuggestedMapping` interface — let Claude handle tier-to-level mapping directly from raw data
- Removed `ActivationMapInput` wrapper type — pass activation levels and value moments directly
- Removed `preAggregatedData` parameter — test via parser unit tests
- Reduced exports to only `generateActivationMap` and `testGenerateActivationMap`
- Bake distribution/drop-off constraints into the prompt as hard requirements instead of post-parse validation

## Proposed Solution

A single file `convex/analysis/outputs/generateActivationMap.ts` containing:

1. **Data fetching**: Fetch product profile, extract `definitions.activation` (ActivationLevelsResult) and `convergence` (value_moments)
2. **Prompt construction**: System prompt with rules for stages, transitions, drop-off risks, value moment distribution. User prompt with formatted activation levels and value moments.
3. **LLM call**: Claude Sonnet via `callClaude()`, temperature 0.2
4. **Response parsing**: `extractJson()` + field validation into `ActivationMap` structure
5. **Storage**: Store result on product profile

## Design Details

### Architecture

```
productProfile
  ├── definitions.activation (ActivationLevelsResult)
  └── convergence (ConvergenceResult.value_moments)
          │
          ▼
 generateActivationMap (internalAction)
  1. Fetch profile → extract activation levels + value moments
  2. Build prompt (system + user with structured data)
  3. Call Claude Sonnet via callClaude()
  4. Parse response via extractJson() + validation
  5. Store under profile outputs
          │
          ▼
 ActivationMap { stages, transitions, primary_activation_level, confidence, sources }
```

### Prompt Design

**System prompt** instructs Claude to:
- Create exactly one stage per activation level
- Derive trigger_events from activation criteria
- Distribute value moments across stages (Tier 3 at weak signal, Tier 1 at strong signal)
- Assess drop-off risks (individual→team adoption is highest risk)
- Define linear progression transitions with timeframes
- Mark primary_activation_level as the "aha moment" stage

**User prompt** includes:
- Formatted activation levels with criteria and signal strengths
- Formatted value moments with tiers, roles, and descriptions
- The primary activation level number

### Response Parsing

- Use `extractJson` from `lenses/shared.ts` to handle code fences
- Validate required fields: stages array, transitions array, primary_activation_level, confidence, sources
- Validate each stage: level, name, signal_strength, trigger_events (non-empty), value_moments_unlocked, drop_off_risk
- Validate transitions: from_level, to_level, trigger_events
- Sort stages by level ascending

### Exports

Only two public exports:
- `generateActivationMap` — the internalAction
- `testGenerateActivationMap` — public action wrapper for dashboard testing

Internal helpers (prompt builder, parser) stay private to the module.

### Linear Test Fixture

4 activation levels (explorer, workflow_learner, workflow_optimizer, product_workflow_master) with 6 value moments distributed by tier:
- L1: Keyboard-First Speed (Tier 3)
- L2: Roadmap-to-Issue Traceability (Tier 2), Ambient Team Awareness starts (Tier 2)
- L3: Cycle Completion with Team Visibility (Tier 1), Smart Triage (Tier 1) — PRIMARY
- L4: Dev Tool Integration (Tier 2), full Ambient Team Awareness (Tier 2)

Expected: 4-stage map, primary_activation_level = 3, L1→L2 flagged as high drop-off risk.

## Alternatives Considered

1. **Pre-computed suggested mappings** — Compute tier-to-level suggestions before passing to LLM. Rejected: adds unnecessary indirection; Claude can determine mappings from raw data.
2. **Dependency on aggregateActivationInputs (S001)** — Wait for S001 and import it. Rejected: generator should own its data fetching following existing patterns.
3. **Granular exports for all helpers** — Export parser, prompt builder, etc. for testing. Rejected: over-granular; test the parser through the module's public interface.

## Success Criteria

1. generateActivationMap internalAction accepts productId and returns ActivationMap
2. Prompt includes activation levels and value moments
3. LLM output is parsed into ActivationMap structure
4. Stages array length matches activation levels count
5. Each stage has trigger_events derived from activation criteria
6. Value moments distributed across stages (not all at one stage)
7. Drop-off risks identified for at least one stage
8. Linear test produces 4-stage map with cycle completion as primary
