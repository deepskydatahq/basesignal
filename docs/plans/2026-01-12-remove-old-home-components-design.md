# Remove Old Home Components Design

## Overview

This cleanup issue removes deprecated home components (`MeasurementFoundationCard` and `StageCard`) that are replaced by the new Profile page architecture. The issue is **blocked** until Profile page components are built.

## Problem Statement

The current home page uses `MeasurementFoundationCard` and `StageCard` to display a 2x2 grid of setup stages. The Profile Home Page epic (#35) replaces this with a document-style Profile view where each section is self-contained. The old components cannot be removed until their replacements exist.

## Expert Perspectives

### Product
- The old home page showed setup progress as a funnel (Overview → First Value → Metrics → Plan) - a staging interface
- The Profile Page shifts from "guide the setup" to "show the complete product story"
- These are fundamentally different mental models that cannot coexist

### Technical
- Removing components before replacements exist creates a "broken intermediate state"
- The design doc correctly identifies this as Phase 3, Task 11 - the final cleanup
- The issue queue should reflect reality: if something can't be done safely, it shouldn't be picked up
- Keep `ProductProfileCard.tsx` intact - it will be replaced by `CoreIdentitySection` in a separate task

### Simplification Review
- Nothing to simplify - the design correctly blocks until dependencies exist
- No partial implementation or workarounds needed
- Clean deletion once Profile page is complete

## Proposed Solution

**Block this issue** until Profile page components exist. Add label `blocked` with dependency note.

### Blocking Dependencies

These components must exist before this cleanup can proceed:

1. `src/components/profile/ProfilePage.tsx`
2. `src/components/profile/ProfileSection.tsx`
3. `src/components/profile/CoreIdentitySection.tsx`
4. `src/components/profile/JourneyMapSection.tsx`
5. `src/components/profile/FirstValueSection.tsx`
6. `src/components/profile/MetricCatalogSection.tsx`
7. `src/components/profile/MeasurementPlanSection.tsx`
8. `src/components/profile/FutureSectionCard.tsx`
9. `convex/profile.ts` with `getProfileData` query

### When Unblocked, Delete

**Files to delete:**
- `src/components/home/MeasurementFoundationCard.tsx`
- `src/components/home/MeasurementFoundationCard.test.tsx` (if exists)
- `src/components/home/StageCard.tsx`
- `src/components/home/StageCard.test.tsx` (if exists)

**Files to verify:**
- `src/routes/HomePage.tsx` - should no longer import these components
- No other files should reference the deleted components

### Verification Steps (When Ready)

1. Confirm `src/components/profile/` directory exists with all 8+ components
2. Confirm `HomePage.tsx` or route now uses `ProfilePage` instead
3. Run `grep -r "MeasurementFoundationCard\|StageCard" src/` - should return empty
4. Delete the files
5. Run `npm test` - all tests should pass
6. Manually verify Profile page renders correctly

## Alternatives Considered

| Alternative | Why Not |
|-------------|---------|
| Delete now, show placeholder | Creates broken intermediate state with no value |
| Keep only ProductProfileCard | Loses foundation tracking functionality |
| Build minimal inline replacement | Creates throwaway code that won't survive refactor |

## Success Criteria

- [ ] Issue blocked until Profile components exist
- [ ] When unblocked: both component files deleted
- [ ] When unblocked: no broken imports remain
- [ ] When unblocked: all tests pass
- [ ] When unblocked: Profile page works correctly
