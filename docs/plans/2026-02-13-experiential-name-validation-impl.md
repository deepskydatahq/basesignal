# Implementation Plan: Experiential Name Validation

**Task:** basesignal-7lq
**Date:** 2026-02-13

## Context
Add a fourth quality check to `validateConvergenceQuality()` that warns when merged value moment names start with business verbs (e.g., "Gain", "Reduce") instead of user-action verbs (e.g., "View", "Create"). Non-blocking (warn only) — monitors prompt quality drift after the experiential prompt rewrite.

## Changes

### 1. Add verb constants
**File:** `convex/analysis/convergence/convergeAndTier.ts`
**What:** Add `BUSINESS_VERBS` and `USER_ACTION_VERBS` exported Set constants before the `validateConvergenceQuality()` function (around line 142).
**Details:**
```typescript
export const BUSINESS_VERBS = new Set([
  "gain", "reduce", "accelerate", "optimize", "streamline",
  "automate", "leverage", "enable", "enhance", "empower",
  "transform", "revolutionize",
]);

/** Reference constant per spec — not used by validation logic. */
export const USER_ACTION_VERBS = new Set([
  "create", "share", "export", "build", "drag", "invite",
  "comment", "vote", "upload", "filter", "tag", "open",
  "view", "configure", "set", "move", "edit", "delete",
  "copy", "pin", "search", "browse", "arrange", "draw",
  "connect", "assign", "schedule",
]);
```
- Store as lowercase `Set<string>` for O(1) lookup
- `USER_ACTION_VERBS` includes additional verbs from the story TOML (Edit, Delete, Copy, Pin, Search, Browse, Arrange, Draw, Connect, Assign, Schedule) beyond what the design doc listed

### 2. Add experiential_names check to validateConvergenceQuality()
**File:** `convex/analysis/convergence/convergeAndTier.ts`
**What:** Insert a fourth check block after the `empty_fields` check (after line 205, before the "overall" computation at line 207).
**Details:**
```typescript
// Check experiential names: business verbs in moment names
const businessVerbMoments = result.value_moments.filter((m) => {
  const firstWord = m.name.split(/\s+/)[0]?.toLowerCase();
  return firstWord ? BUSINESS_VERBS.has(firstWord) : false;
});

let namesStatus: QualityStatus = "pass";
let namesMessage = "All moment names use experiential language";
if (businessVerbMoments.length > 0) {
  namesStatus = "warn";
  const examples = businessVerbMoments.slice(0, 3).map((m) => `"${m.name}"`).join(", ");
  const suffix = businessVerbMoments.length > 3 ? ` and ${businessVerbMoments.length - 3} more` : "";
  namesMessage = `${businessVerbMoments.length} moment(s) use business verbs: ${examples}${suffix}`;
}

checks.push({ name: "experiential_names", status: namesStatus, message: namesMessage });
```
- Extract first word, lowercase it, check against `BUSINESS_VERBS` set
- Never produces "fail" — only "warn" or "pass"
- Shows up to 3 example names in the message for actionability

### 3. Export new constants for testing
**File:** `convex/analysis/convergence/convergeAndTier.ts`
**What:** Add `BUSINESS_VERBS` and `USER_ACTION_VERBS` to the exports at line 466.
**Details:**
- Already exported via `export const` — no additional export line needed

### 4. Update test imports and add tests
**File:** `convex/analysis/convergence/convergeAndTier.test.ts`
**What:** Import the new constants and add 6 test cases to the `validateConvergenceQuality` describe block.
**Details:**

Import `BUSINESS_VERBS` and `USER_ACTION_VERBS` in the existing import statement (line 1-10).

Add tests after the existing `validateConvergenceQuality` tests (after line 695):

1. **"warns when moment name starts with business verb (Gain)"** — Create a result with one moment named "Gain visibility into workload", verify `experiential_names` check has status `"warn"` and message contains the name.

2. **"passes when moment name starts with user-action verb (View)"** — Create a result with all moments using user-action verbs like "View a heatmap of team workload", verify `experiential_names` check has status `"pass"`.

3. **"warns for Automate verb"** — Moment named "Automate protection of sensitive data" → `experiential_names` status is `"warn"`.

4. **"never produces fail status — only warn"** — Create a result where ALL moments use business verbs, verify `experiential_names` is `"warn"` (not `"fail"`).

5. **"shows up to 3 examples when multiple offenders"** — Create a result with 5 business-verb moments, verify message shows `"5 moment(s) use business verbs"` with 3 examples and `"and 2 more"`.

6. **Update existing "returns pass for a healthy result" test** — Change `expect(report.checks).toHaveLength(3)` to `toHaveLength(4)` since we now have 4 checks. The default `makeMoment` helper uses `name: "Moment ${id}"` which starts with "Moment" (not a business verb), so all should still pass.

## Testing
```bash
npm run test:run -- convex/analysis/convergence/convergeAndTier.test.ts
```
- All existing tests must continue passing
- The 5 new tests cover the acceptance criteria exactly
- The updated "healthy result" assertion confirms the new check integrates cleanly

## Notes
- The `makeMoment` helper already exists in the test file (line 439) — reuse it with custom `name` overrides for the new tests
- The `makeConvergenceResult` helper (line 537) also already exists — reuse it
- No changes to the `QualityCheck` or `QualityReport` types needed — the new check uses the same shape
- This depends on M007-E002-S001 (prompt rewrite) being complete first, but the validation code itself is independent and can be implemented now
