---
description: Create epic with child issues from hypothesis or candidate spec
allowed-tools: Bash(git:*), Bash(gh issue create:*), Bash(gh issue edit:*), Bash(gh label list:*), Skill, Read, Write, Glob, Grep
---

# Product Epic

Break a hypothesis into an epic with child issues for testing.

## Purpose

Bridges strategy → tactics. Takes either:
- A hypothesis from HYPOTHESES.md (hypothesis-driven), or
- A candidate spec from brainstorm-epics (idea-driven)

And creates:
- One epic issue (the hypothesis or candidate itself)
- Multiple child issues (tasks needed to test/implement it)

## When to Use

- After creating/updating HYPOTHESES.md
- When ready to start testing a hypothesis
- When current epic is complete and you need the next one

## Prerequisites

- HYPOTHESES.md must exist with at least one untested (🟡) hypothesis
- GitHub labels `epic`, `hypothesis`, and `stage:brainstorm` must exist

## Instructions

### 0. Detect Input Mode

Check if a candidate spec was provided as argument to the command.

**If argument contains JSON-like candidate spec:**
- Parse the spec (title, problem, scope, roadmap_area, children_sketch)
- Skip to step 2 (Brainstorm Tasks) using children_sketch as starting point
- Use candidate-driven labels and formatting (see step 3a, 4a, 5a)

**If no argument or argument is a hypothesis ID (e.g., "H2"):**
- Proceed with current hypothesis-driven flow (steps 1-7)

### 1. Select Hypothesis

1. Read HYPOTHESES.md
2. Filter to 🟡 Untested hypotheses
3. Score by priority:
   - **Impact:** How much does this serve the transformation?
   - **Uncertainty:** How unsure are we? (higher = more valuable to test)
   - **Effort:** How hard to test?
4. Present top choice to user with reasoning
5. Confirm before proceeding (or let user pick different one)

### 2. Brainstorm Tasks

**If candidate-driven:** Use the `children_sketch` from the candidate spec as a starting point. Expand each sketch item into a properly scoped task with clear completion criteria.

**If hypothesis-driven:** Invoke `superpowers:brainstorming` skill to identify tasks needed to test the hypothesis.

Consider:
- What do we need to **prepare** before testing?
- What do we need to **build or change** to run the test?
- How will we **run** the test?
- How will we **measure** results?
- How will we **analyze** and document learnings?

Aim for 3-7 concrete tasks. Each task should be:
- Small enough to complete in a focused session
- Clear about what "done" looks like
- Necessary to test the hypothesis (no nice-to-haves)

### 3. Create Epic Issue

```bash
gh issue create \
  --title "Epic: Test [H#] - [Hypothesis Name]" \
  --label "epic,hypothesis" \
  --body "$(cat <<'EOF'
## Hypothesis

**Belief:** [From HYPOTHESES.md]

**Test:** [From HYPOTHESES.md]

**Investment Area:** [From HYPOTHESES.md]

---

## Tasks

(Child issues will be linked here after creation)

---

*Created via `product epic`*
EOF
)"
```

Note the epic issue number for the next step.

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

### 4. Create Child Issues

For each task identified in step 2:

```bash
gh issue create \
  --title "[Task title]" \
  --label "stage:brainstorm" \
  --body "$(cat <<'EOF'
## Context

Part of epic #[EPIC_NUMBER]: Test [H#] - [Hypothesis Name]

## Goal

[What this task accomplishes toward testing the hypothesis]

## Done When

[Clear completion criteria]

---

*Created via `product epic`*
EOF
)"
```

Collect all child issue numbers.

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

### 5. Update Epic with Tasklist

Edit the epic to add the tasklist with child issue links:

```bash
gh issue edit [EPIC_NUMBER] --body "$(cat <<'EOF'
## Hypothesis

**Belief:** [From HYPOTHESES.md]

**Test:** [From HYPOTHESES.md]

**Investment Area:** [From HYPOTHESES.md]

---

## Tasks

- [ ] #[CHILD_1] - [Task 1 title]
- [ ] #[CHILD_2] - [Task 2 title]
- [ ] #[CHILD_3] - [Task 3 title]
...

---

*Created via `product epic`*
EOF
)"
```

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

### 6. Update HYPOTHESES.md (Hypothesis-Driven Only)

**Skip this step if working from a candidate spec.**

Change the hypothesis status from 🟡 Untested to 🔵 Testing.

Add to Evidence section:
```markdown
**Evidence:**
- [Date]: Epic created (#[EPIC_NUMBER]) with [N] tasks
```

### 7. Commit Changes

**If hypothesis-driven:**
```bash
git add HYPOTHESES.md
git commit -m "docs: start testing [H#] - [Hypothesis Name]"
```

**If candidate-driven:**
No commit needed (no files changed, just GitHub issues created).

## Pipeline Integration

After `product epic` completes, child issues enter the normal pipeline:

```
product epic
    │
    ▼
stage:brainstorm ──► stage:plan ──► stage:ready
     │                   │              │
/brainstorm         /plan-issue    /pick-issue
```

When all child issues are complete, run `/product iteration` to:
- Analyze results
- Update hypothesis status (Validated/Invalidated)
- Document learnings
- Generate follow-up hypotheses if needed

## Example Output

**Epic:** `Epic: Test H2 - Interview Completion` (#123)

**Children:**
- `Recruit 5 test users from target audience` (#124) - stage:brainstorm
- `Set up session recording for user tests` (#125) - stage:brainstorm
- `Create post-interview feedback questions` (#126) - stage:brainstorm
- `Run test sessions and document observations` (#127) - stage:brainstorm
- `Analyze results and update hypothesis` (#128) - stage:brainstorm

**HYPOTHESES.md updated:** H2 status changed to 🔵 Testing
