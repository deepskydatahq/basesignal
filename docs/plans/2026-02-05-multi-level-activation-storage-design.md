# Multi-Level Activation Storage Design

## Overview

Update `productProfiles` mutations to handle the new multi-level activation structure, enabling storage of activation levels with confidence scores while maintaining backward compatibility with legacy flat activation data.

## Problem Statement

The activation schema is evolving from a flat structure (`criteria`, `confidence`) to a multi-level structure (`levels` array, `overallConfidence`). The storage and completeness calculation code needs to handle both formats during the migration period.

## Expert Perspectives

### Technical

**Storage layer**: Keep it opaque. `updateSectionInternal` already uses `v.any()` and stores whatever structure it receives. No changes needed. This enables gradual rollout and A/B testing without coupling extraction logic to schema versioning.

**Read layer**: Put all format-detection intelligence in readers. Use defensive fallback on read rather than explicit format branching.

**Key insight**: Activation isn't fundamentally different from other definitions—treat it uniformly rather than special-casing it.

### Simplification Review

**What was cut:**
- Removed explicit `Array.isArray(activation.levels)` format detection—use transparent fallback instead
- Removed special-case handling of activation—keep it in the uniform definition loop
- `primaryActivation` is stored but doesn't need logic in completeness calculation

**Final pattern**: One-line fallback handles both formats without making format differences visible in code.

## Proposed Solution

### Storage Layer (no changes)

`updateSectionInternal` already stores data opaquely via `v.any()`. The new activation structure with `levels`, `primaryActivation`, and `overallConfidence` will be stored as-is.

### Read Layer (minimal change)

Update `calculateCompletenessAndConfidence` to use a defensive fallback that handles both formats:

```typescript
const defKeys = ["activation", "firstValue", "active", "churn"] as const;
if (profile.definitions) {
  for (const key of defKeys) {
    if (profile.definitions[key]) {
      filledSections++;
      // Handles both new (overallConfidence) and legacy (confidence) formats
      totalConfidence += profile.definitions[key].overallConfidence ??
                        profile.definitions[key].confidence ?? 0;
    }
  }
}
```

## Design Details

### Format Detection

Instead of explicit branching:
```typescript
// DON'T DO THIS
if (Array.isArray(activation.levels)) {
  totalConfidence += activation.overallConfidence ?? 0;
} else {
  totalConfidence += activation.confidence ?? 0;
}
```

Use transparent fallback:
```typescript
// DO THIS
totalConfidence += activation.overallConfidence ?? activation.confidence ?? 0;
```

This handles both formats without conditional logic.

### Data Structures

**Legacy format** (existing profiles):
```typescript
{
  criteria: ["action1", "action2"],
  confidence: 0.75,
  // ...
}
```

**New format** (after M002-E001-S001):
```typescript
{
  levels: [
    { level: 1, name: "Awareness", signalStrength: "weak", ... },
    { level: 2, name: "Engagement", signalStrength: "medium", ... },
    // ...
  ],
  primaryActivation: 2,
  overallConfidence: 0.85,
}
```

## Alternatives Considered

1. **Special-case activation in the loop** - Rejected. Creates inconsistency and makes format differences visible in code.

2. **Helper function `getConfidenceForDefinition(key, data)`** - Rejected. Hides structural reality behind abstraction when transparent fallback is simpler.

3. **Normalize at write-time** - Rejected. Creates tight coupling between extractors and schema versioning.

## Success Criteria

1. Storing activation with `levels` array persists all level data
2. Storing activation with `primaryActivation` marker preserves the field
3. `calculateCompletenessAndConfidence` uses `overallConfidence` when present
4. Legacy profiles with only `confidence` continue to work
5. No schema migration required (already uses `v.any()`)
