# ICP Prompt Prioritization Design

## Overview
Update the ICP generation prompts to prioritize core daily product users over marketing-prominent personas. When crawled website data dominates inputs, the LLM over-indexes on roles the website promotes (security, compliance, buyers) rather than who actually uses the product daily. Two additive changes fix this: a system prompt section and a data-level guidance section.

## Problem Statement
The current ICP generation prompt has no guidance about distinguishing real product users from marketing personas. For products with heavy marketing/compliance content (e.g., Miro's security pages), the LLM generates personas based on content volume rather than product-usage signals like Tier 1 value moments.

## Expert Perspectives

### Product
- The real distinction isn't usage frequency but "who the product is built for" vs "who the website markets to"
- Tier 1 value moments should do the heavy lifting in prioritization, not arbitrary frequency labels
- An executive checking dashboards weekly is still a real product user; a compliance evaluator reading docs is not

### Technical
- The `buildICPPrompt` Prioritization Guidance section must sort roles by `tier_1_count` descending before slicing top 3
- Without explicit sorting, Map insertion order makes the "top roles" arbitrary
- One line of `.sort()` makes the code do what it claims to do — explicit over implicit

### Simplification Review
- Reviewer flagged potential duplication between system prompt instructions and data-level guidance
- However, the Prioritization Guidance section in `buildICPPrompt` is an explicit acceptance criterion
- LLM prompt engineering benefits from both instruction (system) and concrete data (user message)
- No changes cut from the design; reviewer concern noted but acceptance criteria take precedence

## Proposed Solution

### Change 1: Update `ICP_SYSTEM_PROMPT`
Append a "Persona Prioritization" section between Distinctness Requirement and Output Format:
- Defines "core daily user" vs "evaluator/buyer" vs "marketing persona"
- Instructs: "PRIMARY persona must represent who uses this product every day"
- Ranking: Tier 1 count (strongest) > daily usage signal > total count (weakest)
- Confidence: "based on product-usage evidence, not content volume"

### Change 2: Update `buildICPPrompt`
Add "Prioritization Guidance" section after Value Moments by Role:
- Filter roles with `tier_1_count > 0`
- Sort by `tier_1_count` descending (explicit, deterministic)
- Slice top 3
- List with format: `- {name}: {tier_1_count} Tier 1 moments`
- Only emitted when tier-1 roles exist

### Change 3: Add tests
- System prompt content assertions (daily users, evaluators, tier weighting, confidence)
- buildICPPrompt tests (guidance present, sorting, top-3 limit, omission when no tier-1)

## Design Details

**Files modified:** 2
1. `convex/analysis/outputs/generateICPProfiles.ts` — system prompt + buildICPPrompt additions
2. `convex/analysis/outputs/generateICPProfiles.test.ts` — new test cases only

**Files NOT modified:** parseICPProfiles, types.ts, schema.ts, aggregateRoles

**Backward compatibility:** All changes are additive. No output format or validation changes. Existing tests pass unchanged.

## Alternatives Considered

1. **System prompt only (no buildICPPrompt change)** — Simpler but doesn't satisfy acceptance criteria. Reviewer suggested this but the criteria explicitly require Prioritization Guidance in buildICPPrompt.
2. **Using "regular product users" instead of "core daily users"** — Product strategist recommended this as more precise, but acceptance criteria specify "core daily users" language.

## Success Criteria
- All 6 acceptance criteria satisfied
- Existing parseICPProfiles and buildICPPrompt tests pass unchanged
- New tests validate prompt content and guidance behavior
