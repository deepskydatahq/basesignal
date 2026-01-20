# Tracking Maturity in Onboarding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a tracking maturity questionnaire screen to onboarding that captures user's analytics situation for personalization.

**Architecture:** Insert a new `TrackingMaturityScreen` component between ContextScreen and BriefingScreen. Add 4 fields to the users schema. Create a mutation to persist the data. Add a helper hook for downstream personalization.

**Tech Stack:** React + TypeScript, Convex (schema/mutations), Vitest + RTL + convex-test

---

## Task 1: Add Schema Fields

**Files:**
- Modify: `convex/schema.ts:19-36` (users table)

**Step 1: Write the failing test**

Create `convex/users.trackingMaturity.test.ts`:

```typescript
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";

describe("users schema - tracking maturity fields", () => {
  it("accepts tracking maturity fields in user record", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        trackingStatus: "partial",
        trackingPainPoint: "no_outcomes",
        trackingPainPointOther: undefined,
        analyticsTools: ["amplitude", "mixpanel"],
        createdAt: Date.now(),
      });
    });

    const user = await t.run(async (ctx) => {
      return await ctx.db.get(userId);
    });

    expect(user?.trackingStatus).toBe("partial");
    expect(user?.trackingPainPoint).toBe("no_outcomes");
    expect(user?.analyticsTools).toEqual(["amplitude", "mixpanel"]);
  });

  it("accepts trackingPainPointOther when pain point is other", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user-2",
        email: "test2@example.com",
        trackingStatus: "minimal",
        trackingPainPoint: "other",
        trackingPainPointOther: "We have too many conflicting tools",
        analyticsTools: ["custom"],
        createdAt: Date.now(),
      });
    });

    const user = await t.run(async (ctx) => {
      return await ctx.db.get(userId);
    });

    expect(user?.trackingPainPoint).toBe("other");
    expect(user?.trackingPainPointOther).toBe("We have too many conflicting tools");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- convex/users.trackingMaturity.test.ts`
Expected: FAIL with schema validation error (fields don't exist yet)

**Step 3: Add schema fields**

In `convex/schema.ts`, add after line 32 (after `revenueModels`):

```typescript
    // Tracking Maturity (collected during onboarding)
    trackingStatus: v.optional(v.string()),           // "full" | "partial" | "minimal" | "none"
    trackingPainPoint: v.optional(v.string()),        // "what_to_track" | "inconsistent" | "no_outcomes" | "trust" | "other"
    trackingPainPointOther: v.optional(v.string()),   // Custom text if "other"
    analyticsTools: v.optional(v.array(v.string())), // Array of tool IDs
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- convex/users.trackingMaturity.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/schema.ts convex/users.trackingMaturity.test.ts
git commit -m "$(cat <<'EOF'
feat(schema): add tracking maturity fields to users table

Adds 4 fields for capturing user's analytics situation during onboarding:
- trackingStatus: current implementation level
- trackingPainPoint: biggest tracking challenge
- trackingPainPointOther: custom text for "other" pain point
- analyticsTools: array of tools currently in use

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add updateTrackingMaturity Mutation

**Files:**
- Modify: `convex/users.ts:126-150` (add new mutation after updateOnboarding)
- Modify: `convex/users.trackingMaturity.test.ts` (extend tests)

**Step 1: Write the failing test**

Add to `convex/users.trackingMaturity.test.ts`:

```typescript
import { api } from "./_generated/api";

// Add helper at top of file
async function setupAuthenticatedUser(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: "test-user",
      email: "test@example.com",
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

describe("updateTrackingMaturity mutation", () => {
  it("updates user with tracking maturity data", async () => {
    const t = convexTest(schema);
    const { userId, asUser } = await setupAuthenticatedUser(t);

    await asUser.mutation(api.users.updateTrackingMaturity, {
      trackingStatus: "partial",
      trackingPainPoint: "no_outcomes",
      analyticsTools: ["amplitude", "segment"],
    });

    const user = await t.run(async (ctx) => {
      return await ctx.db.get(userId);
    });

    expect(user?.trackingStatus).toBe("partial");
    expect(user?.trackingPainPoint).toBe("no_outcomes");
    expect(user?.analyticsTools).toEqual(["amplitude", "segment"]);
  });

  it("saves trackingPainPointOther when pain point is other", async () => {
    const t = convexTest(schema);
    const { userId, asUser } = await setupAuthenticatedUser(t);

    await asUser.mutation(api.users.updateTrackingMaturity, {
      trackingStatus: "none",
      trackingPainPoint: "other",
      trackingPainPointOther: "Our data is siloed across teams",
      analyticsTools: ["none"],
    });

    const user = await t.run(async (ctx) => {
      return await ctx.db.get(userId);
    });

    expect(user?.trackingPainPoint).toBe("other");
    expect(user?.trackingPainPointOther).toBe("Our data is siloed across teams");
  });

  it("throws error when not authenticated", async () => {
    const t = convexTest(schema);

    await expect(
      t.mutation(api.users.updateTrackingMaturity, {
        trackingStatus: "full",
        trackingPainPoint: "trust",
        analyticsTools: ["amplitude"],
      })
    ).rejects.toThrow("Not authenticated");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- convex/users.trackingMaturity.test.ts`
Expected: FAIL with "api.users.updateTrackingMaturity is not defined"

**Step 3: Add the mutation**

In `convex/users.ts`, add after `updateOnboarding` (after line 150):

```typescript
export const updateTrackingMaturity = mutation({
  args: {
    trackingStatus: v.string(),
    trackingPainPoint: v.string(),
    trackingPainPointOther: v.optional(v.string()),
    analyticsTools: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, {
      trackingStatus: args.trackingStatus,
      trackingPainPoint: args.trackingPainPoint,
      trackingPainPointOther: args.trackingPainPointOther,
      analyticsTools: args.analyticsTools,
    });
  },
});
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- convex/users.trackingMaturity.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/users.ts convex/users.trackingMaturity.test.ts
git commit -m "$(cat <<'EOF'
feat(users): add updateTrackingMaturity mutation

Mutation to persist tracking maturity questionnaire data during onboarding.
Requires authentication and validates all required fields.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create TrackingMaturityScreen Component

**Files:**
- Create: `src/components/onboarding/screens/TrackingMaturityScreen.tsx`
- Create: `src/components/onboarding/screens/TrackingMaturityScreen.test.tsx`

**Step 1: Write the failing test**

Create `src/components/onboarding/screens/TrackingMaturityScreen.test.tsx`:

```typescript
import { expect, test, vi, describe } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackingMaturityScreen } from "./TrackingMaturityScreen";

function setup(props: Partial<Parameters<typeof TrackingMaturityScreen>[0]> = {}) {
  const user = userEvent.setup();
  const onNext = props.onNext ?? vi.fn();
  const onBack = props.onBack ?? vi.fn();

  render(
    <TrackingMaturityScreen
      onNext={onNext}
      onBack={onBack}
      {...props}
    />
  );

  return {
    user,
    onNext,
    onBack,
    getContinueButton: () => screen.getByRole("button", { name: /continue/i }),
    getBackButton: () => screen.getByRole("button", { name: /back/i }),
  };
}

describe("TrackingMaturityScreen", () => {
  test("renders all three question sections", () => {
    setup();

    // Question 1: Tracking status
    expect(screen.getByText(/do you have a tracking setup/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fully implemented/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /incomplete/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /just started/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /starting from scratch/i })).toBeInTheDocument();

    // Question 2: Pain point
    expect(screen.getByText(/biggest tracking challenge/i)).toBeInTheDocument();

    // Question 3: Tools
    expect(screen.getByText(/what analytics tools/i)).toBeInTheDocument();
  });

  test("continue button disabled until all sections complete", async () => {
    const { user, getContinueButton } = setup();

    // Initially disabled
    expect(getContinueButton()).toBeDisabled();

    // Select tracking status
    await user.click(screen.getByRole("button", { name: /fully implemented/i }));
    expect(getContinueButton()).toBeDisabled();

    // Select pain point
    await user.click(screen.getByRole("button", { name: /don't know what to track/i }));
    expect(getContinueButton()).toBeDisabled();

    // Select at least one tool
    await user.click(screen.getByRole("checkbox", { name: /amplitude/i }));
    expect(getContinueButton()).toBeEnabled();
  });

  test("calls onNext with collected data when continue clicked", async () => {
    const { user, onNext, getContinueButton } = setup();

    // Fill all required fields
    await user.click(screen.getByRole("button", { name: /incomplete/i }));
    await user.click(screen.getByRole("button", { name: /inconsistent/i }));
    await user.click(screen.getByRole("checkbox", { name: /mixpanel/i }));
    await user.click(screen.getByRole("checkbox", { name: /segment/i }));

    await user.click(getContinueButton());

    expect(onNext).toHaveBeenCalledWith({
      trackingStatus: "partial",
      trackingPainPoint: "inconsistent",
      trackingPainPointOther: undefined,
      analyticsTools: ["mixpanel", "segment"],
    });
  });

  test("shows text input when other pain point selected", async () => {
    const { user, onNext, getContinueButton } = setup();

    // Select "Other" pain point
    await user.click(screen.getByRole("button", { name: /fully implemented/i }));
    await user.click(screen.getByRole("button", { name: /^other$/i }));

    // Text input should appear
    const textInput = screen.getByPlaceholderText(/describe your challenge/i);
    expect(textInput).toBeInTheDocument();

    // Continue still disabled without text
    await user.click(screen.getByRole("checkbox", { name: /amplitude/i }));
    expect(getContinueButton()).toBeDisabled();

    // Add text
    await user.type(textInput, "Our data is siloed");
    expect(getContinueButton()).toBeEnabled();

    await user.click(getContinueButton());

    expect(onNext).toHaveBeenCalledWith({
      trackingStatus: "full",
      trackingPainPoint: "other",
      trackingPainPointOther: "Our data is siloed",
      analyticsTools: ["amplitude"],
    });
  });

  test("calls onBack when back button clicked", async () => {
    const { user, onBack, getBackButton } = setup();

    await user.click(getBackButton());

    expect(onBack).toHaveBeenCalled();
  });

  test("preserves initial data when provided", () => {
    setup({
      initialData: {
        trackingStatus: "minimal",
        trackingPainPoint: "trust",
        analyticsTools: ["posthog"],
      },
    });

    // Tracking status should be selected
    const minimalButton = screen.getByRole("button", { name: /just started/i });
    expect(minimalButton).toHaveClass("bg-black");

    // Pain point should be selected
    const trustButton = screen.getByRole("button", { name: /stakeholders don't trust/i });
    expect(trustButton).toHaveClass("bg-black");

    // Tool should be checked
    const posthogCheckbox = screen.getByRole("checkbox", { name: /posthog/i });
    expect(posthogCheckbox).toBeChecked();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/onboarding/screens/TrackingMaturityScreen.test.tsx`
Expected: FAIL with "Cannot find module './TrackingMaturityScreen'"

**Step 3: Create the component**

Create `src/components/onboarding/screens/TrackingMaturityScreen.tsx`:

```typescript
import { useState } from "react";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Checkbox } from "../../ui/checkbox";

export interface TrackingMaturityData {
  trackingStatus: string;
  trackingPainPoint: string;
  trackingPainPointOther: string | undefined;
  analyticsTools: string[];
}

interface Props {
  initialData?: Partial<TrackingMaturityData>;
  onNext: (data: TrackingMaturityData) => void;
  onBack: () => void;
}

const trackingStatusOptions = [
  { label: "Yes, fully implemented", value: "full" },
  { label: "Yes, but incomplete/messy", value: "partial" },
  { label: "Just started / minimal", value: "minimal" },
  { label: "No, starting from scratch", value: "none" },
];

const painPointOptions = [
  { label: "I don't know what to track", value: "what_to_track" },
  { label: "My tracking is inconsistent/broken", value: "inconsistent" },
  { label: "I have data but can't connect it to business outcomes", value: "no_outcomes" },
  { label: "Stakeholders don't trust the data", value: "trust" },
  { label: "Other", value: "other" },
];

const analyticsToolOptions = [
  { label: "Amplitude", value: "amplitude" },
  { label: "Mixpanel", value: "mixpanel" },
  { label: "Google Analytics 4", value: "ga4" },
  { label: "Heap", value: "heap" },
  { label: "PostHog", value: "posthog" },
  { label: "Segment", value: "segment" },
  { label: "Rudderstack", value: "rudderstack" },
  { label: "Snowplow", value: "snowplow" },
  { label: "Custom / In-house", value: "custom" },
  { label: "None", value: "none" },
];

export function TrackingMaturityScreen({ initialData, onNext, onBack }: Props) {
  const [trackingStatus, setTrackingStatus] = useState<string | null>(
    initialData?.trackingStatus ?? null
  );
  const [trackingPainPoint, setTrackingPainPoint] = useState<string | null>(
    initialData?.trackingPainPoint ?? null
  );
  const [trackingPainPointOther, setTrackingPainPointOther] = useState(
    initialData?.trackingPainPointOther ?? ""
  );
  const [analyticsTools, setAnalyticsTools] = useState<string[]>(
    initialData?.analyticsTools ?? []
  );

  const toggleTool = (value: string) => {
    setAnalyticsTools((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  // Validation
  const hasTrackingStatus = trackingStatus !== null;
  const hasPainPoint = trackingPainPoint !== null;
  const hasPainPointOther =
    trackingPainPoint !== "other" || trackingPainPointOther.trim().length > 0;
  const hasTools = analyticsTools.length > 0;

  const canContinue = hasTrackingStatus && hasPainPoint && hasPainPointOther && hasTools;

  const handleContinue = () => {
    if (!canContinue || !trackingStatus || !trackingPainPoint) return;
    onNext({
      trackingStatus,
      trackingPainPoint,
      trackingPainPointOther:
        trackingPainPoint === "other" ? trackingPainPointOther.trim() : undefined,
      analyticsTools,
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-medium">Tell us about your current tracking</h1>
        <p className="text-gray-600">
          This helps us personalize your Basesignal experience.
        </p>
      </div>

      <div className="space-y-5">
        {/* Question 1: Tracking status */}
        <div
          className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ animationDelay: "0ms", animationFillMode: "backwards" }}
        >
          <Label>Do you have a tracking setup?</Label>
          <div className="grid grid-cols-2 gap-2">
            {trackingStatusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setTrackingStatus(option.value)}
                className={`px-3 py-2 rounded-md text-sm border transition-colors text-left ${
                  trackingStatus === option.value
                    ? "bg-black text-white border-black"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Question 2: Pain point */}
        <div
          className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
        >
          <Label>What's your biggest tracking challenge?</Label>
          <div className="space-y-2">
            {painPointOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setTrackingPainPoint(option.value)}
                className={`w-full px-3 py-2 rounded-md text-sm border transition-colors text-left ${
                  trackingPainPoint === option.value
                    ? "bg-black text-white border-black"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Other text input */}
          {trackingPainPoint === "other" && (
            <div
              className="mt-2 animate-in fade-in slide-in-from-bottom-2 duration-200"
            >
              <Input
                placeholder="Describe your challenge..."
                value={trackingPainPointOther}
                onChange={(e) => setTrackingPainPointOther(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Question 3: Analytics tools */}
        <div
          className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ animationDelay: "200ms", animationFillMode: "backwards" }}
        >
          <Label>What analytics tools do you use? (select all that apply)</Label>
          <div className="grid grid-cols-2 gap-2">
            {analyticsToolOptions.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`tool-${option.value}`}
                  checked={analyticsTools.includes(option.value)}
                  onCheckedChange={() => toggleTool(option.value)}
                />
                <label
                  htmlFor={`tool-${option.value}`}
                  className="text-sm text-gray-700 cursor-pointer select-none"
                >
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button onClick={handleContinue} className="flex-1" disabled={!canContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/components/onboarding/screens/TrackingMaturityScreen.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/onboarding/screens/TrackingMaturityScreen.tsx src/components/onboarding/screens/TrackingMaturityScreen.test.tsx
git commit -m "$(cat <<'EOF'
feat(onboarding): add TrackingMaturityScreen component

Single-screen questionnaire collecting:
- Tracking status (full/partial/minimal/none)
- Biggest pain point (with "other" text option)
- Analytics tools in use (multi-select)

All questions required, validates before enabling Continue.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Integrate TrackingMaturityScreen into Onboarding Flow

**Files:**
- Modify: `src/routes/SetupOnboardingPage.tsx`

**Step 1: Write the failing test**

Create `src/routes/SetupOnboardingPage.test.tsx`:

```typescript
import { expect, test, vi, describe } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SetupOnboardingPage from "./SetupOnboardingPage";

// Mock Convex
const mockUpdateOnboarding = vi.fn().mockResolvedValue(undefined);
const mockUpdateTrackingMaturity = vi.fn().mockResolvedValue(undefined);
const mockUpdateSetupProgress = vi.fn().mockResolvedValue(undefined);

vi.mock("convex/react", () => ({
  useMutation: (ref: { name: string }) => {
    if (ref.name === "users:updateOnboarding") return mockUpdateOnboarding;
    if (ref.name === "users:updateTrackingMaturity") return mockUpdateTrackingMaturity;
    if (ref.name === "setupProgress:update") return mockUpdateSetupProgress;
    return vi.fn();
  },
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

function setup() {
  const user = userEvent.setup();
  render(<SetupOnboardingPage />);
  return { user };
}

describe("SetupOnboardingPage", () => {
  test("shows philosophy screen first, then context, then tracking maturity, then briefing", async () => {
    const { user } = setup();

    // Step 0: Philosophy screen
    expect(screen.getByText(/basesignal helps you/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /continue/i }));

    // Step 1: Context screen
    expect(screen.getByText(/what's your product called/i)).toBeInTheDocument();

    // Fill context form
    await user.type(screen.getByLabelText(/product called/i), "TestApp");
    await user.click(screen.getByRole("button", { name: /product/i }));
    await user.click(screen.getByRole("button", { name: /no, each user/i }));
    await user.click(screen.getByRole("button", { name: /b2c/i }));
    await user.click(screen.getByRole("checkbox", { name: /tier subscription/i }));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    // Context data should be saved
    await waitFor(() => {
      expect(mockUpdateOnboarding).toHaveBeenCalledWith(
        expect.objectContaining({
          productName: "TestApp",
          role: "Product",
        })
      );
    });

    // Step 2: Tracking maturity screen
    expect(screen.getByText(/tell us about your current tracking/i)).toBeInTheDocument();

    // Fill tracking maturity form
    await user.click(screen.getByRole("button", { name: /fully implemented/i }));
    await user.click(screen.getByRole("button", { name: /don't know what to track/i }));
    await user.click(screen.getByRole("checkbox", { name: /amplitude/i }));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    // Tracking maturity data should be saved
    await waitFor(() => {
      expect(mockUpdateTrackingMaturity).toHaveBeenCalledWith({
        trackingStatus: "full",
        trackingPainPoint: "what_to_track",
        trackingPainPointOther: undefined,
        analyticsTools: ["amplitude"],
      });
    });

    // Step 3: Briefing screen
    expect(screen.getByText(/what you'll walk away with/i)).toBeInTheDocument();
  });

  test("back from tracking maturity returns to context with preserved data", async () => {
    const { user } = setup();

    // Navigate to tracking maturity
    await user.click(screen.getByRole("button", { name: /continue/i })); // Philosophy
    await user.type(screen.getByLabelText(/product called/i), "TestApp");
    await user.click(screen.getByRole("button", { name: /product/i }));
    await user.click(screen.getByRole("button", { name: /no, each user/i }));
    await user.click(screen.getByRole("button", { name: /b2c/i }));
    await user.click(screen.getByRole("checkbox", { name: /tier subscription/i }));
    await user.click(screen.getByRole("button", { name: /continue/i })); // Context -> Tracking

    // Now on tracking maturity
    expect(screen.getByText(/tell us about your current tracking/i)).toBeInTheDocument();

    // Click back
    await user.click(screen.getByRole("button", { name: /back/i }));

    // Should be back on context
    expect(screen.getByText(/what's your product called/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/routes/SetupOnboardingPage.test.tsx`
Expected: FAIL (no tracking maturity screen in flow yet)

**Step 3: Integrate the screen**

Update `src/routes/SetupOnboardingPage.tsx`:

```typescript
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { OnboardingModal } from "../components/onboarding/OnboardingModal";
import { PhilosophyScreen } from "../components/onboarding/screens/PhilosophyScreen";
import { ContextScreen } from "../components/onboarding/screens/ContextScreen";
import { TrackingMaturityScreen, TrackingMaturityData } from "../components/onboarding/screens/TrackingMaturityScreen";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Check, Map, BarChart3, List } from "lucide-react";
import { Button } from "../components/ui/button";

interface ContextData {
  productName: string;
  websiteUrl: string;
  role: string;
  hasMultiUserAccounts: boolean;
  businessType: string | undefined;
  revenueModels: string[];
}

const TOTAL_STEPS = 3; // Keep visual progress at 3 dots

export default function SetupOnboardingPage() {
  const navigate = useNavigate();
  const updateOnboarding = useMutation(api.users.updateOnboarding);
  const updateTrackingMaturity = useMutation(api.users.updateTrackingMaturity);
  const updateSetupProgress = useMutation(api.setupProgress.update);

  // Internal step: 0=philosophy, 1=context, 2=tracking, 3=briefing
  const [step, setStep] = useState(0);
  const [context, setContext] = useState<ContextData>({
    productName: "",
    websiteUrl: "",
    role: "",
    hasMultiUserAccounts: false,
    businessType: undefined,
    revenueModels: [],
  });
  const [trackingMaturity, setTrackingMaturity] = useState<TrackingMaturityData | null>(null);

  const handleContextSubmit = async (data: ContextData) => {
    setContext(data);
    try {
      await updateOnboarding({
        productName: data.productName,
        websiteUrl: data.websiteUrl,
        role: data.role,
        hasMultiUserAccounts: data.hasMultiUserAccounts,
        businessType: data.businessType,
        revenueModels: data.revenueModels,
        onboardingStep: "tracking",
      });
      setStep(2); // Go to tracking maturity
    } catch (error) {
      console.error("Failed to save onboarding data:", error);
    }
  };

  const handleTrackingMaturitySubmit = async (data: TrackingMaturityData) => {
    setTrackingMaturity(data);
    try {
      await updateTrackingMaturity({
        trackingStatus: data.trackingStatus,
        trackingPainPoint: data.trackingPainPoint,
        trackingPainPointOther: data.trackingPainPointOther,
        analyticsTools: data.analyticsTools,
      });
      setStep(3); // Go to briefing
    } catch (error) {
      console.error("Failed to save tracking maturity data:", error);
    }
  };

  const handleTrackingMaturityBack = () => {
    setStep(1); // Back to context
  };

  const handleStartInterview = async () => {
    await updateSetupProgress({
      currentStep: "overview_interview",
      stepsCompleted: ["onboarding"],
    });
    navigate("/setup/interview");
  };

  // Map internal step to visual progress (0,1 = step 0, 2 = step 1, 3 = step 2)
  const visualStep = step <= 1 ? 0 : step === 2 ? 1 : 2;

  // Determine modal size based on step
  const modalSize = step === 3 ? "wide" : "medium";

  const screens = [
    <PhilosophyScreen key="philosophy" onNext={() => setStep(1)} />,
    <ContextScreen key="context" onNext={handleContextSubmit} />,
    <TrackingMaturityScreen
      key="tracking"
      initialData={trackingMaturity ?? undefined}
      onNext={handleTrackingMaturitySubmit}
      onBack={handleTrackingMaturityBack}
    />,
    <SetupBriefingScreen
      key="briefing"
      productName={context.productName}
      onStart={handleStartInterview}
    />,
  ];

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <OnboardingModal currentStep={visualStep} totalSteps={TOTAL_STEPS} size={modalSize}>
        {screens[step]}
      </OnboardingModal>
    </div>
  );
}

// Simplified briefing screen for setup flow (doesn't call startSetup)
function SetupBriefingScreen({
  productName,
  onStart,
}: {
  productName: string;
  onStart: () => void;
}) {
  return (
    <div className="space-y-8">
      {/* Philosophy reminder */}
      <p className="text-sm text-gray-500 text-center">
        We don't track clicks - we track what matters to your business
      </p>

      {/* What you'll need checklist */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-gray-700">What you'll need now</h2>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
              <Check className="w-3 h-3 text-gray-600" />
            </div>
            <span className="text-sm text-gray-600">15 minutes of focused time</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
              <Check className="w-3 h-3 text-gray-600" />
            </div>
            <span className="text-sm text-gray-600">
              Knowledge of {productName || "your product"}'s user journey
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
              <Check className="w-3 h-3 text-gray-600" />
            </div>
            <span className="text-sm text-gray-600">
              Optional: a colleague who knows the product well
            </span>
          </div>
        </div>
      </div>

      {/* What you'll walk away with - 3 output cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-gray-700">What you'll walk away with after 15m</h2>
        <div className="grid grid-cols-3 gap-3">
          {/* User Journey Map */}
          <div className="p-4 bg-white border border-gray-200 rounded-lg space-y-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <Map className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900">User Journey Map</h3>
              <p className="text-xs text-gray-500 mt-1">
                Visual map of how users move from signup to value
              </p>
            </div>
          </div>

          {/* Measurement Plan */}
          <div className="p-4 bg-white border border-gray-200 rounded-lg space-y-3 relative">
            <span className="absolute top-2 right-2 text-[10px] text-gray-400">Coming soon</span>
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900">Measurement Plan</h3>
              <p className="text-xs text-gray-500 mt-1">
                Outcome-focused tracking: Entity + Activity + Property
              </p>
            </div>
          </div>

          {/* Metric Catalog */}
          <div className="p-4 bg-white border border-gray-200 rounded-lg space-y-3 relative">
            <span className="absolute top-2 right-2 text-[10px] text-gray-400">Coming soon</span>
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <List className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900">Metric Catalog</h3>
              <p className="text-xs text-gray-500 mt-1">
                Metrics connecting activities to business outcomes
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="space-y-3 pt-4">
        <p className="text-center text-gray-900 font-medium">
          Ready? Let's build your measurement foundation.
        </p>
        <Button onClick={onStart} className="w-full" size="lg">
          Start Interview
        </Button>
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/routes/SetupOnboardingPage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/routes/SetupOnboardingPage.tsx src/routes/SetupOnboardingPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(onboarding): integrate TrackingMaturityScreen into flow

Flow now: Philosophy → Context → TrackingMaturity → Briefing

- Added tracking step between context and briefing
- Persists tracking maturity data via updateTrackingMaturity mutation
- Back button navigates to context preserving state
- Visual progress dots stay at 3 (tracking is sub-step of context phase)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Create useTrackingMaturity Hook

**Files:**
- Create: `src/hooks/useTrackingMaturity.ts`
- Create: `src/hooks/useTrackingMaturity.test.ts`

**Step 1: Write the failing test**

Create `src/hooks/useTrackingMaturity.test.ts`:

```typescript
import { expect, test, vi, describe } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTrackingMaturity } from "./useTrackingMaturity";

// Mock useQuery to return different user states
const mockUseQuery = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: () => mockUseQuery(),
}));

describe("useTrackingMaturity", () => {
  test("returns undefined values when user has no tracking data", () => {
    mockUseQuery.mockReturnValue({
      // User without tracking data
    });

    const { result } = renderHook(() => useTrackingMaturity());

    expect(result.current.trackingStatus).toBeUndefined();
    expect(result.current.trackingPainPoint).toBeUndefined();
    expect(result.current.analyticsTools).toEqual([]);
    expect(result.current.isStartingFresh).toBe(false);
    expect(result.current.hasExistingSetup).toBe(false);
    expect(result.current.primaryTool).toBeUndefined();
  });

  test("returns tracking data from user", () => {
    mockUseQuery.mockReturnValue({
      trackingStatus: "partial",
      trackingPainPoint: "no_outcomes",
      analyticsTools: ["amplitude", "segment"],
    });

    const { result } = renderHook(() => useTrackingMaturity());

    expect(result.current.trackingStatus).toBe("partial");
    expect(result.current.trackingPainPoint).toBe("no_outcomes");
    expect(result.current.analyticsTools).toEqual(["amplitude", "segment"]);
    expect(result.current.primaryTool).toBe("amplitude");
  });

  test("isStartingFresh is true when status is none", () => {
    mockUseQuery.mockReturnValue({
      trackingStatus: "none",
      trackingPainPoint: "what_to_track",
      analyticsTools: ["none"],
    });

    const { result } = renderHook(() => useTrackingMaturity());

    expect(result.current.isStartingFresh).toBe(true);
    expect(result.current.hasExistingSetup).toBe(false);
  });

  test("hasExistingSetup is true when status is full or partial", () => {
    mockUseQuery.mockReturnValue({
      trackingStatus: "full",
      trackingPainPoint: "trust",
      analyticsTools: ["mixpanel"],
    });

    const { result } = renderHook(() => useTrackingMaturity());

    expect(result.current.isStartingFresh).toBe(false);
    expect(result.current.hasExistingSetup).toBe(true);
  });

  test("hasExistingSetup is true for partial status", () => {
    mockUseQuery.mockReturnValue({
      trackingStatus: "partial",
      trackingPainPoint: "inconsistent",
      analyticsTools: ["ga4"],
    });

    const { result } = renderHook(() => useTrackingMaturity());

    expect(result.current.hasExistingSetup).toBe(true);
  });

  test("hasExistingSetup is false for minimal status", () => {
    mockUseQuery.mockReturnValue({
      trackingStatus: "minimal",
      trackingPainPoint: "what_to_track",
      analyticsTools: ["posthog"],
    });

    const { result } = renderHook(() => useTrackingMaturity());

    expect(result.current.hasExistingSetup).toBe(false);
  });

  test("returns null values when user is null", () => {
    mockUseQuery.mockReturnValue(null);

    const { result } = renderHook(() => useTrackingMaturity());

    expect(result.current.trackingStatus).toBeUndefined();
    expect(result.current.analyticsTools).toEqual([]);
    expect(result.current.isStartingFresh).toBe(false);
    expect(result.current.hasExistingSetup).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/hooks/useTrackingMaturity.test.ts`
Expected: FAIL with "Cannot find module './useTrackingMaturity'"

**Step 3: Create the hook**

Create `src/hooks/useTrackingMaturity.ts`:

```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useTrackingMaturity() {
  const user = useQuery(api.users.current);

  return {
    trackingStatus: user?.trackingStatus,
    trackingPainPoint: user?.trackingPainPoint,
    trackingPainPointOther: user?.trackingPainPointOther,
    analyticsTools: user?.analyticsTools ?? [],
    isStartingFresh: user?.trackingStatus === "none",
    hasExistingSetup:
      user?.trackingStatus === "full" || user?.trackingStatus === "partial",
    primaryTool: user?.analyticsTools?.[0],
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/hooks/useTrackingMaturity.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/useTrackingMaturity.ts src/hooks/useTrackingMaturity.test.ts
git commit -m "$(cat <<'EOF'
feat(hooks): add useTrackingMaturity helper hook

Provides convenient access to tracking maturity data for personalization:
- Raw field values (trackingStatus, trackingPainPoint, analyticsTools)
- Derived flags (isStartingFresh, hasExistingSetup)
- Primary tool helper

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Run Full Test Suite

**Step 1: Run all tests**

Run: `npm run test:run`
Expected: All tests PASS

**Step 2: Run build to verify no type errors**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Commit any fixes if needed**

If tests or build fail, fix issues and commit:

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix: resolve test/build issues

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

| Task | Files | Purpose |
|------|-------|---------|
| 1 | `convex/schema.ts`, `convex/users.trackingMaturity.test.ts` | Add 4 schema fields |
| 2 | `convex/users.ts`, test file | Add updateTrackingMaturity mutation |
| 3 | `TrackingMaturityScreen.tsx`, test file | Create questionnaire component |
| 4 | `SetupOnboardingPage.tsx`, test file | Integrate into flow |
| 5 | `useTrackingMaturity.ts`, test file | Create helper hook |
| 6 | - | Verify full test suite |

**Total commits:** 6 (one per task)
**Test files:** 4 new test files
**New components:** 1 (TrackingMaturityScreen)
**New hooks:** 1 (useTrackingMaturity)
**Schema changes:** 4 new fields on users table
