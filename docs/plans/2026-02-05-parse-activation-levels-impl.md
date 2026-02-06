# Parse Activation Levels Response Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a parser function that extracts and validates activation levels JSON from Claude's response.

**Architecture:** Single function `parseActivationLevelsResponse` that extracts JSON from code fences, validates required fields at top-level and per-level, clamps confidence values, sorts levels, and validates cross-references. Follows exact pattern from `parseIdentityResponse` in `extractIdentity.ts`.

**Tech Stack:** TypeScript, Vitest

---

## Task 1: Create Types File with Activation Level Types

The types from S001 don't exist yet. Create them as the foundation.

**Files:**
- Create: `convex/analysis/extractActivationLevels.ts`
- Test: `convex/analysis/extractActivationLevels.test.ts`

**Step 1: Write the failing test**

```typescript
// convex/analysis/extractActivationLevels.test.ts
import { describe, it, expect } from "vitest";
import type {
  SignalStrength,
  ActivationCriterion,
  ActivationLevel,
  ActivationLevelsResult,
} from "./extractActivationLevels";

describe("Activation Level Types", () => {
  it("SignalStrength accepts valid values", () => {
    const strengths: SignalStrength[] = ["weak", "medium", "strong", "very_strong"];
    expect(strengths).toHaveLength(4);
  });

  it("ActivationCriterion has required fields", () => {
    const criterion: ActivationCriterion = {
      action: "create_board",
      count: 1,
    };
    expect(criterion.action).toBe("create_board");
    expect(criterion.count).toBe(1);
  });

  it("ActivationCriterion supports optional timeWindow", () => {
    const criterion: ActivationCriterion = {
      action: "invite_member",
      count: 3,
      timeWindow: "first_7d",
    };
    expect(criterion.timeWindow).toBe("first_7d");
  });

  it("ActivationLevel has all required fields", () => {
    const level: ActivationLevel = {
      level: 1,
      name: "explorer",
      signalStrength: "weak",
      criteria: [{ action: "view_dashboard", count: 1 }],
      reasoning: "Basic engagement",
      confidence: 0.8,
      evidence: [{ url: "https://example.com", excerpt: "quote" }],
    };
    expect(level.level).toBe(1);
    expect(level.signalStrength).toBe("weak");
  });

  it("ActivationLevelsResult contains levels and metadata", () => {
    const result: ActivationLevelsResult = {
      levels: [],
      primaryActivation: 2,
      overallConfidence: 0.85,
    };
    expect(result.primaryActivation).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: FAIL with import errors (module not found)

**Step 3: Write minimal implementation**

```typescript
// convex/analysis/extractActivationLevels.ts

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
git commit -m "feat(analysis): add activation level types"
```

---

## Task 2: Parser Extracts JSON from Code Fences

**Files:**
- Modify: `convex/analysis/extractActivationLevels.ts`
- Modify: `convex/analysis/extractActivationLevels.test.ts`

**Step 1: Write the failing test**

Add to the test file:

```typescript
describe("parseActivationLevelsResponse", () => {
  const validResult = {
    levels: [
      {
        level: 1,
        name: "explorer",
        signalStrength: "weak",
        criteria: [{ action: "view_dashboard", count: 1 }],
        reasoning: "Basic engagement",
        confidence: 0.7,
        evidence: [{ url: "https://example.com", excerpt: "quote" }],
      },
    ],
    primaryActivation: 1,
    overallConfidence: 0.8,
  };

  it("parses raw JSON response", () => {
    const result = parseActivationLevelsResponse(JSON.stringify(validResult));
    expect(result.levels).toHaveLength(1);
    expect(result.primaryActivation).toBe(1);
  });

  it("extracts JSON from code fences with json tag", () => {
    const wrapped = "```json\n" + JSON.stringify(validResult) + "\n```";
    const result = parseActivationLevelsResponse(wrapped);
    expect(result.levels).toHaveLength(1);
  });

  it("extracts JSON from code fences without language tag", () => {
    const wrapped = "```\n" + JSON.stringify(validResult) + "\n```";
    const result = parseActivationLevelsResponse(wrapped);
    expect(result.levels).toHaveLength(1);
  });
});
```

Update imports at top of test file:

```typescript
import type {
  SignalStrength,
  ActivationCriterion,
  ActivationLevel,
  ActivationLevelsResult,
} from "./extractActivationLevels";
import { parseActivationLevelsResponse } from "./extractActivationLevels";
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: FAIL with "parseActivationLevelsResponse is not exported"

**Step 3: Write minimal implementation**

Add to `extractActivationLevels.ts`:

```typescript
/**
 * Parse Claude's response text to extract activation levels JSON.
 * Handles responses with markdown code fences or raw JSON.
 */
export function parseActivationLevelsResponse(responseText: string): ActivationLevelsResult {
  // Extract JSON from code fences
  const fenceMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : responseText.trim();

  const parsed = JSON.parse(jsonStr);
  return parsed as ActivationLevelsResult;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/analysis/extractActivationLevels.ts convex/analysis/extractActivationLevels.test.ts
git commit -m "feat(analysis): add parseActivationLevelsResponse with code fence extraction"
```

---

## Task 3: Validate Top-Level Required Fields

**Files:**
- Modify: `convex/analysis/extractActivationLevels.ts`
- Modify: `convex/analysis/extractActivationLevels.test.ts`

**Step 1: Write the failing tests**

Add to `parseActivationLevelsResponse` describe block:

```typescript
  it("throws on missing levels field", () => {
    const invalid = JSON.stringify({ primaryActivation: 1, overallConfidence: 0.8 });
    expect(() => parseActivationLevelsResponse(invalid)).toThrow("Missing required field: levels");
  });

  it("throws on missing primaryActivation field", () => {
    const invalid = JSON.stringify({ levels: [], overallConfidence: 0.8 });
    expect(() => parseActivationLevelsResponse(invalid)).toThrow("Missing required field: primaryActivation");
  });

  it("throws on missing overallConfidence field", () => {
    const invalid = JSON.stringify({ levels: [], primaryActivation: 1 });
    expect(() => parseActivationLevelsResponse(invalid)).toThrow("Missing required field: overallConfidence");
  });

  it("throws when levels is not an array", () => {
    const invalid = JSON.stringify({ levels: "not-array", primaryActivation: 1, overallConfidence: 0.8 });
    expect(() => parseActivationLevelsResponse(invalid)).toThrow("levels (must be array)");
  });
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: FAIL - tests expecting throws will not throw

**Step 3: Update implementation**

Update `parseActivationLevelsResponse`:

```typescript
export function parseActivationLevelsResponse(responseText: string): ActivationLevelsResult {
  // Extract JSON from code fences
  const fenceMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : responseText.trim();

  const parsed = JSON.parse(jsonStr);

  // Validate top-level required fields
  if (!Array.isArray(parsed.levels)) {
    throw new Error("Missing required field: levels (must be array)");
  }
  if (typeof parsed.primaryActivation !== "number") {
    throw new Error("Missing required field: primaryActivation (must be number)");
  }
  if (typeof parsed.overallConfidence !== "number") {
    throw new Error("Missing required field: overallConfidence (must be number)");
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
git commit -m "feat(analysis): validate top-level required fields in parser"
```

---

## Task 4: Validate Per-Level Required Fields

**Files:**
- Modify: `convex/analysis/extractActivationLevels.ts`
- Modify: `convex/analysis/extractActivationLevels.test.ts`

**Step 1: Write the failing tests**

Add to `parseActivationLevelsResponse` describe block:

```typescript
  it("throws when level is missing level number", () => {
    const invalid = JSON.stringify({
      levels: [{ name: "explorer", signalStrength: "weak", criteria: [], confidence: 0.5, reasoning: "x", evidence: [] }],
      primaryActivation: 1,
      overallConfidence: 0.8,
    });
    expect(() => parseActivationLevelsResponse(invalid)).toThrow("Level missing: level number");
  });

  it("throws when level is missing name", () => {
    const invalid = JSON.stringify({
      levels: [{ level: 1, signalStrength: "weak", criteria: [], confidence: 0.5, reasoning: "x", evidence: [] }],
      primaryActivation: 1,
      overallConfidence: 0.8,
    });
    expect(() => parseActivationLevelsResponse(invalid)).toThrow("Level missing: name");
  });

  it("throws when level is missing criteria array", () => {
    const invalid = JSON.stringify({
      levels: [{ level: 1, name: "explorer", signalStrength: "weak", confidence: 0.5, reasoning: "x", evidence: [] }],
      primaryActivation: 1,
      overallConfidence: 0.8,
    });
    expect(() => parseActivationLevelsResponse(invalid)).toThrow("Level missing: criteria array");
  });

  it("throws when level is missing confidence", () => {
    const invalid = JSON.stringify({
      levels: [{ level: 1, name: "explorer", signalStrength: "weak", criteria: [], reasoning: "x", evidence: [] }],
      primaryActivation: 1,
      overallConfidence: 0.8,
    });
    expect(() => parseActivationLevelsResponse(invalid)).toThrow("Level missing: confidence");
  });
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: FAIL - tests expecting throws will not throw

**Step 3: Update implementation**

Update `parseActivationLevelsResponse` to add level validation loop after top-level validation:

```typescript
export function parseActivationLevelsResponse(responseText: string): ActivationLevelsResult {
  // Extract JSON from code fences
  const fenceMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : responseText.trim();

  const parsed = JSON.parse(jsonStr);

  // Validate top-level required fields
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
    if (!Array.isArray(level.criteria)) throw new Error("Level missing: criteria array");
    if (typeof level.confidence !== "number") throw new Error("Level missing: confidence");
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
git commit -m "feat(analysis): validate per-level required fields"
```

---

## Task 5: Validate signalStrength Values

**Files:**
- Modify: `convex/analysis/extractActivationLevels.ts`
- Modify: `convex/analysis/extractActivationLevels.test.ts`

**Step 1: Write the failing test**

Add to `parseActivationLevelsResponse` describe block:

```typescript
  it("throws on invalid signalStrength value", () => {
    const invalid = JSON.stringify({
      levels: [{ level: 1, name: "explorer", signalStrength: "invalid", criteria: [], confidence: 0.5, reasoning: "x", evidence: [] }],
      primaryActivation: 1,
      overallConfidence: 0.8,
    });
    expect(() => parseActivationLevelsResponse(invalid)).toThrow("Invalid signalStrength: invalid");
  });

  it("accepts all valid signalStrength values", () => {
    const makeLevel = (strength: string) => ({
      level: 1, name: "test", signalStrength: strength, criteria: [], confidence: 0.5, reasoning: "x", evidence: []
    });

    for (const strength of ["weak", "medium", "strong", "very_strong"]) {
      const result = parseActivationLevelsResponse(JSON.stringify({
        levels: [makeLevel(strength)],
        primaryActivation: 1,
        overallConfidence: 0.8,
      }));
      expect(result.levels[0].signalStrength).toBe(strength);
    }
  });
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: FAIL - invalid signalStrength should throw

**Step 3: Update implementation**

Add signalStrength validation in the level loop:

```typescript
  // Validate each level
  for (const level of parsed.levels) {
    if (typeof level.level !== "number") throw new Error("Level missing: level number");
    if (typeof level.name !== "string") throw new Error("Level missing: name");
    if (!["weak", "medium", "strong", "very_strong"].includes(level.signalStrength)) {
      throw new Error(`Invalid signalStrength: ${level.signalStrength}`);
    }
    if (!Array.isArray(level.criteria)) throw new Error("Level missing: criteria array");
    if (typeof level.confidence !== "number") throw new Error("Level missing: confidence");
  }
```

**Step 4: Run test to verify it passes**

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/analysis/extractActivationLevels.ts convex/analysis/extractActivationLevels.test.ts
git commit -m "feat(analysis): validate signalStrength values"
```

---

## Task 6: Validate Criteria Shape

**Files:**
- Modify: `convex/analysis/extractActivationLevels.ts`
- Modify: `convex/analysis/extractActivationLevels.test.ts`

**Step 1: Write the failing tests**

Add to `parseActivationLevelsResponse` describe block:

```typescript
  it("throws when criterion missing action", () => {
    const invalid = JSON.stringify({
      levels: [{
        level: 1, name: "explorer", signalStrength: "weak",
        criteria: [{ count: 1 }],
        confidence: 0.5, reasoning: "x", evidence: []
      }],
      primaryActivation: 1,
      overallConfidence: 0.8,
    });
    expect(() => parseActivationLevelsResponse(invalid)).toThrow("Criterion missing: action");
  });

  it("throws when criterion missing count", () => {
    const invalid = JSON.stringify({
      levels: [{
        level: 1, name: "explorer", signalStrength: "weak",
        criteria: [{ action: "view" }],
        confidence: 0.5, reasoning: "x", evidence: []
      }],
      primaryActivation: 1,
      overallConfidence: 0.8,
    });
    expect(() => parseActivationLevelsResponse(invalid)).toThrow("Criterion missing: count");
  });
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: FAIL - criteria validation not implemented

**Step 3: Update implementation**

Add criteria validation in the level loop:

```typescript
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
  }
```

**Step 4: Run test to verify it passes**

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/analysis/extractActivationLevels.ts convex/analysis/extractActivationLevels.test.ts
git commit -m "feat(analysis): validate criteria shape in parser"
```

---

## Task 7: Clamp Confidence Values

**Files:**
- Modify: `convex/analysis/extractActivationLevels.ts`
- Modify: `convex/analysis/extractActivationLevels.test.ts`

**Step 1: Write the failing tests**

Add to `parseActivationLevelsResponse` describe block:

```typescript
  it("clamps overallConfidence above 1.0 to 1.0", () => {
    const input = JSON.stringify({
      levels: [{ level: 1, name: "explorer", signalStrength: "weak", criteria: [], confidence: 0.5, reasoning: "x", evidence: [] }],
      primaryActivation: 1,
      overallConfidence: 1.5,
    });
    const result = parseActivationLevelsResponse(input);
    expect(result.overallConfidence).toBe(1.0);
  });

  it("clamps negative overallConfidence to 0", () => {
    const input = JSON.stringify({
      levels: [{ level: 1, name: "explorer", signalStrength: "weak", criteria: [], confidence: 0.5, reasoning: "x", evidence: [] }],
      primaryActivation: 1,
      overallConfidence: -0.5,
    });
    const result = parseActivationLevelsResponse(input);
    expect(result.overallConfidence).toBe(0);
  });

  it("clamps level confidence above 1.0 to 1.0", () => {
    const input = JSON.stringify({
      levels: [{ level: 1, name: "explorer", signalStrength: "weak", criteria: [], confidence: 1.5, reasoning: "x", evidence: [] }],
      primaryActivation: 1,
      overallConfidence: 0.8,
    });
    const result = parseActivationLevelsResponse(input);
    expect(result.levels[0].confidence).toBe(1.0);
  });

  it("clamps negative level confidence to 0", () => {
    const input = JSON.stringify({
      levels: [{ level: 1, name: "explorer", signalStrength: "weak", criteria: [], confidence: -0.2, reasoning: "x", evidence: [] }],
      primaryActivation: 1,
      overallConfidence: 0.8,
    });
    const result = parseActivationLevelsResponse(input);
    expect(result.levels[0].confidence).toBe(0);
  });
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: FAIL - confidence values not clamped

**Step 3: Update implementation**

Add clamping after validation in the level loop and at the end:

```typescript
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

    // Clamp level confidence
    level.confidence = Math.max(0, Math.min(1, level.confidence));
  }

  // Clamp overall confidence
  parsed.overallConfidence = Math.max(0, Math.min(1, parsed.overallConfidence));

  return parsed as ActivationLevelsResult;
```

**Step 4: Run test to verify it passes**

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/analysis/extractActivationLevels.ts convex/analysis/extractActivationLevels.test.ts
git commit -m "feat(analysis): clamp confidence values to [0, 1]"
```

---

## Task 8: Sort Levels by Level Number

**Files:**
- Modify: `convex/analysis/extractActivationLevels.ts`
- Modify: `convex/analysis/extractActivationLevels.test.ts`

**Step 1: Write the failing test**

Add to `parseActivationLevelsResponse` describe block:

```typescript
  it("sorts levels by level number ascending", () => {
    const input = JSON.stringify({
      levels: [
        { level: 3, name: "power", signalStrength: "strong", criteria: [], confidence: 0.9, reasoning: "x", evidence: [] },
        { level: 1, name: "explorer", signalStrength: "weak", criteria: [], confidence: 0.5, reasoning: "x", evidence: [] },
        { level: 2, name: "active", signalStrength: "medium", criteria: [], confidence: 0.7, reasoning: "x", evidence: [] },
      ],
      primaryActivation: 2,
      overallConfidence: 0.8,
    });
    const result = parseActivationLevelsResponse(input);
    expect(result.levels.map(l => l.level)).toEqual([1, 2, 3]);
    expect(result.levels.map(l => l.name)).toEqual(["explorer", "active", "power"]);
  });
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: FAIL - levels not sorted

**Step 3: Update implementation**

Add sorting after validation, before clamping overallConfidence:

```typescript
  // Sort levels by level number ascending
  parsed.levels.sort((a: ActivationLevel, b: ActivationLevel) => a.level - b.level);

  // Clamp overall confidence
  parsed.overallConfidence = Math.max(0, Math.min(1, parsed.overallConfidence));
```

**Step 4: Run test to verify it passes**

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/analysis/extractActivationLevels.ts convex/analysis/extractActivationLevels.test.ts
git commit -m "feat(analysis): sort levels by level number ascending"
```

---

## Task 9: Validate primaryActivation References Existing Level

**Files:**
- Modify: `convex/analysis/extractActivationLevels.ts`
- Modify: `convex/analysis/extractActivationLevels.test.ts`

**Step 1: Write the failing test**

Add to `parseActivationLevelsResponse` describe block:

```typescript
  it("throws when primaryActivation references non-existent level", () => {
    const input = JSON.stringify({
      levels: [
        { level: 1, name: "explorer", signalStrength: "weak", criteria: [], confidence: 0.5, reasoning: "x", evidence: [] },
        { level: 2, name: "active", signalStrength: "medium", criteria: [], confidence: 0.7, reasoning: "x", evidence: [] },
      ],
      primaryActivation: 5,
      overallConfidence: 0.8,
    });
    expect(() => parseActivationLevelsResponse(input)).toThrow("primaryActivation 5 does not match any level");
  });

  it("accepts primaryActivation that matches a level", () => {
    const input = JSON.stringify({
      levels: [
        { level: 1, name: "explorer", signalStrength: "weak", criteria: [], confidence: 0.5, reasoning: "x", evidence: [] },
        { level: 2, name: "active", signalStrength: "medium", criteria: [], confidence: 0.7, reasoning: "x", evidence: [] },
      ],
      primaryActivation: 2,
      overallConfidence: 0.8,
    });
    const result = parseActivationLevelsResponse(input);
    expect(result.primaryActivation).toBe(2);
  });
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: FAIL - primaryActivation validation not implemented

**Step 3: Update implementation**

Add primaryActivation validation at the end, before return:

```typescript
  // Validate primaryActivation references existing level
  if (!parsed.levels.some((l: ActivationLevel) => l.level === parsed.primaryActivation)) {
    throw new Error(`primaryActivation ${parsed.primaryActivation} does not match any level`);
  }

  return parsed as ActivationLevelsResult;
```

**Step 4: Run test to verify it passes**

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/analysis/extractActivationLevels.ts convex/analysis/extractActivationLevels.test.ts
git commit -m "feat(analysis): validate primaryActivation references existing level"
```

---

## Task 10: Test Invalid JSON Handling

**Files:**
- Modify: `convex/analysis/extractActivationLevels.test.ts`

**Step 1: Write the test**

Add to `parseActivationLevelsResponse` describe block:

```typescript
  it("throws on invalid JSON", () => {
    expect(() => parseActivationLevelsResponse("not json at all")).toThrow();
  });
```

**Step 2: Run test to verify it passes**

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: PASS (JSON.parse already throws on invalid JSON)

**Step 3: Commit**

```bash
git add convex/analysis/extractActivationLevels.test.ts
git commit -m "test(analysis): verify invalid JSON throws error"
```

---

## Task 11: Run Full Test Suite

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

---

## Final Implementation Reference

After all tasks, `convex/analysis/extractActivationLevels.ts` should contain:

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

/**
 * Parse Claude's response text to extract activation levels JSON.
 * Handles responses with markdown code fences or raw JSON.
 */
export function parseActivationLevelsResponse(responseText: string): ActivationLevelsResult {
  // Extract JSON from code fences
  const fenceMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : responseText.trim();

  const parsed = JSON.parse(jsonStr);

  // Validate top-level required fields
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

    // Clamp level confidence
    level.confidence = Math.max(0, Math.min(1, level.confidence));
  }

  // Sort levels by level number ascending
  parsed.levels.sort((a: ActivationLevel, b: ActivationLevel) => a.level - b.level);

  // Clamp overall confidence
  parsed.overallConfidence = Math.max(0, Math.min(1, parsed.overallConfidence));

  // Validate primaryActivation references existing level
  if (!parsed.levels.some((l: ActivationLevel) => l.level === parsed.primaryActivation)) {
    throw new Error(`primaryActivation ${parsed.primaryActivation} does not match any level`);
  }

  return parsed as ActivationLevelsResult;
}
```

---

*Plan created via /plan-issue headless session · 2026-02-05*
