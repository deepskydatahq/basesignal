# Apply Refinements to Activation Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the activation level extractor and an accuracy test script, then iterate on refinements until 70%+ accuracy is achieved.

**Architecture:** Build `extractActivationLevels.ts` following the established extractor pattern from `extractIdentity.ts` and `extractJourney.ts`. The prompt and filtering logic are inline in the file. A test script (`scripts/test-activation-accuracy.mjs`) measures accuracy against sample products. Git commits document each refinement iteration.

**Tech Stack:** Convex internalAction, Anthropic Claude Haiku, Vitest for unit tests, Node.js test script

---

## Context

This story (M002-E004-S004) implements the activation level extractor and refinement workflow. Previous stories in M002-E003 defined the design but the actual implementation file `convex/analysis/extractActivationLevels.ts` does not exist yet. This plan creates it from scratch following the established patterns, then iterates on accuracy.

**Key patterns from existing extractors:**
- `extractIdentity.ts`: Single LLM call, page filtering, response parsing, stores to profile
- `extractJourney.ts`: Two LLM calls, prepareCrawledContent, parseLlmJson, validateResult functions

---

### Task 1: Create ActivationLevel Types and Interfaces

**Files:**
- Create: `convex/analysis/extractActivationLevels.ts`
- Test: `convex/analysis/extractActivationLevels.test.ts`

**Step 1: Write failing test for types**

```typescript
// convex/analysis/extractActivationLevels.test.ts
import { describe, it, expect } from "vitest";

describe("ActivationLevel types", () => {
  it("type definitions are exported", async () => {
    const mod = await import("./extractActivationLevels");
    // Types exist (this is a compile-time check but we verify the file imports)
    expect(mod).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- extractActivationLevels`
Expected: FAIL - module not found

**Step 3: Write types**

```typescript
// convex/analysis/extractActivationLevels.ts

/** A single measurable criterion for an activation level */
export interface ActivationCriterion {
  action: string;       // snake_case action verb (create_board, invite_member)
  count: number;        // How many times (1 for one-time, higher for patterns)
  timeWindow?: string;  // Optional timing (first_7d, first_30d)
}

/** A single activation level in the progression */
export interface ActivationLevel {
  level: number;                    // 1-4
  name: string;                     // Human-readable name (explorer, creator)
  signalStrength: "weak" | "medium" | "strong" | "very_strong";
  criteria: ActivationCriterion[];
  reasoning: string;
  confidence: number;
  evidence: Array<{ url: string; excerpt: string }>;
}

/** The complete activation levels extraction result */
export interface ActivationLevelsResult {
  levels: ActivationLevel[];
  primaryActivation: number;  // Level number that represents the aha-moment
  overallConfidence: number;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- extractActivationLevels`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/analysis/extractActivationLevels.ts convex/analysis/extractActivationLevels.test.ts
git commit -m "$(cat <<'EOF'
feat(analysis): add activation level types

Define interfaces for multi-level activation extraction:
- ActivationCriterion: measurable action + count format
- ActivationLevel: individual level with signal strength
- ActivationLevelsResult: complete extraction result

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add ACTIVATION_SYSTEM_PROMPT Constant

**Files:**
- Modify: `convex/analysis/extractActivationLevels.ts`
- Test: `convex/analysis/extractActivationLevels.test.ts`

**Step 1: Write failing test for prompt**

```typescript
// Add to extractActivationLevels.test.ts
import { ACTIVATION_SYSTEM_PROMPT } from "./extractActivationLevels";

describe("ACTIVATION_SYSTEM_PROMPT", () => {
  it("is exported and non-empty", () => {
    expect(ACTIVATION_SYSTEM_PROMPT).toBeDefined();
    expect(ACTIVATION_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it("contains required field names", () => {
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("levels");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("primaryActivation");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("overallConfidence");
  });

  it("contains all signal strengths", () => {
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("weak");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("medium");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("strong");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("very_strong");
  });

  it("contains criteria format guidance", () => {
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("action");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("count");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- extractActivationLevels`
Expected: FAIL - ACTIVATION_SYSTEM_PROMPT not exported

**Step 3: Write the prompt constant**

```typescript
// Add to extractActivationLevels.ts after types

export const ACTIVATION_SYSTEM_PROMPT = `You are a product analyst identifying user activation progression. Extract 3-4 levels representing the journey from first touch to full adoption.

Return JSON matching this structure:

{
  "levels": [
    {
      "level": 1,
      "name": "explorer",
      "signalStrength": "weak",
      "criteria": [{"action": "create_first_item", "count": 1}],
      "reasoning": "Initial exploration shows curiosity",
      "confidence": 0.7,
      "evidence": [{"url": "...", "excerpt": "..."}]
    }
  ],
  "primaryActivation": 3,
  "overallConfidence": 0.75
}

## Signal Strength (Commitment Escalation)

weak: Individual exploration (created first item, browsed content)
medium: Learning the product (used template, completed setup)
strong: Core value realized (shared, collaborated, first outcome)
very_strong: Team adoption (multiple active users, recurring usage)

## Example: Project Management Tool

Level 1 (weak): Created first project or task
Level 2 (medium): Organized tasks with labels/priorities, set due dates
Level 3 (strong): Assigned task to teammate or integrated with other tool
Level 4 (very_strong): 5+ team members with activity in last 30 days

primaryActivation: 3 (assignment proves collaborative value)

## Primary Activation

The level where the product's core value proposition becomes real. Not the most advanced level—the aha-moment. For collaboration tools: when someone else engages with your work. For productivity tools: when your first workflow completes successfully.

## Criteria Format

- action: snake_case verb (create_board, invite_member)
- count: how many times (1 for one-time, higher for patterns)
- timeWindow: optional timing ("first_7d", "first_30d")

## Confidence

overallConfidence reflects source quality:
- 0.8+: Help docs or case studies with explicit behaviors
- 0.5-0.8: Feature pages with action descriptions
- <0.5: Inferred from marketing only

## Rules

- Return ONLY valid JSON
- Always 3-4 levels, numbered 1-4
- Each level needs at least 1 criterion with action + count
- primaryActivation must reference existing level number`;
```

**Step 4: Run test to verify it passes**

Run: `npm test -- extractActivationLevels`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/analysis/extractActivationLevels.ts convex/analysis/extractActivationLevels.test.ts
git commit -m "$(cat <<'EOF'
feat(analysis): add ACTIVATION_SYSTEM_PROMPT constant

Prompt instructs Claude to extract 3-4 activation levels with:
- Signal strength progression (weak → very_strong)
- Measurable criteria (action + count format)
- Primary activation identification (aha-moment)
- Evidence grounding from source content

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Add Page Filtering Logic

**Files:**
- Modify: `convex/analysis/extractActivationLevels.ts`
- Test: `convex/analysis/extractActivationLevels.test.ts`

**Step 1: Write failing test for filterActivationPages**

```typescript
// Add to extractActivationLevels.test.ts
import { filterActivationPages } from "./extractActivationLevels";

describe("filterActivationPages", () => {
  it("includes activation-relevant page types in priority order", () => {
    const pages = [
      { pageType: "pricing", content: "Pricing", url: "https://x.io/pricing" },
      { pageType: "customers", content: "Customers", url: "https://x.io/customers" },
      { pageType: "features", content: "Features", url: "https://x.io/features" },
      { pageType: "homepage", content: "Home", url: "https://x.io" },
      { pageType: "blog", content: "Blog", url: "https://x.io/blog" },
    ];

    const result = filterActivationPages(pages);

    // Should include customers, features, homepage but not pricing or blog
    expect(result).toHaveLength(3);
    // Should be in priority order: customers > features > homepage
    expect(result[0].pageType).toBe("customers");
    expect(result[1].pageType).toBe("features");
    expect(result[2].pageType).toBe("homepage");
  });

  it("includes onboarding and help pages when present", () => {
    const pages = [
      { pageType: "onboarding", content: "Welcome", url: "https://x.io/onboarding" },
      { pageType: "help", content: "Help", url: "https://x.io/help" },
      { pageType: "homepage", content: "Home", url: "https://x.io" },
    ];

    const result = filterActivationPages(pages);

    // onboarding and help should be highest priority
    expect(result[0].pageType).toBe("onboarding");
    expect(result[1].pageType).toBe("help");
    expect(result[2].pageType).toBe("homepage");
  });

  it("returns empty array when no relevant pages", () => {
    const pages = [
      { pageType: "blog", content: "Blog", url: "https://x.io/blog" },
      { pageType: "pricing", content: "Pricing", url: "https://x.io/pricing" },
    ];

    expect(filterActivationPages(pages)).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- extractActivationLevels`
Expected: FAIL - filterActivationPages not exported

**Step 3: Write the filter function**

```typescript
// Add to extractActivationLevels.ts

// Page types relevant for activation extraction, in priority order
const ACTIVATION_PRIORITY = ["onboarding", "help", "customers", "features", "homepage"];

/**
 * Filter crawled pages to those relevant for activation level extraction.
 * Returns pages sorted by priority: onboarding > help > customers > features > homepage
 */
export function filterActivationPages(
  pages: Array<{ pageType: string; content: string; url: string; title?: string }>
): Array<{ pageType: string; content: string; url: string; title?: string }> {
  return pages
    .filter((p) => ACTIVATION_PRIORITY.includes(p.pageType))
    .sort(
      (a, b) =>
        ACTIVATION_PRIORITY.indexOf(a.pageType) - ACTIVATION_PRIORITY.indexOf(b.pageType)
    );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- extractActivationLevels`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/analysis/extractActivationLevels.ts convex/analysis/extractActivationLevels.test.ts
git commit -m "$(cat <<'EOF'
feat(analysis): add filterActivationPages function

Filters crawled pages to activation-relevant types:
- Priority: onboarding > help > customers > features > homepage
- Excludes pricing, blog, and other non-activation content
- Sorts by priority for optimal LLM context

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Add Response Parsing and Validation

**Files:**
- Modify: `convex/analysis/extractActivationLevels.ts`
- Test: `convex/analysis/extractActivationLevels.test.ts`

**Step 1: Write failing test for parseActivationLevelsResponse**

```typescript
// Add to extractActivationLevels.test.ts
import { parseActivationLevelsResponse } from "./extractActivationLevels";

describe("parseActivationLevelsResponse", () => {
  const validResponse = JSON.stringify({
    levels: [
      {
        level: 1,
        name: "explorer",
        signalStrength: "weak",
        criteria: [{ action: "create_board", count: 1 }],
        reasoning: "First board shows interest",
        confidence: 0.7,
        evidence: [{ url: "https://miro.com", excerpt: "Create your first board" }],
      },
      {
        level: 2,
        name: "creator",
        signalStrength: "medium",
        criteria: [{ action: "add_shapes", count: 5 }],
        reasoning: "Adding content shows engagement",
        confidence: 0.7,
        evidence: [{ url: "https://miro.com/features", excerpt: "Infinite canvas" }],
      },
      {
        level: 3,
        name: "collaborator",
        signalStrength: "strong",
        criteria: [{ action: "share_board", count: 1 }],
        reasoning: "Sharing realizes core value",
        confidence: 0.8,
        evidence: [{ url: "https://miro.com", excerpt: "For teams" }],
      },
    ],
    primaryActivation: 3,
    overallConfidence: 0.75,
  });

  it("parses valid JSON response", () => {
    const result = parseActivationLevelsResponse(validResponse);
    expect(result.levels).toHaveLength(3);
    expect(result.primaryActivation).toBe(3);
    expect(result.overallConfidence).toBe(0.75);
  });

  it("parses JSON wrapped in code fences", () => {
    const wrapped = "```json\n" + validResponse + "\n```";
    const result = parseActivationLevelsResponse(wrapped);
    expect(result.levels).toHaveLength(3);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseActivationLevelsResponse("not json")).toThrow();
  });

  it("throws on missing levels array", () => {
    const invalid = JSON.stringify({ primaryActivation: 1, overallConfidence: 0.5 });
    expect(() => parseActivationLevelsResponse(invalid)).toThrow("levels");
  });

  it("throws on empty levels array", () => {
    const invalid = JSON.stringify({ levels: [], primaryActivation: 1, overallConfidence: 0.5 });
    expect(() => parseActivationLevelsResponse(invalid)).toThrow("non-empty");
  });

  it("throws when level missing criteria", () => {
    const invalid = JSON.stringify({
      levels: [{ level: 1, name: "test", signalStrength: "weak", criteria: [], reasoning: "r", confidence: 0.5, evidence: [] }],
      primaryActivation: 1,
      overallConfidence: 0.5,
    });
    expect(() => parseActivationLevelsResponse(invalid)).toThrow("criteria");
  });

  it("throws when primaryActivation references non-existent level", () => {
    const invalid = JSON.stringify({
      levels: [{ level: 1, name: "test", signalStrength: "weak", criteria: [{ action: "a", count: 1 }], reasoning: "r", confidence: 0.5, evidence: [] }],
      primaryActivation: 5,
      overallConfidence: 0.5,
    });
    expect(() => parseActivationLevelsResponse(invalid)).toThrow("primaryActivation");
  });

  it("clamps confidence values to [0, 1]", () => {
    const overConfident = JSON.stringify({
      levels: [{ level: 1, name: "test", signalStrength: "weak", criteria: [{ action: "a", count: 1 }], reasoning: "r", confidence: 1.5, evidence: [] }],
      primaryActivation: 1,
      overallConfidence: 2.0,
    });
    const result = parseActivationLevelsResponse(overConfident);
    expect(result.levels[0].confidence).toBe(1.0);
    expect(result.overallConfidence).toBe(1.0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- extractActivationLevels`
Expected: FAIL - parseActivationLevelsResponse not exported

**Step 3: Write the parsing function**

```typescript
// Add to extractActivationLevels.ts

/**
 * Parse Claude's response text to extract the activation levels JSON.
 * Handles responses with markdown code fences or raw JSON.
 */
export function parseActivationLevelsResponse(responseText: string): ActivationLevelsResult {
  // Try to extract JSON from code fences first
  const fenceMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : responseText.trim();

  const parsed = JSON.parse(jsonStr);

  // Validate required fields
  if (!parsed.levels || !Array.isArray(parsed.levels)) {
    throw new Error("Missing required field: levels array");
  }
  if (parsed.levels.length === 0) {
    throw new Error("levels array must be non-empty");
  }

  // Validate each level
  const validSignalStrengths = ["weak", "medium", "strong", "very_strong"];
  for (const level of parsed.levels) {
    if (typeof level.level !== "number") {
      throw new Error(`Level missing level number: ${JSON.stringify(level)}`);
    }
    if (!level.name || typeof level.name !== "string") {
      throw new Error(`Level ${level.level} missing name`);
    }
    if (!validSignalStrengths.includes(level.signalStrength)) {
      throw new Error(`Level ${level.level} has invalid signalStrength: ${level.signalStrength}`);
    }
    if (!level.criteria || !Array.isArray(level.criteria) || level.criteria.length === 0) {
      throw new Error(`Level ${level.level} must have at least one criteria`);
    }
    for (const c of level.criteria) {
      if (!c.action || typeof c.count !== "number") {
        throw new Error(`Level ${level.level} has invalid criterion: ${JSON.stringify(c)}`);
      }
    }
    // Clamp confidence
    level.confidence = Math.max(0, Math.min(1, level.confidence ?? 0.5));
  }

  // Validate primaryActivation references existing level
  const levelNumbers = parsed.levels.map((l: ActivationLevel) => l.level);
  if (!levelNumbers.includes(parsed.primaryActivation)) {
    throw new Error(`primaryActivation (${parsed.primaryActivation}) must reference an existing level number`);
  }

  // Clamp overall confidence
  parsed.overallConfidence = Math.max(0, Math.min(1, parsed.overallConfidence ?? 0.5));

  return parsed as ActivationLevelsResult;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- extractActivationLevels`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/analysis/extractActivationLevels.ts convex/analysis/extractActivationLevels.test.ts
git commit -m "$(cat <<'EOF'
feat(analysis): add parseActivationLevelsResponse function

Parses and validates LLM response for activation levels:
- Handles JSON with or without code fences
- Validates levels array is non-empty
- Validates each level has criteria with action + count
- Validates primaryActivation references existing level
- Clamps confidence values to [0, 1]

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Create extractActivationLevels internalAction

**Files:**
- Modify: `convex/analysis/extractActivationLevels.ts`
- Test: `convex/analysis/extractActivationLevels.test.ts`

**Step 1: Write failing integration test**

```typescript
// Add to extractActivationLevels.test.ts
import { convexTest } from "convex-test";
import { vi, beforeEach } from "vitest";
import schema from "../schema";
import { internal } from "../_generated/api";

// Mock Anthropic at module level
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              levels: [
                { level: 1, name: "explorer", signalStrength: "weak", criteria: [{ action: "create_board", count: 1 }], reasoning: "Initial exploration", confidence: 0.7, evidence: [] },
                { level: 2, name: "creator", signalStrength: "medium", criteria: [{ action: "add_shapes", count: 5 }], reasoning: "Active use", confidence: 0.7, evidence: [] },
                { level: 3, name: "collaborator", signalStrength: "strong", criteria: [{ action: "share_board", count: 1 }], reasoning: "Core value", confidence: 0.8, evidence: [] },
              ],
              primaryActivation: 3,
              overallConfidence: 0.75,
            }),
          },
        ],
      }),
    },
  })),
}));

describe("extractActivationLevels action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function setupProductWithPages(t: ReturnType<typeof convexTest>) {
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-clerk-id",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    const productId = await t.run(async (ctx) => {
      return await ctx.db.insert("products", {
        userId,
        name: "Test Product",
        url: "https://test.io",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // Create profile
    await t.run(async (ctx) => {
      await ctx.db.insert("productProfiles", {
        productId,
        completeness: 0,
        overallConfidence: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        identity: {
          productName: "Test Product",
          description: "A visual collaboration tool",
          targetCustomer: "Teams",
          businessModel: "B2B SaaS",
          confidence: 0.8,
          evidence: [],
        },
      });
    });

    const scanJobId = await t.run(async (ctx) => {
      return await ctx.db.insert("scanJobs", {
        productId,
        userId,
        url: "https://test.io",
        status: "completed",
        pagesTotal: 3,
        pagesCrawled: 3,
        currentPhase: "Completed",
        startedAt: Date.now(),
        completedAt: Date.now(),
      });
    });

    // Insert relevant crawled pages
    const pages = [
      { pageType: "homepage", title: "Test Product", content: "Visual collaboration for teams", url: "https://test.io" },
      { pageType: "features", title: "Features", content: "Create boards, share with team", url: "https://test.io/features" },
      { pageType: "customers", title: "Customers", content: "Teams use our product to collaborate", url: "https://test.io/customers" },
    ];

    for (const page of pages) {
      await t.run(async (ctx) => {
        await ctx.db.insert("crawledPages", {
          productId,
          scanJobId,
          url: page.url,
          pageType: page.pageType,
          title: page.title,
          content: page.content,
          contentLength: page.content.length,
          crawledAt: Date.now(),
        });
      });
    }

    return { userId, productId, scanJobId };
  }

  it("stores activation levels in definitions.activation", async () => {
    const t = convexTest(schema);
    const { productId } = await setupProductWithPages(t);

    // Run the action (with mocked Anthropic)
    await t.action(internal.analysis.extractActivationLevels.extractActivationLevels, {
      productId,
    });

    // Verify profile was updated
    const profile = await t.query(internal.productProfiles.getInternal, { productId });

    expect(profile?.definitions?.activation).toBeDefined();
    expect(profile?.definitions?.activation?.levels).toHaveLength(3);
    expect(profile?.definitions?.activation?.primaryActivation).toBe(3);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- extractActivationLevels`
Expected: FAIL - extractActivationLevels action not found

**Step 3: Write the internalAction**

```typescript
// Add to extractActivationLevels.ts (add imports at top)
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";
import { buildPageContext } from "./extractIdentity";

// Maximum content per page
const MAX_CONTENT_PER_PAGE = 8000;

/**
 * Truncate content to a maximum length, preserving whole words.
 */
function truncateContent(content: string, maxLength: number = MAX_CONTENT_PER_PAGE): string {
  if (content.length <= maxLength) return content;
  const truncated = content.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > maxLength * 0.8
    ? truncated.slice(0, lastSpace) + "..."
    : truncated + "...";
}

/**
 * Build context string from activation-relevant pages.
 */
function buildActivationContext(
  pages: Array<{ pageType: string; content: string; url: string; title?: string }>
): string {
  const sections: string[] = [];
  for (const page of pages) {
    const content = truncateContent(page.content);
    const header = `--- PAGE: ${page.title || page.url} (${page.pageType}) ---\nURL: ${page.url}`;
    sections.push(`${header}\n\n${content}`);
  }
  return sections.join("\n\n");
}

/**
 * Extract multi-level activation data from crawled product pages.
 *
 * Flow:
 * 1. Fetch crawled pages for the product
 * 2. Filter to activation-relevant pages
 * 3. Build context for LLM
 * 4. Call Claude Haiku with ACTIVATION_SYSTEM_PROMPT
 * 5. Parse and validate response
 * 6. Merge into definitions.activation and store
 */
export const extractActivationLevels = internalAction({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    // 1. Fetch crawled pages
    const pages = await ctx.runQuery(internal.crawledPages.listByProductInternal, {
      productId: args.productId,
    });

    if (pages.length === 0) {
      throw new Error("No crawled pages found for product");
    }

    // 2. Filter to activation-relevant pages
    const activationPages = filterActivationPages(pages);

    if (activationPages.length === 0) {
      throw new Error("No activation-relevant pages found (need onboarding, help, customers, features, or homepage)");
    }

    // 3. Build page context
    const pageContext = buildActivationContext(activationPages);

    // 4. Get identity for product context (if available)
    const profile = await ctx.runQuery(internal.productProfiles.getInternal, {
      productId: args.productId,
    });

    let identityContext = "";
    if (profile?.identity) {
      const id = profile.identity;
      identityContext = `Product: ${id.productName}\nDescription: ${id.description}\nTarget customer: ${id.targetCustomer}\nBusiness model: ${id.businessModel}`;
    }

    // 5. Call Claude Haiku
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-haiku-4-20250414",
      max_tokens: 2048,
      system: ACTIVATION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: identityContext
            ? `${identityContext}\n\nExtract activation levels from:\n\n${pageContext}`
            : `Extract activation levels from:\n\n${pageContext}`,
        },
      ],
    });

    // 6. Parse response
    const textContent = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const activation = parseActivationLevelsResponse(textContent);

    // 7. Merge into definitions and store (preserves other definition fields)
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

**Step 4: Run test to verify it passes**

Run: `npm test -- extractActivationLevels`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/analysis/extractActivationLevels.ts convex/analysis/extractActivationLevels.test.ts
git commit -m "$(cat <<'EOF'
feat(analysis): add extractActivationLevels internalAction

Main orchestrator for activation level extraction:
- Fetches and filters crawled pages
- Builds context with identity enrichment
- Calls Claude Haiku for extraction
- Parses and validates response
- Stores in definitions.activation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Create Accuracy Test Script

**Files:**
- Create: `scripts/test-activation-accuracy.mjs`

**Step 1: Create the accuracy test script**

```javascript
// scripts/test-activation-accuracy.mjs
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const client = new ConvexHttpClient(process.env.CONVEX_URL || "https://woozy-kangaroo-701.convex.cloud");

// Test products with expected activation patterns
const TEST_PRODUCTS = [
  {
    name: "Miro",
    url: "https://miro.com",
    archetype: "collaboration/whiteboard",
    expectedPrimary: 3, // collaboration level
    expectedLevels: 3, // min levels
  },
  {
    name: "Linear",
    url: "https://linear.app",
    archetype: "project-management",
    expectedPrimary: 3,
    expectedLevels: 3,
  },
  {
    name: "Figma",
    url: "https://figma.com",
    archetype: "design-collaboration",
    expectedPrimary: 3,
    expectedLevels: 3,
  },
];

// Scoring rubric (from activation-judgment-rubric-design.md)
function scoreExtraction(product, extraction) {
  let score = 0;
  const issues = [];

  // 1. Logical Progression (0-3 points)
  if (extraction.levels) {
    const strengths = extraction.levels.map(l => l.signalStrength);
    const expectedOrder = ["weak", "medium", "strong", "very_strong"];
    let isProgressive = true;
    for (let i = 1; i < strengths.length; i++) {
      if (expectedOrder.indexOf(strengths[i]) <= expectedOrder.indexOf(strengths[i-1])) {
        isProgressive = false;
        break;
      }
    }
    if (isProgressive) {
      score += 3;
    } else {
      score += 1;
      issues.push("Signal strengths not in progressive order");
    }
  } else {
    issues.push("No levels extracted");
  }

  // 2. Measurability (0-3 points)
  if (extraction.levels) {
    const measurable = extraction.levels.every(l =>
      l.criteria?.every(c => c.action && typeof c.count === "number")
    );
    if (measurable) {
      score += 3;
    } else {
      score += 1;
      issues.push("Some criteria missing action or count");
    }
  }

  // 3. Primary Activation (0-3 points)
  if (extraction.primaryActivation) {
    // For collaboration tools, primary should be level 2-3 (not 1 or 4)
    if (extraction.primaryActivation >= 2 && extraction.primaryActivation <= 3) {
      score += 3;
    } else {
      score += 1;
      issues.push(`Primary activation at level ${extraction.primaryActivation} (expected 2-3 for ${product.archetype})`);
    }
  } else {
    issues.push("No primary activation identified");
  }

  // 4. Evidence Grounding (0-3 points)
  if (extraction.levels) {
    const hasEvidence = extraction.levels.every(l => l.evidence?.length > 0);
    if (hasEvidence) {
      score += 3;
    } else {
      score += 1;
      issues.push("Some levels missing evidence");
    }
  }

  return {
    score,
    maxScore: 12,
    rating: score >= 10 ? "Accurate" : score >= 6 ? "Mostly Accurate" : "Inaccurate",
    issues,
  };
}

async function main() {
  console.log("=== ACTIVATION EXTRACTION ACCURACY TEST ===\n");

  // 1. Get or create test user
  console.log("1. Getting/creating test user...");
  const user = await client.mutation(api.users.getOrCreateByClerkId, {
    clerkId: "user_accuracy_test",
    email: "accuracy-test@example.com",
    name: "Accuracy Test User",
  });
  const userId = user._id;
  console.log("User ID:", userId);

  const results = [];
  let totalScore = 0;
  let maxPossible = 0;

  for (const testProduct of TEST_PRODUCTS) {
    console.log(`\n--- Testing ${testProduct.name} ---`);

    // 2. Check if product exists
    const products = await client.query(api.mcpProducts.list, { userId });
    let product = products.find(p => p.url === testProduct.url);

    if (!product) {
      console.log(`Creating product for ${testProduct.url}...`);
      const result = await client.mutation(api.mcpProducts.create, {
        userId,
        name: testProduct.name,
        url: testProduct.url,
      });
      product = { _id: result.productId };
    }

    // 3. Check scan status
    const scanStatus = await client.query(api.mcpProducts.getScanStatus, {
      userId,
      productId: product._id,
    });

    if (!scanStatus || scanStatus.status !== "complete") {
      console.log(`Scan not complete for ${testProduct.name}, skipping...`);
      results.push({
        product: testProduct.name,
        status: "scan_incomplete",
        score: 0,
        maxScore: 12,
      });
      continue;
    }

    // 4. Get profile and check for activation
    // Note: We need to trigger extraction if not present
    // For now, just check what's there
    const profile = scanStatus.profile;

    if (!profile?.definitions?.activation) {
      console.log(`No activation data for ${testProduct.name}`);
      results.push({
        product: testProduct.name,
        status: "no_extraction",
        score: 0,
        maxScore: 12,
      });
      continue;
    }

    const extraction = profile.definitions.activation;
    const scoreResult = scoreExtraction(testProduct, extraction);

    console.log(`Score: ${scoreResult.score}/${scoreResult.maxScore} (${scoreResult.rating})`);
    if (scoreResult.issues.length > 0) {
      console.log("Issues:", scoreResult.issues.join(", "));
    }

    results.push({
      product: testProduct.name,
      status: "scored",
      ...scoreResult,
      extraction: {
        levels: extraction.levels?.length || 0,
        primaryActivation: extraction.primaryActivation,
        overallConfidence: extraction.overallConfidence,
      },
    });

    totalScore += scoreResult.score;
    maxPossible += scoreResult.maxScore;
  }

  // Summary
  console.log("\n=== SUMMARY ===");
  const accuracy = maxPossible > 0 ? ((totalScore / maxPossible) * 100).toFixed(1) : 0;
  console.log(`Overall Accuracy: ${accuracy}% (${totalScore}/${maxPossible})`);

  const accurate = results.filter(r => r.rating === "Accurate").length;
  const mostlyAccurate = results.filter(r => r.rating === "Mostly Accurate").length;
  const inaccurate = results.filter(r => r.rating === "Inaccurate").length;

  console.log(`Accurate: ${accurate}/${results.length}`);
  console.log(`Mostly Accurate: ${mostlyAccurate}/${results.length}`);
  console.log(`Inaccurate: ${inaccurate}/${results.length}`);

  const passTarget = parseFloat(accuracy) >= 70;
  console.log(`\n70% Target: ${passTarget ? "✓ PASS" : "✗ FAIL"}`);

  // Output full results
  console.log("\n=== DETAILED RESULTS ===");
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
```

**Step 2: Test the script exists and is valid**

Run: `node --check scripts/test-activation-accuracy.mjs`
Expected: No syntax errors

**Step 3: Commit**

```bash
git add scripts/test-activation-accuracy.mjs
git commit -m "$(cat <<'EOF'
feat(scripts): add activation accuracy test script

Measures extraction accuracy against sample products:
- Tests Miro, Linear, Figma
- Uses 12-point rubric from validation design
- Reports per-product scores and overall accuracy
- Tracks progress toward 70% target

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Run Baseline Accuracy Test

**Files:**
- None (manual verification step)

**Step 1: Ensure products are scanned**

Before running accuracy test, verify test products have been scanned:

```bash
node scripts/test-scan.mjs
```

Wait for scans to complete for Miro, Linear, and Figma.

**Step 2: Trigger extraction on test products**

The extraction needs to be triggered. This can be done via the orchestrator or manually. If orchestrator exists:

```bash
# Check if orchestrator has extraction support
grep -r "extractActivation" convex/
```

If not available, note that extraction will need to be triggered manually or via test.

**Step 3: Run baseline accuracy test**

```bash
node scripts/test-activation-accuracy.mjs
```

Expected output: Baseline accuracy score (likely < 70% initially)

**Step 4: Document baseline in git**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: document baseline activation accuracy

Baseline accuracy: [X]%
Products scored:
- Miro: [score]
- Linear: [score]
- Figma: [score]

Issues identified:
- [issue 1]
- [issue 2]

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Apply Refinements Based on Baseline Results

**Files:**
- Modify: `convex/analysis/extractActivationLevels.ts`
- Test: Re-run accuracy script

Based on baseline results, apply targeted refinements. Common issues and fixes:

**If primary activation is misidentified:**

```typescript
// Update ACTIVATION_SYSTEM_PROMPT to add more archetype examples
// In the "Primary Activation" section, add:

## Primary Activation by Product Type

- **Collaboration tools** (Miro, Figma): When another person accesses or engages with shared work
- **Productivity tools** (Linear, Notion): When first workflow completes or task moves through states
- **Creative tools**: When work is shared and receives feedback

The aha-moment for PLG products is almost always at the "strong" signal level (level 3),
not at setup (level 1) or team adoption (level 4).
```

**If criteria are not measurable:**

```typescript
// Update ACTIVATION_SYSTEM_PROMPT criteria section:

## Criteria Format (STRICT)

Every criterion MUST include:
- action: specific snake_case verb (create_board, share_file, assign_task)
- count: explicit number (1, 3, 5)
- timeWindow: optional but recommended for patterns

BAD: "Uses the product regularly" (vague)
GOOD: {"action": "login", "count": 5, "timeWindow": "first_14d"}

BAD: "Engaged with features"
GOOD: {"action": "create_project", "count": 1}
```

**If evidence is weak for higher levels:**

```typescript
// Update ACTIVATION_PRIORITY to prioritize help docs and case studies:
const ACTIVATION_PRIORITY = ["help", "onboarding", "customers", "case-study", "features", "homepage"];
```

**Step 1: Identify specific issues from baseline**

Review the accuracy test output and identify which rubric criteria failed.

**Step 2: Apply targeted fix**

Edit `convex/analysis/extractActivationLevels.ts` with the appropriate refinement.

**Step 3: Run tests to ensure changes don't break anything**

Run: `npm test -- extractActivationLevels`
Expected: PASS

**Step 4: Re-run accuracy test**

```bash
node scripts/test-activation-accuracy.mjs
```

Expected: Improved accuracy score

**Step 5: Commit refinement with rationale**

```bash
git add convex/analysis/extractActivationLevels.ts
git commit -m "$(cat <<'EOF'
fix(analysis): [specific refinement description]

Issue: [what failed in validation]
Fix: [what was changed]
Result: Accuracy improved from X% to Y%

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Iterate Until 70% Accuracy

**Repeat Task 8** until accuracy reaches 70%:

1. Run accuracy test
2. Identify remaining issues
3. Apply targeted refinement
4. Run unit tests
5. Re-run accuracy test
6. Commit with rationale

**Success criteria:**
- Overall accuracy >= 70%
- No product scores "Inaccurate" (< 6 points)
- Git history documents each refinement iteration

---

### Task 10: Final Verification and Cleanup

**Step 1: Run full test suite**

```bash
npm test
```

Expected: All tests pass

**Step 2: Verify accuracy target met**

```bash
node scripts/test-activation-accuracy.mjs
```

Expected: >= 70% accuracy

**Step 3: Final commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(analysis): complete activation level extraction with 70%+ accuracy

Final implementation includes:
- ActivationLevel types and interfaces
- ACTIVATION_SYSTEM_PROMPT with archetype examples
- filterActivationPages with priority ordering
- parseActivationLevelsResponse with validation
- extractActivationLevels internalAction

Accuracy test: [final]%
Products validated: Miro, Linear, Figma

Refinements applied:
- [list each refinement from git history]

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Testing Summary

| Type | Coverage |
|------|----------|
| Unit | Types, prompt, filter, parser functions |
| Integration | extractActivationLevels with mocked Anthropic |
| Manual | Accuracy test against real products |

**Test commands:**
- `npm test -- extractActivationLevels` - Run unit/integration tests
- `node scripts/test-activation-accuracy.mjs` - Run accuracy validation

---

## Dependencies

- **Previous stories:** M002-E003 designs (prompt, filtering, types)
- **Infrastructure:** Convex backend, Anthropic API key
- **Test data:** Scanned products (Miro, Linear, Figma)

---

*Plan created via /plan-issue · 2026-02-05*
