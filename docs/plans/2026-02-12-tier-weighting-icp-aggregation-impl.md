# Implementation Plan: Tier Weighting for ICP Input Aggregation

**Task:** basesignal-xqz (M006-E002-S002)
**Design:** docs/plans/2026-02-12-tier-weighting-icp-aggregation-design.md

## Summary

Add `tier_2_moments` and `tier_3_plus_moments` to `RoleAggregation`, replace the two-key sort with a weighted composite score (`tier_1 * 5 + tier_2 * 2 + occurrence_count`), update `RoleInput` and `buildICPPrompt` with tier breakdown, and update all tests.

## Files Changed

1. `convex/analysis/outputs/aggregateICPInputs.ts`
2. `convex/analysis/outputs/aggregateICPInputs.test.ts`
3. `convex/analysis/outputs/generateICPProfiles.ts`
4. `convex/analysis/outputs/generateICPProfiles.test.ts`

---

## Step 1: Update `RoleAggregation` interface

**File:** `convex/analysis/outputs/aggregateICPInputs.ts` (lines 7-12)

Add two new fields to the interface:

```typescript
export interface RoleAggregation {
  name: string;
  occurrence_count: number;
  value_moments: ValueMoment[];
  tier_1_moments: number;
  tier_2_moments: number;        // NEW
  tier_3_plus_moments: number;   // NEW
}
```

## Step 2: Update aggregation loop to compute tier counts

**File:** `convex/analysis/outputs/aggregateICPInputs.ts` (lines 57-65)

In the loop that builds `RoleAggregation` objects from the `roleMap`, compute all three tier counts:

```typescript
roles.push({
  name,
  occurrence_count: moments.length,
  value_moments: moments,
  tier_1_moments: moments.filter((vm) => vm.tier === 1).length,
  tier_2_moments: moments.filter((vm) => vm.tier === 2).length,
  tier_3_plus_moments: moments.filter((vm) => vm.tier >= 3).length,
});
```

## Step 3: Replace sort with weighted composite score

**File:** `convex/analysis/outputs/aggregateICPInputs.ts` (lines 67-73)

Replace the current two-key sort:

```typescript
// Sort: weighted composite score desc
const weightedScore = (r: RoleAggregation) =>
  r.tier_1_moments * 5 + r.tier_2_moments * 2 + r.occurrence_count;
roles.sort((a, b) => weightedScore(b) - weightedScore(a));
```

Update the JSDoc comment on `aggregateICPInputsCore` (line 29) to reflect the new sort:
`Sorted by weighted score: tier_1 * 5 + tier_2 * 2 + occurrence_count.`

## Step 4: Update `RoleInput` interface

**File:** `convex/analysis/outputs/generateICPProfiles.ts` (lines 10-20)

Add two new fields:

```typescript
export interface RoleInput {
  name: string;
  occurrence_count: number;
  tier_1_count: number;
  tier_2_count: number;           // NEW
  tier_3_plus_count: number;      // NEW
  value_moments: Array<{
    id: string;
    name: string;
    description: string;
    tier: number;
  }>;
}
```

## Step 5: Update inline `aggregateRoles` helper

**File:** `convex/analysis/outputs/generateICPProfiles.ts` (lines 176-202)

Track the new tier counts during aggregation:

```typescript
function aggregateRoles(valueMoments: ValueMoment[]): RoleInput[] {
  const roleMap = new Map<string, RoleInput>();

  for (const vm of valueMoments) {
    for (const role of vm.roles) {
      if (!roleMap.has(role)) {
        roleMap.set(role, {
          name: role,
          occurrence_count: 0,
          tier_1_count: 0,
          tier_2_count: 0,
          tier_3_plus_count: 0,
          value_moments: [],
        });
      }
      const entry = roleMap.get(role)!;
      entry.occurrence_count++;
      if (vm.tier === 1) entry.tier_1_count++;
      if (vm.tier === 2) entry.tier_2_count++;
      if (vm.tier >= 3) entry.tier_3_plus_count++;
      entry.value_moments.push({
        id: vm.id,
        name: vm.name,
        description: vm.description,
        tier: vm.tier,
      });
    }
  }

  return Array.from(roleMap.values());
}
```

## Step 6: Update `buildICPPrompt` role summary format

**File:** `convex/analysis/outputs/generateICPProfiles.ts` (lines 65-69)

Change the role summary line from:
```
- PM: 5 occurrences, 3 Tier 1 value moments
```
to compact tier breakdown:
```
- PM: 5 occurrences (3 T1, 1 T2, 1 T3+)
```

```typescript
parts.push(
  `- ${role.name}: ${role.occurrence_count} occurrences (${role.tier_1_count} T1, ${role.tier_2_count} T2, ${role.tier_3_plus_count} T3+)`,
);
```

## Step 7: Update `aggregateICPInputs.test.ts`

**File:** `convex/analysis/outputs/aggregateICPInputs.test.ts`

### 7a. Update existing sort test (lines 118-171)

The test "sorts by tier_1_moments desc, then occurrence_count desc" must be renamed and updated for weighted scoring. Current data:
- PM: 2 T1, 0 T2 → score = 2*5 + 0*2 + 2 = 12
- Designer: 1 T1, 0 T2 → score = 1*5 + 0*2 + 1 = 6
- Engineer: 0 T1, 3 T2 → score = 0*5 + 3*2 + 3 = 9

New expected order: PM (12) > Engineer (9) > Designer (6).

Rename test to `"sorts by weighted score: tier_1 * 5 + tier_2 * 2 + occurrence_count"`.

Update assertions:
```typescript
expect(result.roles[0].name).toBe("PM");        // score 12
expect(result.roles[1].name).toBe("Engineer");   // score 9
expect(result.roles[2].name).toBe("Designer");   // score 6
```

Also verify the new fields on each role:
```typescript
expect(result.roles[2].tier_2_moments).toBe(3);
expect(result.roles[2].tier_3_plus_moments).toBe(0);
```

### 7b. Update integration test (lines 204-301)

Recalculate weighted scores for Linear-like integration test:
- Engineering Lead: 3 T1, 0 T2 → score = 3*5 + 0*2 + 3 = 18
- Team Lead: 2 T1, 1 T2 → score = 2*5 + 1*2 + 3 = 15
- Product Manager: 1 T1, 2 T2 → score = 1*5 + 2*2 + 3 = 12
- Designer: 1 T1, 1 T2 → score = 1*5 + 1*2 + 2 = 9
- B2B SaaS product teams: 0 T1, 0 T2 → score = 0

Sort order unchanged (Engineering Lead > Team Lead > PM > Designer > phantom). Existing assertions hold.

Add new field assertions:
```typescript
expect(engLead.tier_2_moments).toBe(0);
expect(engLead.tier_3_plus_moments).toBe(0);
expect(pm.tier_2_moments).toBe(2);      // vm-3 (T2), vm-5 (T2)
expect(pm.tier_3_plus_moments).toBe(0);
expect(teamLead.tier_2_moments).toBe(1); // vm-5 (T2)
expect(designer.tier_2_moments).toBe(1); // vm-3 (T2)
```

### 7c. Add new test: "2 T1 moments outranks 10 T3 moments"

```typescript
it("2 T1 moments outranks 10 T3 moments", () => {
  // Role A: 2 T1 moments → score = 2*5 + 0 + 2 = 12
  const t1moments = [1, 2].map((i) =>
    makeValueMoment({ id: `t1-${i}`, name: `T1 ${i}`, tier: 1, roles: ["A"] })
  );
  // Role B: 10 T3 moments → score = 0 + 0 + 10 = 10
  const t3moments = Array.from({ length: 10 }, (_, i) =>
    makeValueMoment({ id: `t3-${i}`, name: `T3 ${i}`, tier: 3, roles: ["B"] })
  );

  const result = aggregateICPInputsCore([...t1moments, ...t3moments], "");
  expect(result.roles[0].name).toBe("A");
  expect(result.roles[1].name).toBe("B");
});
```

### 7d. Add new test: "roles with only T3+ moments sort to bottom"

```typescript
it("roles with only T3+ moments sort to bottom", () => {
  const moments = [
    makeValueMoment({ id: "v1", name: "T2 moment", tier: 2, roles: ["Mid"] }),
    makeValueMoment({ id: "v2", name: "T1 moment", tier: 1, roles: ["Top"] }),
    makeValueMoment({ id: "v3", name: "T3 moment", tier: 3, roles: ["Bottom"] }),
  ];

  const result = aggregateICPInputsCore(moments, "");
  // Top: score = 5+1 = 6, Mid: score = 2+1 = 3, Bottom: score = 0+1 = 1
  expect(result.roles[0].name).toBe("Top");
  expect(result.roles[1].name).toBe("Mid");
  expect(result.roles[2].name).toBe("Bottom");
});
```

### 7e. Add new test: "tier_2 and tier_3_plus fields correctly counted"

```typescript
it("tier_2 and tier_3_plus fields correctly counted", () => {
  const moments = [
    makeValueMoment({ id: "v1", name: "A", tier: 1, roles: ["R"] }),
    makeValueMoment({ id: "v2", name: "B", tier: 2, roles: ["R"] }),
    makeValueMoment({ id: "v3", name: "C", tier: 2, roles: ["R"] }),
    makeValueMoment({ id: "v4", name: "D", tier: 3, roles: ["R"] }),
  ];

  const result = aggregateICPInputsCore(moments, "");
  expect(result.roles[0].tier_1_moments).toBe(1);
  expect(result.roles[0].tier_2_moments).toBe(2);
  expect(result.roles[0].tier_3_plus_moments).toBe(1);
});
```

### 7f. Update phantom role test (line 101)

Add zero-value assertions for new fields:
```typescript
expect(phantom!.tier_2_moments).toBe(0);
expect(phantom!.tier_3_plus_moments).toBe(0);
```

## Step 8: Update `generateICPProfiles.test.ts`

**File:** `convex/analysis/outputs/generateICPProfiles.test.ts`

### 8a. Update `makeRoleInput` helper (lines 10-31)

Add default values for new fields:
```typescript
function makeRoleInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "Product Manager",
    occurrence_count: 5,
    tier_1_count: 3,
    tier_2_count: 1,          // NEW
    tier_3_plus_count: 1,     // NEW
    value_moments: [ ... ],
    ...overrides,
  };
}
```

### 8b. Update prompt format test

The test "includes tier information for each moment" (line 138) should still pass (individual moments still show "Tier 1", "Tier 2").

Add a new test for the role summary format:
```typescript
it("shows tier breakdown in role summary", () => {
  const prompt = buildICPPrompt(
    [makeRoleInput({ tier_1_count: 3, tier_2_count: 1, tier_3_plus_count: 1 })],
    "",
  );
  expect(prompt).toContain("(3 T1, 1 T2, 1 T3+)");
});
```

### 8c. Verify no prompt format test breaks

The existing "includes value moment IDs and names" test doesn't depend on the summary line format — it checks moment-level content. Safe.

The "includes role names from input" test checks that role names appear — will still pass since the new format includes the name.

---

## Verification

After all changes, run:
```bash
npm run test:run -- convex/analysis/outputs/aggregateICPInputs.test.ts convex/analysis/outputs/generateICPProfiles.test.ts
```

All existing tests (with updated expectations) and new tests must pass.

## Dependency Note

This task depends on `basesignal-asi` (M006-E002-S001: ICP prompt prioritization). If that task has landed, the `ICP_SYSTEM_PROMPT` and `buildICPPrompt` in `generateICPProfiles.ts` may have additional content (Prioritization Guidance section). The changes in this plan are additive and shouldn't conflict — but verify during implementation.
