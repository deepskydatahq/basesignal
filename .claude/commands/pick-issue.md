---
description: Pick the next GitHub issue ready for development and implement it
allowed-tools: Bash(gh issue list:*), Bash(gh issue view:*), Bash(gh issue edit:*), Bash(gh issue close:*), Bash(npm run lint:*), Bash(npm run test:*), Bash(npx tsc:*), Bash(git add:*), Bash(git commit:*), Bash(git log:*), Skill, Read, Write, Edit, Glob, Grep
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

**Basesignal Patterns** (reference CLAUDE.md):

| What | Pattern |
|------|---------|
| Convex queries | `useQuery(api.module.functionName, { args })` |
| Convex mutations | `useMutation(api.module.functionName)` |
| Components | Functional with hooks, no class components |
| Styling | Tailwind CSS + Clarity UI design system |

**Testing Conventions** (reference @testing.md):

| What to test | Tool | Pattern |
|--------------|------|---------|
| Convex functions | `convex-test` | Use `setupJourney()` helper for auth |
| React components | RTL | Use `setup()` function, `getByRole` queries |
| Pure functions | Vitest | Direct unit tests |

If the plan is missing or unclear:
- The issue may have been incorrectly staged
- Remove `in-progress` and route back: `gh issue edit <number> --remove-label "in-progress" --remove-label "stage:ready" --add-label "stage:plan"`
- Report: "Issue #<number> lacks implementation plan. Moved back to stage:plan."

### 5. Verify Before Completing

Run all verification checks before marking complete:

```bash
# Lint check
npm run lint

# Type check
npx tsc --noEmit

# Run tests
npm run test:run
```

**All three must pass before closing the issue.**

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
- [x] `npm run lint` - passed
- [x] `npx tsc --noEmit` - passed
- [x] `npm run test:run` - passed

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
- Lint: passed
- TypeScript: passed
- Tests: passed

Completed: #<number>
Commit: <sha>
```

## Example Flow

```
> /pick-issue

Issues ready for development:
#24 - Fix activity validation error messages (bug, stage:ready)
#28 - Add metric trend visualization (enhancement, stage:ready)

Selecting #24 (bug, older) - claiming with in-progress label...

[Fetches full issue context with implementation plan]

Implementation Plan shows 4 steps:
1. Enhance validation error types in convex/activities.ts
2. Create error message mapping in src/lib/validation-errors.ts
3. Update ActivityEditor error display
4. Add tests

Starting implementation...

[Step 1: Reads convex/activities.ts, adds error codes]
[Step 2: Creates src/lib/validation-errors.ts]
[Step 3: Updates ActivityEditor.tsx with new error handling]
[Step 4: Adds tests using convex-test and RTL]

Running verification...

$ npm run lint
No issues found.

$ npx tsc --noEmit
No type errors.

$ npm run test:run
Tests: 42 passed, 0 failed

All checks passed!

[Commits changes]
[Closes issue with structured comment]

Completed: #24
Commit: abc1234
```

## Working with Specific Issues

```
> /pick-issue 28

Fetching issue #28...

[Proceeds with implementation regardless of labels]
```

This is useful when:
- You want to work on a specific issue
- The issue hasn't been labeled yet
- You're resuming work on an in-progress issue
