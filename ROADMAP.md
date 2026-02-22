# Basesignal Roadmap

**Vision:** Context engineering for growth intelligence — generated in 60 seconds, open source, compounding with every conversation.

**Last Updated:** February 2026

**Planning Horizon:** Next 3 months (open source launch → community adoption → refinement loop)

---

## Current State

**Where we are:**
- Complete analysis engine: crawl → 7 lenses → convergence → ICP profiles, activation maps, measurement specs
- Open source monorepo: `@basesignal/core`, `crawlers`, `mcp-server`, `storage`, `cli`
- CLI works end-to-end: `basesignal scan <url>` → structured growth profile on disk
- MCP server works: connect from Claude Desktop for conversational access
- 1,653 tests passing across all packages
- 8 missions completed, all Phase 1 outcomes validated

**The core bet (proven):**
Point at a URL, get a structured growth profile in 60 seconds. The quality bar is "How did it know that?" — validated with M006/M007 output quality work. Value moments are experiential. Measurement specs follow the Double Three-Layer Framework. ICP profiles prioritize by product relevance, not marketing prominence.

**What's next:**
Ship the open source project publicly. Build the refinement loop. Grow the community. Let context compound.

---

## Current Focus Areas

### 1. Open Source Launch (Primary)

**Why:** The engine is built and validated. The biggest risk is now distribution, not quality. Getting the open source project in front of developers and product engineers is the highest-leverage action. Every `npx basesignal scan` is a demo that sells itself.

**Current State:** Repository is structured and tested. CLI, MCP server, Docker support all work. README, CONTRIBUTING.md, and LICENSE exist.

**Remaining Work:**
- Polish README with compelling examples and quick-start
- Publish packages to npm (`@basesignal/core`, `cli`, etc.)
- Set up GitHub Actions CI for PRs and releases
- Create 3-5 example growth profiles (Linear, Notion, Miro, etc.) as showcase
- Write announcement post / launch strategy (HN, Twitter, Reddit)
- Ensure `npx basesignal scan <url>` works as zero-install entry point

**Key Questions:**
- Which 3 example products best showcase the engine's quality?
- What's the npm org name? (`@basesignal` preferred)
- Do we launch on HN first or build a small community quietly?

**Success Signal:** 100 GitHub stars in first week. 5 community-filed issues (means people are actually using it).

---

### 2. Refinement Loop (Next)

**Why:** The scan gets you to ~80%. The refinement loop is where that becomes 100% — and where context engineering becomes real. Users correct definitions, validate sections, add context. The growth profile gets more accurate. Every refinement makes every future AI conversation smarter.

**Current State:** MCP server exposes read-only tools. Profile data persists in ProductDirectory (JSON files). No update/refine tools yet.

**Desired State:** Users can:
- Retrieve any section through conversation or CLI
- Update definitions naturally ("activation should be X, not Y")
- Validate sections the AI got right (confidence upgrade)
- Have updates cascade to connected sections (change activation → measurement spec adjusts)
- See what needs attention (confidence-based suggestions)

**Key Design Decisions:**
- Refinements edit the JSON files in ProductDirectory directly (transparent, inspectable)
- MCP tools for `update_definition`, `validate_section`, `suggest_improvements`
- CLI commands: `basesignal refine <slug>` for interactive refinement
- Track provenance: AI-inferred vs. user-validated per field

**Success Signal:** Users who refine at least one section have 2x return rate vs. scan-only users.

---

### 3. Community & Ecosystem (Parallel)

**Why:** Open source lives or dies by community. Even a small group of contributors adds crawlers, lenses, and integrations that one person can't build alone. The growth profile schema becomes more valuable as more tools produce and consume it.

**Current State:** Extension points exist (Crawler interface, StorageAdapter interface, LlmProvider interface, lens registry). No external contributors yet.

**Desired State:**
- 3+ community-contributed crawlers (e.g., YouTube, G2, docs site)
- Clear contributor guide with "good first issue" labels
- Discord or GitHub Discussions for community
- At least one external tool consuming growth profiles

**Key Questions:**
- What's the lowest-friction way for someone to contribute a new crawler?
- Should we create a plugin registry / marketplace early?
- How do we balance quality control with community velocity?

**Success Signal:** First external PR merged. First tool that reads growth profiles.

---

### 4. Export & Sharing

**Why:** Growth profiles need to escape the terminal and the chat to spread. A PM who generates a great profile wants to share it with their team. That share moment is the adoption mechanism — the recipient sees a profile and wants one for their product.

**Current State:** JSON files on disk. CLI `export` command exists for markdown output.

**Remaining Work:**
- Polish markdown export (clean formatting, section headers, tier badges)
- Add HTML export for standalone viewing
- Shareable link generation (static site from profile JSON)
- Optional: minimal web viewer for read-only profile browsing

**Key Questions:**
- Is a static HTML file (self-contained, no server) better than a hosted viewer?
- Should sharing require Basesignal Cloud, or can it work peer-to-peer?

**Success Signal:** A shared profile leads to the recipient scanning their own product.

---

## Sequencing

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   NOW: Open Source Launch                                       │
│   ├── npm publish + GitHub polish                               │
│   ├── Example profiles + announcement                           │
│   └── First 100 stars / first community issues                  │
│                                                                 │
│   NEXT: Refinement Loop                                         │
│   ├── MCP update tools + CLI refine command                     │
│   ├── Cascading updates + confidence tracking                   │
│   └── Context that compounds with every conversation            │
│                                                                 │
│   PARALLEL: Community & Ecosystem                               │
│   ├── Contributor onboarding + good first issues                │
│   ├── Community-contributed crawlers                             │
│   └── External tools consuming growth profiles                  │
│                                                                 │
│   THEN: Export & Sharing (Growth)                                │
│   ├── Polished markdown + HTML export                           │
│   ├── Shareable links / static viewer                           │
│   └── The "I want one for my product" moment                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Future Horizons

### Extended Sources (Phase 3)

**What:** YouTube channel analysis, documentation site parsing, G2/Capterra review mining.

**Why Not Now:** The marketing site scan produces validated, high-quality output. Extended sources enrich profiles that already work — they're additive, not foundational.

**When:** After open source launch proves adoption and community can contribute crawlers.

### Connected Intelligence (Phase 4)

**What:** Amplitude/Mixpanel/Segment connectors. Gap analysis ("you're tracking 60% of your ideal measurement plan"). Live metrics vs. recommended tracking.

**Why Not Now:** Requires the growth profile schema to be stable across real-world usage. Premature integration couples us to a model that might still evolve from community feedback.

**When:** After 50+ products scanned and the schema stabilizes from real usage.

### Benchmarks & Patterns (Phase 5)

**What:** Cross-product intelligence. "Your activation rate vs. similar products." Industry patterns. Growth model archetypes.

**Why Not Now:** Requires a critical mass of growth profiles to generate meaningful comparisons. This is where the commercial layer emerges — the open source engine generates profiles; the commercial service aggregates patterns.

**When:** After 500+ products scanned. This is the network effect play.

### Basesignal Cloud

**What:** Hosted MCP server, team collaboration, no-setup experience.

**Why Not Now:** Open source adoption comes first. Cloud is the monetization layer built on top of community trust and adoption.

**When:** After open source proves demand and the refinement loop is solid.

---

## What We've Shipped (Phase 1 Complete)

Eight missions, all complete:

| Mission | What It Proved |
|---------|---------------|
| **M001** Core Analysis | URL → structured profile works end-to-end |
| **M002** Multi-Level Activation | Activation as spectrum (4 levels) produces actionable understanding |
| **M003** 7-Lens Value Discovery | 83.3% accuracy on Tier 1 moments (threshold: 70%) |
| **M004** Output Generation | ICP profiles, activation maps, measurement specs — all generatable |
| **M005** Profile View | UI components for browsing and inspecting growth profiles |
| **M006** Output Quality | Production-quality convergence, ICP prioritization, entity framework |
| **M007** Insight Quality | Experiential value moments + Double Three-Layer measurement specs |
| **M008** Open Source Foundation | Modular packages, CLI, self-hostable, pluggable providers |

### Resolved Questions

These were open in the v2 roadmap. All answered through building:

| Question | Answer |
|----------|--------|
| Codebase strategy? | Monorepo with standalone packages. Convex web app coexists as one consumer. |
| Data model design? | Evolved iteratively through M001-M007. Schema now stable in `@basesignal/core`. |
| LLM provider? | Pluggable — Anthropic, OpenAI, Ollama. Users bring their own key. |
| Quality bar? | Experiential framing + Double Three-Layer Framework. Proven in M006/M007. |
| Hosting? | Self-hosted. File storage default. SQLite optional. No hosted infrastructure required. |

---

## Version History

### v2: MCP-First Product Knowledge Layer (January 2026)

The previous roadmap focused on building from zero: MCP platform → scan magic → conversational refinement → export. Everything was "nothing built" and "pre-threshold." The architecture was assumed to be hosted SaaS on Convex.

This was replaced after 8 missions shipped the entire Phase 1 engine and M008 restructured it as open source packages. The roadmap now starts from a working product, not a blank canvas.

### v1: Outcome-Driven Product Analytics (January 2026)

The original roadmap focused on interview-driven setup, web app UX, and Amplitude integration. Replaced when the vision shifted from web app to MCP-first, then again to open source context engineering.
