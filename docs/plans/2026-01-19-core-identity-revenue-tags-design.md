# CoreIdentitySection Revenue Model Tags Design

## Overview

Display revenue models as inline visual tag chips instead of plain text in the CoreIdentitySection, making the completed state feel more polished and rewarding.

## Problem Statement

Currently revenue models display as comma-separated plain text: "Transactions, Tier subscription". This feels utilitarian rather than celebrating the user's completed work. Visual chips would make the display richer and more satisfying.

## Expert Perspectives

### Product
- Focus on the transformation: users completing the interview should feel rewarded
- Visual chips are more scannable than comma-separated text
- The enhancement is purely visual - same information, better presentation

### Technical
- Follow existing CategoryBadge pattern for consistency
- Use `Record<Type, config>` pattern for type-safe mapping
- Keep styling decisions close to type definitions

### Simplification Review

The initial design proposed a separate `RevenueModelBadge` component with its own file, type exports, and test file. This was over-engineered for the use case:

**Removed:**
- Separate component file (`RevenueModelBadge.tsx`)
- New type export (`RevenueModelType`)
- Separate test file

**Simplified:**
- Inline badge rendering directly in CoreIdentitySection
- Reuse existing `revenueModelDisplayLabels` mapping
- Add tests to existing CoreIdentitySection.test.tsx

## Proposed Solution

Inline the badge rendering in CoreIdentitySection using the existing label mapping. Define a simple color mapping for the four revenue model types and render as flex-wrapped badges.

## Design Details

### Color Mapping
```typescript
const revenueModelColors: Record<string, string> = {
  transactions: "bg-amber-100 text-amber-700",
  tier_subscription: "bg-indigo-100 text-indigo-700",
  seat_subscription: "bg-teal-100 text-teal-700",
  volume_based: "bg-rose-100 text-rose-700",
};
```

### Rendering (inline in CoreIdentitySection)
```typescript
{data.revenueModels && data.revenueModels.length > 0 && (
  <div>
    <span className="text-sm text-gray-500">Revenue Models</span>
    <div className="flex flex-wrap gap-1.5 mt-1">
      {data.revenueModels.map((model) => (
        <span
          key={model}
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
            revenueModelColors[model] ?? "bg-gray-100 text-gray-700"
          )}
        >
          {revenueModelDisplayLabels[model] ?? model}
        </span>
      ))}
    </div>
  </div>
)}
```

## Alternatives Considered

1. **Separate RevenueModelBadge component** - Rejected as over-engineering for a single use case
2. **shadcn Badge component with className overrides** - Rejected as it leaks styling concerns
3. **No colors, just outlined badges** - Considered but colors provide better visual distinction

## Success Criteria

- Revenue models render as colored pill badges
- Each model type has visually distinct colors
- Layout handles multiple badges gracefully (flex-wrap)
- Tests verify badge rendering in CoreIdentitySection.test.tsx
