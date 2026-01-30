# Basesignal Roadmap

**Vision:** Every product has a story of how it converts users into revenue. Basesignal learns that story—from anywhere you work.

**Last Updated:** January 2026

**Planning Horizon:** Next 3 months (MVP: URL → useful profile → refined → shareable)

---

## Current State

**Where we are:**
- Existing React/Convex codebase with AI-guided interview flow and React Flow journey visualization (v1 approach)
- New direction: MCP-first product knowledge layer that crawls, analyzes, and structures product knowledge
- No MCP server exists yet — this is the build phase

**The core bet:**
Point at a URL, get a structured product profile in 60 seconds. Refine through conversation. Share with your team. The data model — not the UI — is the product.

**Key tension:** The scan has to be *surprisingly good* from day one. A mediocre generated profile is worse than no profile — it teaches users "this isn't worth my time." The quality bar is "How did it know that?"

---

## Current Focus Areas

### 1. Scan Magic (Primary)

**Why:** This is the hook. If scanning a URL doesn't produce something surprisingly useful, nothing else matters. The vision promises "60 seconds instead of two weeks" — this area delivers on that promise.

**Current State:** Nothing built. The scan pipeline (crawl → extract → analyze → assemble) doesn't exist yet.

**Desired State:** A user provides a URL and gets back a draft profile that makes them say "How did it know that?" The profile includes:
- Core identity (what, who, business model)
- Revenue architecture (pricing model, expansion paths)
- Entity model (the "things" in the product)
- Journey stages (signup → activated → retained)
- Draft definitions (activation, first value, churn)
- Metric suggestions with formulas
- Confidence scores and evidence links throughout

**Key Questions:**
- How good can LLM analysis be from marketing sites alone? What's the realistic confidence level?
- Which profile sections produce the most "wow" — should we optimize depth in fewer areas over breadth?
- What's the right crawl scope? (depth limit, page limit, JS rendering needs)
- Does the structured data model need to be fully designed upfront, or can it evolve with each analysis component?

**Utility Curve Position:** Pre-threshold (zero value until this works and works well)

**Connects to backlog:** Epic 2 (Website Crawling), Epic 3 (Core Analysis)

---

### 2. MCP Platform (Foundation)

**Why:** Without a running MCP server that AI assistants can connect to, Scan Magic has no delivery mechanism. This is the infrastructure that makes everything accessible. Invest enough to unblock the scan — not more.

**Current State:** No MCP server. Existing app is React + Convex (web app architecture, not MCP).

**Desired State:** A working MCP server that:
- Accepts connections from Claude Desktop / other MCP clients
- Authenticates users and persists their data across sessions
- Exposes tools for scanning, retrieving profiles, and refining
- Stores the structured data model reliably

**Key Questions:**
- Which MCP SDK? (TypeScript vs Python — TypeScript aligns with existing codebase)
- Where to host? (Railway, Fly.io, or similar — needs SSE support)
- Auth model? (OAuth2, magic links, or simple token-based)
- Database choice? (PostgreSQL for structured data, or extend Convex?)
- Does the existing Convex backend carry forward, or is this a clean-start project?

**Utility Curve Position:** Pre-threshold (nothing works without the platform, but the platform alone has no value)

**Connects to backlog:** Epic 1 (Foundation)

---

### 3. Conversational Refinement

**Why:** The scan gets you to ~70%. The refinement loop is where that becomes 100% — and where real stickiness emerges. Users correct definitions, validate sections, add context. The model gets more accurate over time. This is also where the "product knowledge layer" promise becomes real: knowledge that persists and compounds.

**Current State:** Nothing built. The scan pipeline (Focus Area 1) produces the draft; this area makes it improvable.

**Desired State:** Users can:
- Retrieve any section or definition through conversation
- Update definitions naturally ("activation should be X, not Y")
- Validate sections the AI got right (quick confidence upgrade)
- Ask questions about their profile and get grounded answers
- See what to improve next (prioritized suggestions)
- Have updates ripple to connected elements (change activation → metrics update)

**Key Questions:**
- How much intelligence goes into the refinement tools vs. relying on the AI assistant's natural conversation ability?
- How do we handle conflicts when a refinement breaks consistency with other sections?
- What's the minimum viable refinement loop? (Update definition + validate section might be enough to start)
- How do we track what's AI-inferred vs. user-validated?

**Utility Curve Position:** Crossing threshold (each refinement tool adds immediate value; small investments = visible improvement)

**Connects to backlog:** Epic 4 (Profile Generation), Epic 5 (Conversational Refinement)

---

### 4. Export & Sharing

**Why:** Profiles need to escape the chat to spread. A PM who generates a great profile wants to share it with their team. That share moment is the growth mechanism — the recipient sees a profile and wants one for their product. Markdown export makes profiles immediately useful in Notion/docs. Shareable links make them viral.

**Current State:** Nothing built.

**Desired State:**
- Markdown and JSON export work from MCP tools
- Shareable link generates a public URL to a read-only web view
- Web viewer renders profiles professionally (mobile-responsive, clean design)
- Links can be revoked

**Key Questions:**
- How minimal can the web viewer be? (Static page from profile JSON? Or does it need a real app?)
- Does the web viewer reuse the existing React codebase, or is it a separate lightweight app?
- Is PDF export needed in the first 3 months, or is Markdown sufficient?
- How do shareable links work with auth? (Public by default? Token-gated?)

**Utility Curve Position:** Pre-threshold (no sharing = no word-of-mouth, but basic export is low effort)

**Connects to backlog:** Epic 8 (Export & Sharing), Epic 9 (Web Viewer — minimal)

---

## Sequencing

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   FIRST: MCP Platform (Foundation)                              │
│   ├── Server skeleton + basic auth + storage                    │
│   └── Unblocks everything else                                  │
│                                                                 │
│   THEN: Scan Magic (The Hook)                                   │
│   ├── Crawling pipeline + content extraction                    │
│   ├── LLM analysis into structured data model                   │
│   └── End-to-end: URL → draft profile                           │
│                                                                 │
│   THEN: Conversational Refinement (Stickiness)                  │
│   ├── Profile retrieval tools                                   │
│   ├── Definition updates + section validation                   │
│   └── Suggestions engine                                        │
│                                                                 │
│   THEN: Export & Sharing (Growth)                                │
│   ├── Markdown + JSON export                                    │
│   ├── Shareable links + minimal web viewer                      │
│   └── The "I want one too" moment                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Note: MCP Platform and Scan Magic will overlap in practice — you need the server to test the scan tools. The sequencing reflects dependency, not strict phases.

---

## Parked Areas

### Extended Sources (YouTube, Docs, Reviews)

**Why Not Now:** The marketing site scan needs to be great first. Adding YouTube, G2, and documentation analysis is Phase 2 of the vision — it enriches profiles that already work, rather than fixing profiles that don't.

**When:** After Scan Magic is validated with real users and the core profile quality is proven.

### Analytics Integration (Amplitude, Mixpanel, Segment)

**Why Not Now:** Connecting real data is Phase 3 of the vision. It requires the profile structure to be stable and validated. Premature integration would couple us to a data model that might still be evolving.

**When:** After the scan-refine-share loop is working and profiles are stable enough to compare against real tracking.

### Growth Intelligence (Feature Correlation, Segmentation, Prediction)

**Why Not Now:** Phase 4 of the vision. Requires connected data (Phase 3) and a large enough user base to generate meaningful benchmarks.

**When:** End of 2026 at earliest. This is the long-term value play.

### Full Web Dashboard

**Why Not Now:** The vision is MCP-first. A full dashboard with editing, collaboration, and visual journey editing competes with the core bet that AI assistants are the primary interface. The minimal web viewer (Focus Area 4) is sufficient for sharing.

**When:** Only if user demand clearly shows chat-based interaction isn't enough for certain workflows (e.g., visual journey editing).

### Intelligence Layer (Benchmarks, Inference Rules, Product Patterns)

**Why Not Now:** The data model needs to be validated with real products first. Encoding inference rules and benchmark data before we know the model is right risks building on shaky foundations.

**When:** After 50+ products scanned and patterns emerge organically from real data.

---

## Open Questions

1. **Codebase strategy:** Does the existing React/Convex app carry forward (shared backend, web app becomes viewer), or is the MCP platform a clean-start project? This affects architecture and timeline significantly.

2. **Data model design:** Should the full ontology be designed upfront (risk: over-engineering before validation) or evolved iteratively (risk: painful migrations)?

3. **Hosting & infrastructure:** MCP server needs SSE support, database, and potentially object storage (screenshots, PDFs). What's the minimal viable stack?

4. **LLM provider & cost:** Which model for analysis? Cost per scan matters for pricing. Can we use cheaper models for some extraction steps?

5. **Quality bar:** What's the minimum "wow" threshold for scan results? Should we focus depth on fewer sections (e.g., nail revenue architecture and activation) rather than breadth across all sections?

---

## Connection to Hypotheses

Each investment area generates testable hypotheses. See HYPOTHESES.md for the full catalog.

Key hypothesis for this horizon: *"Users who scan their product URL will rate the generated profile as 'useful' (>70%) and refine at least one definition (>50%)."*

---

## Version History

### v1: Outcome-Driven Product Analytics (January 2026)

The original roadmap focused on:
- **Measurement Foundation:** Generating tracking plans and metric catalogs from interview data
- **Interview Completion:** Validating that users complete the 15-minute guided interview
- **Analytics Integration (stretch):** Connecting to Amplitude/Mixpanel

This was replaced when the product vision shifted from web app with interview-driven setup to MCP-first product knowledge layer with crawl-then-refine mechanism. See VISION.md Version History for full context.
