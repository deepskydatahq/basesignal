# ProfileHeader Wiring Design

## Overview

Replace the inline header in ProfilePage with the ProfileHeader component, passing the existing profile data through aligned prop interfaces.

## Problem Statement

ProfilePage has inline header code (lines 39-47) showing just product name and a basic "X/Y" completeness count. The ProfileHeader component exists with richer features (business badges, revenue models, progress bar) but isn't being used. This creates duplicate code and inconsistent UI.

## Expert Perspectives

### Product
- Website URL belongs in CoreIdentitySection, not ProfileHeader - don't dilute the header's focus
- Product description field should be deferred - avoid adding onboarding friction without validated user need
- ProfileHeader's job: show product identity and progress at a glance

### Technical
- Data shapes already align between profile API and ProfileHeader props
- ProfileHeader gracefully handles undefined productDescription
- Single responsibility: ProfileHeader shows identity/progress, CoreIdentitySection handles metadata

### Simplification Review
- **Removed:** Tests for child component rendering from ProfilePage tests (each section has its own tests)
- **Simplified:** Focus ProfilePage tests on its actual responsibilities: loading, auth redirect, prop passing
- **Kept minimal:** No schema changes, no new abstractions, direct prop wiring

## Proposed Solution

Replace the inline header with ProfileHeader component using existing data.

### Implementation

**1. Import ProfileHeader**
```typescript
import { ProfileHeader } from "./ProfileHeader";
```

**2. Replace inline header (lines 39-47)**

Current:
```tsx
<div className="mb-8">
  <h1 className="text-2xl font-semibold text-gray-900">
    {profileData.identity.productName || "Your Product"}
  </h1>
  <div className="mt-2 text-sm text-gray-500">
    {profileData.completeness.completed}/{profileData.completeness.total}
  </div>
</div>
```

Replace with:
```tsx
<ProfileHeader
  identity={profileData.identity}
  completeness={profileData.completeness}
/>
```

**3. Data Mapping (already aligned)**
- `profileData.identity` → productName, hasMultiUserAccounts, businessType, revenueModels
- `profileData.completeness` → completed, total

### Test Strategy

Focus ProfilePage tests on ProfilePage responsibilities only:

1. **Update completeness format test** - "4/11" → "4 of 11" (ProfileHeader's format)
2. **Remove child component rendering assertions** - each section has its own test file
3. **Verify prop passing** - ProfileHeader receives correct identity and completeness data

### Files to Modify

1. `src/components/profile/ProfilePage.tsx` - add import, replace inline header
2. `src/components/profile/ProfilePage.test.tsx` - update format test, simplify assertions

## Alternatives Considered

| Alternative | Why Not |
|-------------|---------|
| Add productDescription to schema | Premature - no validated user need, adds onboarding friction |
| Display website URL in header | Already handled by CoreIdentitySection - avoid duplication |
| Create adapter layer for data | Unnecessary - shapes already align |

## Success Criteria

- [ ] ProfilePage renders ProfileHeader component
- [ ] Business type badge (B2B/B2C) displays based on identity data
- [ ] Revenue model badges display when provided
- [ ] Progress bar shows correct percentage
- [ ] No inline header code remains in ProfilePage
- [ ] Tests pass with updated assertions
