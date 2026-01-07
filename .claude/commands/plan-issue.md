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

### 4. Write Implementation Plan

Invoke the `superpowers:writing-plans` skill to create a detailed plan:

- Explore the codebase to understand current state
- Identify all files that need changes
- Break work into specific, ordered steps
- Consider edge cases and error handling
- Include test strategy (see testing conventions below)

**Testing Conventions** (reference @testing.md for full patterns):

| What to test | Tool | Pattern |
|--------------|------|---------|
| Convex functions | `convex-test` | Use `setupJourney()` helper for auth |
| React components | RTL | Use `setup()` function, `getByRole` queries |
| Pure functions | Vitest | Direct unit tests |

Test commands: `npm run test:run` (single run), `npm test` (watch mode)

### 5. Add Plan to Issue

```bash
gh issue comment <number> --body "$(cat <<'EOF'
## Implementation Plan

### Overview
<1-2 sentence summary of approach>

### Steps

1. **<Step title>**
   - File: `<path/to/file.ts>` or `<path/to/Component.tsx>`
   - Change: <what to do>
   - Details: <specifics if needed>

2. **<Step title>**
   - File: `<path/to/file.ts>`
   - Change: <what to do>

... (all steps)

### Testing
- [ ] Convex function tests using `convex-test` (if backend changes)
- [ ] Component tests using RTL (if UI changes)
- [ ] Run `npm run test:run` to verify all tests pass

### Risks & Mitigations
- <risk>: <mitigation>

---
*Plan created via /plan-issue*
EOF
)"
```

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

## Example Flow

```
> /plan-issue

Issues needing planning:
#22 - Add journey duplication feature (enhancement)
#24 - Fix activity validation error messages (bug)

Selecting #24 (bug, older) - claiming with in-progress label...

[Invokes superpowers:writing-plans]

Let me explore the current validation implementation...

[Reads convex/activities.ts]
[Checks src/components/journey/ActivityEditor.tsx]

Understanding the structure:
- Validation happens in convex/activities.ts via validateActivity()
- Errors surface in ActivityEditor.tsx through useMutation error handling

Implementation Plan:

1. **Enhance validation error types**
   - File: `convex/activities.ts`
   - Change: Add specific error codes for entity/action validation

2. **Create error message mapping**
   - File: `src/lib/validation-errors.ts`
   - Change: Map error codes to user-friendly messages

3. **Update ActivityEditor error display**
   - File: `src/components/journey/ActivityEditor.tsx`
   - Change: Use new error mapping, show inline errors

4. **Add tests**
   - File: `convex/activities.test.ts` - convex-test for validation
   - File: `src/components/journey/ActivityEditor.test.tsx` - RTL for UI

[Plan added to issue]

Plan added to issue with 4 steps.
Moved to: stage:ready

Issue #24 is now ready for implementation.
Run /pick-issue to start working on it.
```
