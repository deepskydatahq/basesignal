# ProfileHeader Component Design

## Overview

ProfileHeader is a presentational component that displays at the top of the Profile page, showing product identity (name, optional description), business model badges, and a collapsed completeness indicator with progress bar.

## Problem Statement

The Profile page needs a header that shows product identity at a glance - what the product is, what business model it uses, and how complete the profile setup is. This gives users immediate context when viewing their product profile.

## Expert Perspectives

### Product
- Users need to see "what kind of business am I building?" at a glance
- B2B/B2C badges are identity signals, not infrastructure details
- Completeness indicator creates pull to fill in more sections
- Product description is optional - show it if available, omit gracefully otherwise

### Technical
- ProfileHeader is purely presentational - receives all data as props from ProfilePage
- Derive B2B from `hasMultiUserAccounts === true` OR `businessType === "b2b"`
- Keep formatting logic inline - ProductProfileCard shows this is simple enough
- Props-based data flow makes testing straightforward

### Simplification Review
- Removed BusinessModelBadge component - inline badge rendering directly
- Removed separate constants file - keep simple label mappings inline
- Single file component with no abstractions beyond what's needed

## Proposed Solution

Create `ProfileHeader.tsx` as a single presentational component that receives `identity` and `completeness` props from ProfilePage and renders inline.

## Design Details

### Props Interface

```typescript
interface ProfileHeaderProps {
  identity: {
    productName?: string;
    productDescription?: string;
    hasMultiUserAccounts?: boolean;
    businessType?: "b2b" | "b2c";
    revenueModels?: string[];
  };
  completeness: {
    completed: number;
    total: number;
  };
}
```

### Component Structure

```typescript
// src/components/profile/ProfileHeader.tsx

const REVENUE_MODEL_LABELS: Record<string, string> = {
  transactions: "Transactions",
  tier_subscription: "Tier Subscription",
  seat_subscription: "Seat Subscription",
  volume_based: "Volume Based",
};

export function ProfileHeader({ identity, completeness }: ProfileHeaderProps) {
  // Derive business type badge
  const businessTypeBadge = identity.hasMultiUserAccounts
    ? "B2B"
    : (identity.businessType === "b2b" ? "B2B" : "B2C");

  const percentage = Math.round((completeness.completed / completeness.total) * 100);

  return (
    <header className="mb-8">
      {/* Product name */}
      <h1 className="text-2xl font-bold text-gray-900">
        {identity.productName || "Your Product"}
      </h1>

      {/* Optional description */}
      {identity.productDescription && (
        <p className="mt-1 text-gray-600">{identity.productDescription}</p>
      )}

      {/* Badges + completeness row */}
      <div className="mt-3 flex items-center justify-between">
        {/* Business model badges */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-medium text-white">
            {businessTypeBadge}
          </span>
          {identity.revenueModels?.map((model) => (
            <span
              key={model}
              className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
            >
              {REVENUE_MODEL_LABELS[model] ?? model}
            </span>
          ))}
        </div>

        {/* Collapsed completeness indicator */}
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-black rounded-full transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-sm text-gray-600">
            {completeness.completed} of {completeness.total}
          </span>
        </div>
      </div>
    </header>
  );
}
```

### Visual Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Product Name                                                   │
│  One-line description (if available)                            │
│                                                                 │
│  [B2B] [Seat Subscription]              ████████░░░░ 4 of 11    │
└─────────────────────────────────────────────────────────────────┘
```

### Test Cases

```typescript
// src/components/profile/ProfileHeader.test.tsx

describe("ProfileHeader", () => {
  // Product name
  it("renders product name", () => {...});
  it("shows fallback when product name is missing", () => {...});

  // Description
  it("renders product description when provided", () => {...});
  it("omits description when not provided", () => {...});

  // Business type badge
  it("shows B2B badge when hasMultiUserAccounts is true", () => {...});
  it("shows B2B badge when businessType is b2b", () => {...});
  it("shows B2C badge when single-user and businessType is b2c", () => {...});

  // Revenue model badges
  it("renders revenue model badges with formatted labels", () => {...});
  it("handles empty revenueModels array", () => {...});
  it("handles unknown revenue model gracefully", () => {...});

  // Completeness indicator
  it("shows correct progress bar width for percentage", () => {...});
  it("shows correct count text", () => {...});
  it("handles 0% completeness", () => {...});
  it("handles 100% completeness", () => {...});
});
```

## Alternatives Considered

1. **Separate BusinessModelBadge component** - Rejected as over-engineering. The badge styling is 2 lines of Tailwind, doesn't warrant a separate component.

2. **Shared constants file for labels** - Rejected. Only 4 revenue model mappings, defined inline in the component. Easy to find, easy to change.

3. **ProfileHeader fetches its own data** - Rejected. ProfilePage is the container that fetches data; ProfileHeader should be purely presentational for testability.

## Success Criteria

- [ ] `src/components/profile/ProfileHeader.tsx` exists
- [ ] Displays product name and description from profile data
- [ ] Shows business model badges (B2B/B2C + revenue models)
- [ ] Shows collapsed completeness indicator (progress bar + count)
- [ ] Component has tests covering various data states
