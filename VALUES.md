# Basesignal Value Ladder

> Context engineering for growth intelligence — from a URL to a lifecycle dataset where agents discover what drives growth.

**Last Updated:** February 2026

---

## How to Read This

Basesignal's value story is an ordered progression of **15 levels**. Each level is independently valuable, buildable, and compounds toward the end state: a lifecycle dataset where agents discover microsegments that outperform or underperform across breakdown dimensions (ICP, industry, MRR, seats).

Levels build on each other. Lower levels are prerequisites for higher ones.

**Status key:**
- **shipped** — Working in the current codebase
- **building** — Active development
- **designed** — Architecture defined, not yet built
- **planned** — Scope understood, design pending
- **future** — Requires capabilities not yet in place

---

## Status Summary

| Level | Name | Tier | Status |
|-------|------|------|--------|
| L01 | Product Identity | Scan Intelligence | shipped |
| L02 | Value Moment Discovery | Scan Intelligence | shipped |
| L03 | ICP Profiles | Scan Intelligence | shipped |
| L04 | Activation Definition | Growth Definitions | shipped |
| L05 | Lifecycle States | Growth Definitions | shipped |
| L06 | Entity Model | Growth Definitions | shipped |
| L07 | Revenue Architecture | Growth Definitions | planned |
| L08 | Tracking Plan | Measurement Framework | shipped |
| L09 | Breakdown Dimensions | Measurement Framework | planned |
| L10 | Cohort Framework | Measurement Framework | planned |
| L11 | Data Connection | Connected Intelligence | future |
| L12 | Gap Analysis | Connected Intelligence | future |
| L13 | Live Metrics | Connected Intelligence | future |
| L14 | Segment Discovery | Growth Operations | future |
| L15 | Growth Operations | Growth Operations | future |

---

## Tier 1: Scan Intelligence (L01–L03)

*From a URL, no data needed.*

These levels deliver value the moment someone runs `basesignal scan <url>`. The input is a URL; the output is structured growth intelligence.

---

### L01: Product Identity
> "What is this product, who is it for, and how does it make money — in 10 seconds."

**Status:** shipped
**Missions:** M001

**What it delivers:** Structured identity extraction — product name, category, target audience, business model, pricing tiers, and revenue architecture. All from crawling the public site.

**Why it matters:** Identity is the foundation every other level builds on. Without knowing what the product is and who it serves, no downstream analysis (value moments, ICPs, measurement specs) can be grounded in reality. This is row zero of the lifecycle dataset.

---

### L02: Value Moment Discovery
> "The moments that make users stay — discovered automatically, ranked by impact."

**Status:** shipped
**Missions:** M003, M007

**What it delivers:** A tiered catalog of user-experienced value moments (Core / Important / Supporting), discovered through 7 analytical lenses. 83.3% accuracy on Tier 1 moments. Moments are experiential ("the first time your team sees the board update in real-time") not abstract ("collaboration value").

**Why it matters:** Value moments are the atomic unit of growth. Every activation trigger, every retention driver, every expansion signal traces back to a moment where the user experienced value. The lifecycle dataset needs these as the event vocabulary — without them, you're measuring activity, not value.

---

### L03: ICP Profiles
> "Your best customers, prioritized by product fit — not marketing prominence."

**Status:** shipped
**Missions:** M004, M006

**What it delivers:** Distinct ICP profiles with value moment priorities, activation triggers, pain points, and behavioral signals. Prioritized by product relevance (who actually converts and expands) rather than marketing targeting (who the site talks about most).

**Why it matters:** ICPs are the first breakdown dimension of the lifecycle dataset. When you eventually ask "which segment has the highest activation rate?" or "where is expansion stalling?", the answer is always "for which ICP?" Without ICP profiles grounded in product reality, segmentation is guesswork.

---

## Tier 2: Growth Definitions (L04–L07)

*Generated, product-specific definitions.*

These levels produce the definitions a product team needs to align on: what activation means, what lifecycle states exist, what entities to track, how revenue flows. Generated from the scan, specific to the product.

---

### L04: Activation Definition
> "The 4-level activation spectrum — from first visit to power user, with measurable triggers."

**Status:** shipped
**Missions:** M002

**What it delivers:** A multi-level activation model (Setup → Aha Moment → Habit Formation → Power Use) with specific, measurable triggers at each level. Not a binary "activated/not-activated" — a spectrum that shows where users are and where they stall.

**Why it matters:** Activation is the leading indicator of retention. The lifecycle dataset needs activation as a state machine, not a flag. Without levels, you can't diagnose *where* in the journey users drop off — only *that* they do. The 4-level model becomes the state dimension that every cohort analysis slices by.

---

### L05: Lifecycle States
> "Every state a user can be in — from first touch to churned, with transition triggers."

**Status:** shipped
**Missions:** M010

**What it delivers:** A complete lifecycle state machine: new → activated → engaged → at-risk → dormant → churned → resurrected. Each state has entry criteria, exit triggers, and time windows. Extends the activation map with post-activation states (at-risk, dormant, churned, resurrected).

**Why it matters:** The lifecycle dataset is, by definition, organized by lifecycle state. Without a complete state machine, you can only analyze the acquisition-to-activation funnel. The real value — retention intelligence, churn prediction, expansion triggers — requires knowing where every user sits in their lifecycle at any point in time.

---

### L06: Entity Model
> "The 3–7 core objects your product is built around, with properties that matter."

**Status:** shipped
**Missions:** M006

**What it delivers:** An entity framework identifying the core objects in the product (boards, documents, workspaces, projects, etc.) with their key properties, relationships, and lifecycle events. Follows the Double Three-Layer Framework.

**Why it matters:** Entities are the nouns of the lifecycle dataset. Every event is "a [user] did [action] on [entity]." Without a formal entity model, measurement specs produce events that don't connect — you track "board_created" but can't answer "how many boards does an activated user have?" The entity model makes the dataset joinable.

---

### L07: Revenue Architecture
> "How money flows — new, retained, expanded, contracted, churned — as a state machine."

**Status:** planned

**What it delivers:** A revenue state machine mapping how customers move through revenue states: new (first purchase) → retained (renewed) → expanded (upsell/cross-sell) → contracted (downgrade) → churned (cancelled). Each transition has triggers and signals. Builds on the identity extraction's business model and pricing tier data.

**Why it matters:** Revenue is the outcome variable of the lifecycle dataset. Every upstream dimension (ICP, activation level, lifecycle state, entity usage) ultimately predicts revenue behavior. Without a formal revenue architecture, you can correlate features with retention but not with revenue — and revenue is what the business optimizes for.

---

## Tier 3: Measurement Framework (L08–L10)

*The tracking specification.*

These levels translate growth definitions into a measurement plan that engineering can implement. The output is a spec — events, properties, dimensions, cohort windows — ready for an analytics pipeline.

---

### L08: Tracking Plan
> "Every event, property, and trigger your analytics should capture — generated, not guessed."

**Status:** shipped
**Missions:** M004, M007

**What it delivers:** A complete measurement specification with entity-first event design, activity tracking (past-tense events: board_created, member_invited), property schemas, and perspective coverage (Customer journey, Product lifecycle, Interaction patterns). Follows the Double Three-Layer Framework.

**Why it matters:** The tracking plan is where growth intelligence meets engineering reality. Without it, the gap between "we should measure activation" and "we are measuring activation" remains unbridged. The lifecycle dataset requires instrumented data — the tracking plan is the blueprint for that instrumentation.

---

### L09: Breakdown Dimensions
> "The dimensions that turn aggregate metrics into actionable segments."

**Status:** planned

**What it delivers:** Formal data dimensions for segmenting the lifecycle dataset: ICP segment, industry vertical, company size (MRR band, seat count), acquisition channel, activation level, lifecycle state. Each dimension has defined values, grouping rules, and recommended cross-tabulations.

**Why it matters:** Aggregate metrics lie. "Our activation rate is 40%" hides that enterprise ICP activates at 60% while SMB activates at 25%. Breakdown dimensions are what turn the lifecycle dataset from a dashboard into an intelligence layer. Every question worth answering is "what is [metric] broken down by [dimension]?"

---

### L10: Cohort Framework
> "Time windows that reveal whether things are getting better or worse."

**Status:** planned

**What it delivers:** A cohort analysis framework with time-window definitions (daily, weekly, monthly, quarterly), cohort grouping rules (by signup date, by activation date, by plan tier), and standard retention curves. Defines how to slice the lifecycle dataset over time.

**Why it matters:** Without cohorts, metrics are snapshots. You know today's activation rate but not whether it's improving. Cohort analysis reveals trends that aggregate metrics obscure — is the product getting better at activating users? Is churn accelerating in recent cohorts? The lifecycle dataset becomes a time machine only with a cohort framework.

---

## Tier 4: Connected Intelligence (L11–L13)

*Real data from real products.*

These levels bridge the gap between recommended tracking and actual analytics data. The generated spec meets the live product.

---

### L11: Data Connection
> "Plug in your analytics — Amplitude, Mixpanel, Segment — and see what you're actually tracking."

**Status:** future

**What it delivers:** Connectors for analytics platforms that import actual tracked events and compare them against the recommended tracking plan. Bidirectional: read current tracking state, push recommended events.

**Why it matters:** The lifecycle dataset requires actual data, not just a spec. Data connection is the bridge from "here's what you should track" to "here's what you are tracking." Without it, basesignal produces great plans that sit in a file. With it, the plan becomes a living gap analysis.

---

### L12: Gap Analysis
> "You're tracking 60% of your ideal measurement plan — here's what's missing and what it costs you."

**Status:** future

**What it delivers:** A gap report comparing the generated measurement spec against actual instrumentation. Identifies missing events, incomplete properties, coverage percentages per entity and lifecycle state. Prioritizes gaps by impact on growth intelligence.

**Why it matters:** Gap analysis is the first "aha moment" of connected intelligence. Teams discover they're flying blind on specific lifecycle states or entity types. The lifecycle dataset has holes — gap analysis shows exactly where they are and what filling them would reveal.

---

### L13: Live Metrics
> "Your actual activation rate, retention curves, and revenue metrics — computed from the growth model, not a generic dashboard."

**Status:** future

**What it delivers:** Live computation of growth metrics using the generated model against actual data. Activation rates by level, retention by lifecycle state, revenue by ICP segment. Metrics are meaningful because they're grounded in the product-specific growth model, not generic SaaS benchmarks.

**Why it matters:** Live metrics close the loop. The lifecycle dataset is now populated with real data, organized by the growth model basesignal generated. For the first time, the team can answer "what is our L2 activation rate for enterprise ICP in the last 30-day cohort?" — a question that required the entire stack from L01 to L13 to be answerable.

---

## Tier 5: Growth Operations (L14–L15)

*Act on the intelligence.*

These levels turn the lifecycle dataset into operational decisions. Agents discover what's working and what isn't, across every dimension.

---

### L14: Segment Discovery
> "Automatically discover which microsegments outperform or underperform — and why."

**Status:** future

**What it delivers:** Automated analysis that slices the lifecycle dataset across all breakdown dimensions (ICP, industry, MRR, seats, activation level) and surfaces statistically significant performance differences. "Enterprise ICP in fintech activates at 2.3x the rate of SMB in e-commerce — here's what's different about their journey."

**Why it matters:** This is where the lifecycle dataset becomes an intelligence layer. No human can cross-tabulate every dimension combination. Agents can — and they surface the segments that matter most. The team stops guessing which segments to focus on and starts knowing.

---

### L15: Growth Operations
> "From insight to action — agents that recommend and execute growth plays."

**Status:** future

**What it delivers:** Operational recommendations and automated actions based on segment intelligence. "SMB activation is 18% — the drop-off is between L1 and L2. Recommended: simplify onboarding for solo users. Here's the A/B test spec." Agents that don't just report — they prescribe and, with approval, act.

**Why it matters:** This is the end state. The lifecycle dataset is complete, live, segmented, and actionable. Agents discover microsegments that outperform or underperform across breakdown dimensions and recommend concrete growth plays. The product team's job shifts from "figure out what's happening" to "decide which recommendations to act on."

---

## The End State

The 15 levels build toward a **lifecycle dataset**: a structured, live, segmented view of how a product converts users into revenue.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        LIFECYCLE DATASET                                │
│                                                                         │
│   Every user × every lifecycle state × every time window                │
│   Broken down by: ICP, industry, MRR, seats, activation level          │
│                                                                         │
│   Agents discover:                                                      │
│   - Which segments outperform (and why)                                 │
│   - Which segments underperform (and where they stall)                  │
│   - What growth plays to run (and their expected impact)                │
│                                                                         │
│   Built progressively:                                                  │
│   L01-L03  →  The vocabulary (identity, value moments, ICPs)            │
│   L04-L07  →  The definitions (activation, lifecycle, entities, revenue)│
│   L08-L10  →  The spec (tracking plan, dimensions, cohorts)             │
│   L11-L13  →  The data (connections, gaps, live metrics)                │
│   L14-L15  →  The intelligence (segments, operations)                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

Each level is independently valuable. L01 alone ("what is this product?") is useful. But the compounding value of each level makes the next one dramatically more powerful.

---

## Version History

### v3: Value Ladder (February 2026)

Replaced ROADMAP.md (strategic investment areas) with an ordered progression of 15 value levels. The roadmap defined broad focus areas (Open Source Launch, Refinement Loop, Community, Export). The value ladder defines the specific, ordered value each level delivers and how it builds toward the end-state lifecycle dataset.

**Why the change:** The value story is better told as a progression than as parallel investment areas. Each level has a one-liner compelling enough for a marketing site, builds on the previous levels, and points clearly at the end state. This makes prioritization simple: build the lowest unshipped level first.

### v2: Post-Launch Roadmap (February 2026)

The previous ROADMAP.md focused on strategic investment areas after Phase 1 completion: Open Source Launch (primary), Refinement Loop (next), Community & Ecosystem (parallel), Export & Sharing (then). It tracked what we'd shipped (8 missions, all Phase 1 outcomes validated) and outlined future horizons (Extended Sources, Connected Intelligence, Benchmarks, Cloud).

### v1: MCP-First Product Knowledge Layer (January 2026)

Focused on building from zero: MCP platform → scan magic → conversational refinement → export. Architecture assumed hosted SaaS on Convex. Replaced after 8 missions shipped the entire Phase 1 engine and M008 restructured it as open source packages.

### v0: Outcome-Driven Product Analytics (January 2026)

Original roadmap focused on interview-driven setup, web app UX, and Amplitude integration. Replaced when the vision shifted from web app to MCP-first.
