# Activation Levels Schema Design

## Overview

Define a new multi-level activation schema structure in `convex/schema.ts` to support multiple activation levels, each with signal strength, structured criteria, and evidence. This replaces the flat single-level activation schema.

## Problem Statement

The current activation schema captures only a single activation state. The product needs to model multi-level activation (e.g., "onboarded" → "first action" → "power user") where each level represents a different depth of product engagement with its own criteria and signal strength.

## Expert Perspectives

### Technical
- **Use Option B (Replace directly)**: Since `updateSectionInternal` uses `v.any()` for storage, schema validation is bypassed at runtime. Both old and new data formats will persist without issues.
- **Schema as documentation**: The schema serves primarily for documentation and TypeScript generation, not runtime validation. The new schema documents the target format.
- **Runtime fallback pattern**: The existing `calculateCompletenessAndConfidence` function uses transparent fallbacks (`confidence ?? 0`) to handle both formats gracefully.

### Simplification Review
The reviewer questioned whether multi-level activation is necessary, suggesting the existing flat structure with separate definitions (activation, active, atRisk, churn) already captures lifecycle states.

**Resolution**: The acceptance criteria explicitly require:
- `activation.levels` as array of level objects
- `signalStrength` enum on each level
- `overallConfidence` at root level
- `primaryActivation` as number

These are product requirements from the story specification (M002-E001-S001), not implementation choices. The design correctly implements the specified schema structure.

## Proposed Solution

Replace the existing flat activation schema with a new multi-level structure that supports multiple activation levels.

## Design Details

### Schema Change (convex/schema.ts)

**Current:**
```typescript
activation: v.optional(v.object({
  criteria: v.array(v.string()),
  timeWindow: v.optional(v.string()),
  reasoning: v.string(),
  confidence: v.number(),
  source: v.string(),
  evidence: v.array(v.object({ url: v.string(), excerpt: v.string() })),
})),
```

**New:**
```typescript
activation: v.optional(v.object({
  levels: v.array(v.object({
    level: v.number(),
    name: v.string(),
    signalStrength: v.union(
      v.literal("weak"),
      v.literal("medium"),
      v.literal("strong"),
      v.literal("very_strong")
    ),
    criteria: v.array(v.object({
      action: v.string(),
      count: v.number(),
      timeWindow: v.optional(v.string()),
    })),
    reasoning: v.string(),
    confidence: v.number(),
    evidence: v.array(v.object({ url: v.string(), excerpt: v.string() })),
  })),
  primaryActivation: v.optional(v.number()),
  overallConfidence: v.number(),
  source: v.optional(v.string()),
})),
```

### Key Design Points

1. **Levels array**: Each level is a numbered stage of activation (1, 2, 3...) with its own name, signal strength, and criteria
2. **Structured criteria**: Changed from `criteria: string[]` to `criteria: [{action, count, timeWindow}]` for more precise metric definitions
3. **Signal strength enum**: Categorical classification of activation signal (weak → very_strong)
4. **Primary activation marker**: `primaryActivation` points to the level number that represents the aha-moment
5. **Overall confidence**: Root-level confidence aggregating across all levels
6. **Source tracking**: Made optional since the storage layer uses `v.any()` anyway

### Backward Compatibility

- Storage layer uses `v.any()` for definitions, so old data persists unchanged
- Read layer uses transparent fallbacks (`confidence ?? 0`) to handle both formats
- No migration needed - old and new formats coexist

## Alternatives Considered

1. **Union type for both formats** - Rejected: Creates false specificity suggesting validation occurs
2. **Hybrid schema with both old and new fields** - Rejected: Leaks migration complexity into the data model
3. **Start flat, add levels later** - Rejected: Requirements explicitly specify multi-level structure

## Success Criteria

1. Schema compiles without errors (`npx convex dev` succeeds)
2. TypeScript types are generated correctly in `convex/_generated/`
3. All acceptance criteria met:
   - [x] `activation.levels` as array
   - [x] Each level has `level`, `name`, `signalStrength`
   - [x] Each level has structured `criteria` array
   - [x] Each level has `reasoning`, `confidence`, `evidence`
   - [x] `activation.primaryActivation` as number
   - [x] `activation.overallConfidence` as number
