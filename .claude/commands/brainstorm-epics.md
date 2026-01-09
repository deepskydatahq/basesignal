---
description: Generate epic candidates from vision, roadmap, and ideas
allowed-tools: Bash(git:*), Bash(gh issue list:*), Bash(gh issue view:*), Skill, Task, Read, Glob, Grep
---

# Brainstorm Epics

Generate epic candidates by combining strategic context with user ideas. Present 3-5 structured candidates, let user select, then hand off to product-epic for creation.

## When to Use

- Periodic planning sessions ("what should we build next?")
- When you have ideas to explore
- When stuck on what to work on

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
```

## Instructions

### 1. Gather Context

Run these in parallel:

1. Read VISION.md - extract transformation, beliefs, target users, current phase
2. Read ROADMAP.md - extract focus areas, key questions, sequencing
3. Run `gh issue list --state open --limit 50` - get open issues to avoid duplicates
4. Run `git log --oneline -30` - understand recent momentum

### 2. Ask User for Input

> "Do you have specific ideas you want to explore, or should we brainstorm from scratch based on vision and roadmap?"

**If user has ideas:**
- Capture them
- Use vision/roadmap to enrich and validate alignment

**If brainstorming from scratch:**
- May ask: "Any areas feeling particularly painful right now?"
- May ask: "Anything you've been thinking about but haven't written down?"

### 3. Brainstorm Candidates

Invoke `superpowers:brainstorming` skill to generate 3-5 epic candidates.

Each candidate should have:
- **Title:** Clear, actionable epic name
- **Problem:** What pain point or opportunity this addresses (2-3 sentences)
- **Scope:** S / M / L
- **Roadmap Connection:** Which focus area this serves
- **Why now:** What makes this timely given current state
- **Potential children:** 3-5 rough task ideas

### 4. Present Candidates

Present all candidates with comparison:

```
Here are [N] epic candidates based on [inputs used]:

### Candidate 1: [Title]
**Problem:** ...
**Scope:** M
**Roadmap Connection:** [Focus Area]
**Why now:** ...
**Potential children:**
- Task idea 1
- Task idea 2
- Task idea 3

### Candidate 2: [Title]
...

---

**Comparison:**
- Candidate 1 is highest impact but largest scope
- Candidate 3 addresses a gap in your open issues
- Candidate 5 builds on recent momentum in [area]

Which would you like to pursue? (Enter number, or "none" to refine)
```

### 5. Handle Selection

**If user selects a candidate:**
- Format the candidate spec as JSON
- Proceed to step 6

**If user says "none" or asks to refine:**
- Ask clarifying questions
- Generate new/modified candidates
- Present again

### 6. Hand Off to product-epic

Spawn a subagent to run product-epic with the candidate spec:

```
Task tool with prompt:

"Run the product-epic command with this candidate spec:

{
  "type": "candidate",
  "title": "[Selected epic title]",
  "problem": "[Problem statement]",
  "scope": "[S/M/L]",
  "roadmap_area": "[Focus area]",
  "children_sketch": ["Child 1", "Child 2", "Child 3"]
}

Use the brainstorming skill to expand the children_sketch into full child issues.
Create the epic and all child issues.
Return the epic number and child issue numbers."
```

### 7. Report Results

After subagent returns:

```
Created Epic #[N] with [X] child issues (#[first]-#[last]).
All children tagged stage:brainstorm.

Next: Run `/brainstorm` to design the first issue, or `/plan-issue` if design is clear.
```

## Example Flow

```
> /brainstorm-epics

Let me gather context first...

[Reads VISION.md, ROADMAP.md]
[Checks open GitHub issues]
[Reviews recent commits]

Do you have specific ideas you want to explore, or should we brainstorm from scratch?

> I've been thinking about improving the metric catalog output

Great, let me explore that idea in context of your vision and roadmap...

[Invokes brainstorming skill]

Here are 4 epic candidates:

### Candidate 1: Metric Catalog Export Formats
**Problem:** Users complete the interview but can't easily share the metric catalog with their team or import into other tools.
**Scope:** M
**Roadmap Connection:** Measurement Foundation
**Why now:** Core interview flow works; outputs are the missing payoff
**Potential children:**
- Design export format options (CSV, Notion, PDF)
- Implement CSV export
- Implement Notion integration
- Add export UI to metric catalog view

### Candidate 2: Metric Definitions Enhancement
...

---

**Comparison:**
- Candidate 1 directly addresses "actionable outputs" from roadmap
- Candidate 2 improves quality but doesn't solve delivery
- Candidate 3 is stretch goal territory (analytics integration)

Which would you like to pursue?

> 1

[Spawns product-epic subagent with candidate spec]

Created Epic #52 with 4 child issues (#53-#56).
All children tagged stage:brainstorm.

Next: Run `/brainstorm` to design the first issue.
```
