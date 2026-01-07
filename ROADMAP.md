# Basesignal Roadmap

**Vision:** Transform B2B SaaS measurement from interaction-driven (clicks) to outcome-driven (user success), revealing where products lose revenue potential.

**Last Updated:** January 2026

**Planning Horizon:** Next 3 months (Phase 1 launch)

---

## Current State

**What works:**
- AI-guided interview flow that maps user journeys
- React Flow journey visualization

**What's missing:**
- Actionable outputs (measurement plan, metric catalog)
- Validation that users complete the interview

**Key tension:** We need outputs to make the interview valuable, but we're uncertain whether users will complete the interview to see them.

---

## Current Focus Areas

### 1. Measurement Foundation (Primary)
**Why:** Without actionable outputs, the interview has no payoff. Users need to walk away with a tracking plan and metric catalog they can hand to engineering.

**Current State:** Interview captures journey data; no outputs generated

**Desired State:** Every completed interview produces:
- Measurement plan (entities, activities, properties)
- Metric catalog (6-8 core metrics with definitions)
- Exportable formats (Notion, CSV, or PDF)

**Key Questions:**
- What's the minimum viable output format?
- How much should AI generate vs. template?
- Do outputs need customization, or are opinionated defaults enough?

**Utility Curve Position:** Pre-threshold (no value until this works)

---

### 2. Interview Completion (Validation)
**Why:** If users don't finish the interview, nothing else matters. Need to validate the flow with real users before over-investing in output polish.

**Current State:** Flow works but unvalidated with external users

**Desired State:** 5-10 users complete interview, providing signal on friction

**Key Questions:**
- Where do users hesitate or drop off?
- Is the interview length acceptable (target: 15 min)?
- Do users understand concepts like "First Value" without more education?

**Utility Curve Position:** Crossing threshold (high leverage—small fixes = big gains)

---

## Stretch Goals (If Time Allows)

### Analytics Integration (Amplitude/Mixpanel)
**Why Stretch:** Connecting to existing tracking lets users see gaps between their current state and the measurement plan we generate. Valuable for Phase 1 but not blocking launch.

**Minimum Version:** Read-only connection to show "you're tracking X of Y recommended events."

---

## Parked Areas

(None currently—focus is tight on Phase 1 launch)

---

## Sequencing

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   NOW: Measurement Foundation                               │
│   ├── Build output generation from interview data           │
│   └── Get to "interview complete → useful deliverables"     │
│                                                             │
│   THEN: Interview Completion Validation                     │
│   ├── Get 5-10 real users through the flow                  │
│   └── Identify and fix friction points                      │
│                                                             │
│   STRETCH: Analytics Integration                            │
│   └── Show tracking gaps against measurement plan           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Connection to Hypotheses

Each investment area generates testable hypotheses. See HYPOTHESES.md for the full catalog.
