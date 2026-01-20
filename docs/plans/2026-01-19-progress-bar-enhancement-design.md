# Progress Bar Enhancement Design

## Overview

Enhance the ProfileHeader progress bar with proper accessibility attributes and explicit animation timing while keeping it visually subtle.

## Problem Statement

The current progress bar lacks ARIA attributes for screen readers and has implicit animation timing. Users with assistive technologies cannot perceive the progress state.

## Expert Perspectives

### Product
Keep the progress bar subtle. Setup completion is a *means*, not the *end*—the user's real job is discovering what their product's P&L looks like. Focus visual hierarchy on product identity information; use the progress indicator as a gentle signal that more insights await.

### Technical
"Prominent" and "subtle" aren't opposites—prominent means *clear and truthful* (good contrast, accurate state), subtle means *not demanding attention*. Stick with CSS transitions over Framer Motion—you're solving "smooth animation" not "complex choreography." A linear easing that completes in 300-400ms communicates "deterministic work."

### Simplification Review
Removed:
- Green completion state at 100% (cosmetic, doesn't add information)
- Over-specified timing rationale (use standard Tailwind duration)
- Redundant aria-label (the visible text "X of Y" serves as accessible context)

Kept (required by issue):
- ARIA progressbar role and value attributes (hard requirement)
- Explicit transition property for predictable animation

## Proposed Solution

Add minimal ARIA attributes and explicit animation timing to the existing progress bar without changing its visual design.

## Design Details

### Changes to ProfileHeader

```tsx
{/* Progress bar with accessibility */}
<div className="flex items-center gap-2">
  <div
    role="progressbar"
    aria-valuenow={percentage}
    aria-valuemin={0}
    aria-valuemax={100}
    className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden"
  >
    <div
      data-testid="progress-bar-fill"
      className="h-full bg-black rounded-full transition-[width] duration-300"
      style={{ width: `${percentage}%` }}
    />
  </div>
  <span className="text-sm text-gray-600">
    {completeness.completed} of {completeness.total}
  </span>
</div>
```

### Key Changes

1. **Add `role="progressbar"`** - Identifies the element as a progress indicator
2. **Add `aria-valuenow={percentage}`** - Current progress value
3. **Add `aria-valuemin={0}` and `aria-valuemax={100}`** - Value range
4. **Change `transition-all` to `transition-[width] duration-300`** - Explicit property and timing

### What Stays the Same

- Visual size (w-24 h-2)
- Colors (bg-gray-200 background, bg-black fill)
- Position in header
- "X of Y" text label

## Alternatives Considered

1. **Full-width prominent bar** - Rejected: shifts focus away from product identity
2. **Green completion state** - Rejected: cosmetic, bar filling completely already signals done
3. **Framer Motion animations** - Rejected: overkill for simple progress bar
4. **Separate ProgressBar component** - Rejected: over-abstraction for single use

## Success Criteria

- Screen readers announce progress percentage
- Animation is smooth and predictable (300ms)
- Visual appearance unchanged (subtle, not demanding)
- Tests verify ARIA attributes and animation classes
