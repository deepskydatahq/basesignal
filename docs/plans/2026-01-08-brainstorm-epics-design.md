# Brainstorm Epics Command Design

## Overview

A command that generates epic candidates by combining strategic context (vision, roadmap) with user ideas and current state (GitHub issues, codebase). Presents 3-5 structured candidates, user selects, then hands off to product-epic for creation.

## Position in Workflow

```
VISION.md + ROADMAP.md + User Ideas + GitHub Issues + Codebase
                              │
                              ▼
                      brainstorm-epics
                              │
                              ▼
                    3-5 structured candidates
                              │
                              ▼
                       user selects
                              │
                              ▼
                   product-epic (via subagent)
                              │
                              ▼
                 epic + child issues created
```

Parallel to hypothesis-driven development:
- `product-hypotheses` → `product-epic` (hypothesis-driven)
- `brainstorm-epics` → `product-epic` (idea-driven)

Both paths feed into the same issue pipeline (stage:brainstorm → stage:plan → stage:ready).

## When to Use

- Periodic planning sessions
- When user has ideas to explore
- When stuck on what to build next

---

## Input Gathering

### Automatic Inputs (Always Gathered)

| Source | What to Extract |
|--------|-----------------|
| VISION.md | Transformation, core beliefs, target users, current phase |
| ROADMAP.md | Focus areas, key questions, sequencing, stretch goals |
| GitHub issues | Open issues, existing epics, labels (avoid duplicates, find gaps) |
| Codebase | Recent commits (last 20-30), current feature areas, technical debt |

### User Input (Adaptive)

The command starts by asking:

> "Do you have specific ideas you want to explore, or should we brainstorm from scratch?"

- **If user has ideas:** Capture them, then use vision/roadmap/codebase to enrich and validate
- **If from scratch:** Use all automatic inputs to generate candidates, may ask follow-up questions like "Any areas feeling particularly painful right now?"

---

## Candidate Structure

Each of the 3-5 candidates includes:

```markdown
### Candidate N: [Epic Title]

**Problem:** What pain point or opportunity this addresses (2-3 sentences)

**Scope:** S / M / L

**Roadmap Connection:** Which focus area this serves

**Why now:** What makes this timely given current state

**Potential children:** (rough sketch, 3-5 items)
- Child issue idea 1
- Child issue idea 2
- Child issue idea 3
```

### Presentation Format

After brainstorming, present all candidates with a comparison:

```
Here are 5 epic candidates based on [inputs used]:

[Candidate 1]
[Candidate 2]
...

**Comparison:**
- Candidate 1 is highest impact but largest scope
- Candidate 3 addresses a gap I noticed in your GitHub issues
- Candidate 5 builds on recent momentum in [area]

Which would you like to pursue? (Enter number, or "none" to refine)
```

---

## Handoff to product-epic

### Candidate Spec Format

After user selects, format the selection for product-epic:

```json
{
  "type": "candidate",
  "title": "Epic title",
  "problem": "Problem statement",
  "scope": "M",
  "roadmap_area": "Measurement Foundation",
  "children_sketch": ["Child 1", "Child 2", "Child 3"]
}
```

### product-epic Changes Required

product-epic needs to accept either a hypothesis OR a candidate spec:

```
IF receives candidate spec:
  - Skip hypothesis selection
  - Use candidate spec as the epic context
  - Brainstorm children (use sketch as starting point)
  - Create epic without hypothesis labels/framing
  - Skip HYPOTHESES.md update

ELSE (no input):
  - Current behavior: select from HYPOTHESES.md
  - Use hypothesis framing
  - Update HYPOTHESES.md status
```

### Epic Issue Format (Candidate-Driven)

```markdown
## Epic: [Title]

**Problem:** [From candidate spec]

**Roadmap Area:** [From candidate spec]

---

## Tasks

- [ ] #123 - Child issue 1
- [ ] #124 - Child issue 2
...

---

*Created via `brainstorm-epics`*
```

---

## Command Implementation

### File

`.claude/commands/brainstorm-epics.md`

### Allowed Tools

```yaml
allowed-tools: Bash(git:*), Bash(gh issue list:*), Bash(gh issue view:*), Skill, Task, Read, Glob, Grep
```

### Flow

```
1. Gather automatic inputs (parallel reads)
   ├── Read VISION.md
   ├── Read ROADMAP.md
   ├── gh issue list (open issues, epics)
   └── git log --oneline -30 (recent commits)

2. Ask user for ideas or brainstorm from scratch

3. Invoke superpowers:brainstorming
   - Context: all gathered inputs + user ideas
   - Goal: generate 3-5 epic candidates

4. Present candidates with comparison

5. User selects (or asks to refine)

6. Format candidate spec

7. Spawn subagent for product-epic
   - Pass candidate spec
   - Subagent creates epic + children
   - Returns epic number and child issue numbers

8. Report results
   "Created Epic #45 with 5 child issues (#46-#50).
    All children tagged stage:brainstorm."
```

---

## Open Questions

None - design is complete.

## Success Criteria

- Command generates relevant epic candidates from vision/roadmap
- Candidates are distinct and actionable
- Handoff to product-epic works seamlessly
- Created epics integrate into existing issue pipeline
