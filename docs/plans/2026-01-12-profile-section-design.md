# ProfileSection Wrapper Component Design

## Overview

ProfileSection is a reusable wrapper component that provides consistent visual treatment for all profile page sections. It handles four states (complete, in_progress, not_started, locked) with appropriate styling, status badges, and action buttons.

## Problem Statement

The Profile page has 11 sections that need consistent card styling, status indicators, and action buttons. Rather than duplicating this logic across each section component, a wrapper provides the shared structure while allowing each section to render its own content.

## Expert Perspectives

### Product
- Badge text should show informational content ("12 metrics") not just status labels ("Complete")
- This collapses two cognitive tasks into one glance - completion status AND quantitative progress
- Locked sections need prerequisite text to explain what's blocking them

### Technical
- Keep status types local to ProfileSection - no coupling with StageCard
- Use structured action props (`actionLabel`, `onAction`) - predictable and testable
- Parent provides `statusLabel` explicitly - some sections show counts, others show status text
- Wrapper pattern - wraps children, doesn't prescribe content structure

### Simplification Review
- Removed `action?: ReactNode` escape hatch - structured props handle all real cases
- Kept `statusLabel` as required prop - needed for informational badges like "12 metrics"
- Single file component with STATUS_CONFIG for visual mapping

## Proposed Solution

Create `ProfileSection.tsx` as a wrapper component that accepts title, status, statusLabel, children, and action props. The status prop controls visual treatment (icon, colors, border style), while statusLabel controls the badge text.

## Design Details

### Props Interface

```typescript
export type ProfileSectionStatus =
  | "complete"
  | "in_progress"
  | "not_started"
  | "locked";

interface ProfileSectionProps {
  title: string;
  status: ProfileSectionStatus;
  statusLabel: string;
  children: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  prerequisiteText?: string;  // For locked state
}
```

### Visual Treatment by Status

| Status | Icon | Badge Color | Border | Opacity | Action |
|--------|------|-------------|--------|---------|--------|
| `complete` | Check (green) | green-700 | solid | 100% | Enabled |
| `in_progress` | Circle (filled) | blue-600 | solid | 100% | Enabled |
| `not_started` | Circle (empty) | gray-500 | solid | 100% | Enabled |
| `locked` | Lock | gray-400 | dashed | 50% | Disabled |

### Component Structure

```
ProfileSection
├── Header row: title + status badge (icon + statusLabel)
├── Separator line
├── Children slot (arbitrary content)
└── Footer: action button (+ prerequisiteText if locked)
```

### Implementation

```typescript
// src/components/profile/ProfileSection.tsx

import { Check, Circle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ProfileSectionStatus =
  | "complete"
  | "in_progress"
  | "not_started"
  | "locked";

interface ProfileSectionProps {
  title: string;
  status: ProfileSectionStatus;
  statusLabel: string;
  children: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  prerequisiteText?: string;
}

const STATUS_CONFIG: Record<ProfileSectionStatus, {
  icon: React.ReactNode;
  badgeClass: string;
}> = {
  complete: {
    icon: <Check className="w-4 h-4" />,
    badgeClass: "text-green-700",
  },
  in_progress: {
    icon: <Circle className="w-4 h-4 fill-current" />,
    badgeClass: "text-blue-600",
  },
  not_started: {
    icon: <Circle className="w-4 h-4" />,
    badgeClass: "text-gray-500",
  },
  locked: {
    icon: <Lock className="w-4 h-4" />,
    badgeClass: "text-gray-400",
  },
};

export function ProfileSection({
  title,
  status,
  statusLabel,
  children,
  actionLabel,
  onAction,
  prerequisiteText,
}: ProfileSectionProps) {
  const config = STATUS_CONFIG[status];
  const isLocked = status === "locked";

  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-6 mb-6",
        isLocked
          ? "border-dashed border-gray-300 opacity-50"
          : "border-gray-200"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <div className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium",
          config.badgeClass
        )}>
          <span>{statusLabel}</span>
          {config.icon}
        </div>
      </div>

      <hr className="border-gray-200 mb-4" />

      {/* Content */}
      <div className="mb-4">{children}</div>

      {/* Action */}
      {actionLabel && (
        <div className="flex justify-end items-center gap-2">
          {isLocked && prerequisiteText && (
            <span className="text-xs text-gray-400">{prerequisiteText}</span>
          )}
          <Button
            variant={isLocked ? "outline" : "secondary"}
            onClick={onAction}
            disabled={isLocked}
          >
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
```

### Usage Examples

```tsx
// Complete with informational badge
<ProfileSection
  title="Metric Catalog"
  status="complete"
  statusLabel="12 metrics"
  actionLabel="View Full Catalog"
  onAction={() => navigate('/metric-catalog')}
>
  <MetricGrid metrics={metrics} />
</ProfileSection>

// Locked future section
<ProfileSection
  title="Heartbeat Event"
  status="locked"
  statusLabel="Not Defined"
  actionLabel="Define with Interview"
  prerequisiteText="Requires: Overview Interview"
>
  <p className="text-sm text-gray-500">
    The single event that indicates a user is active.
  </p>
</ProfileSection>
```

### Test Cases

```typescript
// src/components/profile/ProfileSection.test.tsx

describe("ProfileSection", () => {
  // Four states
  it("renders complete state with green checkmark", () => {...});
  it("renders in_progress state with blue indicator", () => {...});
  it("renders not_started state with gray circle", () => {...});
  it("renders locked state with dashed border and disabled action", () => {...});

  // Badge text
  it("displays informational status label", () => {...});

  // Actions
  it("calls onAction when button clicked", () => {...});
  it("disables action button for locked state", () => {...});
  it("shows prerequisite text for locked state", () => {...});

  // Children
  it("renders children content", () => {...});
});
```

## Alternatives Considered

1. **Shared status config with StageCard** - Rejected. Creates false coupling - visual treatments differ between components.

2. **Derived statusLabel from status** - Rejected. Design doc shows informational badges ("12 metrics") that can't be derived from status enum alone.

3. **Action escape hatch (ReactNode)** - Rejected. Structured props handle all real use cases; escape hatch adds complexity without benefit.

## Success Criteria

- [ ] `src/components/profile/ProfileSection.tsx` exists
- [ ] Accepts title, status, children, and action props
- [ ] Renders correct visual treatment based on status prop
- [ ] Status badge shows appropriate icon and text
- [ ] Grayed/dashed style applies for locked state
- [ ] Component has tests for all four states
