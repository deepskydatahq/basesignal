# CoreIdentitySection Design

## Overview

Build a single `CoreIdentitySection` component that displays core product identity fields from the existing user schema, with inline edit capability. Follows the ProductProfileCard pattern for simplicity.

## Problem Statement

The Profile page needs a section showing the user's core product identity (product name, website, business model, revenue models). This creates a "curiosity gap" encouraging users to complete their product profile.

## Expert Perspectives

### Product
- Editing is rare ("set it and forget it") - when users edit, it's one section at a time
- The Profile page should be a clean document-style overview
- Show only what exists - don't create placeholders for fields that aren't in the schema yet

### Technical
- Follow the ProductProfileCard pattern - it's proven and self-contained
- Avoid premature abstraction - don't create hooks/modals for one-off forms
- Keep display and edit logic co-located in one component

### Simplification Review
- Removed proposed `useOnboardingForm` hook - form logic stays in component
- Removed separate `CoreIdentityEditModal` - use inline edit toggle instead
- Removed placeholder fields (companyStage, screenshot/logo) - only show existing schema fields
- Result: One component file instead of three

## Proposed Solution

A single `CoreIdentitySection.tsx` component (150-200 lines) with:
- Display mode: Shows product name, website, business model, revenue models
- Edit mode: Inline form fields (matching ProductProfileCard pattern)
- ProfileSection wrapper for consistent styling and status badge

## Design Details

### Component Structure

```tsx
// src/components/profile/CoreIdentitySection.tsx

interface CoreIdentityData {
  productName?: string;
  websiteUrl?: string;
  hasMultiUserAccounts?: boolean;
  businessType?: string;
  revenueModels?: string[];
}

interface CoreIdentitySectionProps {
  data: CoreIdentityData;
}

export function CoreIdentitySection({ data }: CoreIdentitySectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  // ... display/edit toggle pattern from ProductProfileCard
}
```

### Data Display

| Field | Source | Display Format |
|-------|--------|----------------|
| Product Name | `data.productName` | Header text |
| Website | `data.websiteUrl` | Clickable link |
| Business Model | `data.hasMultiUserAccounts` + `data.businessType` | "B2B, Multi-user" or "B2C" etc. |
| Revenue Models | `data.revenueModels` | Comma-separated: "Seat-based, Usage-based" |

### Completeness Status

Section is "Complete" when `productName` is set. ProfileSection displays appropriate badge.

### Edit Mode

Inline form fields matching ProductProfileCard:
- Product name: Text input
- Website URL: Text input
- Multi-user accounts: Yes/No chip buttons
- Business type: B2C/B2B chip buttons (conditional on single-user)
- Revenue models: Checkbox list

Uses `api.users.updateOnboarding` mutation (same as ProductProfileCard).

### ProfileSection Integration

```tsx
<ProfileSection
  title="Core Identity"
  status={data.productName ? "complete" : "incomplete"}
  actionLabel="Edit"
  onAction={() => setIsEditing(true)}
>
  {isEditing ? <EditForm /> : <DisplayView />}
</ProfileSection>
```

## Alternatives Considered

1. **Separate modal for editing** - Rejected. Adds unnecessary component and state management. ProductProfileCard proves inline works well.

2. **Shared form hook** - Rejected. Premature abstraction for one form. Can extract later if pattern repeats.

3. **Placeholder fields for missing schema** - Rejected. UI for non-existent data creates confusion. Add when schema fields exist.

## Success Criteria

- [ ] `src/components/profile/CoreIdentitySection.tsx` exists
- [ ] Displays product name, website, business model, revenue models
- [ ] Edit button toggles inline edit mode
- [ ] Uses ProfileSection wrapper with complete/incomplete status
- [ ] Tests cover complete, incomplete, and edit states
