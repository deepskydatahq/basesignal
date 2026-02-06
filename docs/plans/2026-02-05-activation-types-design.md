# Activation Types Design

## Overview

Define TypeScript interfaces for multi-level activation extraction that serve as the foundation for the M002-E003 epic (Multi-Level Activation Extraction).

## Problem Statement

The extraction pipeline needs typed interfaces to represent multi-level activation data. These types flow through parsing, validation, storage, and testing. Without shared type definitions, downstream stories (prompts, filtering, parsing) would duplicate type definitions or work with untyped data.

## Expert Perspectives

### Technical

**Key insight:** Export the types as named exports (breaking from the inline-only pattern in extractIdentity.ts) because these types are part of a module API, not implementation details. Future stories S002-S005 will consume these types across prompts, filters, and validators.

Treat `extractActivationLevels.ts` as a types module that happens to also contain extraction logic, not a pure extraction module that happens to define types.

### Simplification Review

**Verdict: APPROVED**

Nothing to remove or simplify. The design is minimal:
- Each interface is functional with no speculative fields
- SignalStrength type alias prevents string literal duplication across the epic
- Types mirror the schema structure exactly (no transformation drift)

## Proposed Solution

Create `convex/analysis/extractActivationLevels.ts` with four exported type definitions that match the schema in `convex/schema.ts`.

## Design Details

```typescript
// convex/analysis/extractActivationLevels.ts

export type SignalStrength = 'weak' | 'medium' | 'strong' | 'very_strong';

export interface ActivationCriterion {
  action: string;
  count: number;
  timeWindow?: string;
}

export interface ActivationLevel {
  level: number;
  name: string;
  signalStrength: SignalStrength;
  criteria: ActivationCriterion[];
  reasoning: string;
  confidence: number;
  evidence: Array<{ url: string; excerpt: string }>;
}

export interface ActivationLevelsResult {
  levels: ActivationLevel[];
  primaryActivation: number;
  overallConfidence: number;
}
```

### Type Responsibilities

| Type | Purpose |
|------|---------|
| `SignalStrength` | Union type for confidence levels in activation |
| `ActivationCriterion` | Single behavioral criterion (action + count + optional time window) |
| `ActivationLevel` | Complete activation level with metadata, criteria, and evidence |
| `ActivationLevelsResult` | Container for extraction results with primary activation marker |

## Alternatives Considered

1. **Inline types (existing pattern)**: Rejected because these types are consumed across multiple stories in the epic, not just internally.

2. **Separate types file**: Considered `convex/analysis/types/activation.ts` but keeping types co-located with their primary consumer is simpler and matches the guidance.

## Success Criteria

1. File `convex/analysis/extractActivationLevels.ts` exists with all types
2. All types are exported as named exports
3. Types match the schema structure in `convex/schema.ts`
4. TypeScript compiles without errors
5. Future stories can import and use these types

---
*Design via /brainstorm-auto · 2026-02-05*
