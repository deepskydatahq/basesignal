# Extract Activation Levels Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the `extractActivationLevels` internalAction that extracts multi-level activation data from crawled pages using Claude Haiku and stores it on the product profile.

**Architecture:** Follow the exact pattern from `extractIdentity.ts` - fetch crawled pages, filter to relevant page types, build context, call Claude Haiku with a system prompt, parse the JSON response, and store via `updateSectionInternal`. The activation data is merged into the existing `definitions` section to preserve other definition fields.

**Tech Stack:** Convex internalAction, Anthropic SDK (Claude Haiku), TypeScript

---

## Task 1: Add Types to extractActivationLevels.ts

**Files:**
- Create: `convex/analysis/extractActivationLevels.ts`

**Step 1: Write the test file with type import tests**

Create `convex/analysis/extractActivationLevels.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type {
  SignalStrength,
  ActivationCriterion,
  ActivationLevel,
  ActivationLevelsResult,
} from "./extractActivationLevels";

describe("activation types", () => {
  it("SignalStrength accepts valid values", () => {
    const strengths: SignalStrength[] = ["weak", "medium", "strong", "very_strong"];
    expect(strengths).toHaveLength(4);
  });

  it("ActivationCriterion has required structure", () => {
    const criterion: ActivationCriterion = {
      action: "create_board",
      count: 1,
    };
    expect(criterion.action).toBe("create_board");
    expect(criterion.count).toBe(1);
  });

  it("ActivationCriterion accepts optional timeWindow", () => {
    const criterion: ActivationCriterion = {
      action: "invite_member",
      count: 2,
      timeWindow: "first_7d",
    };
    expect(criterion.timeWindow).toBe("first_7d");
  });

  it("ActivationLevel has required structure", () => {
    const level: ActivationLevel = {
      level: 1,
      name: "explorer",
      signalStrength: "weak",
      criteria: [{ action: "view_page", count: 1 }],
      reasoning: "Initial exploration",
      confidence: 0.7,
      evidence: [{ url: "https://example.com", excerpt: "quote" }],
    };
    expect(level.level).toBe(1);
    expect(level.signalStrength).toBe("weak");
  });

  it("ActivationLevelsResult has required structure", () => {
    const result: ActivationLevelsResult = {
      levels: [],
      primaryActivation: 2,
      overallConfidence: 0.75,
    };
    expect(result.primaryActivation).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: FAIL - cannot find module or types not exported

**Step 3: Write the types**

Create `convex/analysis/extractActivationLevels.ts`:

```typescript
export type SignalStrength = "weak" | "medium" | "strong" | "very_strong";

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

**Step 4: Run test to verify it passes**

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/analysis/extractActivationLevels.ts convex/analysis/extractActivationLevels.test.ts
git commit -m "$(cat <<'EOF'
feat(analysis): add activation level types

Define TypeScript interfaces for multi-level activation extraction:
- SignalStrength union type (weak/medium/strong/very_strong)
- ActivationCriterion for behavioral criteria
- ActivationLevel for individual levels
- ActivationLevelsResult for extraction results

Part of M002-E003-S001.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add ACTIVATION_SYSTEM_PROMPT

**Files:**
- Modify: `convex/analysis/extractActivationLevels.ts`
- Modify: `convex/analysis/extractActivationLevels.test.ts`

**Step 1: Write the test for the prompt**

Add to `convex/analysis/extractActivationLevels.test.ts`:

```typescript
import {
  ACTIVATION_SYSTEM_PROMPT,
} from "./extractActivationLevels";

describe("ACTIVATION_SYSTEM_PROMPT", () => {
  it("is exported and non-empty", () => {
    expect(ACTIVATION_SYSTEM_PROMPT).toBeDefined();
    expect(ACTIVATION_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it("contains required JSON field names", () => {
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

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: FAIL - ACTIVATION_SYSTEM_PROMPT not exported

**Step 3: Add the prompt constant**

Add to `convex/analysis/extractActivationLevels.ts` after the type definitions:

```typescript
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

The level where the product's core value proposition becomes real. Not the most advanced level—the aha-moment. For Miro: when someone else accesses a shared board. For Linear: when a task moves through the workflow.

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
- Each level needs at least 1 criterion
- primaryActivation must reference existing level`;
```

**Step 4: Run test to verify it passes**

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/analysis/extractActivationLevels.ts convex/analysis/extractActivationLevels.test.ts
git commit -m "$(cat <<'EOF'
feat(analysis): add ACTIVATION_SYSTEM_PROMPT

LLM prompt for extracting 3-4 activation levels with:
- Signal strength commitment escalation
- Criteria format with action/count/timeWindow
- Primary activation identification
- Confidence scoring guidance

Part of M002-E003-S002.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add parseActivationLevelsResponse

**Files:**
- Modify: `convex/analysis/extractActivationLevels.ts`
- Modify: `convex/analysis/extractActivationLevels.test.ts`

**Step 1: Write tests for the parser**

Add to `convex/analysis/extractActivationLevels.test.ts`:

```typescript
import {
  parseActivationLevelsResponse,
} from "./extractActivationLevels";

describe("parseActivationLevelsResponse", () => {
  const validJson = JSON.stringify({
    levels: [
      {
        level: 1,
        name: "explorer",
        signalStrength: "weak",
        criteria: [{ action: "create_board", count: 1 }],
        reasoning: "Initial exploration",
        confidence: 0.7,
        evidence: [{ url: "https://miro.com/features", excerpt: "Create boards" }],
      },
      {
        level: 2,
        name: "creator",
        signalStrength: "medium",
        criteria: [{ action: "add_content", count: 5 }],
        reasoning: "Active content creation",
        confidence: 0.6,
        evidence: [],
      },
      {
        level: 3,
        name: "collaborator",
        signalStrength: "strong",
        criteria: [{ action: "share_board", count: 1 }],
        reasoning: "Core value realized through collaboration",
        confidence: 0.8,
        evidence: [],
      },
    ],
    primaryActivation: 3,
    overallConfidence: 0.7,
  });

  it("parses raw JSON response", () => {
    const result = parseActivationLevelsResponse(validJson);
    expect(result.levels).toHaveLength(3);
    expect(result.primaryActivation).toBe(3);
    expect(result.overallConfidence).toBe(0.7);
  });

  it("parses JSON wrapped in code fences", () => {
    const wrapped = "```json\n" + validJson + "\n```";
    const result = parseActivationLevelsResponse(wrapped);
    expect(result.levels).toHaveLength(3);
  });

  it("parses JSON wrapped in code fences without language tag", () => {
    const wrapped = "```\n" + validJson + "\n```";
    const result = parseActivationLevelsResponse(wrapped);
    expect(result.levels).toHaveLength(3);
  });

  it("throws on missing levels array", () => {
    const invalid = JSON.stringify({ primaryActivation: 2, overallConfidence: 0.5 });
    expect(() => parseActivationLevelsResponse(invalid)).toThrow("levels");
  });

  it("throws on missing primaryActivation", () => {
    const invalid = JSON.stringify({ levels: [], overallConfidence: 0.5 });
    expect(() => parseActivationLevelsResponse(invalid)).toThrow("primaryActivation");
  });

  it("throws on missing overallConfidence", () => {
    const invalid = JSON.stringify({ levels: [], primaryActivation: 2 });
    expect(() => parseActivationLevelsResponse(invalid)).toThrow("overallConfidence");
  });

  it("throws on invalid signalStrength", () => {
    const invalid = JSON.stringify({
      levels: [{
        level: 1,
        name: "test",
        signalStrength: "invalid",
        criteria: [{ action: "x", count: 1 }],
        reasoning: "r",
        confidence: 0.5,
        evidence: [],
      }],
      primaryActivation: 1,
      overallConfidence: 0.5,
    });
    expect(() => parseActivationLevelsResponse(invalid)).toThrow("signalStrength");
  });

  it("throws on missing criterion action", () => {
    const invalid = JSON.stringify({
      levels: [{
        level: 1,
        name: "test",
        signalStrength: "weak",
        criteria: [{ count: 1 }],
        reasoning: "r",
        confidence: 0.5,
        evidence: [],
      }],
      primaryActivation: 1,
      overallConfidence: 0.5,
    });
    expect(() => parseActivationLevelsResponse(invalid)).toThrow("action");
  });

  it("throws on missing criterion count", () => {
    const invalid = JSON.stringify({
      levels: [{
        level: 1,
        name: "test",
        signalStrength: "weak",
        criteria: [{ action: "x" }],
        reasoning: "r",
        confidence: 0.5,
        evidence: [],
      }],
      primaryActivation: 1,
      overallConfidence: 0.5,
    });
    expect(() => parseActivationLevelsResponse(invalid)).toThrow("count");
  });

  it("clamps confidence above 1.0 to 1.0", () => {
    const highConfidence = JSON.stringify({
      levels: [{
        level: 1,
        name: "test",
        signalStrength: "weak",
        criteria: [{ action: "x", count: 1 }],
        reasoning: "r",
        confidence: 1.5,
        evidence: [],
      }],
      primaryActivation: 1,
      overallConfidence: 1.5,
    });
    const result = parseActivationLevelsResponse(highConfidence);
    expect(result.levels[0].confidence).toBe(1.0);
    expect(result.overallConfidence).toBe(1.0);
  });

  it("clamps negative confidence to 0", () => {
    const lowConfidence = JSON.stringify({
      levels: [{
        level: 1,
        name: "test",
        signalStrength: "weak",
        criteria: [{ action: "x", count: 1 }],
        reasoning: "r",
        confidence: -0.5,
        evidence: [],
      }],
      primaryActivation: 1,
      overallConfidence: -0.5,
    });
    const result = parseActivationLevelsResponse(lowConfidence);
    expect(result.levels[0].confidence).toBe(0);
    expect(result.overallConfidence).toBe(0);
  });

  it("sorts levels by level number ascending", () => {
    const unsorted = JSON.stringify({
      levels: [
        { level: 3, name: "c", signalStrength: "strong", criteria: [{ action: "x", count: 1 }], reasoning: "r", confidence: 0.5, evidence: [] },
        { level: 1, name: "a", signalStrength: "weak", criteria: [{ action: "x", count: 1 }], reasoning: "r", confidence: 0.5, evidence: [] },
        { level: 2, name: "b", signalStrength: "medium", criteria: [{ action: "x", count: 1 }], reasoning: "r", confidence: 0.5, evidence: [] },
      ],
      primaryActivation: 2,
      overallConfidence: 0.5,
    });
    const result = parseActivationLevelsResponse(unsorted);
    expect(result.levels.map(l => l.level)).toEqual([1, 2, 3]);
    expect(result.levels.map(l => l.name)).toEqual(["a", "b", "c"]);
  });

  it("throws when primaryActivation references non-existent level", () => {
    const invalid = JSON.stringify({
      levels: [
        { level: 1, name: "a", signalStrength: "weak", criteria: [{ action: "x", count: 1 }], reasoning: "r", confidence: 0.5, evidence: [] },
      ],
      primaryActivation: 5,
      overallConfidence: 0.5,
    });
    expect(() => parseActivationLevelsResponse(invalid)).toThrow("primaryActivation");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseActivationLevelsResponse("not json")).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: FAIL - parseActivationLevelsResponse not exported

**Step 3: Implement the parser**

Add to `convex/analysis/extractActivationLevels.ts`:

```typescript
/**
 * Parse Claude's response text to extract the JSON activation levels result.
 * Handles responses with markdown code fences or raw JSON.
 */
export function parseActivationLevelsResponse(responseText: string): ActivationLevelsResult {
  // Extract JSON from code fences
  const fenceMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : responseText.trim();
  const parsed = JSON.parse(jsonStr);

  // Validate top-level fields
  if (!Array.isArray(parsed.levels)) {
    throw new Error("Missing required field: levels (must be array)");
  }
  if (typeof parsed.primaryActivation !== "number") {
    throw new Error("Missing required field: primaryActivation (must be number)");
  }
  if (typeof parsed.overallConfidence !== "number") {
    throw new Error("Missing required field: overallConfidence (must be number)");
  }

  // Validate each level
  for (const level of parsed.levels) {
    if (typeof level.level !== "number") throw new Error("Level missing: level number");
    if (typeof level.name !== "string") throw new Error("Level missing: name");
    if (!["weak", "medium", "strong", "very_strong"].includes(level.signalStrength)) {
      throw new Error(`Invalid signalStrength: ${level.signalStrength}`);
    }
    if (!Array.isArray(level.criteria)) throw new Error("Level missing: criteria array");
    if (typeof level.confidence !== "number") throw new Error("Level missing: confidence");

    // Validate criteria shape
    for (const c of level.criteria) {
      if (typeof c.action !== "string") throw new Error("Criterion missing: action");
      if (typeof c.count !== "number") throw new Error("Criterion missing: count");
    }

    // Clamp confidence inline
    level.confidence = Math.max(0, Math.min(1, level.confidence));
  }

  // Sort levels by level number
  parsed.levels.sort((a: ActivationLevel, b: ActivationLevel) => a.level - b.level);

  // Clamp overall confidence
  parsed.overallConfidence = Math.max(0, Math.min(1, parsed.overallConfidence));

  // Validate primaryActivation exists
  if (!parsed.levels.some((l: ActivationLevel) => l.level === parsed.primaryActivation)) {
    throw new Error(`primaryActivation ${parsed.primaryActivation} does not match any level`);
  }

  return parsed as ActivationLevelsResult;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/analysis/extractActivationLevels.ts convex/analysis/extractActivationLevels.test.ts
git commit -m "$(cat <<'EOF'
feat(analysis): add parseActivationLevelsResponse

Parser for Claude's activation extraction response:
- Extracts JSON from code fences
- Validates all required fields
- Validates signalStrength values
- Validates criteria structure
- Clamps confidence to [0,1]
- Sorts levels by number
- Validates primaryActivation references existing level

Part of M002-E003-S005.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add Page Filtering Helpers

**Files:**
- Modify: `convex/analysis/extractActivationLevels.ts`
- Modify: `convex/analysis/extractActivationLevels.test.ts`

**Step 1: Write tests for filtering helpers**

Add to `convex/analysis/extractActivationLevels.test.ts`:

```typescript
import {
  filterActivationPages,
  buildActivationPageContext,
} from "./extractActivationLevels";

describe("filterActivationPages", () => {
  it("filters and prioritizes activation-relevant pages", () => {
    const pages = [
      { pageType: "pricing", content: "Pricing", url: "https://x.io/pricing", title: "Pricing" },
      { pageType: "features", content: "Features", url: "https://x.io/features", title: "Features" },
      { pageType: "homepage", content: "Home", url: "https://x.io", title: "Home" },
      { pageType: "customers", content: "Customers", url: "https://x.io/customers", title: "Customers" },
      { pageType: "about", content: "About", url: "https://x.io/about", title: "About" },
    ];

    const result = filterActivationPages(pages);
    // Should include: customers, features, homepage (in priority order)
    // Should exclude: pricing, about
    expect(result.map(p => p.pageType)).toEqual(["customers", "features", "homepage"]);
  });

  it("handles onboarding and help page types", () => {
    const pages = [
      { pageType: "onboarding", content: "Onboarding", url: "https://x.io/onboarding", title: "Onboarding" },
      { pageType: "help", content: "Help", url: "https://x.io/help", title: "Help" },
      { pageType: "features", content: "Features", url: "https://x.io/features", title: "Features" },
    ];

    const result = filterActivationPages(pages);
    // Priority: onboarding > help > customers > features > homepage
    expect(result.map(p => p.pageType)).toEqual(["onboarding", "help", "features"]);
  });

  it("returns empty array when no matching pages", () => {
    const pages = [
      { pageType: "pricing", content: "Pricing", url: "https://x.io/pricing" },
      { pageType: "about", content: "About", url: "https://x.io/about" },
    ];

    expect(filterActivationPages(pages)).toHaveLength(0);
  });

  it("handles empty input", () => {
    expect(filterActivationPages([])).toHaveLength(0);
  });
});

describe("buildActivationPageContext", () => {
  it("formats pages with headers and content", () => {
    const pages = [
      { pageType: "features", content: "Feature content here", url: "https://acme.io/features", title: "Features" },
    ];

    const result = buildActivationPageContext(pages);
    expect(result).toContain("--- PAGE: Features (features) ---");
    expect(result).toContain("URL: https://acme.io/features");
    expect(result).toContain("Feature content here");
  });

  it("truncates long content", () => {
    const longContent = "x".repeat(10000);
    const pages = [
      { pageType: "features", content: longContent, url: "https://acme.io/features", title: "Features" },
    ];

    const result = buildActivationPageContext(pages);
    expect(result.length).toBeLessThan(longContent.length);
    expect(result).toContain("[Content truncated]");
  });

  it("falls back to URL when title is missing", () => {
    const pages = [
      { pageType: "homepage", content: "Home", url: "https://acme.io" },
    ];

    const result = buildActivationPageContext(pages);
    expect(result).toContain("--- PAGE: https://acme.io (homepage) ---");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: FAIL - filterActivationPages not exported

**Step 3: Implement the filtering helpers**

Add to `convex/analysis/extractActivationLevels.ts`:

```typescript
// Page types relevant for activation extraction (in priority order)
const ACTIVATION_PRIORITY = ["onboarding", "help", "customers", "features", "homepage"];

// Maximum characters of page content to send to Claude
const MAX_CONTENT_PER_PAGE = 8000;
const MAX_TOTAL_CONTENT = 40000;

interface CrawledPage {
  url: string;
  pageType: string;
  title?: string;
  content: string;
}

/**
 * Filter crawled pages to those relevant for activation extraction.
 * Returns pages in priority order: onboarding > help > customers > features > homepage
 */
export function filterActivationPages(pages: CrawledPage[]): CrawledPage[] {
  return pages
    .filter((p) => ACTIVATION_PRIORITY.includes(p.pageType))
    .sort((a, b) =>
      ACTIVATION_PRIORITY.indexOf(a.pageType) - ACTIVATION_PRIORITY.indexOf(b.pageType)
    );
}

/**
 * Truncate content to a maximum character length, preserving whole lines.
 * Appends a truncation notice if content was shortened.
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;

  const lastNewline = content.lastIndexOf("\n", maxLength);
  const cutPoint = lastNewline > 0 ? lastNewline : maxLength;
  return content.slice(0, cutPoint) + "\n\n[Content truncated]";
}

/**
 * Build the context string from crawled pages for the LLM prompt.
 * Each page is formatted with its URL, type, and truncated content.
 */
export function buildActivationPageContext(pages: CrawledPage[]): string {
  let totalLength = 0;
  const sections: string[] = [];

  for (const page of pages) {
    const remaining = MAX_TOTAL_CONTENT - totalLength;
    if (remaining <= 0) break;

    const pageMaxLength = Math.min(MAX_CONTENT_PER_PAGE, remaining);
    const truncated = truncateContent(page.content, pageMaxLength);

    const header = `--- PAGE: ${page.title || page.url} (${page.pageType}) ---\nURL: ${page.url}`;
    sections.push(`${header}\n\n${truncated}`);
    totalLength += truncated.length;
  }

  return sections.join("\n\n");
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/analysis/extractActivationLevels.ts convex/analysis/extractActivationLevels.test.ts
git commit -m "$(cat <<'EOF'
feat(analysis): add activation page filtering helpers

- filterActivationPages: filters and prioritizes pages for activation
  extraction (onboarding > help > customers > features > homepage)
- buildActivationPageContext: formats pages for LLM context with
  truncation limits

Part of M002-E003-S003.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Implement extractActivationLevels internalAction

**Files:**
- Modify: `convex/analysis/extractActivationLevels.ts`
- Modify: `convex/analysis/extractActivationLevels.test.ts`

**Step 1: Write tests for the internalAction**

Add to `convex/analysis/extractActivationLevels.test.ts`:

```typescript
import { convexTest } from "convex-test";
import { expect, it, describe, vi, beforeEach, afterEach } from "vitest";
import schema from "../schema";
import { internal } from "../_generated/api";

// Mock Anthropic
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
}));

describe("extractActivationLevels action", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  it("throws when no crawled pages exist", async () => {
    const t = convexTest(schema);

    const productId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "test-clerk-id",
        email: "test@example.com",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return await ctx.db.insert("products", {
        userId,
        name: "Test Product",
        url: "https://test.com",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await expect(
      t.action(internal.analysis.extractActivationLevels.extractActivationLevels, { productId })
    ).rejects.toThrow("No crawled pages found");
  });

  it("throws when no activation-relevant pages exist", async () => {
    const t = convexTest(schema);

    const productId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "test-clerk-id",
        email: "test@example.com",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const pid = await ctx.db.insert("products", {
        userId,
        name: "Test Product",
        url: "https://test.com",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const scanJobId = await ctx.db.insert("scanJobs", {
        productId: pid,
        userId,
        status: "completed",
        startedAt: Date.now(),
      });
      // Only pricing page - not activation-relevant
      await ctx.db.insert("crawledPages", {
        productId: pid,
        scanJobId,
        url: "https://test.com/pricing",
        pageType: "pricing",
        content: "Pricing info",
        contentLength: 12,
        crawledAt: Date.now(),
      });
      return pid;
    });

    await expect(
      t.action(internal.analysis.extractActivationLevels.extractActivationLevels, { productId })
    ).rejects.toThrow("No activation-relevant pages found");
  });

  it("throws when ANTHROPIC_API_KEY is not set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const t = convexTest(schema);

    const productId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "test-clerk-id",
        email: "test@example.com",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const pid = await ctx.db.insert("products", {
        userId,
        name: "Test Product",
        url: "https://test.com",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const scanJobId = await ctx.db.insert("scanJobs", {
        productId: pid,
        userId,
        status: "completed",
        startedAt: Date.now(),
      });
      await ctx.db.insert("crawledPages", {
        productId: pid,
        scanJobId,
        url: "https://test.com/features",
        pageType: "features",
        content: "Features content",
        contentLength: 16,
        crawledAt: Date.now(),
      });
      return pid;
    });

    await expect(
      t.action(internal.analysis.extractActivationLevels.extractActivationLevels, { productId })
    ).rejects.toThrow("ANTHROPIC_API_KEY");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: FAIL - extractActivationLevels not exported or not an internalAction

**Step 3: Implement the internalAction**

Add to `convex/analysis/extractActivationLevels.ts`:

```typescript
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Extract multi-level activation from crawled product pages using Claude Haiku.
 *
 * Flow:
 * 1. Fetch crawled pages for the product
 * 2. Filter to activation-relevant pages (onboarding, help, customers, features, homepage)
 * 3. Build prompt with page content
 * 4. Get identity context if available
 * 5. Call Claude Haiku for structured extraction
 * 6. Parse response and validate
 * 7. Merge into existing definitions and store on product profile
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

    // 3. Build prompt context
    const pageContext = buildActivationPageContext(activationPages);

    // 4. Get identity for product context
    const profile = await ctx.runQuery(internal.productProfiles.getInternal, {
      productId: args.productId,
    });

    let identityContext = "";
    if (profile?.identity) {
      const id = profile.identity;
      identityContext = `Product: ${id.productName}\nDescription: ${id.description}\nTarget customer: ${id.targetCustomer}`;
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
            ? `${identityContext}\n\nExtract activation levels from these pages:\n\n${pageContext}`
            : `Extract activation levels from these pages:\n\n${pageContext}`,
        },
      ],
    });

    // 6. Parse response
    const textContent = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const activation = parseActivationLevelsResponse(textContent);

    // 7. Ensure product profile exists
    await ctx.runMutation(internal.productProfiles.createInternal, {
      productId: args.productId,
    });

    // 8. Merge activation into existing definitions and store
    const existingDefinitions = profile?.definitions ?? {};
    const updatedDefinitions = { ...existingDefinitions, activation };

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

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/analysis/extractActivationLevels.ts convex/analysis/extractActivationLevels.test.ts
git commit -m "$(cat <<'EOF'
feat(analysis): implement extractActivationLevels internalAction

Complete activation level extraction pipeline:
1. Fetches crawled pages via listByProductInternal
2. Filters to activation-relevant page types
3. Builds context with identity enrichment
4. Calls Claude Haiku with ACTIVATION_SYSTEM_PROMPT
5. Parses and validates response
6. Merges into definitions preserving other fields
7. Stores via updateSectionInternal

Part of M002-E003-S004.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add Integration Test with Mock Data

**Files:**
- Modify: `convex/analysis/extractActivationLevels.test.ts`

**Step 1: Write integration test**

Add to `convex/analysis/extractActivationLevels.test.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";

describe("extractActivationLevels integration", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  it("extracts activation levels and stores in definitions", async () => {
    // Mock Claude response with realistic Miro-like activation levels
    const mockResponse = {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            levels: [
              {
                level: 1,
                name: "explorer",
                signalStrength: "weak",
                criteria: [{ action: "create_board", count: 1 }],
                reasoning: "User creates their first board to explore the tool",
                confidence: 0.75,
                evidence: [{ url: "https://miro.com/features", excerpt: "Start with a blank board" }],
              },
              {
                level: 2,
                name: "creator",
                signalStrength: "medium",
                criteria: [{ action: "add_content", count: 5 }],
                reasoning: "User actively adds content showing engagement",
                confidence: 0.7,
                evidence: [{ url: "https://miro.com/features", excerpt: "Add sticky notes, shapes" }],
              },
              {
                level: 3,
                name: "collaborator",
                signalStrength: "strong",
                criteria: [{ action: "share_board", count: 1 }],
                reasoning: "Core value realized through collaboration",
                confidence: 0.85,
                evidence: [{ url: "https://miro.com/features", excerpt: "Invite team members" }],
              },
              {
                level: 4,
                name: "team_adopter",
                signalStrength: "very_strong",
                criteria: [{ action: "team_member_active", count: 3, timeWindow: "first_30d" }],
                reasoning: "Team adoption indicates stickiness",
                confidence: 0.65,
                evidence: [{ url: "https://miro.com/customers", excerpt: "Teams use Miro daily" }],
              },
            ],
            primaryActivation: 3,
            overallConfidence: 0.74,
          }),
        },
      ],
    };

    const mockCreate = vi.fn().mockResolvedValue(mockResponse);
    vi.mocked(Anthropic).mockImplementation(() => ({
      messages: { create: mockCreate },
    }) as unknown as Anthropic);

    const t = convexTest(schema);

    const { productId, userId } = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", {
        clerkId: "test-clerk-id",
        email: "test@example.com",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const pid = await ctx.db.insert("products", {
        userId: uid,
        name: "Miro",
        url: "https://miro.com",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const scanJobId = await ctx.db.insert("scanJobs", {
        productId: pid,
        userId: uid,
        status: "completed",
        startedAt: Date.now(),
      });
      // Add activation-relevant pages
      await ctx.db.insert("crawledPages", {
        productId: pid,
        scanJobId,
        url: "https://miro.com/features",
        pageType: "features",
        title: "Miro Features",
        content: "Create boards, add sticky notes, invite team members...",
        contentLength: 100,
        crawledAt: Date.now(),
      });
      await ctx.db.insert("crawledPages", {
        productId: pid,
        scanJobId,
        url: "https://miro.com/customers",
        pageType: "customers",
        title: "Customer Stories",
        content: "Teams use Miro daily for collaboration...",
        contentLength: 100,
        crawledAt: Date.now(),
      });
      return { productId: pid, userId: uid };
    });

    // Run the extraction
    const result = await t.action(
      internal.analysis.extractActivationLevels.extractActivationLevels,
      { productId }
    );

    // Verify result structure
    expect(result.levels).toHaveLength(4);
    expect(result.primaryActivation).toBe(3);
    expect(result.overallConfidence).toBeCloseTo(0.74, 2);

    // Verify levels are correct
    expect(result.levels[0].name).toBe("explorer");
    expect(result.levels[0].signalStrength).toBe("weak");
    expect(result.levels[2].name).toBe("collaborator");
    expect(result.levels[2].signalStrength).toBe("strong");

    // Verify Claude was called with correct prompt structure
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("claude-haiku-4-20250414");
    expect(callArgs.system).toBe(ACTIVATION_SYSTEM_PROMPT);
    expect(callArgs.messages[0].content).toContain("Extract activation levels");

    // Verify stored in profile
    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("productProfiles")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .first();
    });

    expect(profile).not.toBeNull();
    expect(profile?.definitions?.activation).toBeDefined();
    expect(profile?.definitions?.activation?.levels).toHaveLength(4);
    expect(profile?.definitions?.activation?.primaryActivation).toBe(3);
  });

  it("preserves existing definition fields when storing activation", async () => {
    const mockResponse = {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            levels: [
              {
                level: 1,
                name: "starter",
                signalStrength: "weak",
                criteria: [{ action: "signup", count: 1 }],
                reasoning: "Initial signup",
                confidence: 0.6,
                evidence: [],
              },
            ],
            primaryActivation: 1,
            overallConfidence: 0.6,
          }),
        },
      ],
    };

    vi.mocked(Anthropic).mockImplementation(() => ({
      messages: { create: vi.fn().mockResolvedValue(mockResponse) },
    }) as unknown as Anthropic);

    const t = convexTest(schema);

    const productId = await t.run(async (ctx) => {
      const uid = await ctx.db.insert("users", {
        clerkId: "test-clerk-id",
        email: "test@example.com",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const pid = await ctx.db.insert("products", {
        userId: uid,
        name: "Test Product",
        url: "https://test.com",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      // Create profile with existing definitions
      await ctx.db.insert("productProfiles", {
        productId: pid,
        completeness: 0.1,
        overallConfidence: 0.5,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        definitions: {
          firstValue: {
            description: "First value moment",
            criteria: ["completed_setup"],
            reasoning: "Setup completion indicates first value",
            confidence: 0.7,
            source: "ai-inferred",
            evidence: [],
          },
          active: {
            criteria: ["daily_login"],
            timeWindow: "7 days",
            reasoning: "Regular login indicates active user",
            confidence: 0.6,
            source: "ai-inferred",
            evidence: [],
          },
        },
      });
      const scanJobId = await ctx.db.insert("scanJobs", {
        productId: pid,
        userId: uid,
        status: "completed",
        startedAt: Date.now(),
      });
      await ctx.db.insert("crawledPages", {
        productId: pid,
        scanJobId,
        url: "https://test.com/features",
        pageType: "features",
        content: "Features content",
        contentLength: 16,
        crawledAt: Date.now(),
      });
      return pid;
    });

    // Run extraction
    await t.action(
      internal.analysis.extractActivationLevels.extractActivationLevels,
      { productId }
    );

    // Verify existing definitions are preserved
    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("productProfiles")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .first();
    });

    expect(profile?.definitions?.activation).toBeDefined();
    expect(profile?.definitions?.firstValue).toBeDefined();
    expect(profile?.definitions?.firstValue?.description).toBe("First value moment");
    expect(profile?.definitions?.active).toBeDefined();
    expect(profile?.definitions?.active?.criteria).toContain("daily_login");
  });
});
```

**Step 2: Run test to verify it passes**

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add convex/analysis/extractActivationLevels.test.ts
git commit -m "$(cat <<'EOF'
test(analysis): add integration tests for extractActivationLevels

- Tests extraction with mocked Claude response
- Verifies 3-4 activation levels with primaryActivation
- Tests that existing definitions are preserved
- Validates storage in definitions.activation

Part of M002-E003-S004.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Run Full Test Suite and Verify

**Files:**
- None (verification only)

**Step 1: Run the full test suite**

Run: `npm test`
Expected: All tests pass, including new extractActivationLevels tests

**Step 2: Run TypeScript compilation check**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Verify exports are correct**

Run: `grep -n "export" convex/analysis/extractActivationLevels.ts`
Expected: Should show exports for types, prompt, parser, filter, and action

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add activation types | `extractActivationLevels.ts`, `extractActivationLevels.test.ts` |
| 2 | Add ACTIVATION_SYSTEM_PROMPT | `extractActivationLevels.ts`, `extractActivationLevels.test.ts` |
| 3 | Add parseActivationLevelsResponse | `extractActivationLevels.ts`, `extractActivationLevels.test.ts` |
| 4 | Add page filtering helpers | `extractActivationLevels.ts`, `extractActivationLevels.test.ts` |
| 5 | Implement extractActivationLevels internalAction | `extractActivationLevels.ts`, `extractActivationLevels.test.ts` |
| 6 | Add integration tests | `extractActivationLevels.test.ts` |
| 7 | Run full test suite | (verification) |

**Total: 7 TDD tasks with incremental commits**
