# Logo Placeholder with Colored Initials Design

## Overview

Add a colored initial avatar to ProfileHeader that provides instant visual product identification. The avatar displays the first letter of the product name on a deterministically-selected background color.

## Problem Statement

Products need a unique visual identity without requiring users to upload an actual logo. A colored initial avatar provides immediate recognition while keeping setup friction at zero.

## Expert Perspectives

### Product
- Single-letter initials are sufficient - users navigate between products they already know
- The magic moment is "I instantly know which product this is," not "wow, beautiful avatar"
- 40-48px left-aligned placement works best - doesn't compete with performance data
- Curated color palette ensures all avatars look intentional and trustworthy

### Technical
- Extract color logic as a pure utility function for testability and potential reuse
- Consolidate ProfilePage to use ProfileHeader as single source of truth
- Simple hash-to-palette-index approach for deterministic colors

### Simplification Review
- Keep utility function minimal - just `getProductColor()` and `getProductInitial()`
- Inline Tailwind classes, no complex abstractions
- Tests focus on component behavior, not over-testing trivial logic
- Use a small curated palette (10-12 colors) rather than algorithmic generation

## Proposed Solution

### 1. Create minimal utility functions

Add `src/lib/productColor.ts` with two pure functions:
- `getProductColor(name)` - returns hex color from curated palette based on simple hash
- `getProductInitial(name)` - returns uppercase first letter or "?" fallback

### 2. Update ProfileHeader component

Add a 48x48px circular avatar to the left of the product name:
- White text on colored background
- `aria-hidden="true"` since product name is in heading
- Responsive with `flex-shrink-0`

### 3. Consolidate ProfilePage

Remove the duplicate inline header in ProfilePage and use ProfileHeader as the single source of truth.

## Design Details

### Color Palette

12 curated colors that work well with white text:
```
Blue, Violet, Pink, Red, Orange, Amber, Green, Teal, Cyan, Indigo, Purple, Sky
```

### Initial Extraction

| Input | Output |
|-------|--------|
| "Basesignal" | "B" |
| "acme corp" | "A" |
| "" or undefined | "?" |
| "  hello" | "H" |

### Layout

```
+------+  Product Name
|  B   |  Optional description...
+------+

[B2B] [Subscription]                    [====----] 4 of 11
```

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/productColor.ts` | Create - utility functions |
| `src/lib/productColor.test.ts` | Create - unit tests |
| `src/components/profile/ProfileHeader.tsx` | Modify - add avatar |
| `src/components/profile/ProfileHeader.test.tsx` | Modify - add avatar tests |
| `src/components/profile/ProfilePage.tsx` | Modify - use ProfileHeader |

## Alternatives Considered

1. **Two-letter initials** - Rejected. Adds complexity for edge cases without meaningful differentiation.
2. **Algorithmic hue generation** - Rejected. Could produce muddy or clashing colors.
3. **Inline color logic** - Considered but utility function better for testing requirement.
4. **Large avatar (56-64px)** - Rejected. Would compete with the performance data.

## Success Criteria

- ProfileHeader displays colored initial avatar
- Same product name always produces same color
- Avatar integrates cleanly with existing header layout
- Tests pass for color generation and initial extraction
- ProfilePage uses ProfileHeader (no duplicate header code)
