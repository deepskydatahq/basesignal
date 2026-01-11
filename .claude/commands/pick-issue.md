---
description: Pick the next GitHub issue ready for development and implement it
allowed-tools: Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh issue edit:*), Bash(gh issue close:*), Bash(npm run:*), Bash(git add:*), Bash(git commit:*), Bash(git log:*), Skill, Read, Write, Edit, Glob, Grep
---

# Pick Issue

Pick an issue from the `stage:ready` queue and implement it.

## Arguments

- No argument: Pick from queue
- Issue number (e.g., `/pick-issue 15`): Work on specific issue regardless of label

## Current Issues Ready for Development

!`gh issue list --state open --label "stage:ready" --json number,title,labels,createdAt --limit 20`

## Instructions

### 1. Select Issue

**If argument provided:**
- Use that issue number directly
- Fetch details: `gh issue view <number>`

**If no argument:**
- If no issues with `stage:ready`: Report "No issues ready for development. Run `/plan-issue` to process planning queue, or `/brainstorm` for brainstorming queue." and stop.
- Otherwise, pick the best issue based on:
  - Skip issues with `in-progress` label (already claimed by another session)
  - Labels: `critical` > `bug` > `enhancement` > others
  - Age: older issues first
  - Dependencies: issues that unblock others

### 2. Claim the Issue

```bash
gh issue edit <number> --add-label in-progress
```

### 3. Fetch Full Context

```bash
gh issue view <number>
```

Review:
- Issue description
- Implementation plan (should be in comments)
- Design decisions
- Test requirements

### 4. Implement

The issue should have a detailed implementation plan. Follow it:

- Work through each step in order
- Run tests as specified
- Commit changes appropriately

If the plan is missing or unclear:
- The issue may have been incorrectly staged
- Remove `in-progress` and route back: `gh issue edit <number> --remove-label "in-progress" --remove-label "stage:ready" --add-label "stage:plan"`
- Report: "Issue #<number> lacks implementation plan. Moved back to stage:plan."

### 5. Verify Before Completing

Run all verification checks before marking complete:

```bash
# Run your project's test suite
# Examples:
# npm run test
# pytest
# dbt test
```

**All checks must pass before closing the issue.**

If any check fails:
- Fix the issues
- Re-run verification
- Only proceed when all pass

### 6. Complete

After implementation is done and all checks pass:

```bash
gh issue edit <number> --remove-label "in-progress"
gh issue close <number> --comment "$(cat <<'EOF'
Implemented in commit <sha>.

## Changes
- <summary of changes>

## Verification
- [x] Tests passed
- [x] Linting passed

---
*Closed via /pick-issue*
EOF
)"
```

## Output Format

```
Selected: #<number> - <title>

[Implementation...]

Verification:
- Tests: passed
- Lint: passed

Completed: #<number>
Commit: <sha>
```
