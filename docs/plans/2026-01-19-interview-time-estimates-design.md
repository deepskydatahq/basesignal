# Interview Time Estimates Design

## Overview

Add time estimates to interview CTAs so users know the time commitment before starting. Display `~X min` on the 3-4 places where users actually click to start interviews.

## Problem Statement

Users see interview CTAs without knowing how long the interview takes. This creates friction - they hesitate to start because they don't know if they have enough time. Adding realistic time estimates gives users permission to start and sets proper expectations.

## Expert Perspectives

### Product
Users making a commitment decision care about predictability. The time estimate is "permission to start" - if users know it's ~7 minutes, they can decide if now is a good time. Trust erodes when actual time differs significantly from estimates, so estimates must be realistic.

### Technical
Centralize estimates in `INTERVIEW_TYPES` config (single source of truth). This enables future refinement based on actual completion data without touching component logic. Don't over-parameterize - just read from the config where needed.

### Simplification Review

**Removed:**
- `formatTimeEstimate()` helper function - trivial string operation doesn't need abstraction
- Optional `estimatedMinutes` props on generic components - pass data directly where needed
- Snapshot tests - overkill for text labels
- 3 of the 6 proposed component updates - only 3-4 places actually need this

**Simplified:**
- Components read directly from `INTERVIEW_TYPES` config at call site
- Focus on user-facing CTAs where the commitment decision happens

## Proposed Solution

### 1. Add `estimatedMinutes` to Config

**File:** `src/shared/interviewTypes.ts`

```typescript
export const INTERVIEW_TYPES = {
  overview: {
    // ... existing fields
    estimatedMinutes: 15,
  },
  first_value: {
    // ... existing fields
    estimatedMinutes: 7,
  },
  retention: {
    // ... existing fields
    estimatedMinutes: 5,
  },
  value_outcomes: {
    // ... existing fields
    estimatedMinutes: 7,
  },
  value_capture: {
    // ... existing fields
    estimatedMinutes: 5,
  },
  churn: {
    // ... existing fields
    estimatedMinutes: 5,
  },
} as const;
```

### 2. Time Estimate Values

| Interview | Minutes | Rationale |
|-----------|---------|-----------|
| Overview Journey | 15 | 5 lifecycle stages, comprehensive exploration |
| First Value | 7 | Single focus + follow-up questions |
| Retention | 5 | Simpler scope - frequency criteria |
| Value Outcomes | 7 | Moderate - maps value behaviors |
| Value Capture | 5 | Focused - links to revenue |
| Churn | 5 | Focused - inactivity patterns |

### 3. Display Locations (3-4 places)

1. **BriefingScreen.tsx** - Replace hardcoded "15 minutes" with `INTERVIEW_TYPES.overview.estimatedMinutes`

2. **StageCard.tsx** - Show `~X min` next to "Start" button when starting a new interview

3. **InterviewCard.tsx** - Display time estimate in the interview selection cards

4. **FutureSectionCard.tsx** - Show estimate when the CTA is "Start Interview"

### 4. Display Format

Simple inline text: `~X min` in muted/secondary style near the CTA.

Example:
```
[Start Interview]  ~7 min
```

## Alternatives Considered

1. **Per-component optional props** - Rejected. Over-parameterizes for minimal reuse. Components can read from config directly.

2. **Time ranges (e.g., "5-7 min")** - Rejected for v1. Keep it simple. Can add if user research shows ranges reduce anxiety.

3. **Dynamic "time remaining"** - Future enhancement, not needed for initial release.

## Success Criteria

- [ ] Time estimates visible on all interview CTAs
- [ ] Consistent `~X min` format across the app
- [ ] BriefingScreen no longer hardcodes "15 minutes"
- [ ] Estimates match actual interview complexity
