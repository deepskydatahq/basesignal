# Candidate Validation Pass Design

## Overview

A validation function reviews lens candidates and catches common failure modes before semantic clustering. Deterministic checks run first (fast, testable, no API cost), then a single Claude Haiku call handles judgment and rewriting.

## Problem Statement

The 7-lens pipeline produces 60-140 raw candidates. Many have quality issues: feature-language instead of value-language, vague descriptions, duplicates within the same lens, and references to features not in the knowledge graph. These need to be caught and fixed before clustering.

## Expert Perspectives

### Product
- Hallucinated features should be soft-flagged with rewrite, not removed outright. The knowledge graph may be incomplete (crawler misses things), so aggressive removal creates false negatives that harm the product model.
- When a candidate references an unknown feature, rewrite to outcome language ("helps users achieve X") rather than feature language ("uses Y").
- Flag patterns in metadata for future crawler improvement.

### Technical
- Deterministic-first approach wins because 5 of 8 acceptance criteria are unit tests requiring isolated, testable pure functions.
- Two cognitive categories: (1) deterministic measurable things, (2) judgment-requiring things. The architecture should mirror this.
- If deterministic pass is too aggressive, easy to adjust thresholds or move checks to LLM without rearchitecting.

### Simplification Review
- Collapsed 3-phase pipeline into: single deterministic pass + one LLM call (no separate "assembly phase")
- Removed `CheckResult` intermediate type - deterministic checks populate `ValidatedCandidate` directly
- Embedded prompt building/parsing in orchestrator (not separate exported functions)
- Removed artificial LLM batch size cap (Haiku handles full candidate set)
- `LensCandidate`/`LensResult` types belong to upstream story S001, not here

## Proposed Solution

Single file: `convex/analysis/convergence/validateCandidates.ts`

### Deterministic Checks (exported pure functions for unit testing)

```typescript
/** Check if candidate name/description uses feature-as-value language */
export function isFeatureAsValue(name: string, description: string): string | null

/** Check if candidate description is vague without specifics */
export function isVagueCandidate(description: string): string | null

/** Find duplicate pairs within a single lens using TF-IDF similarity */
export function findWithinLensDuplicates(
  candidates: Array<{ id: string; name: string; description: string }>,
  threshold?: number  // default 0.85
): Array<{ keep: string; remove: string; similarity: number }>

/** Check if candidate references features not in knowledge graph */
export function hasUnverifiedFeatureRef(
  description: string,
  knownFeatures: Set<string>
): string | null
```

### Detection Rules

```typescript
// Feature-as-value patterns
const FEATURE_AS_VALUE_PATTERNS = [
  /^use the\b/i, /^click the\b/i, /^open the\b/i,
  /^navigate to\b/i, /^select the\b/i, /^enable\b/i,
  /^toggle\b/i, /^turn on\b/i, /^activate the\b/i, /^go to\b/i,
];

// Vague phrases that need specifics to be acceptable
const VAGUE_PHRASES = [
  "better visibility", "improved efficiency", "enhanced experience",
  "streamlined workflow", "greater insights", "increased productivity",
  "better outcomes", "improved performance", "enhanced capabilities",
  "seamless integration", "intuitive interface", "powerful features",
  "actionable insights", "data-driven decisions",
];

const DUPLICATE_THRESHOLD = 0.85;
```

### Orchestrator (internalAction)

```typescript
export const validateCandidates = internalAction({
  args: {
    lensResults: v.any(),     // LensResult[]
    productId: v.id("products"),
  },
  handler: async (ctx, args): Promise<ValidatedCandidate[]> => {
    // 1. Load knowledge graph
    const profile = await ctx.runQuery(internal.productProfiles.getInternal, { productId });
    const knownFeatures = buildKnownFeaturesSet(profile);

    // 2. Run deterministic checks, populate ValidatedCandidate[] directly
    //    - isFeatureAsValue -> flag for rewrite
    //    - isVagueCandidate -> flag for rewrite
    //    - findWithinLensDuplicates -> mark removed
    //    - hasUnverifiedFeatureRef -> flag for rewrite

    // 3. Send flagged candidates to Claude Haiku in one call
    //    - LLM confirms/overrides flags
    //    - Rewrites flagged candidates to outcome-focused language
    //    - Returns rewritten name + description + validation_issue

    // 4. Merge LLM results back into ValidatedCandidate[]
    return validated;
  },
});
```

### LLM Call

- Model: `claude-haiku-4-20250414` (fast, cheap)
- Single call with all flagged candidates
- System prompt instructs: confirm/override flags, rewrite to outcome language, explain each issue
- Response: JSON array of `{ id, action, rewritten_name?, rewritten_description?, validation_issue }`

## Design Details

### Data Flow

```
LensResult[] (60-140 candidates)
  |
  v
Deterministic pass (pure functions)
  - Feature-as-value: regex on name/description -> flag
  - Vague: phrase matching on description -> flag
  - Duplicates: TF-IDF similarity within each lens -> remove lower-confidence
  - Unverified features: match against knowledge graph -> flag
  |
  v
Flagged candidates (expect ~30-50% flagged)
  |
  v
Claude Haiku (single call)
  - Confirm/override flags
  - Rewrite to outcome-focused language
  - Explain each issue
  |
  v
ValidatedCandidate[] (20-40% reduction via removal + merging)
```

### Knowledge Graph Matching

Extract feature names from:
- `profile.entities.items[].name` (entity names)
- `profile.outcomes.items[].linkedFeatures[]` (linked features)

Build a `Set<string>` of known features. Case-insensitive matching against candidate descriptions.

## Alternatives Considered

1. **LLM-first** (send everything to Haiku): Rejected because 5 unit tests need deterministic assertions, and it wastes tokens on checks that regex/similarity handles better.
2. **Hybrid single-pass** (deterministic + LLM context): Over-complicated the prompt without clear benefit. The LLM doesn't need to see what was already caught deterministically.
3. **Hard removal of hallucinated features**: Rejected because knowledge graph may be incomplete. Soft-flag with rewrite preserves legitimate candidates.

## Success Criteria

- validateCandidates accepts LensResult[] and returns ValidatedCandidate[]
- Feature-as-value patterns ("Use the...", "Click the...") caught by regex
- Vague phrases flagged unless accompanied by specifics
- Within-lens duplicates (>0.85 similarity) merged
- Unknown feature references soft-flagged
- Total candidate count reduced 20-40%
- Rewritten candidates use outcome-focused language
- Every flagged candidate has validation_issue explaining why
