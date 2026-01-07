# Development Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up a three-stage issue pipeline with Claude Code commands for AI-assisted development.

**Architecture:** GitHub labels define issue stages, Claude Code commands process each stage, headless script enables batch automation.

**Tech Stack:** GitHub CLI (`gh`), Claude Code commands (markdown), Bash scripting

---

## Task 1: Create GitHub Labels

**Files:**
- None (GitHub API only)

**Step 1: Create stage labels**

```bash
gh label create "stage:brainstorm" --color "d4c5f9" --description "Needs design exploration"
gh label create "stage:plan" --color "fbca04" --description "Needs implementation plan"
gh label create "stage:ready" --color "0e8a16" --description "Ready for development"
```

**Step 2: Create workflow labels**

```bash
gh label create "in-progress" --color "1d76db" --description "Currently being worked on"
gh label create "critical" --color "b60205" --description "High priority"
```

**Step 3: Create category labels (if not exist)**

```bash
gh label create "bug" --color "d73a4a" --description "Something isn't working" 2>/dev/null || echo "bug label exists"
gh label create "enhancement" --color "a2eeef" --description "New feature or request" 2>/dev/null || echo "enhancement label exists"
gh label create "tech-debt" --color "fef2c0" --description "Technical debt to address"
```

**Step 4: Verify labels**

```bash
gh label list
```

Expected: All 8 labels visible

---

## Task 2: Create Commands Directory

**Files:**
- Create: `.claude/commands/` (directory)

**Step 1: Create directory**

```bash
mkdir -p .claude/commands
```

**Step 2: Verify**

```bash
ls -la .claude/
```

Expected: `commands/` directory exists alongside `skills/`

---

## Task 3: Create /new-feature Command

**Files:**
- Create: `.claude/commands/new-feature.md`

**Step 1: Write command file**

Create `.claude/commands/new-feature.md` with:
- Frontmatter with description and allowed-tools
- Instructions to capture idea, invoke brainstorming skill
- Save design doc to `docs/plans/YYYY-MM-DD-<feature>-design.md`
- Create GitHub issue with appropriate stage label
- Offer continuation to planning

**Step 2: Verify syntax**

```bash
head -20 .claude/commands/new-feature.md
```

Expected: Valid frontmatter with `---` delimiters

---

## Task 4: Create /brainstorm Command

**Files:**
- Create: `.claude/commands/brainstorm.md`

**Step 1: Write command file**

Create `.claude/commands/brainstorm.md` with:
- Dynamic issue list via `!gh issue list --label "stage:brainstorm"`
- Instructions to select and claim issue
- Invoke `superpowers:brainstorming` skill
- Stage assessment criteria
- Issue update/breakdown logic

**Step 2: Verify syntax**

```bash
head -20 .claude/commands/brainstorm.md
```

Expected: Valid frontmatter

---

## Task 5: Create /plan-issue Command

**Files:**
- Create: `.claude/commands/plan-issue.md`

**Step 1: Write command file**

Create `.claude/commands/plan-issue.md` with:
- Dynamic issue list via `!gh issue list --label "stage:plan"`
- Instructions to select, claim, fetch context
- Invoke `superpowers:writing-plans` skill
- Reference `@testing.md` skill for test patterns
- Add plan to issue comment
- Move to `stage:ready`

**Step 2: Verify syntax**

```bash
head -20 .claude/commands/plan-issue.md
```

Expected: Valid frontmatter

---

## Task 6: Create /pick-issue Command

**Files:**
- Create: `.claude/commands/pick-issue.md`

**Step 1: Write command file**

Create `.claude/commands/pick-issue.md` with:
- Dynamic issue list via `!gh issue list --label "stage:ready"`
- Instructions to select, claim, fetch context
- Implementation guidance with Convex/React patterns
- Close issue with structured comment

**Step 2: Verify syntax**

```bash
head -20 .claude/commands/pick-issue.md
```

Expected: Valid frontmatter

---

## Task 7: Create /retro Command

**Files:**
- Create: `.claude/commands/retro.md`

**Step 1: Write command file**

Create `.claude/commands/retro.md` with:
- Scope identification via git diff
- Full verification suite:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm run test:run`
  - `npx convex dev --typecheck --once`
- Analysis patterns for React/Convex
- Category and stage assessment
- Issue creation with labels

**Step 2: Verify syntax**

```bash
head -20 .claude/commands/retro.md
```

Expected: Valid frontmatter

---

## Task 8: Create run-issue.sh Script

**Files:**
- Create: `run-issue.sh`

**Step 1: Write script**

Create `run-issue.sh` with:
- Argument parsing (--random, --loop, --max, --continue-on-error)
- `fetch_ready_issues()` function
- `process_issue()` function with claude invocation
- Loop logic with stats tracking
- `claude --dangerously-skip-permissions` for headless mode

**Step 2: Make executable**

```bash
chmod +x run-issue.sh
```

**Step 3: Verify**

```bash
./run-issue.sh --help 2>&1 || head -10 run-issue.sh
```

Expected: Shows usage or script header

---

## Task 9: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add workflow section**

Add to CLAUDE.md after "Development" section:
- Workflow overview diagram
- Issue stages table
- Commands table with descriptions
- Labels table
- Typical workflow examples

**Step 2: Verify**

```bash
grep -A5 "Development Workflow" CLAUDE.md
```

Expected: Workflow section visible

---

## Task 10: Commit and Verify

**Files:**
- All new files

**Step 1: Stage files**

```bash
git add .claude/commands/ run-issue.sh CLAUDE.md
```

**Step 2: Commit**

```bash
git commit -m "feat: add development workflow with issue pipeline"
```

**Step 3: Verify commands are discoverable**

In Claude Code, type `/` and check that new commands appear:
- `/new-feature`
- `/brainstorm`
- `/plan-issue`
- `/pick-issue`
- `/retro`

Expected: All 5 commands visible in autocomplete

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | GitHub labels | gh CLI |
| 2 | Commands directory | `.claude/commands/` |
| 3 | /new-feature | `.claude/commands/new-feature.md` |
| 4 | /brainstorm | `.claude/commands/brainstorm.md` |
| 5 | /plan-issue | `.claude/commands/plan-issue.md` |
| 6 | /pick-issue | `.claude/commands/pick-issue.md` |
| 7 | /retro | `.claude/commands/retro.md` |
| 8 | Headless script | `run-issue.sh` |
| 9 | Documentation | `CLAUDE.md` |
| 10 | Commit & verify | All |
