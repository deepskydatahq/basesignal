---
description: Brainstorm a new feature, create design doc, and add to GitHub issues
allowed-tools: Bash(git:*), Bash(gh issue create:*), Read, Write, Glob, Grep, Skill
---

# New Feature

Guide a new feature from idea to design document and GitHub issue.

## Instructions

1. **Capture the idea:**

   If argument provided (e.g., `/new-feature add dark mode support`):
   - Use as the starting point for brainstorming

   If no argument:
   - Ask: "What feature would you like to design?"

2. **Invoke full brainstorming:**

   Use the `superpowers:brainstorming` skill with the feature idea:

   - Explore project context (check relevant files, docs, recent commits)
   - Ask questions one-by-one to understand requirements
   - Propose 2-3 different approaches with trade-offs
   - Lead with your recommended approach
   - Present design in sections (200-300 words each)
   - Validate each section before continuing

3. **Save design document:**

   Save to: `docs/plans/YYYY-MM-DD-<feature-slug>-design.md`

   Document structure:
   ```markdown
   # <Feature Name> Design

   ## Overview
   <2-3 sentence summary>

   ## Problem Statement
   <What problem does this solve?>

   ## Proposed Solution
   <High-level approach>

   ## Design Details
   <Architecture, components, data flow>

   ## Alternatives Considered
   <Other approaches and why not chosen>

   ## Open Questions
   <Any unresolved decisions>

   ## Success Criteria
   <How do we know it works?>
   ```

   Commit the design:
   ```bash
   git add docs/plans/YYYY-MM-DD-<feature-slug>-design.md
   git commit -m "docs: add <feature> design"
   ```

4. **Assess stage for the issue:**

   After brainstorming, determine the appropriate stage:

   | Condition | Stage |
   |-----------|-------|
   | Open questions remain, needs more design exploration | `stage:brainstorm` |
   | Design is complete, ready for implementation planning (DEFAULT) | `stage:plan` |
   | Trivial to implement, no planning needed | `stage:ready` (RARE) |

   **Default to `stage:plan`** - the brainstorming session just completed, so the design should be ready for planning.

5. **Create GitHub issue:**

   ```bash
   gh issue create --title "<Feature Name>" --label "enhancement,stage:<stage>" --body "$(cat <<'EOF'
   ## Summary
   <2-3 sentences from design overview>

   ## Design Document
   See: [docs/plans/YYYY-MM-DD-<feature>-design.md](docs/plans/YYYY-MM-DD-<feature>-design.md)

   ## Key Decisions
   - <Main architectural choice>
   - <Key trade-off made>
   - <Important constraint>

   ## Next Steps
   - [ ] Review design
   - [ ] Create implementation plan
   - [ ] Implement

   ---
   *Created via /new-feature command*
   EOF
   )"
   ```

6. **Offer continuation:**

   ```
   Feature documented and issue #XX created (stage:<stage>).

   Ready to create implementation plan now? (y/n)
   ```

   If yes:
   - Invoke `superpowers:writing-plans` skill
   - Pass the design document as context
   - After plan is written, move issue to `stage:ready`

   If no:
   - Report: "Design saved. Run `/plan-issue` when ready to create implementation plan."

## Example Flow

```
> /new-feature add metric trend visualization

I'll help design this feature. Let me check the current implementation...

[Reads src/components/metrics/MetricCard.tsx]
[Checks Convex schema for metrics data structure]
[Reviews existing React Flow usage in journey editor]

First question: Where should this visualization appear?

1. Inline in MetricCard - compact sparkline view
2. Dedicated MetricTrend component - detailed view with controls
3. Modal overlay - full analysis without navigation

I'd recommend option 2 because it gives us flexibility to show
different time ranges and can be reused across dashboard views...

[Continues brainstorming...]

Design Details:

**React Components:**
- `MetricTrendChart` - Recharts-based line chart
- `TrendPeriodSelector` - time range picker (7d, 30d, 90d)
- `TrendInsights` - AI-generated trend analysis

**Convex Functions:**
- `metrics.getTrendData` query - fetch time-series data
- `metrics.analyzeTrend` action - Claude API for insights

**Data Flow:**
1. User clicks "View Trend" on MetricCard
2. MetricTrend loads with useQuery(api.metrics.getTrendData)
3. Chart renders with period selector
4. Optional: trigger analyzeTrend for AI insights

[Saves design to docs/plans/2026-01-07-metric-trend-visualization-design.md]
[Creates GitHub issue #28 with stage:plan]

Feature documented and issue #28 created (stage:plan).

Ready to create implementation plan now? (y/n)
```
