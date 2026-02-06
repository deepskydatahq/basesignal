# Extract Activation Levels Design

## Overview

Implement `extractActivationLevels` as an internalAction that extracts multi-level activation data from crawled product pages and stores it on the product profile. Follows the established extractor pattern from extractIdentity.ts.

## Problem Statement

Basesignal needs to identify multiple activation levels (explorer → creator → collaborator → team adopter) from product content, not just a single activation definition. This enables product leaders to see nuanced activation milestones across their product.

## Expert Perspectives

### Product
- Users need ONE authoritative source of truth for activation levels, not conflicting definitions
- The magic moment is consistent, nuanced activation milestones without confusion
- Multi-level activation replaces the simpler single-level approach

### Technical
- Each extraction should own its entire payload
- Follow extractJourney's proven pattern: fetch profile → merge locally → call updateSectionInternal
- Avoid adding new mutations when existing patterns suffice

### Simplification Review
- Removed proposed `updateDefinitionsSubfieldInternal` mutation - unnecessary abstraction
- The fetch-merge-write pattern belongs in the action layer, not database layer
- Existing `updateSectionInternal` with local merging is simpler and proven

## Proposed Solution

Follow the exact extractIdentity.ts pattern with local merge for definitions storage:

```typescript
export const extractActivationLevels = internalAction({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    // 1. Fetch crawled pages
    const pages = await ctx.runQuery(internal.crawledPages.listByProductInternal, {
      productId: args.productId,
    });

    // 2. Filter to activation-relevant pages
    const activationPages = filterActivationPages(pages);

    // 3. Build page context
    const pageContext = buildPageContext(activationPages);

    // 4. Get identity for product context
    const profile = await ctx.runQuery(internal.productProfiles.getInternal, {
      productId: args.productId,
    });
    const identityContext = profile?.identity
      ? `Product: ${profile.identity.productName}\nValue: ${profile.identity.description}`
      : "";

    // 5. Call Claude Haiku
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-haiku-4-20250414",
      max_tokens: 2048,
      system: ACTIVATION_SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `${identityContext}\n\nExtract activation levels from:\n\n${pageContext}`,
      }],
    });

    // 6. Parse response
    const activation = parseActivationLevelsResponse(responseText);

    // 7. Merge and store on profile (preserves other definitions)
    const definitions = profile?.definitions ?? {};
    const updatedDefinitions = { ...definitions, activation };

    await ctx.runMutation(internal.productProfiles.updateSectionInternal, {
      productId: args.productId,
      section: "definitions",
      data: updatedDefinitions,
    });

    return activation;
  },
});
```

## Design Details

### Flow
1. Fetch all crawled pages for product
2. Filter to activation-relevant pages (onboarding, help, features, customers)
3. Build page context for LLM
4. Enrich with identity context if available
5. Call Claude Haiku with ACTIVATION_SYSTEM_PROMPT
6. Parse JSON response to ActivationLevelsResult
7. Fetch current profile, merge activation into definitions, store

### Storage Strategy
Use existing `updateSectionInternal` with local merge:
- Fetch current profile to get existing definitions
- Spread existing definitions and add new activation
- Write complete definitions object back

This is the proven pattern from extractJourney - no new mutations needed.

### Dependencies
- S001: Types (ActivationLevel, ActivationCriterion, ActivationLevelsResult)
- S002: ACTIVATION_SYSTEM_PROMPT
- S003: filterActivationPages function
- S005: parseActivationLevelsResponse function (implied)

### Components
| Component | Source | Responsibility |
|-----------|--------|----------------|
| Types | S001 | ActivationLevel, ActivationLevelsResult interfaces |
| ACTIVATION_SYSTEM_PROMPT | S002 | LLM instructions for extraction |
| filterActivationPages | S003 | Page type filtering and prioritization |
| parseActivationLevelsResponse | S004 (this story) | JSON parsing and validation |
| extractActivationLevels | S004 (this story) | Main internalAction orchestrator |

## Alternatives Considered

### New updateDefinitionsSubfieldInternal mutation
- Rejected: Adds database-layer complexity for a problem solved at application layer
- The fetch-merge-write pattern is cleaner in the action where we already have profile access

### Separate top-level section for activation
- Rejected: Would require schema changes and diverge from definitions pattern
- Keeping activation within definitions maintains consistency

## Success Criteria

1. extractActivationLevels exported as internalAction
2. Fetches pages via listByProductInternal
3. Filters using filterActivationPages (from S003)
4. Calls Claude Haiku with ACTIVATION_SYSTEM_PROMPT (from S002)
5. Parses response to ActivationLevelsResult
6. Stores in definitions.activation without overwriting other definition fields
7. Running on Miro product produces 3-4 activation levels
8. Stored activation includes levels array with primaryActivation set

---
*Design created via /brainstorm-auto*
