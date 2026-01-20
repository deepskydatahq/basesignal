# FutureSectionCard Component Design

## Overview

FutureSectionCard is a thin convenience wrapper around ProfileSection for rendering placeholder sections that aren't yet available. It provides a semantic API for "future" sections while delegating all styling and behavior to ProfileSection.

## Problem Statement

The Profile page has 6 future sections (Heartbeat, Activation, Active, At-Risk, Churn, Expansion) that need placeholder UI. These sections show users what's coming and what prerequisites must be met before they can access the interview.

## Expert Perspectives

### Product
- "Ready but disabled" state creates user confusion - sections should either be locked (prerequisite not met) or fully functional
- The `isReady` prop serves the builder tracking implementation progress, not the user understanding what they can do
- Keep prerequisites as the only signal - sections are either locked or their real component

### Technical
- Use ProfileSection wrapper internally - thin composition over duplication
- FutureSectionCard is a "state selector" that maps props to ProfileSection's locked/not_started states
- One-liner glue code rather than duplicating opacity/border/button logic

### Simplification Review
- **Key insight**: ProfileSection already handles locked state completely (50% opacity, dashed border, disabled button, prerequisite text)
- FutureSectionCard is a semantic convenience wrapper, not a new abstraction
- Could be eliminated entirely by using ProfileSection directly with `status="locked"`
- Kept as thin wrapper for call-site clarity ("this is a future section")

## Proposed Solution

Create `FutureSectionCard.tsx` as a minimal wrapper that:
1. Maps its props to ProfileSection props
2. Uses `status="locked"` or `status="not_started"` based on `isReady`
3. Adds no custom styling or logic

## Design Details

### Props Interface

```typescript
interface FutureSectionCardProps {
  title: string;
  description: string;
  prerequisite: string;
  isReady: boolean;
}
```

### State Mapping

| isReady | ProfileSection status | Visual Treatment |
|---------|----------------------|------------------|
| `false` | `locked` | 50% opacity, dashed border, disabled button, prerequisite shown |
| `true` | `not_started` | Full opacity, solid border, enabled button |

### Implementation

```typescript
// src/components/profile/FutureSectionCard.tsx

import { ProfileSection } from "./ProfileSection";

interface FutureSectionCardProps {
  title: string;
  description: string;
  prerequisite: string;
  isReady: boolean;
}

export function FutureSectionCard({
  title,
  description,
  prerequisite,
  isReady,
}: FutureSectionCardProps) {
  return (
    <ProfileSection
      title={title}
      status={isReady ? "not_started" : "locked"}
      statusLabel="Not Defined"
      actionLabel="Start Interview"
      prerequisiteText={!isReady ? prerequisite : undefined}
    >
      <p className="text-sm text-gray-500">{description}</p>
    </ProfileSection>
  );
}
```

### Usage Example

```tsx
<FutureSectionCard
  title="Heartbeat Event"
  description="The single event that indicates a user is active. If they do this, they're engaged. If not, at risk."
  prerequisite="Requires: Overview Interview"
  isReady={false}
/>
```

### Test Cases

```typescript
// src/components/profile/FutureSectionCard.test.tsx

describe("FutureSectionCard", () => {
  describe("locked state (isReady=false)", () => {
    it("renders with locked status styling via ProfileSection");
    it("shows prerequisite text");
    it("disables the action button");
  });

  describe("ready state (isReady=true)", () => {
    it("renders with not_started status styling via ProfileSection");
    it("does not show prerequisite text");
    it("enables the action button");
  });
});
```

## Alternatives Considered

1. **Standalone component with own styling** - Rejected. Duplicates ProfileSection logic for opacity, borders, and buttons.

2. **Remove FutureSectionCard entirely** - Considered valid. ProfileSection handles everything. Kept wrapper for semantic clarity at call sites.

3. **Remove isReady prop** - Product expert recommended this. Kept per issue requirements, but noted the "ready but disabled" state may cause user confusion.

## Success Criteria

- [x] `src/components/profile/FutureSectionCard.tsx` exists
- [x] Accepts title, description, prerequisite, and isReady props
- [x] Renders with 50% opacity and dashed border when locked (via ProfileSection)
- [x] Shows prerequisite text when locked (via ProfileSection)
- [x] Shows "Start Interview" button when ready (via ProfileSection)
- [x] Component has tests for locked and ready states
