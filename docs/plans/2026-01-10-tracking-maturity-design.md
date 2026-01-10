# Tracking Maturity in Onboarding Design

## Overview

Add a tracking maturity questionnaire to the onboarding flow that captures the user's current analytics situation. This data enables personalized experiences throughout Basesignal based on the user's tracking sophistication and pain points.

## Problem Statement

New users have vastly different starting points - some have mature analytics setups, others are starting from scratch. Without understanding their context, we can't tailor the experience appropriately. A user with no tracking needs different guidance than one with broken tracking they're trying to fix.

## Proposed Solution

Add a single-screen questionnaire during Phase 1 of onboarding (after product context, before briefing) that collects:
1. Current tracking status (fully set up / partial / minimal / none)
2. Biggest tracking challenge (what to track / inconsistent / no outcomes / trust / other)
3. Analytics tools currently in use (multi-select)

All questions required, completable in <60 seconds.

---

## Design Details

### Data Model

**Add to `users` table in `convex/schema.ts`:**

```typescript
// Tracking Maturity (collected during onboarding)
trackingStatus: v.optional(v.string()),
trackingPainPoint: v.optional(v.string()),
trackingPainPointOther: v.optional(v.string()),
analyticsTools: v.optional(v.array(v.string())),
```

**Field Values:**

`trackingStatus`:
| Value | Display Label |
|-------|---------------|
| `"full"` | "Yes, fully implemented" |
| `"partial"` | "Yes, but incomplete/messy" |
| `"minimal"` | "Just started / minimal" |
| `"none"` | "No, starting from scratch" |

`trackingPainPoint`:
| Value | Display Label |
|-------|---------------|
| `"what_to_track"` | "I don't know what to track" |
| `"inconsistent"` | "My tracking is inconsistent/broken" |
| `"no_outcomes"` | "I have data but can't connect it to business outcomes" |
| `"trust"` | "Stakeholders don't trust the data" |
| `"other"` | "Other" (shows text input) |

`analyticsTools` (array, multi-select):
| Value | Display Label |
|-------|---------------|
| `"amplitude"` | "Amplitude" |
| `"mixpanel"` | "Mixpanel" |
| `"ga4"` | "Google Analytics 4" |
| `"heap"` | "Heap" |
| `"posthog"` | "PostHog" |
| `"segment"` | "Segment" |
| `"rudderstack"` | "Rudderstack" |
| `"snowplow"` | "Snowplow" |
| `"custom"` | "Custom / In-house" |
| `"none"` | "None" |

---

### UI Component

**New file:** `src/components/onboarding/screens/TrackingMaturityScreen.tsx`

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Tell us about your current tracking                    │
│  ───────────────────────────────────────────────────    │
│                                                         │
│  Do you have a tracking setup?                          │
│  [Button grid - 2x2, single select]                     │
│                                                         │
│  What's your biggest tracking challenge?                │
│  [Radio list with "Other" text input option]            │
│                                                         │
│  What analytics tools do you use? (select all)          │
│  [Chip/button grid - multi-select]                      │
│                                                         │
│                              [Back]  [Continue →]       │
└─────────────────────────────────────────────────────────┘
```

**Validation:**
- All three sections required
- If pain point is "other", text input required
- At least one tool must be selected (can be "none")
- Continue button disabled until all valid

**Component Props:**
```typescript
interface TrackingMaturityScreenProps {
  initialData?: {
    trackingStatus?: string;
    trackingPainPoint?: string;
    trackingPainPointOther?: string;
    analyticsTools?: string[];
  };
  onNext: (data: TrackingMaturityData) => void;
  onBack: () => void;
}
```

---

### Flow Integration

**Update Phase 1 sequence in `SetupOnboardingPage.tsx`:**

```
Current:   Philosophy → Context → Briefing
New:       Philosophy → Context → TrackingMaturity → Briefing
```

**Step management:**
- Keep 3 visible progress dots (TrackingMaturity is sub-step of "Context" phase)
- Internal step tracking: `philosophy` → `context` → `tracking` → `briefing`

**Data persistence:**
- On TrackingMaturity "Continue", call `users.updateTrackingMaturity` mutation
- Mutation updates user record with the 4 fields
- Data persisted before proceeding to Briefing

**Back button:**
- From TrackingMaturity → Context (preserves Context answers)
- From Briefing → TrackingMaturity (preserves TrackingMaturity answers)

---

### Backend Mutation

**New mutation in `convex/users.ts`:**

```typescript
export const updateTrackingMaturity = mutation({
  args: {
    trackingStatus: v.string(),
    trackingPainPoint: v.string(),
    trackingPainPointOther: v.optional(v.string()),
    analyticsTools: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    await ctx.db.patch(user._id, {
      trackingStatus: args.trackingStatus,
      trackingPainPoint: args.trackingPainPoint,
      trackingPainPointOther: args.trackingPainPointOther,
      analyticsTools: args.analyticsTools,
    });
  },
});
```

---

### Personalization

**Helper hook:** `src/hooks/useTrackingMaturity.ts`

```typescript
export function useTrackingMaturity() {
  const user = useQuery(api.users.current);

  return {
    trackingStatus: user?.trackingStatus,
    trackingPainPoint: user?.trackingPainPoint,
    analyticsTools: user?.analyticsTools ?? [],
    isStartingFresh: user?.trackingStatus === "none",
    hasExistingSetup: user?.trackingStatus === "full" || user?.trackingStatus === "partial",
    primaryTool: user?.analyticsTools?.[0],
  };
}
```

**During Setup (Phase 2-3):**

| Context | Personalization |
|---------|-----------------|
| Interview (starting fresh) | AI acknowledges "since you're building from scratch..." |
| Interview (has setup) | AI asks about current implementation to compare |
| Review page (no outcomes pain) | Highlight how metrics connect to business outcomes |

**Post-Setup:**

| Context | Personalization |
|---------|-----------------|
| Measurement Plan empty state | Tailor messaging based on trackingStatus |
| Settings/Integrations | Prioritize user's selected tools |
| Tips/guidance | Address specific pain point |

**Initial personalization points (v1):**
1. Interview system prompt includes tracking context
2. Review page messaging varies by status
3. Home page tips based on pain point

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/components/onboarding/screens/TrackingMaturityScreen.tsx` | Questionnaire UI |
| `src/hooks/useTrackingMaturity.ts` | Helper hook for personalization |

### Modified Files

| File | Changes |
|------|---------|
| `convex/schema.ts` | Add 4 fields to users table |
| `convex/users.ts` | Add `updateTrackingMaturity` mutation |
| `src/routes/SetupOnboardingPage.tsx` | Add TrackingMaturity step to flow |
| `convex/ai.ts` | Include tracking context in interview prompts (optional v1) |

---

## Alternatives Considered

### Placement after interview
- **Rejected**: Loses opportunity to personalize the interview itself
- Context collection should happen before the AI interview starts

### Separate assessment table
- **Rejected**: Overengineered for 4 fields
- User table is the right place for profile data

### Skip option
- **Rejected**: <60 seconds to complete, data valuable for personalization
- Required fields ensure we always have context

---

## Success Criteria

1. All new users complete tracking maturity questions during onboarding
2. Data stored in user profile and queryable
3. At least one personalization point uses the data (interview or review page)
4. Flow completes in <60 seconds for this screen
5. No increase in onboarding drop-off rate

---

## Future Enhancements

- Tool-specific integration guides based on `analyticsTools`
- Maturity score calculation for analytics
- Re-assessment option in Settings to update answers
- A/B test different personalization strategies based on maturity
