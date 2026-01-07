---
description: Post-implementation retrospective - discover issues and create GitHub issues
allowed-tools: Bash(git:*), Bash(gh issue create:*), Bash(npm run lint:*), Bash(npm run test:*), Bash(npx tsc:*), Bash(npx convex dev:*), Grep, Glob, Read
---

# Retrospective

Analyze recent implementation work and discover follow-up issues.

## Instructions

### 1. Identify the Scope of Recent Work

```bash
git diff --name-only $(git merge-base HEAD main)..HEAD
```

If no changes from main, check recent commits:
```bash
git log --oneline -10 --name-only
```

### 2. Run Full Verification Suite

Run all checks and capture any failures:

```bash
# Lint check
npm run lint

# TypeScript check
npx tsc --noEmit

# Run tests
npm run test:run

# Convex schema validation
npx convex dev --typecheck --once
```

Capture all warnings and errors from these checks - they become findings.

### 3. For Each Changed File, Analyze

**Related files to check:**
- Test files: `src/**/*.test.tsx` for components, `convex/**/*.test.ts` for backend
- Files that import the changed module (use Grep)
- Similar files in same directory (same pattern)

**React/TypeScript patterns to grep for:**
- If you fixed `any` types, search for similar `any` usage
- If you fixed missing error handling, search for similar patterns
- If you added validation, check for missing validation elsewhere

**Convex-specific patterns to check:**
- Mutations without input validation (`v.object({})` with no validators)
- Queries that might need indexes (check `schema.ts`)
- Missing error handling in actions
- Internal functions exposed as public

### 4. Categorize Findings

| Category | Label | Look For |
|----------|-------|----------|
| Bug | `bug` | Failing tests, wrong values, broken assertions, incorrect API calls |
| Tech debt | `tech-debt` | `any` types, linting warnings, TODOs, deprecated patterns |
| Refactoring | `refactoring` | Code duplication, inconsistent patterns, unclear naming |
| Enhancement | `enhancement` | Missing features, incomplete APIs, useful extensions |
| Documentation | `documentation` | Outdated docs, missing examples, stale comments |
| Testing | `testing` | Missing test coverage, test patterns to improve |

### 5. Assess Stage for Each Finding

| Stage | Criteria |
|-------|----------|
| `stage:brainstorm` | Problem unclear, multiple approaches possible, needs design decisions, affects architecture |
| `stage:plan` | Problem clear, solution known, but involves multiple files/steps |
| `stage:ready` | Trivial fix - specific file/line known, mechanical change, no risk (RARE) |

**Default to `stage:plan`** - only use `stage:ready` for truly trivial fixes, and `stage:brainstorm` when design decisions are genuinely needed.

### 6. Assess Priority

| Priority | Criteria |
|----------|----------|
| High | Blocking other work, causing failures, security concern |
| Medium | Should fix soon, affects code quality |
| Low | Nice to have, cleanup, minor improvement |

### 7. Present Findings

```
## Retro Findings

| # | Category | File | Issue | Priority | Stage | Effort |
|---|----------|------|-------|----------|-------|--------|
| 1 | tech-debt | src/components/X.tsx | Uses `any` type for props | Low | ready | Quick win |
| 2 | bug | convex/activities.ts | Missing validation for edge case | Medium | plan | Medium |
| 3 | testing | src/hooks/useAuth.tsx | No test coverage | Medium | plan | Medium |
| 4 | refactoring | convex/*.ts | Duplicate error handling | Low | brainstorm | Unknown |

Create all N issues? (y/n)
```

### 8. If Confirmed, Create Issues

For each finding, create a GitHub issue with both category and stage labels:

```bash
gh issue create --title "<Issue title>" --label "<category-label>,stage:<stage>" --body "$(cat <<'EOF'
## Problem
<description of issue>

## Context
Discovered during retro after <recent work description>.

## Solution
<suggested fix if known>

## Files
- `<file path>`

---
*Priority: <priority> | Effort: <effort>*
*Created via /retro*
EOF
)"
```

### 9. Summarize

```
Created N issues:
- #XX: <title> (category, stage:<stage>)
- #YY: <title> (category, stage:<stage>)
```

## Stage Assessment Examples

| Finding | Stage | Reasoning |
|---------|-------|-----------|
| "Replace `any` with proper type in Component.tsx" | `stage:ready` | Mechanical replacement, single file, no risk |
| "Fix incorrect API endpoint in test" | `stage:ready` | Fix specific line, obvious change |
| "Add error boundary for async operations" | `stage:plan` | Clear what to do, but multiple places to update |
| "Inconsistent Convex mutation patterns" | `stage:plan` | Clear goal, needs to identify all occurrences |
| "Should we add request caching?" | `stage:brainstorm` | Multiple caching strategies, needs design decision |
| "Component re-renders too often" | `stage:brainstorm` | Needs investigation to understand problem |

## React/Convex Specific Patterns

### React Patterns to Check

| Pattern | Issue | Check |
|---------|-------|-------|
| Missing error boundaries | Components can crash silently | `grep -r "throw\|Error" src/components` without ErrorBoundary |
| Hooks in conditionals | React rules violation | Manual review of changed hooks |
| Missing loading states | Poor UX | Components using useQuery without loading check |
| Missing deps in useEffect | Stale closure bugs | ESLint exhaustive-deps warnings |

### Convex Patterns to Check

| Pattern | Issue | Check |
|---------|-------|-------|
| Mutation without validation | Bad data can enter DB | Mutations with empty or minimal validators |
| Query without index | Performance issues | Queries filtering without matching index in schema |
| Internal function as public | Security risk | Functions in api.* that should be internal |
| Missing auth check | Authorization bypass | Mutations/queries without identity check |
| Action without error handling | Silent failures | Actions calling external APIs without try/catch |

### Test Coverage Gaps

| What to check | Expected test file | Pattern |
|---------------|-------------------|---------|
| New component | `src/components/**/*.test.tsx` | Same name with `.test.tsx` |
| New Convex function | `convex/**/*.test.ts` | Test file in convex/ |
| Modified utility | `src/lib/**/*.test.ts` | Test file next to source |

## Example Flow

```
> /retro

Identifying scope of recent work...

$ git diff --name-only $(git merge-base HEAD main)..HEAD
convex/webhooks.ts
convex/users.ts
src/hooks/useAuthGuard.ts

Running verification suite...

$ npm run lint
No issues found.

$ npx tsc --noEmit
No type errors.

$ npm run test:run
Tests: 42 passed, 0 failed

$ npx convex dev --typecheck --once
Schema valid.

Analyzing changed files...

[Checks for test coverage of new files]
[Greps for similar patterns that might need same fix]
[Reviews Convex patterns in changed files]

## Retro Findings

| # | Category | File | Issue | Priority | Stage | Effort |
|---|----------|------|-------|----------|-------|--------|
| 1 | testing | convex/webhooks.ts | No test coverage for new webhook handlers | Medium | plan | Medium |
| 2 | tech-debt | convex/users.ts | TODO comment for rate limiting | Low | brainstorm | Unknown |
| 3 | enhancement | src/hooks/useAuthGuard.ts | Could benefit from retry logic docs | Low | ready | Quick win |

Create all 3 issues? (y/n)

> y

Creating issues...

Created 3 issues:
- #31: Add tests for Clerk webhook handlers (testing, stage:plan)
- #32: Design rate limiting for user creation (tech-debt, stage:brainstorm)
- #33: Add JSDoc to useAuthGuard retry logic (enhancement, stage:ready)
```

## Integration

The `superpowers:finishing-a-development-branch` skill should suggest running `/retro` before completing work:

```
Implementation complete. Before finishing:
- Run /retro to discover follow-up issues? (recommended)
```
