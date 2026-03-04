# How We Work

Basesignal uses a structured product development workflow powered by Claude Code sub-agents and Beads task management. This document is the single source of truth for how ideas become shipped features.

For technical conventions, code patterns, and testing requirements, see [CLAUDE.md](./CLAUDE.md).

---

## The Hierarchy

```
VISION.md           "What transformation are we enabling?"
    ↓
VALUES.md           "What value do we deliver?"
    ↓
product/missions/   "What do we need to prove?"
    ↓
product/epics/      "What chunks of work deliver this?"
    ↓
product/stories/    "What specific things do we build?"
    ↓
Beads tasks         "What's the implementation work?"
```

Each level feeds the next. Validation flows back up — a completed story validates its epic, a completed epic validates its mission.

---

## Levels

### Vision (VISION.md)

The north star. What transformation does Basesignal enable? Updates rarely — only on fundamental pivots.

- **Updates:** Rarely (pivots only)
- **Question:** "What transformation are we enabling?"

### Value Ladder (VALUES.md)

The ordered progression of value basesignal delivers. 15 levels from URL scan to growth operations, each independently valuable.

- **Updates:** When missions complete or level statuses change
- **Question:** "What value do we deliver?"

### Missions (product/missions/*.toml)

Outcome-oriented work packages. Each mission proves something about the product — it has a clear outcome, testing criteria, and a definition of done.

- **Naming:** `M001-short-description.toml`
- **Key fields:** `id`, `title`, `status`, `outcome.description`, `testing.criteria`

### Epics (product/epics/*.toml)

Breakdown of missions into implementable chunks. Each epic delivers a working, testable piece.

- **Naming:** `M001-E001-short-description.toml`
- **Key fields:** `id`, `parent`, `title`, `status`, `outcome.description`

### Stories (product/stories/*.toml)

Concrete, implementable work items with acceptance criteria. Small enough to complete in one session.

- **Naming:** `M001-E001-S001-short-description.toml`
- **Key fields:** `id`, `parent`, `title`, `status`, `acceptance_criteria`

### Beads Tasks

Implementation tasks tracked with the `bd` CLI. Stories become Beads tasks during mission execution.

- **Tool:** `bd` (Beads CLI)

---

## Execution Model

After aligning on a mission, a single command orchestrates everything through to PRs using Claude Code sub-agents.

```
/execute-mission M014
         │
         ▼
┌──────────────────────────────────┐
│  PHASE 1: Breakdown + Triage     │  Main agent
│                                   │
│  Mission → Epics → Stories        │
│  LLM triage each story:          │
│    ready / plan / brainstorm      │
│  Create Beads tasks               │
└──────────┬───────────────────────┘
     ┌─────┼─────────┐
     ▼     ▼         ▼
┌────────┐┌────────┐┌────────┐
│ E001   ││ E002   ││ E003   │     PHASE 2: Epic sub-agents
│ Agent  ││ Agent  ││ Agent  │     (parallel, worktree isolation)
│        ││        ││        │
│ Stories handled in order:  │     Each agent owns its epic's
│  - brainstorm if needed    │     full pipeline
│  - plan if needed          │
│  - implement + test        │     Stories sequential within epic
│  - commit                  │     Epics parallel across agents
│                  ││        │
│ → One PR         ││ → PR   │     One PR per epic
└────────┘└────────┘└────────┘
     │         │         │
     ▼         ▼         ▼
┌────────┐┌────────┐┌────────┐
│fix-pr  ││fix-pr  ││fix-pr  │     PHASE 3: PR feedback
│feedback││feedback││feedback│     /fix-pr-feedback (standalone)
│ ≤2     ││ ≤2     ││ ≤2     │     Max 2 rounds per PR
│rounds  ││rounds  ││rounds  │
└────────┘└────────┘└────────┘
           │
           ▼
┌──────────────────────────────────┐
│  PHASE 4: Report                  │  Main agent
│  Summary, failures, PR links      │
└──────────────────────────────────┘
```

### Phase 1: Breakdown + Triage

The main agent reads the mission TOML, breaks it into epics and stories (creating TOML files), then triages each story using LLM assessment:

| Triage Result | Criteria | What Happens |
|---------------|----------|-------------|
| **ready** | Has specific file paths + clear verifiable ACs + small scope | Epic agent skips brainstorm and planning, goes straight to implementation |
| **plan** | Has clear ACs but needs file identification or exploration | Epic agent writes a quick plan, then implements |
| **brainstorm** | Has open design questions, multiple approaches, ambiguity | Epic agent explores the design space first, then plans, then implements |

Beads tasks are created with the triage result as the starting label.

### Phase 2: Epic Sub-Agents

Each epic gets a dedicated Claude Code sub-agent running in an isolated git worktree. The agent receives:
- The epic context (mission → epic → stories)
- The triage label for each story
- Instructions to handle the full pipeline

Stories within an epic are implemented sequentially (S002 builds on S001). Epics without dependencies run in parallel.

Epic-level dependencies (E002 depends on E001) are respected — the orchestrator waits for the blocking epic's PR to be merged before launching the dependent epic.

Each epic agent creates one PR containing all its stories.

### Phase 3: PR Feedback

After PRs are created, `/fix-pr-feedback` reads automated review comments (Graptile), fixes actionable feedback, and pushes updates. Max 2 rounds of fix → re-review per PR.

### Phase 4: Report

The orchestrator collects results from all agents and reports: PRs created, tasks closed, any failures requiring attention.

---

## Smart Triage

The LLM triage in Phase 1 evaluates each story against these signals:

**→ ready** (skip brainstorm + plan):
- Acceptance criteria reference specific file paths
- Changes are mechanical or well-defined
- Scope is a single file or small set of files
- No design decisions needed

**→ plan** (skip brainstorm):
- Clear goal and acceptance criteria
- Needs codebase exploration to identify files
- Implementation approach is obvious but details need working out

**→ brainstorm** (full pipeline):
- Multiple valid approaches exist
- Architectural decisions needed
- Scope is unclear or cross-cutting
- New patterns or abstractions required

---

## Standalone Commands

### `/execute-mission <mission-id>`

Full autopilot from mission alignment to PRs. Runs all four phases without stopping.

### `/fix-pr-feedback <pr-number>`

Standalone PR feedback fixer. Works on any PR:
1. Reads review comments via GitHub API
2. Filters actionable feedback from noise
3. Fixes issues on the PR branch
4. Pushes fixes
5. Waits for re-review, fixes again if needed
6. Max 2 rounds, then reports unresolved items

### `/retro`

Post-implementation retrospective. Analyzes recent work, discovers follow-up issues, creates Beads tasks.

---

## Beads CLI Quick Reference

```bash
bd list --label ready               # Tasks ready to implement
bd show <id> --json                 # Full task details
bd update <id> --status in_progress # Start working
bd close <id>                       # Mark complete
bd status                           # Overview
```

---

## The Full Flow

1. **Direction:** Refine vision and value ladder as needed
2. **Mission:** Define the mission TOML (manually or via brainstorming)
3. **Execute:** `/execute-mission M014` — breakdown, triage, implement, PR feedback — all autonomous
4. **Review:** Review and merge epic PRs
5. **Retro:** `/retro` — discover follow-up issues
6. **Learn:** Update value ladder with learnings

---

## Key Files

| File | Purpose |
|------|---------|
| `VISION.md` | North star transformation |
| `VALUES.md` | Value ladder — ordered progression of 15 levels |
| `CLAUDE.md` | Technical conventions, code patterns, testing rules |
| `HOW_WE_WORK.md` | This document — the development workflow |
| `CONTRIBUTING.md` | Guide for external contributors |
| `product/missions/` | Mission TOML files |
| `product/epics/` | Epic TOML files |
| `product/stories/` | Story TOML files |
| `.claude/archive/` | Archived commands, skills, and scripts from previous workflow |
