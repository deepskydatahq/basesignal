# Onboarding Copy & Layout Tweaks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update onboarding copy and add website URL field to improve clarity and urgency.

**Architecture:** Simple copy changes across 3 components + new optional field in schema/mutation. Changes are isolated to onboarding screens with no external dependencies.

**Tech Stack:** React, Convex, Vitest/RTL

---

## Summary of Changes

| Location | Current | Change to |
|----------|---------|-----------|
| PhilosophyScreen | "Tracking plans focus on interactions" | "Typical tracking plans focus on interactions" |
| PhilosophyScreen | No divider | Add divider between problem and shift sections |
| ContextScreen | Only product name field | Add website URL field |
| BriefingScreen/SetupBriefingScreen | "What you'll need" | "What you'll need now" |
| BriefingScreen/SetupBriefingScreen | "What you'll walk away with" | "What you'll walk away with after 15m" |

---

### Task 1: Update PhilosophyScreen copy and add divider

**Files:**
- Modify: `src/components/onboarding/screens/PhilosophyScreen.tsx:13,18`
- Test: `src/components/onboarding/screens/PhilosophyScreen.test.tsx`

**Step 1: Update the test to expect new copy**

Change the test assertion from:
```typescript
expect(
  screen.getByText(/tracking plans focus on interactions/i)
).toBeInTheDocument();
```

To:
```typescript
expect(
  screen.getByText(/typical tracking plans focus on interactions/i)
).toBeInTheDocument();
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/onboarding/screens/PhilosophyScreen.test.tsx`
Expected: FAIL - text not found

**Step 3: Update PhilosophyScreen copy**

Change line 13 from:
```tsx
<h1 className="text-xl font-medium">
  Tracking plans focus on interactions
</h1>
```

To:
```tsx
<h1 className="text-xl font-medium">
  Typical tracking plans focus on interactions
</h1>
```

**Step 4: Add divider after the code snippet section**

After line 26 (the closing `</div>` for the code snippet mockup), add:
```tsx
{/* Divider */}
<div className="border-t border-gray-200" />
```

**Step 5: Run test to verify it passes**

Run: `npm run test:run -- src/components/onboarding/screens/PhilosophyScreen.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add src/components/onboarding/screens/PhilosophyScreen.tsx src/components/onboarding/screens/PhilosophyScreen.test.tsx
git commit -m "feat: update philosophy screen copy and add divider"
```

---

### Task 2: Add websiteUrl field to schema and mutation

**Files:**
- Modify: `convex/schema.ts:24` (add after productName)
- Modify: `convex/users.ts:66-73,139-148` (updateOnboarding and resetOnboarding args)

**Step 1: Add websiteUrl to users schema**

After line 24 (`productName: v.optional(v.string()),`), add:
```typescript
websiteUrl: v.optional(v.string()),
```

**Step 2: Add websiteUrl to updateOnboarding mutation args**

After `productName: v.optional(v.string()),` in the args (line 66), add:
```typescript
websiteUrl: v.optional(v.string()),
```

**Step 3: Add websiteUrl to resetOnboarding mutation**

In the `resetOnboarding` handler, add to the patch object:
```typescript
websiteUrl: undefined,
```

**Step 4: Run Convex dev to verify schema syncs**

Run: `npx convex dev --once`
Expected: Schema syncs without errors

**Step 5: Commit**

```bash
git add convex/schema.ts convex/users.ts
git commit -m "feat: add websiteUrl field to user schema and mutations"
```

---

### Task 3: Add website URL input to ContextScreen

**Files:**
- Modify: `src/components/onboarding/screens/ContextScreen.tsx:8,39,52,64-65,88-95`
- Modify: `src/routes/SetupOnboardingPage.tsx:13,27,39`

**Step 1: Update ContextData interface in ContextScreen**

Add after `productName: string;`:
```typescript
websiteUrl: string;
```

**Step 2: Add websiteUrl state**

After line 39 (`const [productName, setProductName] = useState("");`), add:
```typescript
const [websiteUrl, setWebsiteUrl] = useState("");
```

**Step 3: Update handleContinue to include websiteUrl**

Update the `onNext` call (around line 64-65):
```typescript
onNext({
  productName: productName.trim(),
  websiteUrl: websiteUrl.trim(),
  role,
  hasMultiUserAccounts,
  businessType: hasMultiUserAccounts ? undefined : businessType,
  revenueModels,
});
```

**Step 4: Add website URL input field after product name**

After the product name input section (after line 95), add:
```tsx
{/* Question 1b: Website URL */}
<div
  className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
  style={{ animationDelay: "50ms", animationFillMode: "backwards" }}
>
  <Label htmlFor="websiteUrl">What's your website? (optional)</Label>
  <Input
    id="websiteUrl"
    placeholder="e.g., acme.com"
    value={websiteUrl}
    onChange={(e) => setWebsiteUrl(e.target.value)}
  />
</div>
```

**Step 5: Adjust animation delays for subsequent questions**

Update the animation delays:
- Role: change from `75ms` to `100ms`
- Multi-user: change from `150ms` to `175ms`
- B2C/B2B: change from `225ms` to `250ms`
- Revenue: change from `300ms` to `325ms`

**Step 6: Update SetupOnboardingPage ContextData interface**

In the ContextData interface (around line 11-17), add after `productName: string;`:
```typescript
websiteUrl: string;
```

**Step 7: Update SetupOnboardingPage initial state**

In the useState (around line 27), add after `productName: "",`:
```typescript
websiteUrl: "",
```

**Step 8: Update SetupOnboardingPage handleContextSubmit**

Add `websiteUrl` to the updateOnboarding call (around line 39):
```typescript
await updateOnboarding({
  productName: data.productName,
  websiteUrl: data.websiteUrl,
  role: data.role,
  // ... rest
});
```

**Step 9: Verify the app runs**

Run: `npm run dev` and navigate through onboarding
Expected: New website field appears, form submits correctly

**Step 10: Commit**

```bash
git add src/components/onboarding/screens/ContextScreen.tsx src/routes/SetupOnboardingPage.tsx
git commit -m "feat: add website URL input to onboarding context"
```

---

### Task 4: Update BriefingScreen copy

**Files:**
- Modify: `src/components/onboarding/screens/BriefingScreen.tsx:29,58`
- Modify: `src/components/onboarding/screens/BriefingScreen.test.tsx`

**Step 1: Update test expectations (no change needed)**

The existing tests don't assert on the exact header text, so no test changes needed for this task.

**Step 2: Update "What you'll need" header**

Change line 29 from:
```tsx
<h2 className="text-sm font-medium text-gray-700">What you'll need</h2>
```

To:
```tsx
<h2 className="text-sm font-medium text-gray-700">What you'll need now</h2>
```

**Step 3: Update "What you'll walk away with" header**

Change line 58 from:
```tsx
<h2 className="text-sm font-medium text-gray-700">What you'll walk away with</h2>
```

To:
```tsx
<h2 className="text-sm font-medium text-gray-700">What you'll walk away with after 15m</h2>
```

**Step 4: Run tests to verify nothing broke**

Run: `npm run test:run -- src/components/onboarding/screens/BriefingScreen.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/onboarding/screens/BriefingScreen.tsx
git commit -m "feat: update briefing screen copy for urgency"
```

---

### Task 5: Update SetupBriefingScreen copy (in SetupOnboardingPage)

**Files:**
- Modify: `src/routes/SetupOnboardingPage.tsx:100,129`

**Step 1: Update "What you'll need" header**

Change line 100 from:
```tsx
<h2 className="text-sm font-medium text-gray-700">What you'll need</h2>
```

To:
```tsx
<h2 className="text-sm font-medium text-gray-700">What you'll need now</h2>
```

**Step 2: Update "What you'll walk away with" header**

Change line 129 from:
```tsx
<h2 className="text-sm font-medium text-gray-700">What you'll walk away with</h2>
```

To:
```tsx
<h2 className="text-sm font-medium text-gray-700">What you'll walk away with after 15m</h2>
```

**Step 3: Run full test suite**

Run: `npm run test:run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/routes/SetupOnboardingPage.tsx
git commit -m "feat: update setup briefing copy for urgency"
```

---

### Task 6: Final verification

**Step 1: Run linting**

Run: `npm run lint`
Expected: No errors

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run all tests**

Run: `npm run test:run`
Expected: All tests pass

**Step 4: Manual verification**

Run `npm run dev` and walk through the onboarding flow:
1. PhilosophyScreen shows "Typical tracking plans..." with divider
2. ContextScreen has website URL field
3. BriefingScreen shows "What you'll need now" and "What you'll walk away with after 15m"

**Step 5: Final commit if any cleanup needed**

If everything passes, the implementation is complete.
