# BASESIGNAL
## Product Vision Document v3

*Context Engineering for Growth Intelligence*

**February 2026 | DeepSky Data ApS**

---

## Vision Statement

> *Every product has a growth model—who it acquires, how they activate, why they stay, where revenue expands.*
> *Most teams have never written it down. Basesignal generates it—and anyone can run it.*

Basesignal is **context engineering for growth intelligence**—an analysis engine that crawls a product's public presence, discovers how it converts users into revenue, and generates structured growth context: who the users are (ICP profiles), how they progress (activation maps), what they experience (value moments), and what to measure (measurement specifications).

This context is what makes AI conversations about your product actually useful. Without it, every question to Claude about your activation rate, your ICP, or your measurement plan starts from zero. With Basesignal, every conversation is grounded in structured growth intelligence that accumulates over time.

Run it from the command line. Connect it as an MCP server. Self-host it with Docker. The tools are open source; the context is yours; the intelligence compounds across every product analyzed.

---

## The Paradigm Shift

### Old Model: Start Every Conversation From Zero

Ask an AI assistant about your product's activation rate. It will give you a generic answer about B2B SaaS. Ask it to write a measurement plan. It will invent plausible-sounding events that don't match your product. Ask it who your ICP is. It will parrot your marketing page.

The problem isn't the AI. It's the **context**. Without structured knowledge about your specific product — its users, value moments, activation model, entity structure — every AI conversation about growth starts from scratch.

### New Model: Engineer the Context Once, Use It Everywhere

Basesignal **engineers the growth context** that makes every downstream conversation, decision, and tool smarter. It crawls your product, runs 7 analytical lenses, and produces structured growth intelligence that persists, compounds, and connects to every tool in your stack.

The shift is from "ask an AI and hope" to "give the AI the right context and know."

Growth context should be:
- **Structured:** Not prose in a doc — typed, validated, interconnected
- **Engineered:** Not manually assembled — generated from evidence, refined through conversation
- **Portable:** Move between tools without losing your model
- **Compounding:** Every refinement makes every future conversation smarter
- **Self-hostable:** Run on your infrastructure with your API keys

---

## The Problem We Solve

### The Surface Problem

Product teams can't answer the fundamental question: **How does our product grow?**

Not "are signups increasing" — but the structural question: Who are our best users? What do they experience that makes them stay? Where do others drop off? What should we measure to know?

### The Deeper Problem

They don't have a structured growth model. Ask five team members to define "activation" and you'll get five different answers. Ask who the ideal customer is and you'll get a marketing persona that doesn't match the users who actually convert. Ask for the measurement plan and you'll get a tracking spreadsheet from 18 months ago.

Growth intelligence — the connected understanding of users, value, activation, and measurement — is scattered across tools, teams, and outdated documents.

### Why This Persists

Building a growth model is hard work. It requires:
- Understanding who your users really are (not just who marketing targets)
- Mapping how they discover and experience value
- Defining activation, retention, and expansion precisely
- Translating all of that into a measurement spec engineering can implement
- Getting alignment across product, growth, data, and engineering
- Keeping it updated as the product evolves

Most teams start this work, get 30% done, and abandon it.

### What Changes Everything

**What if the growth model built itself?**

What if you could point at your product's website and in 60 seconds get:
- **Who** your ideal customers are and what they care about
- **What** value moments drive activation and retention
- **How** users progress from first visit to power user
- **What to measure** — a complete tracking specification ready for engineering

What if refining that model was as easy as having a conversation?

What if it lived in a portable, open format that worked with any tool in your stack?

That's Basesignal.

---

## Core Belief System

### The Keystone Belief

> **"I need a structured model of how my product grows—who our users are, how they activate, what to measure—but I don't have time to build one from scratch, and I don't want to be locked into a vendor to store it."**

This belief is central because:

1. **It acknowledges the need.** Teams know they should have clear definitions, journey maps, and metrics. They just never get around to building them.

2. **It acknowledges the constraint.** Time is the enemy. Two-week discovery projects don't happen.

3. **It acknowledges the distrust.** Teams have been burned by vendor lock-in. They want to own their data.

4. **It creates the opening.** If the model could be generated—and lived in an open format they control—suddenly it's achievable.

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
| 8 | ...in an open format I can inspect, extend, and own... | Trust requirement |
| 9 | ...then I could finally have what I need | Product fit |

---

## How Basesignal Works

### Step 1: Scan

User provides a URL. Basesignal crawls the marketing site, pricing page, and documentation.

```bash
$ basesignal scan https://acme.io

Crawling... found 34 pages
Extracting identity, revenue model, entities...
Running 7 analytical lenses...
Converging 102 candidates into value moments...
Generating ICP profiles, activation map, measurement spec...

✓ Product profile saved to ~/.basesignal/products/acme-io/
```

**Time: 60-90 seconds**

### Step 2: Generate

The analysis engine runs a multi-phase pipeline:

**Phase 1 — Extract** (parallel): Identity, revenue architecture, entity model, activation levels
**Phase 2 — Discover** (7 lenses): Capability mapping, effort elimination, time compression, artifact creation, information asymmetry, decision enablement, state transitions
**Phase 3 — Converge**: Validate candidates → cluster semantically → assign tiers (Core / Important / Supporting)
**Phase 4 — Output**: ICP profiles, activation maps, measurement specifications

Each output follows the **Double Three-Layer Framework**:
- **Entities** define the core objects (3-7 per product) with reusable properties
- **Activities** mark entity lifecycle progress (past-tense: board_created, asset_shared)
- **Perspectives** cover Customer (journey state), Product (entity lifecycle), and Interaction (specific actions)

**Output: Structured product profile as portable JSON**

### Step 3: Refine

Connect Basesignal as an MCP server and refine through conversation:

```
User: "The activation definition isn't quite right. We care about
       whether they connect a data source, not team invites."

Basesignal: Updated activation definition.
            Cascading update to measurement spec...
            3 events adjusted. Activation map updated.
```

Or edit the JSON files directly. They're yours.

### Step 4: Use Everywhere

The product profile is a structured, portable artifact:

- **In your AI assistant:** Connect as MCP server—every conversation is grounded in your product model
- **In your docs:** Export as Markdown for Notion, Confluence, or your wiki
- **In your code:** Import the JSON into your analytics pipeline
- **In your team:** Share the profile directory—it's just files

---

## The Growth Profile: Engineered Context

### Why Context Engineering Matters

Anyone can crawl a website. Anyone can call an LLM.

**The moat is the engineered context—structured growth intelligence that makes every downstream use better.**

```
Raw crawled data  →  Context Engineering  →  Structured growth profile
(commodity)          (the engine)            (what makes AI useful)
```

The difference between "AI that gives generic advice" and "AI that knows your product" is the quality of context it has access to. Basesignal engineers that context.

### What the Schema Encodes

The growth profile captures the full picture of how a product converts users into revenue:

| Layer | Growth Question | What It Captures |
|-------|----------------|------------------|
| **Identity** | "What is this product?" | What it does, who it's for, business model, revenue architecture |
| **Value Moments** | "What makes users stay?" | Tiered catalog of user-experienced moments (Core / Important / Supporting) |
| **ICP Profiles** | "Who are the best users?" | Distinct personas with value moment priorities, activation triggers, pain points |
| **Activation Map** | "How do users progress?" | Multi-level progression from first visit → power user, with triggers and drop-off risk |
| **Measurement Spec** | "What should we track?" | Entity-first tracking specification: entities, activities, properties, perspectives |

Together, these layers form the **growth context** — a connected model that answers: **Who** should we acquire → **What** do they need to experience → **How** do they progress → **What** do we measure to know it's working.

### The Schema as Portable Context

The growth profile schema is:
- **Versioned**: Semantic versioning, backward-compatible evolution
- **Published**: TypeScript types and JSON Schema available as `@basesignal/core`
- **Portable**: Any tool can read and write growth profiles
- **Extensible**: Add custom sections without breaking the core

When you connect Basesignal as an MCP server, this context is available in every AI conversation. When you export it, this context travels with your product. When other tools adopt the schema, the context compounds across your entire stack.

---

## Architecture: Modular Open Source

### Package Structure

```
@basesignal/core           Schema types, validation, scoring algorithms
@basesignal/crawlers       Pluggable crawlers (Firecrawl, Jina, static)
@basesignal/mcp-server     Analysis pipeline, MCP server, LLM integration
@basesignal/storage        Storage adapters (file, SQLite), product directory
@basesignal/cli            Command-line interface
```

### Three Ways to Run

```
CLI (simplest)           basesignal scan <url>
                         → JSON files on disk

MCP Server (richest)     Connect from Claude Desktop, Cursor, ChatGPT
                         → Conversational refinement + persistence

Docker (self-host)       docker-compose up
                         → Full server with storage
```

### Extension Points

| Extension | How |
|-----------|-----|
| **New crawler** | Implement the Crawler interface, register in config |
| **New storage** | Implement the StorageAdapter interface |
| **New LLM provider** | Implement the LlmProvider interface (Anthropic, OpenAI, Ollama supported) |
| **New analysis lens** | Add to the lens registry |
| **Custom output** | Add an output generator to the pipeline |

### Configuration

```toml
# basesignal.toml
[provider]
name = "anthropic"       # or "openai", "ollama"

[storage]
adapter = "file"          # or "sqlite"

[crawl]
max_pages = 50
```

Precedence: env vars > `./basesignal.toml` > `~/.basesignal/config.toml` > defaults

---

## Target Users

### Primary: Developers and Product Engineers

**The open source entry point.** They discover Basesignal on GitHub, run `npx basesignal scan` on their product, and get a structured profile in their terminal. They care about:
- Self-hostable, no vendor lock-in
- Portable JSON output they can pipe into other tools
- Extensible architecture they can contribute to
- Bring-your-own LLM key

### Secondary: Product Managers Who Use AI Assistants

**The MCP entry point.** They connect Basesignal to Claude Desktop and refine their product model through conversation. They care about:
- Instant value from URL scan
- Conversational refinement without learning a new tool
- Shareable profiles for team alignment
- Measurement specs they can hand to engineering

### Expansion: Teams and Organizations

| Audience | Use Case |
|----------|----------|
| **Data/Analytics teams** | Structured measurement plans from the schema |
| **Growth teams** | ICP-driven activation optimization |
| **Engineering teams** | Entity-first tracking instrumentation |
| **Founders/Executives** | Product health overview, board-ready exports |

---

## Business Model: Open Core

### Open Source (Free Forever)

Everything in the repository:
- Full analysis engine (crawl → extract → discover → converge → generate)
- CLI, MCP server, all crawlers and storage adapters
- Product profile schema and TypeScript types
- Self-hosting via Docker

### Commercial Layer (Future)

| Offering | Value | Model |
|----------|-------|-------|
| **Basesignal Cloud** | Hosted MCP server, team collaboration, no setup | SaaS subscription |
| **Benchmarks** | "Your activation rate vs. similar products" | Data network effect |
| **Extended Sources** | YouTube, G2, documentation, review mining | Premium crawlers |
| **Analytics Integration** | Connect Amplitude/Mixpanel, gap analysis | Premium connectors |

The open source project builds the standard. The commercial layer builds on the network.

---

## What We've Proven

Eight missions completed. The analysis engine is validated end-to-end.

### Validated Hypotheses

| Hypothesis | Result | Mission |
|------------|--------|---------|
| **H5: Multi-Level Activation** | 4 distinct levels with measurable criteria, aha-moment correctly identified | M002 |
| **H6: 7-Lens Value Discovery** | 83.3% accuracy on Tier 1 moments (threshold: 70%) | M003 |

### Production-Quality Outputs (M006 + M007)

- **Value moments** describe user-experienced moments, not abstract business outcomes
- **ICP profiles** prioritize by product relevance, not marketing prominence
- **Measurement specs** follow the Double Three-Layer Framework (entities → activities → perspectives)
- **Convergence** produces useful tier distribution: 2-3 Core, 5-6 Important, ≤20 Supporting

### Open Source Foundation (M008)

- Modular packages with clear boundaries
- `basesignal scan <url>` works without any hosted infrastructure
- Pluggable crawlers, storage adapters, and LLM providers
- Product profile schema published as `@basesignal/core`

---

## Product Roadmap

### Phase 1: The Open Source Engine ✓ Complete

**What shipped:**
- Multi-phase analysis pipeline (identity → lenses → convergence → outputs)
- 7 analytical lenses with experiential extraction
- LLM-based semantic clustering and tiered convergence
- ICP profile, activation map, and measurement spec generators
- Modular packages: core, crawlers, mcp-server, storage, cli
- CLI with `scan`, `init`, `export`, `serve` commands
- TOML config, product directory storage, structured artifact persistence
- Docker support for self-hosting

### Phase 2: Refinement Loop

**Goal:** Make generated profiles improvable through conversation and direct editing.

- MCP tools for retrieving, updating, and validating profile sections
- Cascading updates (change activation → measurement spec adjusts)
- Confidence tracking: AI-inferred vs. user-validated
- Suggestions engine: "These sections need attention"

### Phase 3: Extended Sources

**Goal:** Richer inputs for deeper analysis.

- YouTube channel analysis (demos, tutorials, onboarding)
- Documentation site parsing (API docs, guides)
- G2/Capterra review mining (user sentiment, use cases)
- Benchmark database from analyzed products

### Phase 4: Connected Intelligence

**Goal:** Bridge the gap between recommended tracking and actual data.

- Amplitude, Mixpanel, Segment connectors
- Gap analysis: "You're tracking 60% of your ideal measurement plan"
- Live metrics: actual activation rate, retention, conversion
- Feature → outcome correlation

---

## Competitive Positioning

### The Gap We Fill

```
┌─────────────────────────────────────────────────────────────────┐
│  "How does our product grow?"             ← BASESIGNAL          │
│  (users, value, activation, measurement)                        │
├─────────────────────────────────────────────────────────────────┤
│  "Validate these events"                  ← Tracking Plans      │
├─────────────────────────────────────────────────────────────────┤
│  "Here's your data"                       ← Analytics Tools     │
├─────────────────────────────────────────────────────────────────┤
│  "Here's your raw events"                 ← Data Infrastructure │
└─────────────────────────────────────────────────────────────────┘
```

Every layer below assumes you already know your growth model. Basesignal generates it.

### Why Open Source Wins

| vs. | Their Limitation | Our Advantage |
|-----|-----------------|---------------|
| **Analytics SaaS** (Amplitude, Mixpanel) | They measure what you track. Closed schema. No growth model. | We generate the growth model that tells you what to track. Open schema you own. |
| **Tracking Plans** (Avo, Iteratively) | They validate events. No strategy layer. | We generate the strategy — users, value moments, activation — that informs events. |
| **Growth platforms** (Pendo, Appcues) | They optimize existing flows. No structured intelligence. | We generate the structured intelligence they should be optimizing toward. |
| **AI Assistants** (Claude, ChatGPT) | No persistence. Every conversation starts fresh. | Structured growth knowledge that accumulates and connects. |
| **Consulting** | $20K and 2 weeks. | 60 seconds. Free. Self-serve. Open source. |

### Why Open Source Specifically

1. **Trust through transparency.** Product teams can inspect every prompt, every scoring algorithm, every inference rule. No black box.
2. **Adoption through distribution.** `npx basesignal scan` is zero-friction. No signup, no credit card, no vendor approval.
3. **Context compounds.** Every product analyzed, every refinement made, every conversation grounded—the context gets richer and the AI gets smarter about growth.
4. **Quality through contribution.** Crawlers for new platforms, lenses for new analytical perspectives, storage adapters for new backends—community extends what one team can't.

---

## Key Product Decisions

### 1. Open Source First, Commercial Later

The analysis engine, schema, and tools are fully open source (MIT). Commercial offerings build on top—never gate the core.

**Rationale:** Standards win through adoption, not monetization. Build the network first.

### 2. CLI + MCP, Not Web App

The primary interfaces are the command line and MCP protocol. A web viewer exists for sharing and visualization—not as the main product.

**Rationale:** Meet developers where they are. Don't compete for screen time. Leverage AI companies' UI investment.

### 3. Context Is the Product

The engineered growth context—structured, validated, interconnected—is the core IP. Everything else is interface.

**Rationale:** Crawling is commodity. LLMs are commodity. Structured growth context that makes AI conversations actually useful doesn't exist. We're creating it.

### 4. Experiential, Not Abstract

Value moments describe what users **experience**, not what the marketing site says. Measurement specs follow the Double Three-Layer Framework.

**Rationale:** M006 and M007 proved that experiential framing produces outputs product teams recognize as accurate. Abstract outputs get ignored.

### 5. Confidence Over Completeness

Every generated element has a confidence score. We'd rather be transparent about uncertainty than pretend false precision.

**Rationale:** Trust requires honesty. Users can prioritize refinement based on confidence.

### 6. Solo Founder, AI-Leveraged

One person, maximum AI leverage, open source distribution. This is an experiment in what's possible in 2026.

**Rationale:** Stay lean, build in the open, let the community amplify.

---

## The Founder's Bet

This product is a bet on three trends:

### 1. Open Source Eats the Product Stack

PostHog, Supabase, Cal.com—the pattern is clear. Open source wins in developer-adjacent categories by building trust through transparency and community. Growth intelligence is next.

### 2. Context Becomes the Bottleneck

AI models are getting cheaper and smarter every quarter. The bottleneck isn't intelligence—it's context. The team that can feed an AI structured knowledge about their product's growth model will outperform the team prompting from scratch. Context engineering is the new competitive advantage.

### 3. AI Makes Intelligence Generatable

What took a consulting team two weeks can now be generated in 60 seconds. The barrier isn't intelligence anymore—it's structure. Basesignal provides the structure; LLMs provide the intelligence.

Basesignal sits at the intersection: **context engineering for growth, open source, generated by AI.**

---

## Success Metrics

### For Users

- *"It figured out more about my product in 60 seconds than I could explain in an hour"*
- *"My team finally agrees on what activation means"*
- *"I actually have a measurement plan I can hand to engineering"*
- *"I can run this on my own infrastructure—no vendor dependency"*

### For the Project

| Metric | Phase 1 (Current) | Phase 2 | Phase 3 |
|--------|-------------------|---------|---------|
| GitHub stars | 500 | 2,000 | 5,000 |
| Products analyzed | 100 | 1,000 | 10,000 |
| Contributors | 5 | 20 | 50 |
| Schema adopters | 1 (us) | 5 tools | 20 tools |

### For the Business

| Metric | Year 1 | Year 2 |
|--------|--------|--------|
| Cloud subscribers | 50 | 500 |
| ARR | $15,000 | $150,000 |
| Community-contributed crawlers | 5 | 20 |

---

## Summary

| Element | Description |
|---------|-------------|
| **The Problem** | Teams can't answer "how does our product grow?" — and every AI conversation about it starts from zero |
| **Why It Persists** | Building a growth model requires connecting users, value moments, activation, and measurement — hard work that never gets finished |
| **The Insight** | What if the growth context engineered itself—and made every AI conversation smarter? |
| **The Mechanism** | Crawl → 7 lenses → converge → generate ICP profiles, activation map, measurement spec |
| **The Context** | Growth profile: structured, versioned, portable, compounding |
| **The Distribution** | Open source: CLI, MCP server, Docker. Run anywhere. |
| **Phase 1** | The engine: URL → structured product profile (complete) |
| **Phase 2** | Refinement: conversational improvement, cascading updates |
| **Phase 3** | Extended sources: YouTube, docs, reviews, benchmarks |
| **Phase 4** | Connected intelligence: analytics integration, gap analysis |

---

> **Basesignal: Context engineering for growth intelligence—generated in 60 seconds, open source, compounding with every conversation.**

---

*Version 3.0*
*February 2026*
*DeepSky Data ApS*

---
---

## Version History

### v2: The Product Knowledge Layer (January 2026)

The second vision positioned Basesignal as a **hosted MCP-first SaaS**—a product knowledge layer accessible through AI assistants. Key differences from v3:

| Aspect | v2 | v3 |
|--------|----|----|
| **Tagline** | "The Product Knowledge Layer" | "Context Engineering for Growth Intelligence" |
| **Distribution** | Hosted SaaS with MCP server | Open source: CLI + MCP + Docker |
| **Moat** | Structured data model + compounding inference | Engineered growth context + open schema |
| **Business model** | SaaS subscription ($29-99/month) | Open core: free engine + commercial cloud/benchmarks |
| **Primary interface** | MCP server via AI assistants | CLI (developers) + MCP (product managers) |
| **Schema ownership** | Stored in Basesignal's infrastructure | Portable JSON files the user owns |
| **Architecture** | Monolithic Convex serverless backend | Modular npm packages, self-hostable |
| **Phase 1 status** | Planned ("The Scanner") | Complete (8 missions shipped) |

#### What Carried Forward

These v2 ideas remain core to v3:
- **The problem space**: Teams can't answer "how does my product convert users to revenue?"
- **Crawl-then-refine mechanism**: Generate draft from public sources, refine through conversation
- **MCP as interface**: AI assistants as primary interaction for product managers
- **Confidence over completeness**: Transparent uncertainty, not false precision
- **Solo founder experiment**: Maximum AI leverage, minimal infrastructure

#### What Changed and Why

1. **Distribution shift (SaaS → open source)**: M008 proved the engine works as standalone packages. Open source distribution removes all adoption friction—no signup, no credit card, no vendor approval process. Standards win through adoption.

2. **Architecture shift (monolith → packages)**: The Convex backend was the right prototyping choice, but self-hosting requires portability. Modular packages (core, crawlers, mcp-server, storage, cli) let users compose what they need.

3. **Moat shift (data model → engineered context)**: The defensibility moved from "a data model inside our SaaS" to "the engine that produces structured growth context." The context compounds — every product analyzed, every refinement, every conversation makes the system smarter.

4. **Quality validation**: M006 (output quality) and M007 (insight quality) proved the engine produces outputs that product teams recognize as accurate. This gave confidence to open source the engine—the quality speaks for itself.

### v1: Outcome-Driven Product Analytics (January 2026)

The original vision positioned Basesignal as a **web application** for outcome-driven product analytics. Key differences:

| Aspect | v1 | v2 | v3 |
|--------|----|----|-----|
| **Tagline** | "Outcome-Driven Product Analytics" | "The Product Knowledge Layer" | "Context Engineering for Growth Intelligence" |
| **Primary interface** | Web app with guided setup | MCP server via AI assistants | CLI + MCP + Docker |
| **Core mechanism** | AI-conducted interview (15 min) | URL scan + crawl (60 sec) | URL scan + 7 lenses + convergence (60 sec) |
| **Distribution** | Web app | Hosted SaaS | Open source |
| **Moat** | Opinionated framework | Structured data model | Engineered growth context |

#### What Has Persisted Across All Three Versions

- **The problem**: Teams lack structured definitions of how their product creates value
- **The bet**: AI can generate what teams can't build manually
- **The ambition**: 60 seconds instead of 2 weeks
- **The outcome**: Structured growth context that makes AI conversations actually useful
