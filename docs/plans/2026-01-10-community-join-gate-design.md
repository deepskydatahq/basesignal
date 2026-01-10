# Mandatory Community Join (Setup Gate) Design

## Overview

Add a mandatory community join step to the setup flow that requires users to join the Discord community before starting the AI interview. Supports two verification modes (honor system and magic code) configurable via Convex environment variable, with an email fallback escape hatch.

## Problem Statement

At launch, direct user feedback is essential. The product is complex and we need to see where people get stuck. A mandatory community join ensures early users are connected for support and feedback, while the async nature respects solo founder bandwidth.

## Proposed Solution

Insert a "Community Join" gate after the Briefing step, before the Interview begins. Users must either:
1. **Honor mode**: Check a box confirming they joined
2. **Magic code mode**: Enter a code from a pinned Discord message

An email fallback allows users who are stuck to proceed by emailing support.

---

## Design Details

### Data Model

**Add to `users` table in `convex/schema.ts`:**

```typescript
communityJoined: v.optional(v.boolean()),
communityJoinedAt: v.optional(v.number()),
communityJoinMethod: v.optional(v.string()), // "honor" | "magic_code" | "email_fallback"
```

**Add to `setupProgress` table:**

```typescript
communityJoinStatus: v.optional(v.string()), // "pending" | "verified" | "skipped_email"
```

**Convex environment variables:**

| Variable | Values | Description |
|----------|--------|-------------|
| `COMMUNITY_VERIFICATION_MODE` | `"honor"` \| `"magic_code"` | Which verification to show |
| `COMMUNITY_MAGIC_CODE` | e.g., `"BASESIGNAL2026"` | Code to match (only used in magic_code mode) |
| `COMMUNITY_DISCORD_INVITE` | e.g., `"https://discord.gg/xyz"` | Discord invite URL |

---

### UI Component

**New file:** `src/components/onboarding/screens/CommunityJoinScreen.tsx`

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  Join our early adopter community                       │
│  ───────────────────────────────────────────────────    │
│                                                         │
│  Basesignal is launching and we're building this with   │
│  you. Before you continue, join our Discord – it's      │
│  where you'll get support, share feedback, and help     │
│  shape what we build next.                              │
│                                                         │
│  This isn't optional (yet). We're a small team and      │
│  your input is how we make this great.                  │
│                                                         │
│           [Join Discord button]                         │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  [HONOR MODE - checkbox]                                │
│  ☐ I've joined the Discord community                    │
│                                                         │
│  [MAGIC CODE MODE - input]                              │
│  Already joined? Enter the code from #welcome:          │
│  [code input field]                                     │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Having trouble? [Email us] to continue                 │
│                                                         │
│                              [Back]  [Continue →]       │
└─────────────────────────────────────────────────────────┘
```

**Component behavior:**

| Element | Behavior |
|---------|----------|
| Join Discord button | Opens invite URL in new tab |
| Checkbox (honor mode) | Enables Continue when checked |
| Code input (magic_code mode) | Validates on blur/submit, shows error if wrong |
| Continue button | Disabled until verified, calls verification mutation |
| Email us link | Opens mailto, marks as skipped_email, enables Continue |

**Props:**

```typescript
interface CommunityJoinScreenProps {
  onNext: () => void;
  onBack: () => void;
}
```

---

### Flow Integration

**Updated setup sequence:**

```
Philosophy → Context → TrackingMaturity → Briefing → CommunityJoin → Interview
```

**Step display:**
- CommunityJoin appears as interstitial gate (no progress dot)
- Or optionally as Step 4 if showing numbered progress

**Navigation:**
- Back → returns to Briefing
- Continue → proceeds to Interview (after verification)

---

### Backend Implementation

**New file:** `convex/communityJoin.ts`

```typescript
// Query: Get verification config
export const getConfig = query({
  handler: async (ctx) => {
    const mode = process.env.COMMUNITY_VERIFICATION_MODE || "honor";
    const discordInvite = process.env.COMMUNITY_DISCORD_INVITE || "";
    return { mode, discordInvite };
  },
});

// Mutation: Verify community join
export const verify = mutation({
  args: {
    method: v.string(), // "honor" | "magic_code" | "email_fallback"
    code: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Validate magic code if applicable
    if (args.method === "magic_code") {
      const expectedCode = process.env.COMMUNITY_MAGIC_CODE;
      if (args.code !== expectedCode) {
        throw new Error("Invalid code");
      }
    }

    // Update user record
    await ctx.db.patch(user._id, {
      communityJoined: args.method !== "email_fallback",
      communityJoinedAt: Date.now(),
      communityJoinMethod: args.method,
    });

    // Update setup progress
    const progress = await getSetupProgress(ctx, user._id);
    if (progress) {
      await ctx.db.patch(progress._id, {
        communityJoinStatus: args.method === "email_fallback" ? "skipped_email" : "verified",
      });
    }

    return { success: true };
  },
});
```

---

### Email Fallback

**Mailto link:**
```
mailto:support@basesignal.com?subject=Community%20Join%20Help&body=Hi%2C%20I%27m%20having%20trouble%20joining%20the%20Discord%20community.%20My%20email%20is%20[USER_EMAIL].
```

**Behavior:**
1. Click opens email client
2. Immediately call `verify({ method: "email_fallback" })`
3. Continue button becomes enabled
4. User can proceed (but `communityJoined` = false, `communityJoinMethod` = "email_fallback")

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/components/onboarding/screens/CommunityJoinScreen.tsx` | Gate UI component |
| `convex/communityJoin.ts` | Config query and verify mutation |

### Modified Files

| File | Changes |
|------|---------|
| `convex/schema.ts` | Add fields to users and setupProgress |
| `src/routes/SetupOnboardingPage.tsx` | Add CommunityJoin step after Briefing |

---

## Alternatives Considered

### Discord bot + email match
- **Rejected for v1**: Requires bot setup, Discord API integration
- Could add later as a third verification mode

### OAuth Discord link
- **Rejected**: Complex implementation, overkill for launch
- Better for future "connect Discord account" feature

### No escape hatch
- **Rejected**: Risks losing users who genuinely can't join Discord
- Email fallback gives visibility into stuck users

---

## Configuration

**Initial launch settings:**
```
COMMUNITY_VERIFICATION_MODE=honor
COMMUNITY_DISCORD_INVITE=https://discord.gg/[your-invite]
```

**When ready for stricter verification:**
```
COMMUNITY_VERIFICATION_MODE=magic_code
COMMUNITY_MAGIC_CODE=BASESIGNAL2026
```

---

## Success Criteria

1. Community join step appears after Briefing, before Interview
2. Users cannot proceed without verification (or email fallback)
3. Join Discord button opens invite in new tab
4. Honor mode: checkbox enables Continue
5. Magic code mode: validates code against env var
6. Email fallback: allows proceeding while tracking the skip
7. Verification mode switchable via Convex env var without redeploy
