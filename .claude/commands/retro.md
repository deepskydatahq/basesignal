---
description: Post-implementation retrospective - discover issues and create GitHub issues
allowed-tools: Bash(git:*), Bash(gh issue create:*), Bash(npm run:*), Grep, Glob, Read
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
# Run your project's verification commands
# Examples:
# npm run lint && npm run test
# pytest && ruff check .
# dbt test
```

Capture all warnings and errors from these checks - they become findings.

### 3. For Each Changed File, Analyze

**Related files to check:**
- Test files for changed modules
- Files that import the changed module (use Grep)
- Similar files in same directory (same pattern)

**Patterns to grep for:**
- If you fixed `any` types, search for similar usage
- If you fixed missing error handling, search for similar patterns
- If you added validation, check for missing validation elsewhere

### 4. Categorize Findings

| Category | Label | Look For |
|----------|-------|----------|
| Bug | `bug` | Failing tests, wrong values, broken assertions |
| Tech debt | `tech-debt` | `any` types, linting warnings, TODOs, deprecated patterns |
| Refactoring | `refactoring` | Code duplication, inconsistent patterns, unclear naming |
| Enhancement | `enhancement` | Missing features, incomplete APIs, useful extensions |
| Documentation | `documentation` | Outdated docs, missing examples, stale comments |
| Testing | `testing` | Missing test coverage, test patterns to improve |

### 5. Assess Stage for Each Finding

| Stage | Criteria |
|-------|----------|
| `stage:brainstorm` | Problem unclear, multiple approaches possible, needs design decisions |
| `stage:plan` | Problem clear, solution known, but involves multiple files/steps |
| `stage:ready` | Trivial fix - specific file/line known, mechanical change (RARE) |

**Default to `stage:plan`** - only use `stage:ready` for truly trivial fixes.

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
| 1 | tech-debt | src/X.ts | Uses `any` type for props | Low | ready | Quick win |
| 2 | bug | src/Y.ts | Missing validation for edge case | Medium | plan | Medium |
| 3 | testing | src/Z.ts | No test coverage | Medium | plan | Medium |

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
| "Replace `any` with proper type" | `stage:ready` | Mechanical replacement, single file |
| "Fix incorrect API endpoint in test" | `stage:ready` | Fix specific line, obvious change |
| "Add error boundary for async operations" | `stage:plan` | Clear what to do, but multiple places |
| "Inconsistent mutation patterns" | `stage:plan` | Clear goal, needs to identify all occurrences |
| "Should we add request caching?" | `stage:brainstorm` | Multiple strategies, needs design decision |

## Integration

The `superpowers:finishing-a-development-branch` skill should suggest running `/retro` before completing work:

```
Implementation complete. Before finishing:
- Run /retro to discover follow-up issues? (recommended)
```
