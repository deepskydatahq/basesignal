# Linear Reference Analysis Design

## Overview

Create `docs/reference/linear-value-moments.md` — a flat, structured reference document listing 6 value moments for Linear as a case study product. Each moment uses a REF-NN format with name, description, and evidence fields. Serves as baseline for validating 7-lens pipeline output (M003-E003, H6 validation).

## Problem Statement

The 7-lens value discovery pipeline will generate value moment candidates for Linear. To validate whether the pipeline produces accurate results, we need a human-authored reference document listing Linear's known value moments. S002 will compare 7-lens output against this reference for precision/recall.

## Expert Perspectives

### Product
- The primary aha-moment is L2 (team_adopter), not L3 — cycle completion where the team sees progress is the moment Linear clicks
- Cut from 9 to 6 moments: multiplayer sync, cross-team coordination, and analytics are nice-to-have or already covered by core 6
- Moments 1-3 drive adoption; moments 4-6 drive expansion

### Technical
- Flat numbered list (REF-01 through REF-06) with explicit fields — no tiering
- Pipeline handles tiering via convergence logic; reference doc is input, not analysis output
- Simple IDs enable clean mapping in the H6 comparison table

### Simplification Review
- Verdict: APPROVED — no cuts needed after the product strategist's initial simplification
- 6 moments is the right constraint; could justify 8-9 but didn't
- Inline evidence per moment keeps entries self-contained
- Brief M002 mapping table at end (not inline per moment) for clean separation

## Proposed Solution

A single markdown file at `docs/reference/linear-value-moments.md` with a flat, minimal structure.

## Design Details

### Value Moments

| ID | Name | Core Insight |
|----|------|-------------|
| REF-01 | Keyboard-First Speed | Issue ops in 1 keystroke vs 3 clicks in Jira |
| REF-02 | Cycle Completion with Team Visibility | **[PRIMARY AHA-MOMENT]** Team sees progress without meetings |
| REF-03 | Smart Triage Workflow | Inbox-style prioritization replaces backlog chaos |
| REF-04 | Roadmap-to-Issue Traceability | Progress computed from actual work, not manual updates |
| REF-05 | Development Tool Integration | GitHub/Slack fit existing dev workflows |
| REF-06 | Ambient Team Awareness | Board/list/timeline views eliminate status meetings |

### Document Structure

```
# Linear — Value Moments Reference

Brief intro: Linear as case study for Basesignal's activation analysis pipeline.

## Value Moments

### REF-01: Keyboard-First Speed
- **Name:** Keyboard-First Speed
- **Description:** Linear's command palette and keyboard shortcuts let users
  create, triage, and navigate issues without touching a mouse. The speed
  difference vs. Jira/Asana is immediately felt in the first session.
- **Evidence:** Linear's marketing leads with "Built for speed." Keyboard
  shortcuts are featured in onboarding. Community comparisons cite speed
  as the primary switching reason.

### REF-02: Cycle Completion with Team Visibility [PRIMARY AHA-MOMENT]
- **Name:** Cycle Completion with Team Visibility
- **Description:** A team completes a cycle (sprint) and every member can see
  what shipped, what slipped, and what's next — without a status meeting.
  This is Linear's core value proposition: making project status ambient
  rather than extracted through meetings.
- **Evidence:** Linear's Cycles feature is central to their product narrative.
  Blog posts emphasize "building momentum" through visible progress.
- **Why primary:** The aha is collaborative, not individual. Maps to L2
  (team_adopter) — the shift from "I have a tool" to "my team uses this tool."

### REF-03: Smart Triage Workflow
- **Name:** Smart Triage Workflow
- **Description:** Linear's triage system presents new issues in an inbox-style
  queue. Team leads can accept, snooze, or decline with keyboard shortcuts,
  replacing the chaos of unmanaged backlogs.
- **Evidence:** Triage is a dedicated feature with its own view. Linear's docs
  describe it as "your team's intake process."

### REF-04: Roadmap-to-Issue Traceability
- **Name:** Roadmap-to-Issue Traceability
- **Description:** Projects and roadmap items link directly to issues. Progress
  is computed from actual issue completion, not manually updated percentages.
- **Evidence:** Linear's Projects feature auto-calculates progress from child
  issues. Roadmap views aggregate project status.

### REF-05: Development Tool Integration
- **Name:** Development Tool Integration
- **Description:** GitHub PRs auto-link to issues, Slack threads create issues,
  and status updates flow without context-switching.
- **Evidence:** GitHub integration promoted in onboarding. Auto-close on merge
  is standard. Slack integration is first-party.

### REF-06: Ambient Team Awareness
- **Name:** Ambient Team Awareness
- **Description:** Board, list, and timeline views give every team member
  visibility into what others are working on. Status is always current
  because it's derived from actual work, not manual updates.
- **Evidence:** Multiple view types are core navigation. Linear's design
  emphasizes "information should find you."

## Activation Level Mapping (M002)

| Level | Signal Strength | Name | Related Moments |
|-------|----------------|------|-----------------|
| L1 | weak | Individual Explorer | REF-01, REF-03 |
| L2 | medium | Team Adopter [PRIMARY] | REF-02, REF-06 |
| L3 | strong | Workflow Integrator | REF-04, REF-05 |
| L4 | very_strong | Embedded Organization | All moments reinforcing |

## Sources
- M002 activation extraction results
- Linear public website (linear.app)
- General product knowledge
```

### Key Characteristics
- Multi-user dynamics embedded in REF-02 and REF-06 (no separate section)
- M002 activation levels in mapping table at end (clean separation from moments)
- Primary aha-moment marked with `[PRIMARY AHA-MOMENT]` tag on REF-02
- Flat list with REF-NN IDs for downstream comparison

## Alternatives Considered

1. **9 moments (full list)** — Rejected: multiplayer sync, cross-team coordination, and analytics are secondary or already covered
2. **Tiered reference doc** — Rejected: creates parallel classification system that could diverge from pipeline tiers
3. **Separate evidence section** — Rejected: inline evidence keeps moments self-contained
4. **7 moments with cross-team coordination** — Rejected: already covered by REF-06 (ambient team awareness)

## Success Criteria

All 6 acceptance criteria met:
1. `docs/reference/linear-value-moments.md` exists with structured analysis
2. 6 known value moments listed (within 6-10 range)
3. Each moment has name, description, evidence/source
4. Primary aha-moment (cycle completion with team visibility) clearly identified
5. Multi-user dynamics documented in REF-02 and REF-06
6. M002 activation levels in mapping table at end
