# ICPProfilesSection Design

## Overview
A presentational component that renders ICP persona cards in a responsive grid within the Product Profile page's "ICP Profiles" tab. Each card shows persona identity, confidence, value moment priorities, and collapsible detail sections.

## Problem Statement
The Product Profile View (M005) needs a way to display AI-generated ICP profiles so product leaders can see their target personas, what those personas care about, and how confident the system is in each profile.

## Expert Perspectives

### Product
- Pure read-only display of analysis outputs — no user interaction beyond expanding/collapsing detail sections
- Component receives data as props from parent (ProductProfilePage tab)

### Technical
- Use uncontrolled-style collapsibles with minimal useState for chevron toggling (matching ActivityTimeline pattern)
- Do NOT extract sub-components — inline everything; 3 collapsible sections doesn't warrant abstraction
- No helper functions for simple threshold logic — inline confidence badge colors

### Simplification Review
- Removed PersonaCard sub-component: flatten everything into ICPProfilesSection
- Removed getConfidenceBadge helper: inline as ternary in JSX
- Simplified collapsible approach: each section gets its own useState(false), matching ActivityTimeline
- Minimal empty state: dashed border div with text, no Card wrapper

## Proposed Solution
Single file `src/components/product-profile/ICPProfilesSection.tsx` (~80-100 lines). Takes `profiles: ICPProfile[]` as props. Renders responsive grid of cards with inline collapsible sections.

## Design Details

### Props
```typescript
interface ICPProfilesSectionProps {
  profiles: ICPProfile[];
}
```

### Layout
- Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`
- Empty state: dashed border container with "No ICP profiles generated yet."

### Per-Persona Card
- **Header**: Name (CardTitle) + confidence badge (Badge variant="secondary" with inline color: >0.8 green, >0.6 amber, else gray)
- **Description**: CardDescription
- **Value Moment Priorities**: Simple list with P1/P2/P3 text + relevance reason
- **3 Collapsible Sections**: Activation Triggers, Pain Points, Success Metrics — each with useState(false) + ChevronRight/ChevronDown toggle, rendering string[] as list items

### Confidence Badge Colors
- `> 0.8`: `bg-green-100 text-green-800` — "High"
- `> 0.6`: `bg-amber-100 text-amber-800` — "Medium"
- else: `bg-gray-100 text-gray-800` — "Low"

## Alternatives Considered
- **Accordion (one-section-at-a-time)**: Rejected — adds orchestration complexity for no user benefit in read-only context
- **Extracted CollapsibleListSection sub-component**: Rejected — premature abstraction for only 3 instances
- **Uncontrolled collapsibles (no useState)**: Rejected — need controlled state for chevron icon toggling

## Success Criteria
- All 5 acceptance criteria pass as unit tests
- Component is ~80-100 lines, flat structure, no unnecessary abstractions
- Matches existing codebase patterns (ActivityTimeline collapsible, Card/Badge usage)
