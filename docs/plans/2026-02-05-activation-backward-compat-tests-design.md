# Activation Backward Compatibility Tests Design

## Overview
Add backward compatibility tests to verify legacy activation format (criteria: string[]) coexists with new multi-level activation format after schema migration.

## Problem Statement
After S001 (schema changes) and S002 (mutation handling) are complete, we need to verify that existing profiles with the legacy activation format continue to work, and new multi-level activation profiles are correctly stored and retrieved.

## Expert Perspectives

### Technical
- Use `t.run()` to insert legacy format data directly, simulating pre-migration state
- Use mutations for new format to ensure business logic runs
- Skip redundant schema validation tests—Convex enforces enums at write time
- Focus on the migration contract: legacy readable, new storable, both coexist

### Simplification Review
- Removed standalone signalStrength validation test (Convex handles this)
- Combined completeness tests into one (same function, different inputs)
- Inline test data instead of separate fixtures
- Reuse existing `setupUserAndProduct()` pattern

## Proposed Solution

Add a new `describe("activation backward compatibility")` block with 5 focused tests:

### Test 1: Legacy activation format is readable
```typescript
it("legacy activation format (criteria: string[]) is readable", async () => {
  // Insert legacy format via t.run(): { criteria: string[], confidence: 0.7, ... }
  // Query via getInternal
  // Assert criteria array is accessible
});
```

### Test 2: New multi-level activation stores and retrieves
```typescript
it("new multi-level activation stores and retrieves correctly", async () => {
  // Create profile via createInternal
  // Update with levels array via updateSectionInternal
  // Query and verify: levels array, primaryActivation, overallConfidence persist
});
```

### Test 3: Completeness calculation works with both formats
```typescript
it("completeness calculation works with both legacy and new formats", async () => {
  // Create two profiles
  // Profile A: legacy activation with confidence: 0.7
  // Profile B: multi-level activation with overallConfidence: 0.85
  // Verify both have correct completeness percentages
  // Key: new format uses overallConfidence, legacy uses confidence
});
```

### Test 4: Mixed profiles coexist
```typescript
it("mixed profiles (legacy and multi-level) coexist in database", async () => {
  // Create product1 with legacy activation
  // Create product2 with multi-level activation
  // Query both via list or get
  // Verify each maintains its format
});
```

### Test 5: Existing tests pass
No code changes—run `npm test -- productProfiles.test.ts` to verify existing tests still pass after schema migration.

## Test Data (Inline)

**Legacy format:**
```typescript
// Old format: criteria as string[]
{ criteria: ["Complete onboarding", "Create first project"], timeWindow: "7 days", confidence: 0.7, reasoning: "...", evidence: [] }
```

**New format:**
```typescript
// New format: levels array with structured criteria
{ levels: [{ level: 1, name: "explorer", signalStrength: "weak", criteria: [{action: "view_dashboard", count: 1}], ... }], primaryActivation: 2, overallConfidence: 0.85 }
```

## Success Criteria
- All 5 tests pass
- No changes to existing productProfiles.test.ts tests (they still pass)
- Tests demonstrate the migration contract: read legacy, write new, coexist

---
*Design via /brainstorm-auto · 2026-02-05*
