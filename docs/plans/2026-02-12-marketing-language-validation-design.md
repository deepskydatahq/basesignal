# Marketing-Language Detection Design

## Overview
Add deterministic marketing-language detection to the candidate validation pipeline, catching candidates that describe abstract business outcomes instead of user experiences. Flagged candidates flow through existing LLM rewrite infrastructure.

## Problem Statement
The lens extraction pipeline sometimes produces value moment candidates phrased in marketing buzzwords ("Automate X", "Streamline Y at scale") rather than grounded user experiences. These need to be caught and rewritten before convergence.

## Expert Perspectives

### Technical
- Check both pattern lists (marketing verbs and abstract phrases) in a single function with one responsibility: "marketing smoke without product substance"
- Use substring matching against `knownFeatures` for the escape hatch — same approach as existing `isVagueCandidate()` and `hasUnverifiedFeatureRef()`. No need for word-boundary matching; edge cases are rarer than the cost of over-engineering
- No changes to LLM prompt — existing rewrite flow handles flagged candidates generically

### Simplification Review
- Reviewer suggested merging the two pattern lists and removing the `knownFeatures` escape hatch
- Both suggestions rejected: ACs explicitly require two named constants (`MARKETING_LANGUAGE_PATTERNS` and `ABSTRACT_OUTCOME_PATTERNS`) and the escape hatch behavior (test case: "Set board-level permissions" must NOT be flagged)
- Reviewer's core insight is valid: keep things minimal. No new types, no prompt changes, no new abstractions

## Proposed Solution

Add two constants, one function, and a single-line pipeline integration — all in the existing `validateCandidates.ts` file.

## Design Details

### Constants

```typescript
export const MARKETING_LANGUAGE_PATTERNS: RegExp[] = [
  /\bautomate\b/i, /\bstreamline\b/i, /\boptimize\b/i,
  /\bleverage\b/i, /\benhance\b/i, /\bempower\b/i,
  /\baccelerate\b/i, /\brevolutionize\b/i, /\btransform\b/i,
];

export const ABSTRACT_OUTCOME_PATTERNS: string[] = [
  "at scale", "cross-functional", "end-to-end",
  "enterprise-grade", "best-in-class", "next-generation",
];
```

### Function: `isMarketingLanguage(name, description, knownFeatures)`

1. Check name+description against `MARKETING_LANGUAGE_PATTERNS` (regex)
2. If no match, check against `ABSTRACT_OUTCOME_PATTERNS` (substring)
3. If any match found, check if text also references a known product surface from `knownFeatures`
4. If known feature present → return null (not flagged)
5. If no known feature → return explanation string

### Pipeline Integration

Single line added to `runValidationPipeline()` after existing checks:
```typescript
const marketingFlag = isMarketingLanguage(candidate.name, candidate.description, knownFeatures);
if (marketingFlag) flags.push(marketingFlag);
```

Flagged candidates flow through existing `applyLlmReview()` for experiential rewriting.

## Files Changed

| File | Change |
|------|--------|
| `convex/analysis/convergence/validateCandidates.ts` | Add constants, function, pipeline integration |
| `convex/analysis/convergence/validateCandidates.test.ts` | Unit tests + integration test |

## Alternatives Considered

- **Merge both pattern lists into one** — Rejected: ACs require two named constants. Separate lists also have different semantics (verb patterns vs phrase patterns).
- **Remove knownFeatures escape hatch, let LLM decide** — Rejected: AC explicitly requires the function NOT flag when product surface is referenced. The deterministic escape hatch avoids unnecessary LLM calls.
- **Change LLM prompt for marketing-specific rewrites** — Rejected: Existing prompt already handles flagged candidates generically with outcome-focused rewrites.

## Success Criteria

- All 3 specified test cases pass (automate flagged, permissions not flagged, streamline flagged)
- Full validation pipeline runs without errors
- No changes to existing test behavior
