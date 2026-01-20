# Community Join Gate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a mandatory community join step to the setup flow that requires users to join the Discord community before starting the AI interview.

**Architecture:** Insert a "Community Join" screen after the Briefing step. Users verify via honor system checkbox OR magic code input (configurable via env var). Email fallback allows stuck users to proceed while tracking the skip.

**Tech Stack:** React, Convex (backend), Tailwind CSS, lucide-react icons

---

## Task 1: Add Schema Fields for Community Join

**Files:**
- Modify: `convex/schema.ts:12-41` (users table)
- Modify: `convex/schema.ts:43-69` (setupProgress table)

**Step 1: Add community fields to users table**

In `convex/schema.ts`, add three fields to the `users` table after the `setupCompletedAt` field (around line 37):

```typescript
    // Community join tracking
    communityJoined: v.optional(v.boolean()),
    communityJoinedAt: v.optional(v.number()),
    communityJoinMethod: v.optional(v.string()), // "honor" | "magic_code" | "email_fallback"
```

**Step 2: Add community field to setupProgress table**

In `convex/schema.ts`, add one field to the `setupProgress` table after `overviewJourneyId` (around line 65):

```typescript
    // Community join status
    communityJoinStatus: v.optional(v.string()), // "pending" | "verified" | "skipped_email"
```

**Step 3: Run convex dev to verify schema compiles**

Run: `npx convex dev` (should auto-push schema changes)
Expected: No schema validation errors

**Step 4: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add community join fields to users and setupProgress tables"
```

---

## Task 2: Create communityJoin Backend Functions with Tests

**Files:**
- Create: `convex/communityJoin.ts`
- Create: `convex/communityJoin.test.ts`

**Step 1: Write failing test for getConfig query**

Create `convex/communityJoin.test.ts`:

```typescript
import { convexTest } from "convex-test";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

describe("communityJoin.getConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns honor mode by default when no env var set", async () => {
    const t = convexTest(schema);
    delete process.env.COMMUNITY_VERIFICATION_MODE;

    const config = await t.query(api.communityJoin.getConfig, {});

    expect(config.mode).toBe("honor");
  });

  it("returns magic_code mode when env var is set", async () => {
    const t = convexTest(schema);
    process.env.COMMUNITY_VERIFICATION_MODE = "magic_code";

    const config = await t.query(api.communityJoin.getConfig, {});

    expect(config.mode).toBe("magic_code");
  });

  it("returns discord invite URL from env var", async () => {
    const t = convexTest(schema);
    process.env.COMMUNITY_DISCORD_INVITE = "https://discord.gg/test123";

    const config = await t.query(api.communityJoin.getConfig, {});

    expect(config.discordInvite).toBe("https://discord.gg/test123");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- convex/communityJoin.test.ts`
Expected: FAIL - module not found

**Step 3: Write minimal getConfig implementation**

Create `convex/communityJoin.ts`:

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get verification configuration from environment
export const getConfig = query({
  args: {},
  handler: async () => {
    const mode = process.env.COMMUNITY_VERIFICATION_MODE || "honor";
    const discordInvite = process.env.COMMUNITY_DISCORD_INVITE || "";
    return { mode, discordInvite };
  },
});
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- convex/communityJoin.test.ts`
Expected: PASS

**Step 5: Write failing test for verify mutation - honor mode**

Add to `convex/communityJoin.test.ts`:

```typescript
describe("communityJoin.verify", () => {
  it("updates user and progress when verifying with honor mode", async () => {
    const t = convexTest(schema);

    // Create user
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    // Create setup progress
    await t.run(async (ctx) => {
      await ctx.db.insert("setupProgress", {
        userId,
        currentStep: "onboarding",
        status: "active",
        stepsCompleted: [],
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        remindersSent: 0,
      });
    });

    const asUser = t.withIdentity({
      subject: "test-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-user",
    });

    await asUser.mutation(api.communityJoin.verify, {
      method: "honor",
    });

    // Check user was updated
    const user = await t.run(async (ctx) => {
      return await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", "test-user"))
        .first();
    });

    expect(user?.communityJoined).toBe(true);
    expect(user?.communityJoinMethod).toBe("honor");
    expect(user?.communityJoinedAt).toBeDefined();

    // Check progress was updated
    const progress = await t.run(async (ctx) => {
      return await ctx.db
        .query("setupProgress")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
    });

    expect(progress?.communityJoinStatus).toBe("verified");
  });

  it("marks as skipped_email for email_fallback method", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("setupProgress", {
        userId,
        currentStep: "onboarding",
        status: "active",
        stepsCompleted: [],
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        remindersSent: 0,
      });
    });

    const asUser = t.withIdentity({
      subject: "test-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-user",
    });

    await asUser.mutation(api.communityJoin.verify, {
      method: "email_fallback",
    });

    const user = await t.run(async (ctx) => {
      return await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", "test-user"))
        .first();
    });

    expect(user?.communityJoined).toBe(false);
    expect(user?.communityJoinMethod).toBe("email_fallback");

    const progress = await t.run(async (ctx) => {
      return await ctx.db
        .query("setupProgress")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
    });

    expect(progress?.communityJoinStatus).toBe("skipped_email");
  });

  it("throws error when not authenticated", async () => {
    const t = convexTest(schema);

    await expect(
      t.mutation(api.communityJoin.verify, { method: "honor" })
    ).rejects.toThrow("Not authenticated");
  });
});
```

**Step 6: Run test to verify it fails**

Run: `npm run test:run -- convex/communityJoin.test.ts`
Expected: FAIL - verify function not defined

**Step 7: Write verify mutation implementation**

Add to `convex/communityJoin.ts`:

```typescript
// Verify community join
export const verify = mutation({
  args: {
    method: v.string(), // "honor" | "magic_code" | "email_fallback"
    code: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    // Validate magic code if applicable
    if (args.method === "magic_code") {
      const expectedCode = process.env.COMMUNITY_MAGIC_CODE;
      if (!expectedCode || args.code !== expectedCode) {
        throw new Error("Invalid code");
      }
    }

    const now = Date.now();

    // Update user record
    await ctx.db.patch(user._id, {
      communityJoined: args.method !== "email_fallback",
      communityJoinedAt: now,
      communityJoinMethod: args.method,
    });

    // Update setup progress
    const progress = await ctx.db
      .query("setupProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (progress) {
      await ctx.db.patch(progress._id, {
        communityJoinStatus: args.method === "email_fallback" ? "skipped_email" : "verified",
        lastActiveAt: now,
      });
    }

    return { success: true };
  },
});
```

**Step 8: Run test to verify it passes**

Run: `npm run test:run -- convex/communityJoin.test.ts`
Expected: PASS

**Step 9: Write failing test for magic code validation**

Add to `convex/communityJoin.test.ts`:

```typescript
describe("communityJoin.verify with magic_code", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.COMMUNITY_MAGIC_CODE = "BASESIGNAL2026";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("accepts correct magic code", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("setupProgress", {
        userId,
        currentStep: "onboarding",
        status: "active",
        stepsCompleted: [],
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        remindersSent: 0,
      });
    });

    const asUser = t.withIdentity({
      subject: "test-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-user",
    });

    await asUser.mutation(api.communityJoin.verify, {
      method: "magic_code",
      code: "BASESIGNAL2026",
    });

    const user = await t.run(async (ctx) => {
      return await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", "test-user"))
        .first();
    });

    expect(user?.communityJoined).toBe(true);
    expect(user?.communityJoinMethod).toBe("magic_code");
  });

  it("rejects incorrect magic code", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("setupProgress", {
        userId,
        currentStep: "onboarding",
        status: "active",
        stepsCompleted: [],
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        remindersSent: 0,
      });
    });

    const asUser = t.withIdentity({
      subject: "test-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-user",
    });

    await expect(
      asUser.mutation(api.communityJoin.verify, {
        method: "magic_code",
        code: "WRONGCODE",
      })
    ).rejects.toThrow("Invalid code");
  });
});
```

**Step 10: Run test to verify it passes (implementation already handles this)**

Run: `npm run test:run -- convex/communityJoin.test.ts`
Expected: PASS

**Step 11: Commit**

```bash
git add convex/communityJoin.ts convex/communityJoin.test.ts
git commit -m "feat: add communityJoin backend functions with tests"
```

---

## Task 3: Create CommunityJoinScreen Component with Tests

**Files:**
- Create: `src/components/onboarding/screens/CommunityJoinScreen.tsx`
- Create: `src/components/onboarding/screens/CommunityJoinScreen.test.tsx`

**Step 1: Write failing test for CommunityJoinScreen**

Create `src/components/onboarding/screens/CommunityJoinScreen.test.tsx`:

```typescript
import { expect, test, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommunityJoinScreen } from "./CommunityJoinScreen";

// Mock Convex hooks
const mockVerify = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => ({ mode: "honor", discordInvite: "https://discord.gg/test" })),
  useMutation: vi.fn(() => mockVerify),
}));

function setup(props: { onNext?: () => void; onBack?: () => void } = {}) {
  const user = userEvent.setup();
  const onNext = props.onNext ?? vi.fn();
  const onBack = props.onBack ?? vi.fn();
  render(<CommunityJoinScreen onNext={onNext} onBack={onBack} />);
  return {
    user,
    onNext,
    onBack,
    getContinueButton: () => screen.getByRole("button", { name: /continue/i }),
    getBackButton: () => screen.getByRole("button", { name: /back/i }),
    getDiscordButton: () => screen.getByRole("link", { name: /join discord/i }),
    getCheckbox: () => screen.getByRole("checkbox"),
  };
}

beforeEach(() => {
  mockVerify.mockClear();
  mockVerify.mockResolvedValue({ success: true });
});

test("renders community join content", () => {
  setup();

  expect(screen.getByText(/join our early adopter community/i)).toBeInTheDocument();
  expect(screen.getByText(/basesignal is launching/i)).toBeInTheDocument();
  expect(screen.getByText(/this isn't optional/i)).toBeInTheDocument();
});

test("Discord link opens in new tab", () => {
  const { getDiscordButton } = setup();

  const link = getDiscordButton();
  expect(link).toHaveAttribute("href", "https://discord.gg/test");
  expect(link).toHaveAttribute("target", "_blank");
});

test("Continue button is disabled until checkbox is checked in honor mode", async () => {
  const { user, getContinueButton, getCheckbox } = setup();

  expect(getContinueButton()).toBeDisabled();

  await user.click(getCheckbox());

  expect(getContinueButton()).toBeEnabled();
});

test("calls verify mutation and onNext when continuing in honor mode", async () => {
  const onNext = vi.fn();
  const { user, getContinueButton, getCheckbox } = setup({ onNext });

  await user.click(getCheckbox());
  await user.click(getContinueButton());

  await waitFor(() => {
    expect(mockVerify).toHaveBeenCalledWith({ method: "honor" });
  });
  await waitFor(() => {
    expect(onNext).toHaveBeenCalled();
  });
});

test("calls onBack when Back button is clicked", async () => {
  const onBack = vi.fn();
  const { user, getBackButton } = setup({ onBack });

  await user.click(getBackButton());

  expect(onBack).toHaveBeenCalled();
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/onboarding/screens/CommunityJoinScreen.test.tsx`
Expected: FAIL - module not found

**Step 3: Write CommunityJoinScreen component**

Create `src/components/onboarding/screens/CommunityJoinScreen.tsx`:

```typescript
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "../../ui/button";
import { ExternalLink, Mail } from "lucide-react";

interface CommunityJoinScreenProps {
  onNext: () => void;
  onBack: () => void;
}

export function CommunityJoinScreen({ onNext, onBack }: CommunityJoinScreenProps) {
  const config = useQuery(api.communityJoin.getConfig);
  const verify = useMutation(api.communityJoin.verify);

  const [honorChecked, setHonorChecked] = useState(false);
  const [magicCode, setMagicCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [emailFallbackUsed, setEmailFallbackUsed] = useState(false);

  const mode = config?.mode || "honor";
  const discordInvite = config?.discordInvite || "";

  const canContinue =
    emailFallbackUsed ||
    (mode === "honor" && honorChecked) ||
    (mode === "magic_code" && magicCode.length > 0);

  const handleContinue = async () => {
    setIsVerifying(true);
    setCodeError("");

    try {
      if (emailFallbackUsed) {
        await verify({ method: "email_fallback" });
      } else if (mode === "honor") {
        await verify({ method: "honor" });
      } else {
        await verify({ method: "magic_code", code: magicCode });
      }
      onNext();
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid code") {
        setCodeError("That code doesn't match. Check the pinned message in #welcome.");
      } else {
        setCodeError("Something went wrong. Please try again.");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleEmailFallback = () => {
    // Open email client
    const subject = encodeURIComponent("Community Join Help");
    const body = encodeURIComponent(
      "Hi, I'm having trouble joining the Discord community. Can you help me proceed with setup?"
    );
    window.open(`mailto:support@basesignal.com?subject=${subject}&body=${body}`, "_blank");

    // Mark as used so they can continue
    setEmailFallbackUsed(true);
  };

  if (!config) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-gray-900">
          Join our early adopter community
        </h1>
        <p className="text-sm text-gray-600">
          Basesignal is launching and we're building this with you. Before you continue,
          join our Discord – it's where you'll get support, share feedback, and help
          shape what we build next.
        </p>
        <p className="text-sm text-gray-500 italic">
          This isn't optional (yet). We're a small team and your input is how we make
          this great.
        </p>
      </div>

      {/* Discord Join Button */}
      <div className="flex justify-center">
        <a
          href={discordInvite}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#5865F2] text-white rounded-lg font-medium hover:bg-[#4752C4] transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Join Discord
        </a>
      </div>

      {/* Verification Section */}
      <div className="border-t border-gray-200 pt-6 space-y-4">
        {mode === "honor" ? (
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={honorChecked}
              onChange={(e) => setHonorChecked(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              I've joined the Discord community
            </span>
          </label>
        ) : (
          <div className="space-y-2">
            <label className="block text-sm text-gray-700">
              Already joined? Enter the code from #welcome:
            </label>
            <input
              type="text"
              value={magicCode}
              onChange={(e) => {
                setMagicCode(e.target.value.toUpperCase());
                setCodeError("");
              }}
              placeholder="Enter code"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {codeError && (
              <p className="text-sm text-red-600">{codeError}</p>
            )}
          </div>
        )}
      </div>

      {/* Email Fallback */}
      <div className="border-t border-gray-200 pt-4">
        <button
          onClick={handleEmailFallback}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <Mail className="w-4 h-4" />
          Having trouble? Email us to continue
        </button>
        {emailFallbackUsed && (
          <p className="text-sm text-green-600 mt-2">
            Email opened! You can now continue.
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!canContinue || isVerifying}
        >
          {isVerifying ? "Verifying..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/components/onboarding/screens/CommunityJoinScreen.test.tsx`
Expected: PASS

**Step 5: Write additional test for email fallback**

Add to `src/components/onboarding/screens/CommunityJoinScreen.test.tsx`:

```typescript
test("email fallback enables Continue button", async () => {
  const mockOpen = vi.fn();
  vi.stubGlobal("open", mockOpen);

  const { user, getContinueButton } = setup();

  expect(getContinueButton()).toBeDisabled();

  const emailLink = screen.getByRole("button", { name: /email us/i });
  await user.click(emailLink);

  expect(mockOpen).toHaveBeenCalledWith(
    expect.stringContaining("mailto:support@basesignal.com"),
    "_blank"
  );
  expect(getContinueButton()).toBeEnabled();

  vi.unstubAllGlobals();
});
```

**Step 6: Run all component tests to verify**

Run: `npm run test:run -- src/components/onboarding/screens/CommunityJoinScreen.test.tsx`
Expected: PASS

**Step 7: Commit**

```bash
git add src/components/onboarding/screens/CommunityJoinScreen.tsx src/components/onboarding/screens/CommunityJoinScreen.test.tsx
git commit -m "feat: add CommunityJoinScreen component with tests"
```

---

## Task 4: Integrate CommunityJoinScreen into SetupOnboardingPage

**Files:**
- Modify: `src/routes/SetupOnboardingPage.tsx`

**Step 1: Add import for CommunityJoinScreen**

At the top of `src/routes/SetupOnboardingPage.tsx`, add:

```typescript
import { CommunityJoinScreen } from "../components/onboarding/screens/CommunityJoinScreen";
```

**Step 2: Update TOTAL_STEPS constant**

Change:
```typescript
const TOTAL_STEPS = 3;
```

To:
```typescript
const TOTAL_STEPS = 4;
```

**Step 3: Add CommunityJoinScreen to screens array**

Update the `screens` array to include CommunityJoinScreen after Briefing:

```typescript
  const screens = [
    <PhilosophyScreen key="philosophy" onNext={() => setStep(1)} />,
    <ContextScreen key="context" onNext={handleContextSubmit} />,
    <SetupBriefingScreen
      key="briefing"
      productName={context.productName}
      onStart={() => setStep(3)}
    />,
    <CommunityJoinScreen
      key="community"
      onNext={handleStartInterview}
      onBack={() => setStep(2)}
    />,
  ];
```

**Step 4: Update handleContextSubmit to go to step 2 (Briefing)**

The `handleContextSubmit` function already does `setStep(2)` which is correct - Briefing is now at index 2.

**Step 5: Update modalSize logic**

Change:
```typescript
const modalSize = step === 2 ? "wide" : "medium";
```

To (Briefing is still wide, community join is medium):
```typescript
const modalSize = step === 2 ? "wide" : "medium";
```

This is already correct since Briefing (step 2) needs wide, and CommunityJoin (step 3) needs medium.

**Step 6: Test manually by running the app**

Run: `npm run dev`
Navigate through onboarding to verify:
1. Philosophy → Context → Briefing → CommunityJoin → Interview
2. CommunityJoin shows after Briefing
3. Cannot proceed until verified
4. Back button returns to Briefing

**Step 7: Commit**

```bash
git add src/routes/SetupOnboardingPage.tsx
git commit -m "feat: integrate CommunityJoinScreen into setup flow"
```

---

## Task 5: Run Full Test Suite and Final Verification

**Files:**
- None (verification only)

**Step 1: Run all tests**

Run: `npm run test:run`
Expected: All tests pass

**Step 2: Run linter**

Run: `npm run lint`
Expected: No errors

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any test/lint/build issues"
```

---

## Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | Schema fields | Schema validates |
| 2 | Backend functions | 8 Convex tests |
| 3 | UI component | 6 React tests |
| 4 | Flow integration | Manual verification |
| 5 | Full verification | All tests pass |

**Total estimated tests:** 14 new tests

**Environment variables to configure:**
- `COMMUNITY_VERIFICATION_MODE`: "honor" (default) or "magic_code"
- `COMMUNITY_MAGIC_CODE`: e.g., "BASESIGNAL2026" (only needed in magic_code mode)
- `COMMUNITY_DISCORD_INVITE`: e.g., "https://discord.gg/xyz"
