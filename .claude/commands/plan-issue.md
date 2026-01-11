---
description: Pick an issue needing planning and write an implementation plan
allowed-tools: Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh issue edit:*), Bash(gh issue comment:*), Skill, Read, Write, Glob, Grep
---

# Plan Issue

Pick an issue from the `stage:plan` queue and write a detailed implementation plan.

## Arguments

- No argument: Pick from queue
- Issue number (e.g., `/plan-issue 15`): Plan specific issue regardless of label

## Current Issues Needing Planning

!`gh issue list --state open --label "stage:plan" --json number,title,labels,createdAt --limit 20`

## Instructions

### 1. Select Issue

**If argument provided:**
- Use that issue number directly
- Fetch details: `gh issue view <number>`

**If no argument:**
- If no issues with `stage:plan`: Report "No issues need planning. Run `/brainstorm` to process brainstorming queue, or `/new-feature` to create issues." and stop.
- Otherwise, pick the best issue based on:
  - Skip issues with `in-progress` label
  - Priority: `critical` > `bug` > `enhancement`
  - Age: older issues first

### 2. Claim the Issue

```bash
gh issue edit <number> --add-label in-progress
```

### 3. Fetch Full Context

```bash
gh issue view <number>
```

Review:
- Issue description and requirements
- Any design decisions from brainstorming
- Linked design documents in `docs/plans/`
- Scope and constraints

### 3a. Validate Brainstorm Complete

Before writing an implementation plan, verify the issue has been through brainstorming:

1. **Check for brainstorm output** in issue body/comments:
   - Look for "Brainstorming Complete" or "Auto-Brainstorming Complete" marker
   - OR design document referenced in `docs/plans/YYYY-MM-DD-*-design.md`

2. **If validation fails:**
   - Report: "Cannot plan #<number>: no brainstorm output found. Run `/brainstorm <number>` first."
   - Remove `in-progress` label: `gh issue edit <number> --remove-label "in-progress"`
   - Stop (do not proceed with planning)

3. **If validation passes:** Continue to write implementation plan

### 4. Write Implementation Plan

Invoke the `superpowers:writing-plans` skill to create a detailed plan:

- Explore the codebase to understand current state
- Identify all files that need changes
- Break work into specific, ordered steps
- Consider edge cases and error handling
- Include test strategy

### 5. Add Plan to Issue

```bash
gh issue comment <number> --body "$(cat <<'EOF'
## Implementation Plan

### Overview
<1-2 sentence summary of approach>

### Steps

1. **<Step title>**
   - File: `<path/to/file>`
   - Change: <what to do>
   - Details: <specifics if needed>

2. **<Step title>**
   - File: `<path/to/file>`
   - Change: <what to do>

... (all steps)

### Testing
- [ ] Unit tests for new functionality
- [ ] Integration tests if applicable
- [ ] Run test suite to verify

### Risks & Mitigations
- <risk>: <mitigation>

---
*Plan created via /plan-issue*
EOF
)"
```

### 5a. Validate Plan Complete

Before moving to stage:ready, verify the implementation plan was added:

1. **Check for plan output** in issue comments:
   - Look for "Implementation Plan" marker in comments
   - OR plan document saved to `docs/plans/YYYY-MM-DD-*-plan.md`

2. **If validation fails:**
   - Report: "Cannot advance #<number> to stage:ready: no implementation plan documented."
   - Do NOT proceed with stage transition

3. **If validation passes:** Continue with transition

### 6. Move to Ready

```bash
gh issue edit <number> --remove-label "stage:plan" --remove-label "in-progress" --add-label "stage:ready"
```

## Output Format

```
Selected: #<number> - <title>

[Planning session...]

Plan added to issue with N steps.
Moved to: stage:ready

Issue #<number> is now ready for implementation.
Run /pick-issue to start working on it.
```
