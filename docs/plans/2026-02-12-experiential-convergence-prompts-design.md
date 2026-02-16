# Experiential Convergence Prompts Design

## Overview
Rewrite MERGE_SYSTEM_PROMPT and CLUSTERING_SYSTEM_PROMPT to shift from business/value-oriented language ("Gain visibility into...", "Reduce time spent on...") to experiential, user-action framing that describes what users actually do in the product.

## Problem Statement
The convergence prompts currently produce abstract value moment names that read like marketing copy. Product leaders can't recognize themselves in names like "Accelerate cross-functional alignment." The prompts need to produce names grounded in observable user actions and screens.

## Expert Perspectives

### Product
- Use a flexible naming principle, not a rigid template. The test: "Would a product leader recognize themselves in this name?"
- Names should be scannable and specific enough that a user immediately knows if this is their moment
- Don't force "in [surface]" on every name — sometimes context is implicit and adds noise

### Technical
- Clustering grouping should use "in-product experience" not "user action" to avoid verb-matching over semantic coherence
- Two candidates with different verbs but describing facets of the same moment (e.g., "drag card to Done" + "view completion count tick up") must still cluster together
- Cross-lens diversity within a cluster is the goal, not a bug

### Simplification Review
- Cut example pairs from 3 to 2 — one clear contrast teaches the pattern; repetition is prompt bloat
- Drop "or user moment" duality in clustering — just say "in-product experience"
- Reduce verb examples from 12+ to 7 distinct ones: Create, Share, Export, View, Comment, Configure, Drag
- Clustering labels should be concise (3-8 words), not full sentences

## Proposed Solution

Prompt-only changes to two string constants. No structural, schema, or test changes.

### Change 1: MERGE_SYSTEM_PROMPT (convergeAndTier.ts, ~lines 219-245)

Replace the entire prompt constant. Key changes:
- **Verb examples**: `Create, Share, Export, Build, Drag, View, Comment, Configure` (replacing Gain, Reduce, Accelerate, Eliminate, Enable)
- **Core instruction**: "Name should describe what a user sees or does on screen, not what the business gains."
- **Name format**: Start with a capitalized user-action verb, then the object, anchored to a recognizable workflow moment. Let examples teach the pattern.
- **2 good/bad pairs**:
  - BAD: "Gain visibility into project progress" → GOOD: "View project status on the overview dashboard"
  - BAD: "Accelerate team alignment" → GOOD: "Comment on shared goals in the team workspace"
- Keep all structural rules: capitalized first letter, JSON output, is_coherent flag, roles, product_surfaces

### Change 2: CLUSTERING_SYSTEM_PROMPT (clusterCandidates.ts, ~lines 195-221)

Replace the entire prompt constant. Key changes:
- **Grouping criterion**: "SAME in-product experience — candidates belong together when they describe different facets (different screens, different actions, different perspectives) of the same thing a user recognizes as one coherent experience"
- **Rule 4**: "Group by shared user experience, not surface-level keyword overlap"
- **Example labels** (concise, 3-8 words): "Drag cards across columns", "View team activity feed", "Export filtered data"
- Preserve verbatim: "NEVER place two candidates from the SAME lens" and "15-30 clusters"

## Design Details

### Test Compatibility
- `parseMergeResponse` validates name starts with capital letter — preserved (user-action verbs are capitalized)
- Mock test responses use hardcoded names — independent of prompt text
- Clustering tests assert prompt contains "NEVER place two candidates from the SAME lens" and "15-30 clusters" — both preserved verbatim
- No other prompt-content assertions exist

### Files Modified
| File | Change |
|------|--------|
| `convex/analysis/convergence/convergeAndTier.ts` | Replace `MERGE_SYSTEM_PROMPT` constant |
| `convex/analysis/convergence/clusterCandidates.ts` | Replace `CLUSTERING_SYSTEM_PROMPT` constant |

### Files NOT Modified
- No test files changed
- No schema changes
- No type changes

## Alternatives Considered
1. **Rigid template "Verb + Object + in Surface"** — Rejected: produces formulaic names, forces awkward suffixes
2. **Keep "user action" in clustering** — Rejected: causes verb-matching instead of semantic grouping
3. **Three good/bad pairs** — Simplified to two: one clear contrast teaches the pattern better than repetition

## Success Criteria
- All existing convergence tests pass unchanged
- Running convergence on real product data produces names with observable user actions instead of business abstractions
- Clustering groups experiential moments by shared user experience, not abstract themes
