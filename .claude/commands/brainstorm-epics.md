---
description: Generate epic candidates from vision, roadmap, and ideas (self-directed or expert-driven)
allowed-tools: Bash(git:*), Bash(gh issue list:*), Bash(gh issue view:*), Skill, Task, Read, Glob, Grep
---

# Brainstorm Epics

Generate epic candidates by combining strategic context with user ideas. Choose between:
- **Self-directed**: Guided exploration of your own ideas
- **Product Expert**: Let expert personas (Butterfield + Abramov + Jobs) generate and review 3 candidates

Present structured candidates, let user select, then hand off to product-epic for creation.

## When to Use

- Periodic planning sessions ("what should we build next?")
- When you have ideas to explore
- When stuck on what to work on

## Prerequisites

- VISION.md should exist (run `/product-vision` if not)
- ROADMAP.md should exist (run `/product-roadmap` if not)

If either file is missing, the command can still run but will have less strategic context. Consider creating them first for better results.

## Position in Workflow

```
                         brainstorm-epics
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
             Self-Directed        Product Expert
                    │                   │
                    ▼                   ▼
         User explores ideas    Expert Panel generates:
         with guidance          - Product Expert (Butterfield)
                    │           - Technical Expert (Abramov)
                    │           - Design Review (Jobs)
                    │                   │
                    └─────────┬─────────┘
                              ▼
                    3 structured candidates
                              │
                              ▼
                       user selects
                              │
                              ▼
                   product-epic (via subagent)
```

## Instructions

### 1. Ask Brainstorming Mode

First, ask the user how they want to brainstorm:

> "How would you like to brainstorm epics?
> 1. **Self-directed** - I'll guide you through exploring ideas
> 2. **Product Expert** - Let an expert panel (Butterfield + Abramov + Jobs) generate candidates"

**If Self-directed:** Continue to step 2
**If Product Expert:** Skip to step 2b (Expert-Driven Mode)

### 2. Gather Context (Self-Directed)

Run these in parallel:

1. Read VISION.md - extract transformation, beliefs, target users, current phase
2. Read ROADMAP.md - extract focus areas, key questions, sequencing
3. Run `gh issue list --state open --limit 50` - get open issues to avoid duplicates
4. Run `git log --oneline -30` - understand recent momentum

### 2a. Ask User for Input

> "Do you have specific ideas you want to explore, or should we brainstorm from scratch based on vision and roadmap?"

**If user has ideas:**
- Capture them
- Use vision/roadmap to enrich and validate alignment

**If brainstorming from scratch:**
- May ask: "Any areas feeling particularly painful right now?"
- May ask: "Anything you've been thinking about but haven't written down?"

### 2b. Expert-Driven Mode

If user selected Product Expert mode, launch an expert brainstorming session:

#### 2b.1 Gather Context
Run these in parallel:
1. Read VISION.md
2. Read ROADMAP.md
3. Run `gh issue list --state open --limit 50`
4. Run `git log --oneline -30`

#### 2b.2 Launch Expert Panel

Use the Task tool to launch a Product Expert agent (haiku model) with this prompt:

```
You are a product expert generating epic candidates for a software project.

## Your Principles (Butterfield-style)
- "We don't sell saddles here" - focus on transformation, not features
- Job to be done - what is the user really trying to accomplish?
- Reduce friction ruthlessly - every click is a chance to lose someone
- Magic moments - design for delight, not just utility
- Simplicity is respect for the user's time
- Iterate on real usage, not opinions

## Context

### Vision
{VISION.md content}

### Roadmap
{ROADMAP.md content}

### Open Issues (avoid duplicates)
{gh issue list output}

### Recent Momentum
{git log output}

## Your Task

Generate exactly 3 epic candidates that would create the most value.

For each candidate, provide:
1. **Title**: Clear, actionable epic name
2. **Problem**: What pain point or opportunity (2-3 sentences)
3. **Transformation**: What better version of the user does this enable?
4. **Magic Moment**: What would make someone say "wow"?
5. **Scope**: S / M / L
6. **Roadmap Connection**: Which focus area this serves
7. **Why Now**: What makes this timely
8. **Potential Children**: 3-5 rough task ideas

Focus on transformation over features. Challenge whether proposed features are actually needed.
```

#### 2b.3 Review with Technical Expert

After Product Expert generates candidates, launch a Technical Expert agent (haiku model):

```
Review these epic candidates from a technical perspective.

## Your Principles (Abramov-style)
- Start with why - what problem are we actually solving?
- Minimal API surface - the best API needs no documentation
- Composition over configuration
- Question assumptions - "everyone does it" is not a reason

## Candidates
{Product Expert output}

## Your Task
For each candidate:
1. Flag any technical complexity or risks
2. Suggest simpler alternatives if over-engineered
3. Note implementation considerations
4. Rate feasibility: Easy / Medium / Hard

Keep it brief - 2-3 sentences per candidate.
```

#### 2b.4 Simplification Review

Launch Design Reviewer agent (haiku model) for final check:

```
Review these epic candidates for ruthless simplification.

## Your Principles (Jobs-style)
- "Focus means saying no" - what can be removed?
- Simple can be harder than complex
- No excuses for complexity

## Candidates with Technical Notes
{Combined output}

## Your Task
For each candidate:
1. What would you cut or simplify?
2. Is this truly essential or "nice to have"?
3. Rate: STRONG / GOOD / WEAK

Output a final ranking with brief justification.
```

Then proceed to step 4 (Present Candidates) with the expert-generated candidates.

### 3. Brainstorm Candidates (Self-Directed)

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

Spawn a subagent to run product-epic with the candidate spec. The subagent will receive the candidate spec in its prompt and use it as input to product-epic.

Use the Task tool:

```
Task tool (general-purpose):
  description: "Create epic from candidate"
  prompt: |
    Execute the product-epic command with this candidate spec:

    Candidate Spec:
    - Type: candidate
    - Title: [Selected epic title]
    - Problem: [Problem statement]
    - Scope: [S/M/L]
    - Roadmap Area: [Focus area]
    - Children Sketch:
      - [Child 1]
      - [Child 2]
      - [Child 3]

    Follow the product-epic command instructions for candidate-driven mode:
    1. Use the children sketch as starting point for step 2
    2. Use steps 3a, 4a, 5a for issue creation
    3. Skip step 6 (no HYPOTHESES.md update)
    4. Return the epic number and child issue numbers
```

### 7. Report Results

After subagent returns:

```
Created Epic #[N] with [X] child issues (#[first]-#[last]).
All children tagged stage:brainstorm.

Next: Run `/brainstorm` to design the first issue, or `/plan-issue` if design is clear.
```

## Example Flow

### Self-Directed Mode

```
> /brainstorm-epics

How would you like to brainstorm epics?
1. **Self-directed** - I'll guide you through exploring ideas
2. **Product Expert** - Let an expert panel generate candidates

> 1

Let me gather context first...

[Reads VISION.md, ROADMAP.md]
[Checks open GitHub issues]
[Reviews recent commits]

Do you have specific ideas you want to explore, or should we brainstorm from scratch?

> I've been thinking about improving the metric catalog output

Great, let me explore that idea in context of your vision and roadmap...

[Invokes brainstorming skill]

Here are 3 epic candidates:

### Candidate 1: Metric Catalog Export Formats
**Problem:** Users complete the interview but can't easily share...
[continues as before]
```

### Product Expert Mode

```
> /brainstorm-epics

How would you like to brainstorm epics?
1. **Self-directed** - I'll guide you through exploring ideas
2. **Product Expert** - Let an expert panel generate candidates

> 2

Launching expert panel...

[Gathering context: VISION.md, ROADMAP.md, issues, commits]

**Product Expert (Butterfield)** is generating candidates...

[Product Expert generates 3 candidates focused on user transformation]

**Technical Expert (Abramov)** is reviewing...

[Technical Expert adds feasibility notes and simplification suggestions]

**Design Reviewer (Jobs)** is doing final check...

[Design Reviewer ranks candidates: STRONG / GOOD / WEAK]

---

Here are 3 expert-generated epic candidates:

### Candidate 1: [Title] ⭐ STRONG
**Problem:** ...
**Transformation:** ...
**Magic Moment:** ...
**Technical Notes:** Easy feasibility, aligns with existing patterns
**Scope:** M
**Roadmap Connection:** [Area]
**Why now:** ...
**Potential children:**
- Task 1
- Task 2
- Task 3

### Candidate 2: [Title] - GOOD
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
