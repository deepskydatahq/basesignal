# Favicon Visual Identity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Display website favicon in ProfileHeader avatar, falling back to text initial when unavailable.

**Architecture:** Add `websiteUrl` to ProfileHeader props, extract domain to build Google Favicon API URL, render as img with onError fallback to existing initial-based avatar.

**Tech Stack:** React, Google Favicon API (`https://www.google.com/s2/favicons?domain={domain}&sz=128`)

---

## Task 1: Add websiteUrl to ProfileHeader Props Interface

**Files:**
- Modify: `src/components/profile/ProfileHeader.tsx:14-21`
- Test: `src/components/profile/ProfileHeader.test.tsx`

**Step 1: Write the failing test**

Add to `ProfileHeader.test.tsx`:

```typescript
test("renders favicon image when websiteUrl is provided", () => {
  setup({
    identity: {
      productName: "Basesignal",
      websiteUrl: "https://basesignal.net",
    },
  });

  const avatar = screen.getByLabelText("Product avatar");
  const img = avatar.querySelector("img");
  expect(img).toBeInTheDocument();
  expect(img).toHaveAttribute(
    "src",
    "https://www.google.com/s2/favicons?domain=basesignal.net&sz=128"
  );
  expect(img).toHaveAttribute("alt", "Basesignal favicon");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- ProfileHeader.test.tsx`
Expected: FAIL - no img element found in avatar

**Step 3: Add websiteUrl to props interface**

In `ProfileHeader.tsx`, update the identity interface (around line 15):

```typescript
interface ProfileHeaderProps {
  identity: {
    productName?: string;
    productDescription?: string;
    websiteUrl?: string;
    hasMultiUserAccounts?: boolean;
    businessType?: "b2b" | "b2c";
    revenueModels?: string[];
  };
  completeness: {
    completed: number;
    total: number;
  };
  stats?: {
    metricsCount: number;
    entitiesCount: number;
    activitiesCount: number;
  };
}
```

**Step 4: Add domain extraction helper**

Add this helper function near the top of `ProfileHeader.tsx` (after the imports):

```typescript
function extractDomain(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
```

**Step 5: Update avatar rendering with favicon**

Replace the avatar div (lines 55-62) with:

```typescript
{/* Logo avatar */}
<div
  aria-label="Product avatar"
  className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-semibold overflow-hidden"
  style={{ backgroundColor }}
>
  {(() => {
    const domain = extractDomain(identity.websiteUrl);
    if (domain) {
      return (
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
          alt={`${identity.productName || "Product"} favicon`}
          className="w-8 h-8"
          onError={(e) => {
            // Replace img with initial on error
            const target = e.currentTarget;
            target.style.display = "none";
            target.parentElement!.textContent = initial;
          }}
        />
      );
    }
    return initial;
  })()}
</div>
```

**Step 6: Run test to verify it passes**

Run: `npm test -- ProfileHeader.test.tsx`
Expected: PASS

**Step 7: Commit**

```bash
git add src/components/profile/ProfileHeader.tsx src/components/profile/ProfileHeader.test.tsx
git commit -m "$(cat <<'EOF'
feat: add favicon support to ProfileHeader avatar

Display website favicon using Google's favicon API when websiteUrl
is available, with fallback to initial-based avatar.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add Test for Fallback When websiteUrl Missing

**Files:**
- Test: `src/components/profile/ProfileHeader.test.tsx`

**Step 1: Write the test**

Add to `ProfileHeader.test.tsx`:

```typescript
test("renders initial avatar when websiteUrl is not provided", () => {
  setup({
    identity: {
      productName: "Basesignal",
      // No websiteUrl
    },
  });

  const avatar = screen.getByLabelText("Product avatar");
  expect(avatar).toHaveTextContent("B");
  expect(avatar.querySelector("img")).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it passes**

Run: `npm test -- ProfileHeader.test.tsx`
Expected: PASS (existing behavior preserved)

**Step 3: Commit**

```bash
git add src/components/profile/ProfileHeader.test.tsx
git commit -m "$(cat <<'EOF'
test: verify fallback to initial when no websiteUrl

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add Test for Invalid URL Handling

**Files:**
- Test: `src/components/profile/ProfileHeader.test.tsx`

**Step 1: Write the test**

Add to `ProfileHeader.test.tsx`:

```typescript
test("renders initial avatar when websiteUrl is invalid", () => {
  setup({
    identity: {
      productName: "Basesignal",
      websiteUrl: "not-a-valid-url",
    },
  });

  const avatar = screen.getByLabelText("Product avatar");
  expect(avatar).toHaveTextContent("B");
  expect(avatar.querySelector("img")).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it passes**

Run: `npm test -- ProfileHeader.test.tsx`
Expected: PASS (extractDomain returns null for invalid URLs)

**Step 3: Commit**

```bash
git add src/components/profile/ProfileHeader.test.tsx
git commit -m "$(cat <<'EOF'
test: verify fallback for invalid websiteUrl

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add Test for Favicon Load Error Fallback

**Files:**
- Test: `src/components/profile/ProfileHeader.test.tsx`

**Step 1: Write the test**

Add to `ProfileHeader.test.tsx`:

```typescript
test("falls back to initial when favicon fails to load", () => {
  setup({
    identity: {
      productName: "Basesignal",
      websiteUrl: "https://nonexistent-domain-12345.com",
    },
  });

  const avatar = screen.getByLabelText("Product avatar");
  const img = avatar.querySelector("img");
  expect(img).toBeInTheDocument();

  // Simulate image load error
  fireEvent.error(img!);

  // Image should be hidden, initial should show
  expect(img).toHaveStyle({ display: "none" });
  expect(avatar).toHaveTextContent("B");
});
```

Note: Add `fireEvent` to imports at top of test file:

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
```

**Step 2: Run test to verify it passes**

Run: `npm test -- ProfileHeader.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/ProfileHeader.test.tsx
git commit -m "$(cat <<'EOF'
test: verify fallback when favicon fails to load

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Run Full Test Suite

**Step 1: Run all tests**

Run: `npm test -- --run`
Expected: All tests pass

**Step 2: Commit if any fixes needed**

If tests fail, fix and commit with appropriate message.

---

## Summary

| Task | Description | Files Modified |
|------|-------------|----------------|
| 1 | Add favicon to ProfileHeader | ProfileHeader.tsx, ProfileHeader.test.tsx |
| 2 | Test fallback without websiteUrl | ProfileHeader.test.tsx |
| 3 | Test invalid URL handling | ProfileHeader.test.tsx |
| 4 | Test favicon load error fallback | ProfileHeader.test.tsx |
| 5 | Run full test suite | - |

**Total: 5 tasks**

**Key implementation notes:**
- `websiteUrl` is already in the Convex schema and returned by `api.profile.getProfileData`
- `ProfilePage` spreads `identity` to `ProfileHeader`, so `websiteUrl` will automatically flow through
- No changes needed to ProfilePage or Convex - just ProfileHeader
