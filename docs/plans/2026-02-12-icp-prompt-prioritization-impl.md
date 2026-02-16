# ICP Prompt Prioritization — Implementation Plan

## Context

`convex/analysis/outputs/generateICPProfiles.ts` generates ICP profiles via Claude. The current `ICP_SYSTEM_PROMPT` has no guidance about distinguishing real product users from marketing personas, causing the LLM to over-index on roles that appear frequently in website copy (security, compliance, buyers) rather than who uses the product daily.

The brainstorm design (docs/plans/2026-02-12-icp-prompt-prioritization-design.md) specifies two additive changes plus tests. No changes to `parseICPProfiles`, types, or schema.

## Approach

Two additive modifications to `generateICPProfiles.ts`, plus new test cases. All existing tests must pass unchanged.

## Implementation Steps

### Step 1: Add "Persona Prioritization" section to `ICP_SYSTEM_PROMPT`

**File:** `convex/analysis/outputs/generateICPProfiles.ts` (lines 24–49)

Insert a new `## Persona Prioritization` section between the existing `## Distinctness Requirement` block (ends ~line 46) and `## Output Format` (line 48).

**Exact text to insert before `## Output Format`:**

```
## Persona Prioritization
Your PRIMARY persona must represent who uses this product every day — the core
daily user — not who the website markets to or who evaluates/buys the product.

Key distinction:
- "Core daily user": the person whose daily workflow depends on this product
- "Evaluator/buyer": the person who discovers, evaluates, or purchases the product
- "Marketing persona": a role the website promotes heavily but who may not be a daily user

If the input data is dominated by marketing/security/compliance content, that
likely reflects website copy, NOT actual product usage. Down-weight roles that
only appear in low-tier (Tier 3+) or marketing-heavy content.

Rank personas by:
1. Number of Tier 1 value moments associated with that role (strongest signal)
2. Whether the role implies daily product usage (activation-level signal)
3. Total occurrence count (weakest signal — high count from marketing copy is noise)

Set confidence scores based on product-usage evidence, not content volume.
A role with 2 Tier 1 moments deserves higher confidence than a role with 10 Tier 3 moments.
```

### Step 2: Add "Prioritization Guidance" section to `buildICPPrompt`

**File:** `convex/analysis/outputs/generateICPProfiles.ts` (lines 53–83)

Inside the existing `if (roles.length > 0)` block (line 63), after the "Value Moments by Role" loop (ends at line 79), add a new block that:

1. Filters roles with `tier_1_count > 0`
2. Sorts the filtered copy by `tier_1_count` descending
3. Slices top 3
4. Emits a "Prioritization Guidance" section

**Code to insert after line 79 (before the closing `}` of the `if (roles.length > 0)` block on line 80):**

```typescript
    const tier1Roles = [...roles]
      .filter((r) => r.tier_1_count > 0)
      .sort((a, b) => b.tier_1_count - a.tier_1_count)
      .slice(0, 3);
    if (tier1Roles.length > 0) {
      parts.push("\n## Prioritization Guidance");
      parts.push(
        "Roles with the most Tier 1 value moments are most likely core daily users:",
      );
      for (const role of tier1Roles) {
        parts.push(`- ${role.name}: ${role.tier_1_count} Tier 1 moments`);
      }
      parts.push("The primary persona should come from this group.");
    }
```

Key details:
- `[...roles]` creates a spread copy to avoid mutating the input array
- `.filter()` before `.sort()` so we only sort tier-1 roles
- Sort is explicit descending by `tier_1_count` — deterministic ordering
- `.slice(0, 3)` caps at top 3 roles
- Section only emitted when at least one role has tier-1 moments
- No guidance section when no roles have tier-1 moments (graceful omission)

### Step 3: Add new tests for `ICP_SYSTEM_PROMPT`

**File:** `convex/analysis/outputs/generateICPProfiles.test.ts`

Add to the existing `describe("ICP_SYSTEM_PROMPT")` block (after line 112):

```typescript
  it("contains instruction to distinguish core daily users from evaluators/buyers", () => {
    expect(ICP_SYSTEM_PROMPT.toLowerCase()).toContain("core daily user");
    expect(ICP_SYSTEM_PROMPT.toLowerCase()).toContain("evaluator");
    expect(ICP_SYSTEM_PROMPT.toLowerCase()).toContain("buyer");
  });

  it("instructs primary persona must be who uses the product daily", () => {
    expect(ICP_SYSTEM_PROMPT.toLowerCase()).toContain("primary persona");
    expect(ICP_SYSTEM_PROMPT.toLowerCase()).toContain("every day");
  });

  it("contains guidance to weight Tier 1 value moments over content volume", () => {
    expect(ICP_SYSTEM_PROMPT).toContain("Tier 1");
    expect(ICP_SYSTEM_PROMPT.toLowerCase()).toContain("content volume");
  });

  it("instructs confidence scores reflect product-usage data, not marketing prominence", () => {
    expect(ICP_SYSTEM_PROMPT.toLowerCase()).toContain("confidence");
    expect(ICP_SYSTEM_PROMPT.toLowerCase()).toContain("product-usage evidence");
  });
```

### Step 4: Add new tests for `buildICPPrompt` Prioritization Guidance

**File:** `convex/analysis/outputs/generateICPProfiles.test.ts`

Add to the existing `describe("buildICPPrompt")` block (after line 148):

```typescript
  it("includes Prioritization Guidance section when tier-1 roles exist", () => {
    const roles = [
      makeRoleInput({ name: "PM", tier_1_count: 3 }),
      makeRoleInput({ name: "Engineer", tier_1_count: 1 }),
    ];
    const prompt = buildICPPrompt(roles, "");
    expect(prompt).toContain("## Prioritization Guidance");
    expect(prompt).toContain("PM: 3 Tier 1 moments");
    expect(prompt).toContain("Engineer: 1 Tier 1 moments");
    expect(prompt).toContain("primary persona should come from this group");
  });

  it("sorts Prioritization Guidance roles by tier_1_count descending", () => {
    const roles = [
      makeRoleInput({ name: "Low", tier_1_count: 1 }),
      makeRoleInput({ name: "High", tier_1_count: 5 }),
      makeRoleInput({ name: "Mid", tier_1_count: 3 }),
    ];
    const prompt = buildICPPrompt(roles, "");
    const highIdx = prompt.indexOf("High: 5 Tier 1");
    const midIdx = prompt.indexOf("Mid: 3 Tier 1");
    const lowIdx = prompt.indexOf("Low: 1 Tier 1");
    expect(highIdx).toBeLessThan(midIdx);
    expect(midIdx).toBeLessThan(lowIdx);
  });

  it("limits Prioritization Guidance to top 3 roles", () => {
    const roles = [
      makeRoleInput({ name: "A", tier_1_count: 4 }),
      makeRoleInput({ name: "B", tier_1_count: 3 }),
      makeRoleInput({ name: "C", tier_1_count: 2 }),
      makeRoleInput({ name: "D", tier_1_count: 1 }),
    ];
    const prompt = buildICPPrompt(roles, "");
    expect(prompt).toContain("A: 4 Tier 1");
    expect(prompt).toContain("B: 3 Tier 1");
    expect(prompt).toContain("C: 2 Tier 1");
    expect(prompt).not.toContain("D: 1 Tier 1");
  });

  it("omits Prioritization Guidance when no roles have tier-1 moments", () => {
    const roles = [
      makeRoleInput({ name: "Viewer", tier_1_count: 0 }),
    ];
    const prompt = buildICPPrompt(roles, "");
    expect(prompt).not.toContain("Prioritization Guidance");
  });

  it("does not mutate the input roles array", () => {
    const roles = [
      makeRoleInput({ name: "B", tier_1_count: 1 }),
      makeRoleInput({ name: "A", tier_1_count: 3 }),
    ];
    const originalOrder = roles.map((r) => r.name);
    buildICPPrompt(roles, "");
    expect(roles.map((r) => r.name)).toEqual(originalOrder);
  });
```

### Step 5: Verify existing tests pass

Run the full test suite to confirm:
- All existing `parseICPProfiles` tests pass unchanged
- All existing `buildICPPrompt` tests pass unchanged
- All existing `ICP_SYSTEM_PROMPT` tests pass unchanged
- All new tests pass

```bash
npm run test:run -- convex/analysis/outputs/generateICPProfiles.test.ts
```

## Testing

| Acceptance Criterion | Test Coverage |
|---|---|
| Prompt distinguishes 'core daily users' from 'evaluators/buyers' | Step 3: content assertions for "core daily user", "evaluator", "buyer" |
| Primary persona must be who uses product daily | Step 3: content assertions for "primary persona", "every day" |
| Weight Tier 1 value moments over content volume | Step 3: content assertions for "Tier 1", "content volume" |
| Confidence scores reflect product-usage data | Step 3: content assertions for "confidence", "product-usage evidence" |
| buildICPPrompt includes Prioritization Guidance | Step 4: presence test, sort order test, top-3 limit test, omission test, immutability test |
| Existing parseICPProfiles tests pass unchanged | Step 5: no changes to parseICPProfiles or its tests |
| Existing buildICPPrompt tests pass unchanged | Step 5: additive changes only to buildICPPrompt |

## Risks / Open Questions

1. **Prompt length** — Adding ~15 lines to system prompt and a few lines to user prompt is well within Claude's context. No risk.
2. **Downstream dependent** — `basesignal-xqz` (tier weighting) builds on this. The `RoleInput` interface is NOT changed here, so the dependent story can add `tier_2_count` / `tier_3_plus_count` fields later without conflict.
3. **Spread copy `[...roles]`** — Required because `.sort()` mutates in place. The test in Step 4 explicitly verifies immutability.
