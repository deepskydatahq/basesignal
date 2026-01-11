---
description: Pick an issue needing brainstorming and run a design session
allowed-tools: Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh issue edit:*), Bash(gh issue create:*), Bash(gh issue close:*), Skill, Read, Write, Glob, Grep
---

# Brainstorm

Pick an issue from the `stage:brainstorm` queue and run a brainstorming session.

## Arguments

- No argument: Pick from queue
- Issue number (e.g., `/brainstorm 15`): Brainstorm specific issue regardless of label

## Current Issues Needing Brainstorming

!`gh issue list --state open --label "stage:brainstorm" --json number,title,labels,createdAt --limit 20`

## Instructions

### 1. Select Issue

**If argument provided:**
- Use that issue number directly
- Fetch details: `gh issue view <number>`

**If no argument:**
- If no issues with `stage:brainstorm`: Report "No issues need brainstorming. Run `/new-feature` to create some." and stop.
- Otherwise, pick the best issue based on:
  - Skip issues with `in-progress` label
  - Priority: `critical` > `bug` > `enhancement`
  - Age: older issues first

### 2. Claim the Issue

```bash
gh issue edit <number> --add-label in-progress
```

### 3. Run Brainstorming Session

Invoke the `superpowers:brainstorming` skill with the issue context:

- Explore relevant code and patterns
- Ask questions one-by-one to understand requirements
- Propose 2-3 approaches with trade-offs
- Lead with your recommended approach
- Present design in sections, validating each

### 4. Assess Output

After brainstorming completes, determine:

**Single coherent piece of work:**
- Update the original issue with design decisions
- Assess next stage (see criteria below)
- Move to that stage

**Multiple independent pieces:**
- Create child issues for each piece
- Each child gets its own stage assessment
- Close original with links to children

### 5. Stage Assessment Criteria

For each piece of work (original or child), assess:

```
stage:brainstorm if ANY of:
  - Still has unresolved design questions
  - Needs further user input on approach
  - Affects architecture and needs more thought

stage:plan if:
  - Design decisions are made
  - Solution is known but involves multiple files/steps
  - Ready for detailed implementation planning

stage:ready if ALL of:
  - Trivial, mechanical change
  - Specific file and location known
  - No risk of unintended consequences
  (This should be RARE - prefer stage:plan)
```

### 6. Save Design Document (if substantial)

For non-trivial design work, save to: `docs/plans/YYYY-MM-DD-<feature-slug>-design.md`

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

### 6a. Validate Before Stage Advancement

Before advancing to any stage beyond brainstorm, verify brainstorming work is documented:

1. **Check for brainstorm output** in issue comments:
   - Look for "Brainstorming Complete" or "Auto-Brainstorming Complete" marker
   - OR design document saved to `docs/plans/YYYY-MM-DD-*-design.md`

2. **If validation fails:**
   - Report: "Cannot advance #<number>: no brainstorm output documented. Complete the brainstorming session first."
   - Remove `in-progress` label and stop
   - Do NOT proceed with stage transition

3. **If validation passes:** Continue to next section

### 7. Create Child Issues (if breaking down)

For each child issue:

```bash
gh issue create --title "<Child title>" --label "<category>,stage:<stage>" --body "$(cat <<'EOF'
## Summary
<what this piece does>

## Context
Broken out from #<parent> during brainstorming.

## Design Decisions
- <relevant decisions from brainstorm session>

## Scope
- <specific files/components involved>

---
*Created via /brainstorm from #<parent>*
EOF
)"
```

### 8. Close Original (if broken down)

```bash
gh issue close <number> --comment "Broken down into:
- #<child1> - <title> (stage:<stage>)
- #<child2> - <title> (stage:<stage>)
- #<child3> - <title> (stage:<stage>)

Design exploration complete."
```

### 9. Update Original (if not broken down)

```bash
gh issue edit <number> --remove-label "stage:brainstorm" --remove-label "in-progress" --add-label "stage:<next-stage>"

gh issue comment <number> --body "## Brainstorming Complete

### Design Decisions
- <key decision 1>
- <key decision 2>

### Approach
<summary of chosen approach>

### Next Steps
<what the implementation plan should cover>

---
*Updated via /brainstorm*"
```

## Output Format

```
Selected: #<number> - <title>

[Brainstorming session...]

Outcome: <Single piece | Broken into N pieces>

<If single:>
Moving to: stage:<next-stage>
Issue updated with design decisions.

<If broken down:>
Created:
- #<child1> - <title> (stage:<stage>)
- #<child2> - <title> (stage:<stage>)
Original #<number> closed.
```
