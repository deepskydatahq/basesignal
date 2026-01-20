# Empty State Copy Design

## Overview

Design compelling, discovery-oriented empty state copy for all 5 profile sections that creates curiosity about the insights users will uncover, rather than framing completion as a task.

## Problem Statement

Current empty states are task-oriented ("No profile information yet", "Complete the Overview Interview...") which frames onboarding as obligation rather than discovery. Users should feel like they're uncovering insights about their product's health, not filling out forms.

## Expert Perspectives

### Product
The user's job isn't to complete a form—it's to uncover what their product P&L actually looks like. Each empty state should hint at the *insight they're about to discover*, not the *task they're about to do*. Reframe from instructional to revelatory. This shifts the emotional tone from obligation to anticipation.

### Technical
The 5 profile sections are: CoreIdentitySection, FirstValueSection, JourneyMapSection, MetricCatalogSection, and MeasurementPlanSection. Sections 3-5 all depend on the Overview Interview for completion.

### Simplification Review
- **Removed:** Time estimates (users don't believe them; compelling copy doesn't need them)
- **Removed:** Third text level (time estimate styling) - collapsed to two levels: hook + insight
- **Simplified:** Consistent CTA approach rather than fragmented action labels
- **Kept:** Discovery-oriented hooks that are genuinely compelling

## Proposed Solution

Two-line empty state copy for each section:
1. **Hook** (bold) - Creates curiosity gap about what they'll discover
2. **Insight** (regular) - One sentence on why this matters

No time estimates. Trust the copy to drive action.

## Design Details

### 1. Core Identity Section

**Hook:** Your product's P&L starts here.

**Insight:** How you monetize and who you serve determines which metrics matter most.

**CTA:** Set your foundation

---

### 2. First Value Section

**Hook:** What moment turns a visitor into a believer?

**Insight:** Finding your first value reveals whether you're activating users fast enough.

**CTA:** Define first value

---

### 3. Journey Map Section

**Hook:** See where users thrive—and where they vanish.

**Insight:** Mapping your journey reveals the critical transitions where growth happens or stalls.

**CTA:** Start Overview Interview

---

### 4. Metric Catalog Section

**Hook:** Your product's vital signs, waiting to be measured.

**Insight:** Discover which numbers actually matter for your business.

**CTA:** Start Overview Interview

---

### 5. Measurement Plan Section

**Hook:** The blueprint for understanding user behavior.

**Insight:** Entities and activities reveal what users do and how they move through your product.

**CTA:** Start Overview Interview

---

## Styling Structure

```
Hook:    font-medium text-gray-900
Insight: text-gray-600 text-sm mt-1
```

Two levels only. Clean whitespace. Let the copy breathe.

## Alternatives Considered

1. **Three-line structure with time estimates** - Rejected because time estimates add clutter without building trust
2. **Uniform CTAs across all sections** - Considered but sections 1-2 have distinct actions (profile setup, first value definition) while 3-5 share the Overview Interview
3. **Longer explanatory paragraphs** - Rejected; tighter copy is more compelling

## Success Criteria

- [ ] All 5 sections have discovery-oriented empty states
- [ ] Copy creates curiosity rather than obligation
- [ ] Consistent two-line structure (hook + insight)
- [ ] CTAs match the actual action for each section
