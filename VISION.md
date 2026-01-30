# BASESIGNAL
## Product Vision Document v2

*The Product Knowledge Layer*

**January 2026 | DeepSky Data ApS**

---

## Vision Statement

> *Every product has a story of how it converts users into revenue.*
> *Basesignal learns that story—from anywhere you work.*

Basesignal is the **product knowledge layer**—an intelligence system that crawls, analyzes, and structures everything about how a B2B SaaS product converts users into revenue. Users interact through their preferred AI assistant (Claude, ChatGPT, Cursor), and all knowledge persists in Basesignal's structured data model.

In 60 seconds instead of two weeks, teams get a comprehensive draft of their product's growth model—activation definitions, journey maps, metric catalogs, and measurement plans—generated from public sources and refined through conversation.

---

## The Paradigm Shift

### Old Model: Build an App, Hope Users Come

Traditional SaaS: You build the UI. Users learn your interface. They come to your app to do their work. You compete for screen time.

### New Model: Build the Intelligence, Meet Users Where They Are

Basesignal doesn't compete for screen time. It becomes a **capability** within tools users already live in. When a PM asks Claude "help me define activation for my product," Basesignal provides the structure, the knowledge, and the persistence.

The interface is whatever AI assistant the user prefers. The value is the structured product knowledge that accumulates over time.

---

## The Problem We Solve

### The Surface Problem

Product teams can't answer the fundamental question: **Is our product converting users into revenue?**

### The Deeper Problem

They don't have a structured model of how their product creates value. Ask five team members to define "activation" and you'll get five different answers. Ask for the user journey and you'll get a whiteboard sketch from 18 months ago.

### Why This Persists

Building this model is hard work. It requires:
- Gathering information from multiple sources
- Making dozens of interconnected decisions
- Getting alignment across teams
- Keeping it updated as the product evolves

Most teams start this work, get 30% done, and abandon it. The document sits in a forgotten Notion page.

### What Changes Everything

**What if the model built itself?**

What if you could point at your product's website and get a structured draft of your entire growth model—activation definition, journey stages, metric catalog, entity model—in 60 seconds?

What if refining that model was as easy as having a conversation?

What if that model lived in a system that any AI assistant could access, making every conversation about your product smarter?

That's Basesignal.

---

## Core Belief System

### The Keystone Belief

> **"I need a structured model of how my product converts users to revenue—but I don't have time to build one from scratch."**

This belief is central because:

1. **It acknowledges the need.** Teams know they should have clear definitions, journey maps, and metrics. They just never get around to building them.

2. **It acknowledges the constraint.** Time is the enemy. Two-week discovery projects don't happen. Elaborate tracking plans gather dust.

3. **It creates the opening.** If the model could be generated—not created from scratch—suddenly it's achievable.

### The Belief Chain

| # | Belief | Type |
|---|--------|------|
| 1 | Our product converts some users into revenue, but not all | Observable reality |
| 2 | The gap between "users acquired" and "revenue realized" is value we're losing | The reframe |
| 3 | To close that gap, we need to understand where users drop off | Logical extension |
| 4 | That requires clear definitions: activation, retention, churn, etc. | Mechanism |
| 5 | We've tried to define these, but never finished / they're outdated | Pain recognition |
| **6** | **I need a structured model, but I don't have time to build one from scratch** | **KEYSTONE** |
| 7 | If the model could be generated from existing information... | Solution direction |
| 8 | ...and refined through conversation rather than workshops... | Solution refinement |
| 9 | ...then I could finally have what I need | Product fit |

---

## How Basesignal Works

### Step 1: Scan

User provides a URL. Basesignal crawls the marketing site, pricing page, documentation, and optionally YouTube channel and review sites.

```
User: "Scan my product at acme.io"

Basesignal: Analyzing... found 34 pages, pricing tier structure,
            documentation at docs.acme.io, 12 YouTube demos.

            Building your product profile...
```

**Time: 30-90 seconds**

### Step 2: Generate

Basesignal's analysis engine extracts structured information into the data model:

- **Core Identity:** What the product is, who it's for
- **Revenue Architecture:** How money flows, pricing model, expansion paths
- **Entity Model:** The "things" in the product (users, workspaces, projects, etc.)
- **User Journey:** Stages from signup to retained revenue
- **Definitions (draft):** Activation, First Value, Active, Churn
- **Outcomes:** What users are trying to achieve
- **Metric Catalog:** Relevant metrics with formulas

Each element has a confidence score and links to the evidence that informed it.

**Output: 70% complete product profile**

### Step 3: Refine

User reviews the draft and refines through conversation:

```
User: "The activation definition isn't quite right. We care about
       whether they connect a data source, not team invites."

Basesignal: Updated. New activation definition:
            "User creates a project AND connects at least one data source"

            Should I also update the related metrics?
            Activation Rate formula would change from...
```

Refinement happens naturally in conversation. Every update persists. The model gets more accurate over time.

### Step 4: Use Everywhere

The product knowledge is now accessible from any AI assistant:

- Ask Claude to help write a PRD → It knows your activation definition
- Ask ChatGPT to analyze a feature idea → It knows your user journey
- Ask Cursor to instrument tracking → It knows your entity model

The knowledge compounds. Every conversation makes the model richer.

---

## The Data Model: Our Moat

### Why the Model Matters

Anyone can crawl a website. Anyone can call an LLM.

**The moat is the structure we impose on the chaos.**

```
Raw crawled data  →  Basesignal Data Model  →  Actionable knowledge
(commodity)          (the moat)               (what users get)
```

### What the Data Model Encodes

| Layer | What It Captures |
|-------|------------------|
| **Ontology** | What concepts exist (Activation, First Value, Stage, Outcome, Entity) |
| **Relationships** | How concepts connect (Activation → belongs to → Journey Stage) |
| **Inference Rules** | How to derive one thing from another |
| **Validation Logic** | What makes a definition complete vs. incomplete |
| **Patterns** | What "good" looks like across product types |

### Concrete Example

Raw extraction: *"Free tier available, $29/seat/month"*

Without model: Just text.

With Basesignal model:
```yaml
revenue_architecture:
  model: seat_based
  has_free_tier: true
  entry_price: 29
  billing_unit: seat

  # Inferred from model rules:
  likely_expansion_path: add_seats
  churn_risk_factor: seat_reduction
  activation_pressure: high  # Free tier = must prove value fast

  # Connected to other concepts:
  links_to:
    - journey_stage: "Trial → Paid"
    - metric: "Free to Paid Conversion Rate"
    - outcome: "Team Adoption"
```

The structure is the value. The relationships. The inferences. The connections.

### The Model Gets Smarter

Every product analyzed teaches the model:
- More inference rules (if X then likely Y)
- More patterns (DevTools products typically have Z% activation)
- More benchmarks (data points by vertical, stage, model type)
- Better validation (this combination usually means incomplete)

**Compounding IP.** The more products use Basesignal, the smarter it gets.

---

## Architecture: MCP-First

### What is MCP?

Model Context Protocol (MCP) is an open standard that lets AI assistants connect to external tools and data sources. When Claude or ChatGPT connects to an MCP server, they gain new capabilities.

### Basesignal as MCP Server

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER'S WORLD                            │
│                                                                 │
│    ┌──────────┐    ┌──────────┐    ┌──────────┐                 │
│    │  Claude  │    │ ChatGPT  │    │  Cursor  │                 │
│    └────┬─────┘    └────┬─────┘    └────┬─────┘                 │
│         │               │               │                       │
│         └───────────────┼───────────────┘                       │
│                         │ MCP Protocol                          │
└─────────────────────────┼───────────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────────┐
│              BASESIGNAL MCP SERVER                              │
│                                                                 │
│  Tools:                                                         │
│  ├─ scan_product(url)          # Crawl and analyze              │
│  ├─ get_profile()              # Retrieve full profile          │
│  ├─ get_definition(type)       # Get activation, churn, etc.    │
│  ├─ update_definition(...)     # Refine through conversation    │
│  ├─ get_metrics()              # Metric catalog                 │
│  ├─ export_profile(format)     # MD, JSON, PDF                  │
│  └─ ask_about_product(q)       # Query the knowledge            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   DATA MODEL + STORAGE                   │   │
│  │  Product profiles, knowledge graph, inference rules      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Why MCP-First?

| Advantage | Impact |
|-----------|--------|
| **Zero UI barrier** | Users don't learn a new app |
| **Fits existing workflows** | PMs already use Claude daily |
| **Compound knowledge** | Every conversation adds to the model |
| **Solo founder leverage** | AI companies build the UI |
| **Future-proof** | Works with whatever AI wins |

The web interface is optional—for sharing, visualization, and team collaboration. But the primary interaction is through AI assistants.

---

## Target Users

### Primary Audience

**Product managers and founders at B2B SaaS companies who use AI assistants daily.**

They already ask Claude and ChatGPT for help with product work. Basesignal makes those conversations smarter by grounding them in structured product knowledge.

### Characteristics

- Use AI assistants multiple times per day
- Know they need better product definitions but haven't built them
- Have tried and abandoned tracking plans, metric definitions, journey maps
- Want data-driven decisions but lack the foundation

### Entry Points

- *"I need to define activation but don't know where to start"*
- *"Our team argues about metrics because nothing is defined"*
- *"I want to instrument tracking but don't have a plan"*
- *"Help me think through our user journey"*

These are things users already ask AI assistants. With Basesignal connected, the answers are grounded in their specific product.

### Expansion Audiences

| Audience | Use Case |
|----------|----------|
| **Data/Analytics teams** | Structured measurement plans, metric catalogs |
| **Growth teams** | Journey optimization, conversion definitions |
| **Engineering teams** | Tracking instrumentation from entity model |
| **Founders/Executives** | Product health overview, board-ready exports |

---

## Product Roadmap

### Phase 1: The Scanner (MVP)

**Goal:** Prove the magic works—URL in, useful profile out.

**What It Does:**
- MCP server with core tools
- Website crawling and content extraction
- LLM analysis into data model
- Profile generation with confidence scores
- Basic refinement through conversation
- Markdown and JSON export

**User Experience:**
```
Day 1: User connects Basesignal to Claude
       "Scan my product at acme.io"
       → Gets draft profile in 60 seconds
       → Refines activation definition in conversation
       → Exports to Notion

Day 7: Returns to refine more
       "What's my current activation definition?"
       → Basesignal remembers everything
       → Continues refinement
```

**Success Metrics:**
- Scanned profiles rated "useful" by >70% of users
- >50% of users refine at least one definition
- >30% of users return within 7 days

---

### Phase 2: Extended Intelligence

**Goal:** Richer sources, smarter analysis.

**What It Does:**
- YouTube channel analysis (demos, tutorials)
- Documentation site parsing
- G2/Capterra review mining
- Benchmark comparisons
- Inference rules engine
- Product type patterns

**User Experience:**
```
"Also analyze my YouTube channel and G2 reviews"
→ First Value moment identified from review sentiment
→ Onboarding flow extracted from demo videos
→ Activation compared to B2B SaaS benchmarks
```

---

### Phase 3: Connected Intelligence

**Goal:** Connect to real data, show actual performance.

**What It Does:**
- Connect to Amplitude, Mixpanel, Segment
- Gap analysis: ideal plan vs. actual tracking
- Live metrics: actual activation rate, retention, etc.
- Track definition accuracy over time

**User Experience:**
```
"Connect my Amplitude account"
→ "You're tracking 60% of your ideal measurement plan"
→ "Your activation rate is 34%, below the 42% benchmark"
→ "These 5 events are missing from your tracking"
```

---

### Phase 4: Growth Intelligence

**Goal:** Actionable insights for prioritization.

**What It Does:**
- Feature → outcome correlation
- Segment analysis (which user types convert best)
- Expansion opportunity identification
- Churn risk prediction
- Prioritization recommendations

**User Experience:**
```
"Which features drive activation?"
→ "Users who use Feature X activate at 2.3x the rate"
→ "Segment Y has 45% higher LTV but only 12% of signups"
→ "Prioritize: improving Feature X for Segment Y"
```

---

## Competitive Positioning

### The Gap We Fill

Basesignal fills a gap that exists **before** analytics tools and **above** raw data:

```
┌─────────────────────────────────────────────────────────────────┐
│  "What should we measure and why?"        ← BASESIGNAL          │
├─────────────────────────────────────────────────────────────────┤
│  "Measure these events"                   ← Tracking Plans      │
├─────────────────────────────────────────────────────────────────┤
│  "Here's your data"                       ← Analytics Tools     │
├─────────────────────────────────────────────────────────────────┤
│  "Here's your raw events"                 ← Data Infrastructure │
└─────────────────────────────────────────────────────────────────┘
```

### Competitive Landscape

| Category | Examples | How We're Different |
|----------|----------|---------------------|
| **Analytics Tools** | Amplitude, Mixpanel | They measure what you track. We tell you what to track and why. |
| **Tracking Plans** | Avo, Iteratively | They validate events. We define the strategy that informs events. |
| **Data Modeling** | dbt, Census | Infrastructure layer. We're the strategy layer. |
| **AI Assistants** | Claude, ChatGPT | General purpose. We add structured product knowledge. |
| **Consulting** | Analytics consultants | We productize the discovery. 60 seconds vs. 2 weeks. |

### Why Incumbents Won't Build This

1. **Analytics tools** are built for interactions, not outcomes. Rebuilding around outcome-driven measurement would cannibalize their core product.

2. **AI assistants** don't persist knowledge. Every conversation starts fresh. They can't accumulate product understanding over time.

3. **Neither** has the specialized data model. They don't encode the relationships between activation, journey stages, metrics, and revenue.

Basesignal sits **on top** of AI assistants (via MCP) and **before** analytics tools (defining what to measure). It's a new layer, not a replacement.

---

## Business Model

### MCP-Native Pricing

The MCP model enables clean usage-based pricing:

| Tier | What's Included | Price |
|------|-----------------|-------|
| **Free** | 1 product, basic scan, 10 refinements/month | $0 |
| **Pro** | 3 products, extended sources, unlimited refinements, export | $29/month |
| **Team** | Unlimited products, collaboration, benchmarks, API access | $99/month |

Alternative: Pure usage-based
- $1 per scan
- $0.10 per refinement
- $2 per export

### Revenue Potential

| Metric | Conservative | Optimistic |
|--------|--------------|------------|
| Users Year 1 | 500 | 2,000 |
| Paid Conversion | 10% | 20% |
| ARPU | $30/month | $50/month |
| ARR Year 1 | $18,000 | $240,000 |

The real upside is in Phase 3-4: connected data and intelligence. That's where enterprise value emerges.

---

## Key Product Decisions

### 1. MCP-First, Web-Optional

The primary interface is AI assistants via MCP. Web UI exists for sharing, visualization, and edge cases—not as the main product.

**Rationale:** Meet users where they are. Don't compete for screen time. Leverage AI companies' UI investment.

### 2. Crawl-Then-Refine, Not Interview-First

We generate draft profiles from public sources, then refine through conversation. Users correct rather than create.

**Rationale:** Correction is easier than creation. Instant value creates engagement. "How did it know that?" is a hook.

### 3. Data Model Is the Product

The structured ontology—concepts, relationships, inference rules—is the core IP. Everything else is interface.

**Rationale:** Crawling is commodity. LLMs are commodity. Structure is defensible.

### 4. Confidence Over Completeness

Every generated element has a confidence score. We'd rather be transparent about uncertainty than pretend false precision.

**Rationale:** Trust requires honesty. Users can prioritize refinement based on confidence.

### 5. Solo Founder, AI-Leveraged

One person, maximum AI leverage, minimal infrastructure. This is an experiment in what's possible in 2026.

**Rationale:** Stay lean, move fast, validate before scaling.

---

## Success Metrics

### For Users

- *"It figured out more about my product in 60 seconds than I could explain in an hour"*
- *"My team finally agrees on what activation means"*
- *"Every conversation with Claude about my product is smarter now"*
- *"I actually have a measurement plan I can hand to engineering"*

### For Basesignal (Phase 1)

| Metric | Target |
|--------|--------|
| Scanned profiles | 500 |
| "Useful" rating | >70% |
| Return rate (7-day) | >30% |
| Paid conversion | >10% |

### For Basesignal (Phase 2+)

| Metric | Target |
|--------|--------|
| Connected data sources | >100 |
| Monthly active products | >1,000 |
| ARR | >$100,000 |

---

## Messaging Framework

### Headline

> **Your product's growth model—generated in 60 seconds.**

### Core Message

Every product has a story of how it converts users into revenue. But most teams have never written that story down. Definitions are vague. Journey maps are outdated. Metrics are undefined.

Basesignal changes that. Point us at your website, and we'll draft your complete growth model—activation definitions, user journey, metric catalog, measurement plan. Then refine it through conversation with your AI assistant.

Finally, a structured understanding of how your product works—without the two-week discovery project.

### Tagline Options

- The product knowledge layer
- Your growth model, generated
- Product intelligence for AI assistants
- From URL to understanding in 60 seconds

### Positioning Statement

**For** product teams at B2B SaaS companies
**Who** need structured definitions of how their product converts users to revenue
**Basesignal is** a product knowledge layer
**That** generates comprehensive growth models from public sources and refines them through conversation
**Unlike** traditional analytics tools or manual discovery processes
**We** deliver a complete, structured product model in 60 seconds instead of 2 weeks.

---

## The Founder's Bet

This product is a bet on three trends:

### 1. AI Assistants Become Primary Interface

More and more work happens through conversation with AI. Tools that integrate with this paradigm will win over tools that fight it.

### 2. Structure Becomes Valuable Again

In a world of infinite generated content, structured knowledge becomes scarce and valuable. The data model is the moat.

### 3. Product-Led Growth Demands Clarity

As PLG matures, "just ship and see" isn't enough. Teams need rigorous understanding of their growth models. But they don't have time to build it manually.

Basesignal sits at the intersection: **structured product knowledge, accessible through AI assistants, generated automatically.**

---

## Summary

| Element | Description |
|---------|-------------|
| **The Problem** | Teams can't answer "how does our product convert users to revenue?" because they lack structured definitions |
| **Why It Persists** | Building the model is hard work that never gets finished |
| **The Insight** | What if the model generated itself from existing information? |
| **The Mechanism** | Crawl public sources → Generate structured profile → Refine through conversation |
| **The Moat** | The data model: ontology, relationships, inference rules, patterns |
| **The Interface** | MCP server accessible from any AI assistant |
| **Phase 1** | Scanner: URL → draft profile → conversational refinement |
| **Phase 2** | Extended sources: YouTube, docs, reviews, benchmarks |
| **Phase 3** | Connected data: actual metrics from analytics tools |
| **Phase 4** | Growth intelligence: prioritization and prediction |

---

> **Basesignal: The product knowledge layer—accessible from any AI, generated in 60 seconds, refined through conversation.**

---

*Version 2.0*
*January 2026*
*DeepSky Data ApS*

---
---

## Version History

### v1: Outcome-Driven Product Analytics (January 2026)

The original vision positioned Basesignal as a **web application** for outcome-driven product analytics. Key differences from v2:

| Aspect | v1 | v2 |
|--------|----|----|
| **Tagline** | "Outcome-Driven Product Analytics" | "The Product Knowledge Layer" |
| **Primary interface** | Web app with guided setup | MCP server via AI assistants |
| **Core mechanism** | AI-conducted interview (15 min) | URL scan + crawl (60 seconds) |
| **User interaction** | Come to our app, complete setup | Stay in your AI assistant, we come to you |
| **Value creation** | User answers questions → outputs generated | Public sources crawled → draft generated → user refines |
| **Moat** | Opinionated framework + education | Structured data model + compounding inference rules |
| **Keystone belief** | "I need to understand how much revenue potential our product is losing" | "I need a structured model, but I don't have time to build one from scratch" |
| **Time to value** | 15 minutes | 60 seconds |
| **Phase 1** | "The Generator" — interview-driven journey mapping | "The Scanner" — URL → draft profile |

#### What Carried Forward

These v1 ideas remain core to v2:
- **The problem space**: Teams can't answer "Is our product converting users into revenue?"
- **Outcome-driven thinking**: Measuring success, not just interactions
- **The three-layer framework**: Entities, Activities, Properties
- **Competitive positioning**: Sits above analytics tools, before tracking plans
- **Solo founder experiment**: Maximum AI leverage, minimal infrastructure
- **Later phases**: Connected data (Amplitude/Mixpanel) and growth intelligence

#### What Changed and Why

1. **Interface shift (app → MCP)**: Instead of building a UI and competing for screen time, become a capability within tools users already use daily. This is the biggest strategic shift—from "build an app" to "build intelligence."

2. **Input shift (interview → crawl)**: Instead of asking users to spend 15 minutes answering questions, generate a 70% complete draft from public sources in 60 seconds. Correction is easier than creation.

3. **Moat shift (framework → data model)**: The defensibility moved from "an opinionated measurement framework" to "a structured ontology with compounding inference rules." Every product analyzed makes the model smarter.

4. **Belief shift**: v1 emphasized loss aversion ("revenue you're losing"). v2 emphasizes the time constraint ("I don't have time to build one from scratch") and the magic of instant generation.
