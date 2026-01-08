# Brainstorm Epics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create `brainstorm-epics` command and make `product-epic` input-agnostic so it can be called from both hypothesis-driven and idea-driven workflows.

**Architecture:** Two commands that work together. `brainstorm-epics` gathers context, brainstorms candidates, lets user select, then spawns a subagent to run `product-epic` with a candidate spec. `product-epic` detects whether it received a candidate spec or should read from HYPOTHESES.md.

**Tech Stack:** Claude Code commands (markdown), GitHub CLI, Task tool for subagent dispatch

---

## Task 1: Update product-epic to Accept Candidate Spec

**Files:**
- Modify: `.claude/commands/product-epic.md`

**Step 1: Read the current product-epic.md**

Understand the current structure before modifying.

**Step 2: Add input detection section**

At the top of Instructions, add a new section that detects input mode:

```markdown
## Instructions

### 0. Detect Input Mode

Check if a candidate spec was provided as argument to the command.

**If argument contains JSON-like candidate spec:**
- Parse the spec (title, problem, scope, roadmap_area, children_sketch)
- Skip to step 2 (Brainstorm Tasks) using children_sketch as starting point
- Use candidate-driven labels and formatting (see step 3a, 4a, 5a)

**If no argument or argument is a hypothesis ID (e.g., "H2"):**
- Proceed with current hypothesis-driven flow (steps 1-7)
```

**Step 3: Add candidate-driven alternatives for steps 3, 4, 5**

After each hypothesis-driven step, add a candidate alternative:

After step 3 (Create Epic Issue), add:

```markdown
### 3a. Create Epic Issue (Candidate-Driven)

If working from a candidate spec instead of hypothesis:

```bash
gh issue create \
  --title "Epic: [Title from spec]" \
  --label "epic" \
  --body "$(cat <<'EOF'
## Problem

[Problem from candidate spec]

## Roadmap Area

[roadmap_area from candidate spec]

---

## Tasks

(Child issues will be linked here after creation)

---

*Created via `brainstorm-epics`*
EOF
)"
```

Note: No `hypothesis` label. Attribution says `brainstorm-epics`.
```

After step 4 (Create Child Issues), add:

```markdown
### 4a. Create Child Issues (Candidate-Driven)

If working from a candidate spec:

```bash
gh issue create \
  --title "[Task title]" \
  --label "stage:brainstorm" \
  --body "$(cat <<'EOF'
## Context

Part of epic #[EPIC_NUMBER]: [Epic Title]

## Goal

[What this task accomplishes]

## Done When

[Clear completion criteria]

---

*Created via `brainstorm-epics`*
EOF
)"
```

Note: No hypothesis reference in context.
```

After step 5 (Update Epic with Tasklist), add:

```markdown
### 5a. Update Epic with Tasklist (Candidate-Driven)

```bash
gh issue edit [EPIC_NUMBER] --body "$(cat <<'EOF'
## Problem

[Problem from candidate spec]

## Roadmap Area

[roadmap_area from candidate spec]

---

## Tasks

- [ ] #[CHILD_1] - [Task 1 title]
- [ ] #[CHILD_2] - [Task 2 title]
- [ ] #[CHILD_3] - [Task 3 title]
...

---

*Created via `brainstorm-epics`*
EOF
)"
```
```

**Step 4: Update step 6 to be conditional**

Change step 6 to only run for hypothesis-driven flow:

```markdown
### 6. Update HYPOTHESES.md (Hypothesis-Driven Only)

**Skip this step if working from a candidate spec.**

Change the hypothesis status from 🟡 Untested to 🔵 Testing.
...
```

**Step 5: Update step 7 commit message**

Make commit message conditional:

```markdown
### 7. Commit Changes

**If hypothesis-driven:**
```bash
git add HYPOTHESES.md
git commit -m "docs: start testing [H#] - [Hypothesis Name]"
```

**If candidate-driven:**
No commit needed (no files changed, just GitHub issues created).
```

**Step 6: Update description in frontmatter**

```yaml
description: Create epic with child issues from hypothesis or candidate spec
```

**Step 7: Verify the file is valid markdown**

Read the modified file to ensure structure is correct.

**Step 8: Commit**

```bash
git add .claude/commands/product-epic.md
git commit -m "feat: make product-epic accept candidate spec input

Adds input detection to support both hypothesis-driven and
candidate-driven epic creation. Candidate specs come from
brainstorm-epics command.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Create brainstorm-epics Command

**Files:**
- Create: `.claude/commands/brainstorm-epics.md`

**Step 1: Create the command file with frontmatter**

```markdown
---
description: Generate epic candidates from vision, roadmap, and ideas
allowed-tools: Bash(git:*), Bash(gh issue list:*), Bash(gh issue view:*), Skill, Task, Read, Glob, Grep
---
```

**Step 2: Add overview section**

```markdown
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
```

**Step 3: Add instructions section**

```markdown
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
```

**Step 4: Add example section**

```markdown
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
```

**Step 5: Verify file structure**

Read the file to ensure it's valid markdown.

**Step 6: Commit**

```bash
git add .claude/commands/brainstorm-epics.md
git commit -m "feat: add brainstorm-epics command

New command for idea-driven epic generation. Gathers context from
vision, roadmap, issues, and codebase, then brainstorms 3-5 epic
candidates. User selects, then product-epic creates the epic.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Update CLAUDE.md with New Command

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add brainstorm-epics to the workflow diagram**

In the "Development Workflow" section, update the diagram to show the parallel path:

```markdown
```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   /new-feature ──┐                                                      │
│   /retro ────────┼──► stage:brainstorm ──► stage:plan ──► stage:ready   │
│                  │         │                   │              │         │
│                  │    /brainstorm         /plan-issue    /pick-issue    │
│                  │                                       run-issue.sh   │
│                  │                                            │         │
│                  └────────────────────────────────────────────┘         │
│                              (retro discovers more issues)              │
│                                                                         │
│   /brainstorm-epics ──► product-epic ──► stage:brainstorm (children)    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```
```

**Step 2: Add to Commands table**

Add row for brainstorm-epics:

```markdown
| `/brainstorm-epics` | Generate epic candidates from vision + roadmap |
```

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add brainstorm-epics to workflow documentation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Test the Flow End-to-End

**Step 1: Verify product-epic can parse candidate spec**

Manually test by running `/product-epic` with a test spec to ensure it detects the input mode correctly.

**Step 2: Verify brainstorm-epics gathers context**

Run `/brainstorm-epics` and confirm it:
- Reads VISION.md and ROADMAP.md
- Lists open GitHub issues
- Shows recent commits
- Asks for user input

**Step 3: Verify candidate generation**

Confirm brainstorming produces 3-5 structured candidates with all required fields.

**Step 4: Verify handoff works**

Select a candidate and confirm:
- Subagent spawns correctly
- Epic is created with correct format
- Child issues are created with stage:brainstorm label
- Results are reported back

**Step 5: Document any issues found**

If issues found, create follow-up tasks or fix immediately if trivial.
