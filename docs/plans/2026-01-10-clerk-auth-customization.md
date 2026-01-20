# Clerk Auth Customization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Style Clerk auth components to match Basesignal's design system so login/signup feels native to the product.

**Architecture:** Create a centralized Clerk theme configuration that maps CSS custom properties to Clerk's Theme API. Apply the theme at ClerkProvider level, then refine element-specific overrides in AuthPage. Extract shared appearance config to avoid duplication between SignIn and SignUp.

**Tech Stack:** Clerk Theme API (`@clerk/clerk-react` v5), CSS custom properties, TypeScript

---

## Task 1: Create Clerk Theme Configuration

**Files:**
- Create: `src/lib/clerkTheme.ts`
- Test: `src/lib/clerkTheme.test.ts`

**Step 1: Write the test for theme configuration**

Create a test that verifies the theme configuration exports the correct structure and values.

```typescript
// src/lib/clerkTheme.test.ts
import { describe, expect, test } from "vitest";
import { clerkTheme, clerkAppearance } from "./clerkTheme";

describe("clerkTheme", () => {
  test("exports variables with correct color mappings", () => {
    expect(clerkTheme.variables).toBeDefined();
    expect(clerkTheme.variables?.colorPrimary).toBe("hsl(0, 0%, 0%)");
    expect(clerkTheme.variables?.colorBackground).toBe("hsl(0, 0%, 100%)");
    expect(clerkTheme.variables?.colorText).toBe("hsl(0, 0%, 7%)");
    expect(clerkTheme.variables?.colorDanger).toBe("hsl(0, 84%, 60%)");
  });

  test("exports variables with correct border radius", () => {
    expect(clerkTheme.variables?.borderRadius).toBe("0.375rem");
  });
});

describe("clerkAppearance", () => {
  test("exports elements with correct class overrides", () => {
    expect(clerkAppearance.elements).toBeDefined();
    expect(clerkAppearance.elements?.rootBox).toBe("w-full");
    expect(clerkAppearance.elements?.card).toBe("shadow-none w-full");
    expect(clerkAppearance.elements?.footerAction).toBe("hidden");
  });

  test("exports elements with correct form styling", () => {
    expect(clerkAppearance.elements?.formFieldInput).toBe("h-12");
    expect(clerkAppearance.elements?.formButtonPrimary).toContain("h-12");
    expect(clerkAppearance.elements?.formButtonPrimary).toContain("bg-neutral-900");
  });

  test("exports elements with correct typography styling", () => {
    expect(clerkAppearance.elements?.headerTitle).toContain("text-2xl");
    expect(clerkAppearance.elements?.headerTitle).toContain("font-semibold");
    expect(clerkAppearance.elements?.headerSubtitle).toContain("text-neutral-500");
  });

  test("exports elements with correct social button styling", () => {
    expect(clerkAppearance.elements?.socialButtonsBlockButton).toContain("h-12");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/clerkTheme.test.ts`
Expected: FAIL with "Cannot find module './clerkTheme'"

**Step 3: Write the theme configuration**

```typescript
// src/lib/clerkTheme.ts
import type { Theme, Appearance } from "@clerk/types";

/**
 * Clerk theme configuration mapping to Basesignal design system.
 *
 * CSS variable reference (from src/index.css):
 * - --primary: 0 0% 0% (black)
 * - --background: 0 0% 100% (white)
 * - --foreground: 0 0% 7% (near black)
 * - --secondary: 0 0% 96% (light gray)
 * - --destructive: 0 84% 60% (red)
 * - --border: 0 0% 90% (light gray)
 * - --radius: 0.375rem (6px)
 */
export const clerkTheme: Theme = {
  variables: {
    colorPrimary: "hsl(0, 0%, 0%)",
    colorBackground: "hsl(0, 0%, 100%)",
    colorInputBackground: "hsl(0, 0%, 96%)",
    colorText: "hsl(0, 0%, 7%)",
    colorTextSecondary: "hsl(0, 0%, 45%)",
    colorDanger: "hsl(0, 84%, 60%)",
    borderRadius: "0.375rem",
  },
};

/**
 * Shared appearance configuration for SignIn and SignUp components.
 * Uses Tailwind classes for element-specific styling.
 */
export const clerkAppearance: Appearance = {
  elements: {
    rootBox: "w-full",
    card: "shadow-none w-full",
    headerTitle: "text-2xl font-semibold",
    headerSubtitle: "text-neutral-500",
    socialButtonsBlockButton: "h-12 text-base",
    formFieldInput: "h-12",
    formButtonPrimary: "h-12 text-base bg-neutral-900 hover:bg-neutral-800",
    footerAction: "hidden",
  },
};
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/clerkTheme.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/clerkTheme.ts src/lib/clerkTheme.test.ts
git commit -m "$(cat <<'EOF'
feat: add Clerk theme configuration

Create centralized theme config mapping Basesignal design system
CSS variables to Clerk Theme API. Includes both theme variables
and shared appearance config for auth components.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Apply Theme to ClerkProvider

**Files:**
- Modify: `src/lib/auth.tsx`
- Test: `src/lib/auth.test.tsx` (create)

**Step 1: Write the test for AuthProvider with theme**

```typescript
// src/lib/auth.test.tsx
import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthProvider } from "./auth";

// Mock Clerk and Convex
vi.mock("@clerk/clerk-react", () => ({
  ClerkProvider: ({ children, appearance }: { children: React.ReactNode; appearance?: unknown }) => (
    <div data-testid="clerk-provider" data-appearance={JSON.stringify(appearance)}>
      {children}
    </div>
  ),
  useAuth: () => ({ isLoaded: true, isSignedIn: false }),
}));

vi.mock("convex/react-clerk", () => ({
  ConvexProviderWithClerk: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="convex-provider">{children}</div>
  ),
}));

vi.mock("convex/react", () => ({
  ConvexReactClient: vi.fn(),
}));

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_123");
    vi.stubEnv("VITE_CONVEX_URL", "https://test.convex.cloud");
  });

  test("renders children within providers", () => {
    render(
      <AuthProvider>
        <div data-testid="child">Test Child</div>
      </AuthProvider>
    );

    expect(screen.getByTestId("clerk-provider")).toBeInTheDocument();
    expect(screen.getByTestId("convex-provider")).toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  test("passes appearance config to ClerkProvider", () => {
    render(
      <AuthProvider>
        <div>Test</div>
      </AuthProvider>
    );

    const clerkProvider = screen.getByTestId("clerk-provider");
    const appearance = JSON.parse(clerkProvider.getAttribute("data-appearance") || "{}");

    expect(appearance.baseTheme).toBeDefined();
    expect(appearance.variables?.colorPrimary).toBe("hsl(0, 0%, 0%)");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/auth.test.tsx`
Expected: FAIL with "appearance config" assertion failure (since theme not yet applied)

**Step 3: Update AuthProvider to include theme**

```typescript
// src/lib/auth.tsx
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { clerkTheme } from "./clerkTheme";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in environment");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      appearance={{
        baseTheme: clerkTheme,
        variables: clerkTheme.variables,
      }}
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

export { convex };
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/auth.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/auth.tsx src/lib/auth.test.tsx
git commit -m "$(cat <<'EOF'
feat: apply Clerk theme to AuthProvider

Configure ClerkProvider with Basesignal theme variables for
consistent auth component styling across the app.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Refactor AuthPage to Use Shared Appearance

**Files:**
- Modify: `src/routes/AuthPage.tsx`
- Test: `src/routes/AuthPage.test.tsx` (create)

**Step 1: Write the test for AuthPage**

```typescript
// src/routes/AuthPage.test.tsx
import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthPage from "./AuthPage";

// Mock Clerk components
vi.mock("@clerk/clerk-react", () => ({
  SignIn: ({ appearance }: { appearance?: { elements?: Record<string, string> } }) => (
    <div data-testid="sign-in" data-appearance={JSON.stringify(appearance)}>
      Sign In Form
    </div>
  ),
  SignUp: ({ appearance }: { appearance?: { elements?: Record<string, string> } }) => (
    <div data-testid="sign-up" data-appearance={JSON.stringify(appearance)}>
      Sign Up Form
    </div>
  ),
}));

function setup() {
  const user = userEvent.setup();
  render(<AuthPage />);
  return { user };
}

describe("AuthPage", () => {
  test("renders sign in form by default", () => {
    setup();
    expect(screen.getByTestId("sign-in")).toBeInTheDocument();
    expect(screen.queryByTestId("sign-up")).not.toBeInTheDocument();
  });

  test("renders brand name in left panel", () => {
    setup();
    expect(screen.getByText("Basesignal")).toBeInTheDocument();
  });

  test("switches to sign up when clicking sign up link", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /sign up/i }));

    expect(screen.getByTestId("sign-up")).toBeInTheDocument();
    expect(screen.queryByTestId("sign-in")).not.toBeInTheDocument();
  });

  test("switches back to sign in when clicking sign in link", async () => {
    const { user } = setup();

    // First switch to sign up
    await user.click(screen.getByRole("button", { name: /sign up/i }));
    expect(screen.getByTestId("sign-up")).toBeInTheDocument();

    // Then switch back to sign in
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(screen.getByTestId("sign-in")).toBeInTheDocument();
  });

  test("passes appearance config to SignIn component", () => {
    setup();
    const signIn = screen.getByTestId("sign-in");
    const appearance = JSON.parse(signIn.getAttribute("data-appearance") || "{}");

    expect(appearance.elements?.rootBox).toBe("w-full");
    expect(appearance.elements?.card).toBe("shadow-none w-full");
    expect(appearance.elements?.footerAction).toBe("hidden");
  });

  test("passes appearance config to SignUp component", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /sign up/i }));

    const signUp = screen.getByTestId("sign-up");
    const appearance = JSON.parse(signUp.getAttribute("data-appearance") || "{}");

    expect(appearance.elements?.rootBox).toBe("w-full");
    expect(appearance.elements?.card).toBe("shadow-none w-full");
    expect(appearance.elements?.footerAction).toBe("hidden");
  });
});
```

**Step 2: Run test to verify it passes (existing code should work)**

Run: `npm run test:run -- src/routes/AuthPage.test.tsx`
Expected: PASS (existing implementation already has these values inline)

**Step 3: Refactor AuthPage to use shared appearance**

```typescript
// src/routes/AuthPage.tsx
import { SignIn, SignUp } from "@clerk/clerk-react";
import { useState } from "react";
import { clerkAppearance } from "../lib/clerkTheme";

export default function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  return (
    <div className="min-h-screen flex">
      {/* Left panel - Brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-neutral-100 items-end p-12">
        <div className="text-2xl font-semibold tracking-tight">Basesignal</div>
      </div>

      {/* Right panel - Auth */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {mode === "signin" ? (
            <SignIn
              appearance={clerkAppearance}
              forceRedirectUrl="/"
            />
          ) : (
            <SignUp
              appearance={clerkAppearance}
              forceRedirectUrl="/"
            />
          )}

          <div className="mt-4 text-center text-sm text-neutral-500">
            {mode === "signin" ? (
              <>
                Don't have an account?{" "}
                <button
                  onClick={() => setMode("signup")}
                  className="text-neutral-900 underline font-medium"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => setMode("signin")}
                  className="text-neutral-900 underline font-medium"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it still passes**

Run: `npm run test:run -- src/routes/AuthPage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/routes/AuthPage.tsx src/routes/AuthPage.test.tsx
git commit -m "$(cat <<'EOF'
refactor: use shared Clerk appearance in AuthPage

Replace inline appearance configuration with imported clerkAppearance
from centralized theme file. Reduces duplication between SignIn and
SignUp components.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Run Full Test Suite and Verify

**Files:**
- None (verification only)

**Step 1: Run the full test suite**

Run: `npm run test:run`
Expected: All tests pass

**Step 2: Start dev server and visually verify**

Run: `npm run dev` (in separate terminal with `npx convex dev`)
Expected: Visit `/auth` and verify:
- Sign in/up forms use black primary buttons
- Input fields have consistent height (h-12)
- Typography matches design system
- No Clerk branding/footer visible
- Smooth transitions between sign in/up modes

**Step 3: Final commit (if any adjustments needed)**

Only if visual testing reveals issues that need code changes.

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Create Clerk theme config | `src/lib/clerkTheme.ts`, `src/lib/clerkTheme.test.ts` |
| 2 | Apply theme to ClerkProvider | `src/lib/auth.tsx`, `src/lib/auth.test.tsx` |
| 3 | Refactor AuthPage | `src/routes/AuthPage.tsx`, `src/routes/AuthPage.test.tsx` |
| 4 | Verify full suite | Run tests and visual check |

**Total new files:** 4 (2 source, 2 test)
**Modified files:** 2 (`auth.tsx`, `AuthPage.tsx`)
