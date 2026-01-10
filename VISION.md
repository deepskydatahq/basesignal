# BASESIGNAL
## Product Vision Document

*Outcome-Driven Product Analytics*

**January 2026 | DeepSky Data ApS**

---

## Vision Statement

> *Every SaaS product leaks revenue.*
> *Basesignal shows you where.*

Basesignal transforms how B2B SaaS companies measure product performance. We help teams shift from interaction-driven tracking (what users click) to outcome-driven measurement (whether users succeed). By defining user stages and measuring conversion between them, companies finally see where their product fails to convert users into revenue.

In 15 minutes instead of a week, teams get a journey map, measurement plan, and metric catalog that reveals exactly how much revenue potential their product is losing—and where.

---

## The Problem We Solve

### The Surface Problem

Product teams have tracking but cannot answer the fundamental question: **Is the product working?**

### The Deeper Problem

Measurement was never designed around outcomes. Teams track what is easy to instrument (clicks, pageviews, button taps) rather than what matters to the business (activation, retention, revenue conversion). The result is a big black box between new accounts and revenue, with no visibility into where the product fails.

### The Consequences

- Events are inconsistent and undocumented
- Dashboards exist but nobody trusts them
- When leadership asks "how is the product doing?" there is a scramble
- Data teams spend weeks building tracking plans that still miss the point
- No shared language between product, data, and business

### Who Feels This Pain

- Product managers who can't prove impact
- Data analysts asked to "just add tracking" without strategy
- Founders who know they should be data-driven but don't know where to start
- Growth teams optimizing metrics that don't ladder to business outcomes

---

## Core Belief System

### The Keystone Belief

> **"I need to understand how much revenue potential our product is losing."**

This belief is central because:

1. **It reframes the problem.** Most people think they have a tracking problem or a data quality problem. The real problem is they can't see where their product is failing to convert users into revenue.

2. **It's specific to SaaS.** In SaaS, marketing creates trials—the product creates revenue over time. Every user who signs up represents future revenue potential that can be realized or lost. Most companies have no visibility into this.

3. **It creates urgency.** "Revenue we're losing" is more urgent than "revenue we could gain." Loss aversion drives action.

4. **It qualifies prospects.** People who hold this belief (or can be led to it) are good fits. People who just want "better dashboards" or "more events tracked" are not.

### The Belief Chain

Customers don't start with the keystone belief. They arrive at it through a sequence of smaller, logical steps:

| # | Belief | Type |
|---|--------|------|
| 1 | In SaaS, marketing gets people to try us—the product has to deliver revenue over time | 95% starting point |
| 2 | Every user who signs up represents future revenue potential | Logical extension |
| 3 | But not every user converts to paying, and not every paying user stays | Observable reality |
| 4 | The gap between "users acquired" and "revenue realized" is revenue the product failed to capture | The reframe |
| **5** | **I need to understand how much revenue potential our product is losing** | **KEYSTONE** |
| 6 | My current tracking doesn't tell me this—it just tracks interactions | Problem recognition |
| 7 | I need to measure outcomes (user success), not just interactions (clicks) | Solution direction |
| 8 | User stages show me WHERE the product is losing revenue potential | Mechanism |
| 9 | Basesignal helps me define outcomes and measure stage conversion | Product fit |

---

## The Core Reframe

### Interaction-Driven vs. Outcome-Driven Tracking

This distinction is the philosophical foundation of Basesignal.

| Interaction-Driven (Status Quo) | Outcome-Driven (What We Enable) |
|---------------------------------|---------------------------------|
| Tracks what users did | Measures whether users succeeded |
| Events: clicks, pageviews, button taps | Outcomes: onboarded, got value, retained |
| Answers: "What happened?" | Answers: "Is the product working?" |
| More events = more noise | Defined outcomes = clarity |

**Product implication:** Every feature we build should help users move from interaction-driven thinking to outcome-driven thinking.

### User States as a Growth Model

Instead of measuring interactions, Basesignal measures which states users are in and how they move between states. A state can be: New, Activated, Active, At Risk, or Dormant.

This gives teams not a linear funnel but a loop that shows where they should invest resources.

When users define stages (Signed Up → Onboarded → Active → Paying → Retained), they get:

- **A growth model** — For the first time, they can see how users flow through stages
- **Visibility into loss** — They can see WHERE users drop off (where revenue potential is lost)
- **Decision-making framework** — They know where to focus product improvements

### The Three-Layer Framework

Basesignal uses a structured, outcome-oriented tracking approach that scales:

| Layer | Question It Answers |
|-------|---------------------|
| **Entities** | What are the "things" in your product? |
| **Activities** | What happens to those things? |
| **Properties** | What attributes matter about those things? |

This creates structured, outcome-oriented tracking that scales.

### Value Generation → Value Capture

This framing helps with product people who resist "revenue" language:

- **Value generation:** The product helps users achieve their goals
- **Value capture:** The business captures value (revenue) from users who received value

These are connected: if you measure value generation well (outcomes), value capture follows. Product people can focus on user success while still contributing to revenue.

---

## Target Users

### Primary Audience

**Product managers and data analysts at B2B SaaS companies (Seed to Series B)**

### Characteristics

- Know they need better measurement but don't know where to start
- Have some tracking in place but it's messy/incomplete
- Want to be data-driven but lack the foundation
- Don't have a dedicated data team or the data team is overwhelmed

### Entry Points (What They Say)

- *"Our tracking is a mess"*
- *"I don't know what metrics matter"*
- *"Leadership wants dashboards but I don't trust the data"*
- *"We're about to rebuild tracking—where do we start?"*

### Audience-Specific Messaging

| Audience | Their Rabbit Hole | What They Want |
|----------|-------------------|----------------|
| **Analysts** | "I need to fix tracking / choose the right tool / track more events" | To provide insights that actually matter to stakeholders |
| **Product People** | "I care about user value, not revenue metrics" | To prove that what they build creates real value |
| **Business Leaders** | "Is the product actually driving revenue?" | Confidence that product investments pay off |

---

## Product Roadmap: Three Phases

### Phase 1: The Generator (Current Focus)

**Timeline:** February-March 2026 (Onboarding first accounts)

**Belief Addressed:** *"I need to measure outcomes, not just interactions"*

**Value Proposition:** "Know what to track and why—in 15 minutes instead of a week."

**What It Does:**

- Interview-driven journey mapping (AI conducts smooth, non-exhausting interviews)
- First Value identification
- Measurement plan generation using the three-layer framework
- Metric catalog with definitions and formulas
- Ability to connect to Amplitude/Mixpanel/PostHog to check tracking gaps

**Outputs:**

| Output | What It Is | Why It Matters |
|--------|------------|----------------|
| User Journey Map | Visual map from signup → value → revenue → churn | Shared understanding of how users succeed |
| Measurement Plan | Entities, activities, properties—what to track | Engineering knows exactly what to instrument |
| Metric Catalog | 6-8 core metrics with definitions and formulas | Everyone agrees on what metrics mean |

**Pricing:** Free with credit usage model (guard rails for AI usage)

---

### Phase 2: Product Performance Metrics

**Timeline:** After Summer 2026

**Belief Addressed:** *"I need to see where revenue potential is being lost"*

**Value Proposition:** "See if your product is actually working—connected to your real data."

**What It Does:**

- Connect to reality: integrate with Amplitude, Mixpanel, Segment, data warehouses
- Gap analysis: "You're tracking 60% of your ideal plan"
- Product P&L: 10-12 metrics showing how product performance develops
- Show conversion between stages and where users drop off
- Quantify revenue potential lost at each stage

**User Value:** Visibility into product performance

---

### Phase 3: Growth Intelligence

**Timeline:** End of 2026

**Belief Addressed:** *"I need to know what drives revenue potential"*

**What It Does:**

- Bring revenue data in (customer lifetime value, plans, etc.)
- Connect outcomes to features: identify which features drive the most value
- Micro-segment analysis: compare 100-200 segments by product performance
- Identify accounts that can be expanded and accounts at risk of churn
- Actionable intelligence for prioritization

**User Value:** Actionable intelligence for prioritization

---

## Competitive Positioning

Basesignal fills a gap that exists **before** you instrument tracking and **before** you set up dashboards: knowing *what* to track and *why*.

| Category | Examples | How We're Different |
|----------|----------|---------------------|
| Tracking Plan Templates | Spreadsheets, Notion templates | We generate, not template. Interactive, not static. |
| Analytics Tools | Amplitude, Mixpanel, Heap | They measure what you track. We tell you what to track. |
| Data Modeling | dbt, Census | Infrastructure layer. We're strategy layer. |
| Consulting | Analytics consultants | We productize the discovery process. 15 min vs. 2 weeks. |

### Why Analytics Platforms Won't Build This

Product analytics platforms are not built for outcome-driven measurement. They are built for interactions. This is mostly for historical reasons—tracking interactions was the first thing people thought to measure.

Calculating an activation rate is possible in these tools, but putting it on a time series segmented by marketing channel will not work out of the box.

Basesignal sits **on top** of these tools, not replacing them, but adding what they will most likely never build.

---

## Key Product Decisions

1. **Setup Mode is the product (for now):** Users must complete a guided setup to get value. This isn't onboarding—it's the core experience. 15 minutes of input → week's worth of output.

2. **Interview-driven, not form-driven:** We ask questions conversationally. This surfaces better information than forms and educates users along the way.

3. **Opinionated defaults:** We generate a standard metric set (activation rate, retention, MRR, churn, etc.) plus product-specific metrics. Users can customize, but the defaults should be right for 80% of cases.

4. **Education is embedded:** Many users won't know concepts like "First Value" or metric trees. The product teaches as it guides.

5. **Community as support (for now):** Discord community is mandatory at launch. Direct feedback loop while we're small. Inspired by Superhuman's setup calls, adapted for solo founder bandwidth.

6. **Solo founder experiment:** No investment, no additional team members. This is an experiment to see how far one person can push things with the tools available in 2026.

---

## What Success Looks Like

### For Users

- *"I finally have a tracking plan I can hand to engineering"*
- *"Our team agrees on what metrics mean"*
- *"I can see the gap between what we track and what we should track"*
- *"This would have taken us weeks"*

### For Basesignal (Phase 1)

- Users complete Setup Mode and get all three outputs
- Outputs are good enough to use immediately (not just demos)
- Users return to reference/refine their measurement foundation
- Word of mouth: "You need to try this"

### For Basesignal (Phase 2+)

- Users connect their actual tracking
- Gap analysis drives instrumentation work
- Metrics update with real data
- Basesignal becomes the source of truth for "Is the product working?"

---

## Messaging Framework

### Headline

> **100 events. Zero answers.**

### Core Message

*Your tracking measures clicks. It should measure success.*

Most product analytics setups track interactions—what users did. But interactions don't tell you if users are succeeding.

Basesignal helps you define outcomes, measure what matters, and finally see how well your product converts users into value.

### Tagline Options

- Outcome-driven product analytics
- Track outcomes, not just events
- See where your product loses revenue
- From interactions to outcomes

---

## Guiding Principles for Product Development

These principles should inform every product decision:

### Feature Prioritization
*Ask: "Does this feature help users move from interaction-driven to outcome-driven thinking?"*

### UX/Copy Decisions
*Ask: "Does this reinforce the belief that outcomes > interactions?"*

### Success Metrics
*Ask: "Are we measuring whether users achieve clarity on product performance—not just whether they use features?"*

### Onboarding
*Ask: "Does our onboarding guide users through the belief chain—starting with outcomes, not with connecting data sources?"*

---

## Summary

| Element | Description |
|---------|-------------|
| **The Problem** | SaaS companies track lots of events but can't answer "Is our product converting users into revenue?" |
| **Why It Exists** | Their tracking is interaction-driven (clicks) instead of outcome-driven (user success) |
| **The Keystone Belief** | "I need to understand how much revenue potential our product is losing." |
| **The Mechanism** | User stages as a growth model—define stages, measure conversion, see where revenue is lost |
| **The Reframe** | Outcome-driven tracking starts with defining what success looks like, then identifies what to measure |
| **Phase 1** | Help users define outcomes and create an outcome-driven tracking plan |
| **Phase 2** | Show product performance metrics and where revenue potential is lost |
| **Phase 3** | Connect outcomes to features and segments for prioritization intelligence |

---

> **Basesignal helps B2B SaaS teams build measurement foundations in 15 minutes instead of a week.**
