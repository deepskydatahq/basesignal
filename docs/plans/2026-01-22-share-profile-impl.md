# Share Profile Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Share button to ProfilePage that generates a permanent, copyable link for read-only profile viewing without authentication.

**Architecture:** Add `shareToken` field to users table with index, create mutation to generate tokens on-demand, add public query for token lookup, add `/p/:shareToken` route before auth guard, extend ProfilePage with `readOnly` prop that conditionally queries and hides edit actions.

**Tech Stack:** Convex (schema, queries, mutations), React Router, React (useState, useParams), convex-test for backend tests, RTL for component tests.

---

## Task 1: Add shareToken field to schema

**Files:**
- Modify: `convex/schema.ts:12-52` (users table definition)

**Step 1: Add shareToken field and index**

In `convex/schema.ts`, add to the users table definition (after line 48, before `createdAt`):

```typescript
    // Share profile
    shareToken: v.optional(v.string()),
```

And add the index (after line 52):

```typescript
    .index("by_share_token", ["shareToken"]),
```

The users table should now have indexes:
```typescript
  })
    .index("by_clerk_id", ["clerkId"])
    .index("email", ["email"])
    .index("by_share_token", ["shareToken"]),
```

**Step 2: Verify schema compiles**

Run: `npx convex dev --once`
Expected: Schema validated successfully

**Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "$(cat <<'EOF'
feat: add shareToken field and index to users schema

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add getOrCreateShareToken mutation

**Files:**
- Modify: `convex/profile.ts` (add mutation after line 160)
- Test: `convex/profile.test.ts` (create new test file)

**Step 1: Write the failing test**

Create `convex/profile.test.ts`:

```typescript
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

// Helper to create authenticated user
async function setupUser(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: "test-user",
      email: "test@example.com",
      productName: "Test Product",
      createdAt: Date.now(),
    });
  });

  const asUser = t.withIdentity({
    subject: "test-user",
    issuer: "https://clerk.test",
    tokenIdentifier: "https://clerk.test|test-user",
  });

  return { userId, asUser };
}

describe("profile", () => {
  describe("getOrCreateShareToken", () => {
    it("creates a new share token for user without one", async () => {
      const t = convexTest(schema);
      const { asUser, userId } = await setupUser(t);

      const token = await asUser.mutation(api.profile.getOrCreateShareToken, {});

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.length).toBe(12);

      // Verify token is saved to user
      const user = await t.run(async (ctx) => {
        return await ctx.db.get(userId);
      });
      expect(user?.shareToken).toBe(token);
    });

    it("returns existing share token without creating new one", async () => {
      const t = convexTest(schema);
      const { asUser, userId } = await setupUser(t);

      // Set existing token
      await t.run(async (ctx) => {
        await ctx.db.patch(userId, { shareToken: "existingtoken" });
      });

      const token = await asUser.mutation(api.profile.getOrCreateShareToken, {});

      expect(token).toBe("existingtoken");
    });

    it("throws error for unauthenticated user", async () => {
      const t = convexTest(schema);

      await expect(
        t.mutation(api.profile.getOrCreateShareToken, {})
      ).rejects.toThrow("Not authenticated");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/profile.test.ts`
Expected: FAIL - api.profile.getOrCreateShareToken is not defined

**Step 3: Write minimal implementation**

In `convex/profile.ts`, add imports at top:

```typescript
import { query, mutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
```

Add helper for mutations (after `getCurrentUser` function, around line 15):

```typescript
async function getCurrentUserMut(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  return user;
}
```

Add mutation at end of file (after `getProfileData`):

```typescript
export const getOrCreateShareToken = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserMut(ctx);
    if (!user) throw new Error("Not authenticated");

    if (user.shareToken) {
      return user.shareToken;
    }

    const shareToken = crypto.randomUUID().slice(0, 12);
    await ctx.db.patch(user._id, { shareToken });
    return shareToken;
  },
});
```

**Step 4: Run test to verify it passes**

Run: `npm test -- convex/profile.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/profile.ts convex/profile.test.ts
git commit -m "$(cat <<'EOF'
feat: add getOrCreateShareToken mutation

Creates a 12-character share token on first request, returns existing token on subsequent calls.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add getProfileByShareToken query

**Files:**
- Modify: `convex/profile.ts` (add query after getOrCreateShareToken)
- Test: `convex/profile.test.ts` (add test cases)

**Step 1: Write the failing test**

Add to `convex/profile.test.ts` inside the `describe("profile")` block:

```typescript
  describe("getProfileByShareToken", () => {
    it("returns profile data for valid share token", async () => {
      const t = convexTest(schema);
      const { userId } = await setupUser(t);

      // Set share token
      await t.run(async (ctx) => {
        await ctx.db.patch(userId, { shareToken: "validtoken12" });
      });

      // Query without auth (public)
      const profile = await t.query(api.profile.getProfileByShareToken, {
        shareToken: "validtoken12",
      });

      expect(profile).not.toBeNull();
      expect(profile?.identity.productName).toBe("Test Product");
    });

    it("returns null for invalid share token", async () => {
      const t = convexTest(schema);

      const profile = await t.query(api.profile.getProfileByShareToken, {
        shareToken: "nonexistent",
      });

      expect(profile).toBeNull();
    });

    it("includes completeness data", async () => {
      const t = convexTest(schema);
      const { userId } = await setupUser(t);

      await t.run(async (ctx) => {
        await ctx.db.patch(userId, { shareToken: "tokentest12" });
      });

      const profile = await t.query(api.profile.getProfileByShareToken, {
        shareToken: "tokentest12",
      });

      expect(profile?.completeness).toBeDefined();
      expect(profile?.completeness.sections).toBeDefined();
      expect(profile?.completeness.percentage).toBeGreaterThanOrEqual(0);
    });
  });
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/profile.test.ts`
Expected: FAIL - api.profile.getProfileByShareToken is not defined

**Step 3: Write minimal implementation**

Add to `convex/profile.ts` after `getOrCreateShareToken`:

```typescript
export const getProfileByShareToken = query({
  args: { shareToken: v.string() },
  handler: async (ctx, { shareToken }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_share_token", (q) => q.eq("shareToken", shareToken))
      .first();

    if (!user) return null;

    // Get overview journey
    const overviewJourney = await ctx.db
      .query("journeys")
      .withIndex("by_user_and_type", (q) =>
        q.eq("userId", user._id).eq("type", "overview")
      )
      .first();

    // Get stages from overview journey
    const stages = overviewJourney
      ? await ctx.db
          .query("stages")
          .withIndex("by_journey", (q) => q.eq("journeyId", overviewJourney._id))
          .collect()
      : [];

    // Get first value definition
    const firstValue = await ctx.db
      .query("firstValueDefinitions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    // Get metrics
    const metrics = await ctx.db
      .query("metrics")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Get measurement entities
    const entities = await ctx.db
      .query("measurementEntities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Get activity count
    const activities = await ctx.db
      .query("measurementActivities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Get property count
    const properties = await ctx.db
      .query("measurementProperties")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Calculate completeness
    const completeness = calculateCompleteness({
      identity: user,
      stages,
      firstValue,
      metrics,
      entities,
    });

    return {
      identity: {
        productName: user.productName,
        websiteUrl: user.websiteUrl,
        hasMultiUserAccounts: user.hasMultiUserAccounts,
        businessType: user.businessType,
        revenueModels: user.revenueModels,
      },
      journeyMap: {
        stages,
        journeyId: overviewJourney?._id ?? null,
      },
      firstValue,
      metricCatalog: {
        metrics: groupBy(metrics, "category"),
        totalCount: metrics.length,
      },
      measurementPlan: {
        entities,
        activityCount: activities.length,
        propertyCount: properties.length,
      },
      completeness,
    };
  },
});
```

Add import for validator at top of file:

```typescript
import { v } from "convex/values";
```

**Step 4: Run test to verify it passes**

Run: `npm test -- convex/profile.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/profile.ts convex/profile.test.ts
git commit -m "$(cat <<'EOF'
feat: add getProfileByShareToken public query

Returns same profile shape as getProfileData but looks up by share token without auth.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add public route for shared profiles

**Files:**
- Modify: `src/App.tsx:1-156` (add public route before auth guard)

**Step 1: Add SharedProfileRoute component and public route handling**

In `src/App.tsx`, add import at top:

```typescript
import { useParams } from 'react-router-dom'
```

Add new component before `AppRoutes` function (around line 29):

```typescript
function SharedProfileRoute() {
  const { shareToken } = useParams<{ shareToken: string }>();
  if (!shareToken) return <Navigate to="/" replace />;
  return <ProfilePage readOnly shareToken={shareToken} />;
}
```

Modify `App` function to handle public routes before auth:

```typescript
function App() {
  const pathname = window.location.pathname;

  // Public share route - bypass auth entirely
  if (pathname.startsWith('/p/')) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/p/:shareToken" element={<SharedProfileRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
```

**Step 2: Verify it compiles**

Run: `npm run build`
Expected: Build succeeds (will have type error about ProfilePage props - expected until Task 5)

Note: If type error about `readOnly` prop, this is expected. We'll fix in Task 5.

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "$(cat <<'EOF'
feat: add public /p/:shareToken route for shared profiles

Bypasses auth guard by checking pathname before BrowserRouter renders.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add readOnly mode to ProfilePage

**Files:**
- Modify: `src/components/profile/ProfilePage.tsx:1-102`

**Step 1: Update ProfilePage to accept props and handle both modes**

Replace the entire `ProfilePage.tsx` with:

```typescript
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Navigate } from "react-router-dom";
import { Share2, Check } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { CoreIdentitySection } from "./CoreIdentitySection";
import { FirstValueSection } from "./FirstValueSection";
import { MetricCatalogSection } from "./MetricCatalogSection";
import { MeasurementPlanSection } from "./MeasurementPlanSection";
import { JourneyMapSection } from "./JourneyMapSection";
import { SuggestedNextAction } from "./SuggestedNextAction";
import { ProfileHeader } from "./ProfileHeader";
import { Button } from "@/components/ui/button";

interface ProfilePageProps {
  readOnly?: boolean;
  shareToken?: string;
}

export function ProfilePage({ readOnly = false, shareToken }: ProfilePageProps) {
  const [copied, setCopied] = useState(false);

  // Use appropriate query based on mode
  const profileData = readOnly && shareToken
    ? useQuery(api.profile.getProfileByShareToken, { shareToken })
    : useQuery(api.profile.getProfileData);

  const measurementPlan = readOnly ? null : useQuery(api.measurementPlan.getFullPlan);
  const getOrCreateToken = useMutation(api.profile.getOrCreateShareToken);

  const handleShare = async () => {
    const token = await getOrCreateToken();
    const url = `${window.location.origin}/p/${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Loading state
  if (profileData === undefined) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="animate-pulse text-gray-500">Loading profile...</div>
      </div>
    );
  }

  // Not found (invalid share token) or not authenticated
  if (profileData === null) {
    if (readOnly) {
      return (
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-900">Profile not found</h2>
            <p className="text-gray-600 mt-2">This shared profile link may be invalid or expired.</p>
          </div>
        </div>
      );
    }
    return <Navigate to="/sign-in" />;
  }

  // Flatten metrics from grouped structure
  const flatMetrics = Object.values(profileData.metricCatalog.metrics)
    .flat()
    .map((m) => ({
      _id: m._id,
      name: m.name,
      category: m.category,
    }));

  // Compute next section to suggest (only for owner view)
  const sections = profileData.completeness.sections.slice(0, 5);
  const completedIds = sections.filter((s) => s.complete).map((s) => s.id);
  const navigableSections = [
    "journey_map",
    "metric_catalog",
    "measurement_plan",
  ] as const;
  const nextSection = readOnly
    ? null
    : navigableSections.find((id) => !completedIds.includes(id)) ?? null;
  const lastCompleted =
    completedIds.length > 0 ? completedIds[completedIds.length - 1] : null;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Read-only banner */}
      {readOnly && (
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
          <p className="text-sm text-gray-600">
            Viewing shared profile for <span className="font-medium text-gray-900">{profileData.identity.productName || "this product"}</span>
          </p>
        </div>
      )}

      <ProfileHeader
        identity={{
          ...profileData.identity,
          businessType: profileData.identity.businessType as "b2b" | "b2c" | undefined,
        }}
        completeness={profileData.completeness}
        stats={{
          metricsCount: profileData.metricCatalog.totalCount,
          entitiesCount: profileData.measurementPlan.entities.length,
          activitiesCount: profileData.measurementPlan.activityCount,
        }}
      />

      {/* Share button - owner only */}
      {!readOnly && (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="text-gray-600"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-1.5" />
                Link copied!
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 mr-1.5" />
                Share profile
              </>
            )}
          </Button>
        </div>
      )}

      <div className="space-y-6 mt-6">
        <CoreIdentitySection data={profileData.identity} readOnly={readOnly} />

        {nextSection === "journey_map" && (
          <SuggestedNextAction
            nextSection={nextSection}
            lastCompleted={lastCompleted}
          />
        )}

        <JourneyMapSection journeyId={profileData.journeyMap.journeyId} readOnly={readOnly} />

        {nextSection === "metric_catalog" && (
          <SuggestedNextAction
            nextSection={nextSection}
            lastCompleted={lastCompleted}
          />
        )}

        <FirstValueSection readOnly={readOnly} />

        <MetricCatalogSection metrics={flatMetrics} readOnly={readOnly} />

        {nextSection === "measurement_plan" && (
          <SuggestedNextAction
            nextSection={nextSection}
            lastCompleted={lastCompleted}
          />
        )}

        <MeasurementPlanSection plan={measurementPlan ?? []} readOnly={readOnly} />
      </div>
    </div>
  );
}
```

**Step 2: Verify changes compile**

Run: `npm run build`
Expected: Type errors about readOnly prop on section components (expected until Task 6)

**Step 3: Commit**

```bash
git add src/components/profile/ProfilePage.tsx
git commit -m "$(cat <<'EOF'
feat: add readOnly mode and share button to ProfilePage

- Accepts readOnly and shareToken props
- Conditionally queries by token or auth
- Shows share button with copy feedback for owners
- Shows read-only banner for shared views

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add readOnly prop to CoreIdentitySection

**Files:**
- Modify: `src/components/profile/CoreIdentitySection.tsx:19-21,79,284-285`

**Step 1: Update interface and conditionally hide edit button**

In `CoreIdentitySection.tsx`, update the interface (around line 19):

```typescript
interface CoreIdentitySectionProps {
  data: CoreIdentityData;
  readOnly?: boolean;
}
```

Update the function signature (line 79):

```typescript
export function CoreIdentitySection({ data, readOnly = false }: CoreIdentitySectionProps) {
```

In the return statement for the non-editing view (around line 280-286), conditionally pass `actionLabel` and `onAction`:

```typescript
  return (
    <ProfileSection
      title="Core Identity"
      status={isComplete ? "complete" : "not_started"}
      statusLabel={isComplete ? "Complete" : "Not Started"}
      actionLabel={readOnly ? undefined : "Edit"}
      onAction={readOnly ? undefined : () => setIsEditing(true)}
    >
```

**Step 2: Verify changes compile**

Run: `npm run build`
Expected: Build succeeds (may have warnings about other sections)

**Step 3: Commit**

```bash
git add src/components/profile/CoreIdentitySection.tsx
git commit -m "$(cat <<'EOF'
feat: add readOnly prop to CoreIdentitySection

Hides Edit button when viewing shared profile.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Add readOnly prop to FirstValueSection

**Files:**
- Modify: `src/components/profile/FirstValueSection.tsx`

**Step 1: Update interface and conditionally hide edit button**

First read the file to find the exact interface location, then:

Update the interface to add `readOnly?: boolean`:

```typescript
interface FirstValueSectionProps {
  readOnly?: boolean;
}
```

Update the function signature:

```typescript
export function FirstValueSection({ readOnly = false }: FirstValueSectionProps) {
```

Find where `actionLabel` and `onAction` are passed to `ProfileSection` and make them conditional:

```typescript
      actionLabel={readOnly ? undefined : "Edit"}
      onAction={readOnly ? undefined : () => setIsEditing(true)}
```

**Step 2: Verify changes compile**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/profile/FirstValueSection.tsx
git commit -m "$(cat <<'EOF'
feat: add readOnly prop to FirstValueSection

Hides Edit button when viewing shared profile.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Add readOnly prop to MetricCatalogSection

**Files:**
- Modify: `src/components/profile/MetricCatalogSection.tsx`

**Step 1: Update interface and conditionally hide action**

Update the interface:

```typescript
interface MetricCatalogSectionProps {
  metrics: Array<{
    _id: string;
    name: string;
    category: string;
  }>;
  readOnly?: boolean;
}
```

Update function signature:

```typescript
export function MetricCatalogSection({ metrics, readOnly = false }: MetricCatalogSectionProps) {
```

Find where `actionLabel` and `onAction` are passed to `ProfileSection` and make them conditional:

```typescript
      actionLabel={readOnly ? undefined : "View Full Catalog"}
      onAction={readOnly ? undefined : () => navigate("/metric-catalog")}
```

**Step 2: Verify changes compile**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/profile/MetricCatalogSection.tsx
git commit -m "$(cat <<'EOF'
feat: add readOnly prop to MetricCatalogSection

Hides View Full Catalog button when viewing shared profile.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Add readOnly prop to MeasurementPlanSection

**Files:**
- Modify: `src/components/profile/MeasurementPlanSection.tsx`

**Step 1: Update interface and conditionally hide action**

Update the interface to add `readOnly?: boolean`.

Update function signature to destructure `readOnly = false`.

Find where `actionLabel` and `onAction` are passed to `ProfileSection` and make them conditional:

```typescript
      actionLabel={readOnly ? undefined : "View Full Plan"}
      onAction={readOnly ? undefined : () => navigate("/measurement-plan")}
```

**Step 2: Verify changes compile**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/profile/MeasurementPlanSection.tsx
git commit -m "$(cat <<'EOF'
feat: add readOnly prop to MeasurementPlanSection

Hides View Full Plan button when viewing shared profile.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Add readOnly prop to JourneyMapSection

**Files:**
- Modify: `src/components/profile/JourneyMapSection.tsx`

**Step 1: Update interface and conditionally hide action**

Update the interface to add `readOnly?: boolean`.

Update function signature to destructure `readOnly = false`.

Find where `actionLabel` and `onAction` are passed to `ProfileSection` and make them conditional:

```typescript
      actionLabel={readOnly ? undefined : "Edit Journey"}
      onAction={readOnly ? undefined : () => journeyId && navigate(`/journeys/${journeyId}`)}
```

**Step 2: Verify changes compile**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/profile/JourneyMapSection.tsx
git commit -m "$(cat <<'EOF'
feat: add readOnly prop to JourneyMapSection

Hides Edit Journey button when viewing shared profile.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Final verification and integration test

**Files:**
- All modified files

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Manual verification checklist**

Start dev server: `npm run dev` (in one terminal) and `npx convex dev` (in another)

Verify:
- [ ] Authenticated user sees Share button on ProfilePage
- [ ] Clicking Share button copies link and shows "Link copied!" feedback
- [ ] Opening `/p/{token}` in incognito shows read-only profile
- [ ] Read-only view shows banner with product name
- [ ] Read-only view hides all edit buttons
- [ ] Invalid token shows "Profile not found" message

**Step 4: Final commit**

If any fixes needed, commit them. Otherwise:

```bash
git status
# Should show nothing to commit if all tasks completed
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add shareToken field to schema | `convex/schema.ts` |
| 2 | Add getOrCreateShareToken mutation | `convex/profile.ts`, `convex/profile.test.ts` |
| 3 | Add getProfileByShareToken query | `convex/profile.ts`, `convex/profile.test.ts` |
| 4 | Add public route for shared profiles | `src/App.tsx` |
| 5 | Add readOnly mode to ProfilePage | `src/components/profile/ProfilePage.tsx` |
| 6 | Add readOnly prop to CoreIdentitySection | `src/components/profile/CoreIdentitySection.tsx` |
| 7 | Add readOnly prop to FirstValueSection | `src/components/profile/FirstValueSection.tsx` |
| 8 | Add readOnly prop to MetricCatalogSection | `src/components/profile/MetricCatalogSection.tsx` |
| 9 | Add readOnly prop to MeasurementPlanSection | `src/components/profile/MeasurementPlanSection.tsx` |
| 10 | Add readOnly prop to JourneyMapSection | `src/components/profile/JourneyMapSection.tsx` |
| 11 | Final verification and integration test | All files |

**Total: 11 TDD tasks**
