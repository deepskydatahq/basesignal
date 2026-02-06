# Parse Activation Levels Response Design

## Overview

A parser function that extracts JSON from Claude's response, validates all required fields for activation levels, clamps confidence values, and ensures data integrity before downstream consumption.

## Problem Statement

When Claude generates activation levels analysis, the response comes as text that may include markdown code fences. This raw response needs parsing and validation before the application can safely use it. Invalid or malformed responses should fail fast with clear error messages.

## Expert Perspectives

### Technical
- Validate at the boundary between untrusted LLM output and internal code
- Validate the *shape* required for safe consumption, not deep business logic
- For criteria: validate required fields (action, count) but don't validate optional field formats
- Keep the parser focused on deserialization; leave domain validation to downstream code

### Simplification Review
- Collapse validation into single function - no helper abstractions
- Inline confidence clamping with Math.max/min
- Follow exact pattern from parseIdentityResponse: linear validation flow
- No separate constants or utility functions - inline everything

## Proposed Solution

A single `parseActivationLevelsResponse` function following the established pattern from `parseIdentityResponse` in `extractIdentity.ts`:

1. Extract JSON from markdown code fences (or raw JSON)
2. Parse JSON
3. Validate top-level required fields: levels, primaryActivation, overallConfidence
4. Validate each level has: level, name, signalStrength, criteria, confidence
5. Validate signalStrength is one of: weak, medium, strong, very_strong
6. Validate each criterion has: action (string), count (number)
7. Clamp confidence values inline to [0, 1] range
8. Sort levels by level number ascending
9. Validate primaryActivation references an existing level number
10. Return validated result

## Design Details

```typescript
export function parseActivationLevelsResponse(responseText: string): ActivationLevelsResult {
  // Extract JSON from code fences
  const fenceMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : responseText.trim();
  const parsed = JSON.parse(jsonStr);

  // Validate top-level fields
  if (!Array.isArray(parsed.levels)) {
    throw new Error("Missing required field: levels (must be array)");
  }
  if (typeof parsed.primaryActivation !== 'number') {
    throw new Error("Missing required field: primaryActivation (must be number)");
  }
  if (typeof parsed.overallConfidence !== 'number') {
    throw new Error("Missing required field: overallConfidence (must be number)");
  }

  // Validate each level
  for (const level of parsed.levels) {
    if (typeof level.level !== 'number') throw new Error("Level missing: level number");
    if (typeof level.name !== 'string') throw new Error("Level missing: name");
    if (!['weak', 'medium', 'strong', 'very_strong'].includes(level.signalStrength)) {
      throw new Error(`Invalid signalStrength: ${level.signalStrength}`);
    }
    if (!Array.isArray(level.criteria)) throw new Error("Level missing: criteria array");
    if (typeof level.confidence !== 'number') throw new Error("Level missing: confidence");

    // Validate criteria shape
    for (const c of level.criteria) {
      if (typeof c.action !== 'string') throw new Error("Criterion missing: action");
      if (typeof c.count !== 'number') throw new Error("Criterion missing: count");
    }

    // Clamp confidence inline
    level.confidence = Math.max(0, Math.min(1, level.confidence));
  }

  // Sort levels by level number
  parsed.levels.sort((a, b) => a.level - b.level);

  // Clamp overall confidence
  parsed.overallConfidence = Math.max(0, Math.min(1, parsed.overallConfidence));

  // Validate primaryActivation exists
  if (!parsed.levels.some(l => l.level === parsed.primaryActivation)) {
    throw new Error(`primaryActivation ${parsed.primaryActivation} does not match any level`);
  }

  return parsed;
}
```

## Alternatives Considered

1. **Separate validation helper functions** - Rejected: adds indirection without improving readability, breaks from established codebase pattern
2. **Schema validation library (zod, etc.)** - Rejected: overkill for this use case, adds dependency
3. **Lenient criteria validation** - Rejected: catching malformed LLM output early prevents downstream type errors

## Success Criteria

All acceptance criteria from the story:
1. parseActivationLevelsResponse extracts JSON from code fences
2. Parser validates required fields: levels, primaryActivation, overallConfidence
3. Parser validates each level has: level, name, signalStrength, criteria, confidence
4. Parser throws descriptive error for missing required fields
5. Parser clamps confidence values to [0, 1] range
6. Parser validates signalStrength is one of: weak, medium, strong, very_strong
7. Parser ensures levels are sorted by level number ascending
8. Parser validates primaryActivation references an existing level number
