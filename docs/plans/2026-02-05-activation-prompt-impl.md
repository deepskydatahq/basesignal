# Activation Prompt Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add ACTIVATION_SYSTEM_PROMPT constant that instructs Claude to extract multi-level activation from product content.

**Architecture:** Export a ~700 word prompt constant from `extractActivationLevels.ts` (after types from S001). The prompt follows extractIdentity.ts pattern: role definition, JSON schema, signal strength mapping, one example, and output constraints.

**Tech Stack:** TypeScript, Vitest

---

## Task 1: Add ACTIVATION_SYSTEM_PROMPT constant

**Files:**
- Modify: `convex/analysis/extractActivationLevels.ts` (after types)
- Test: `convex/analysis/extractActivationLevels.test.ts`

**Step 1: Write the failing test**

Create test file that verifies prompt export exists and contains required elements:

```typescript
// convex/analysis/extractActivationLevels.test.ts
import { describe, it, expect } from "vitest";
import { ACTIVATION_SYSTEM_PROMPT } from "./extractActivationLevels";

describe("ACTIVATION_SYSTEM_PROMPT", () => {
  it("is exported and non-empty", () => {
    expect(ACTIVATION_SYSTEM_PROMPT).toBeDefined();
    expect(ACTIVATION_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });

  it("requests JSON output with required fields", () => {
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("levels");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("primaryActivation");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("overallConfidence");
  });

  it("includes all signal strengths", () => {
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("weak");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("medium");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("strong");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("very_strong");
  });

  it("includes criteria format guidance", () => {
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("action");
    expect(ACTIVATION_SYSTEM_PROMPT).toContain("count");
  });

  it("includes example with activation levels", () => {
    // Prompt should include an example showing the progression
    expect(ACTIVATION_SYSTEM_PROMPT).toMatch(/Level \d/);
  });

  it("explains primary activation concept", () => {
    // Should explain the "aha-moment" concept
    expect(ACTIVATION_SYSTEM_PROMPT).toMatch(/primary.*activation|aha.*moment/i);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/analysis/extractActivationLevels.test.ts`
Expected: FAIL with "Cannot find module" or "is not exported"

**Step 3: Write the implementation**

Add to `convex/analysis/extractActivationLevels.ts` (after type definitions):

```typescript
/**
 * System prompt for extracting multi-level activation from product content.
 * Instructs Claude to identify 3-4 activation levels representing user progression
 * from first touch to full adoption.
 */
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
Expected: PASS (all 6 tests)

**Step 5: Commit**

```bash
git add convex/analysis/extractActivationLevels.ts convex/analysis/extractActivationLevels.test.ts
git commit -m "feat(analysis): add ACTIVATION_SYSTEM_PROMPT for multi-level extraction

Add system prompt constant that instructs Claude to extract 3-4 activation
levels from product content. The prompt includes signal strength mapping,
one B2B SaaS example, primary activation guidance, and output constraints.

Part of M002-E003-S002."
```

---

## Verification

After implementation, verify all acceptance criteria:

1. [unit] ACTIVATION_SYSTEM_PROMPT constant is defined with extraction instructions ✓
2. [unit] Prompt requests output as JSON matching ActivationLevelsResult structure ✓
3. [unit] Prompt includes examples for PLG product activation spectrum ✓
4. [unit] Prompt includes guidance on identifying primary activation based on value prop ✓
5. [unit] Prompt instructs to look for behavioral language (create, invite, share, collaborate) ✓
6. [unit] Prompt explains signalStrength mapping (weak = individual exploration, very_strong = team adoption) ✓

Run full test suite: `npm test`
