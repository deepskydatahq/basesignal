# Development Workflow

A three-stage task pipeline with Claude Code commands for AI-assisted development.

## Overview

**Architecture:** HTE task statuses define workflow stages, Claude Code commands process each stage.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   brainstorm    │ ──► │      plan       │ ──► │     ready       │
│                 │     │                 │     │                 │
│  /brainstorm    │     │  /plan-issue    │     │  /pick-issue    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        ▲                                               │
        │                                               ▼
        │                                       ┌─────────────────┐
        └────────────────────────────────────── │    /retro       │
                                                │ (follow-ups)    │
                                                └─────────────────┘
```

## Setup

### 1. Install HTE CLI

```bash
# Install HTE (Hypothesis-Test-Evaluate) CLI
# See https://github.com/your-org/hte for installation instructions

# Initialize HTE in your project
hte init
```

### 2. Verify HTE Connection

```bash
hte health
hte tasks list
```

### 3. Install Superpowers Plugin (Recommended)

```bash
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

## Commands

### `/new-feature [idea]`

Start from a feature idea:
1. Captures the idea
2. Invokes `superpowers:brainstorming` skill
3. Saves design doc to `docs/plans/YYYY-MM-DD-<feature>-design.md`
4. Creates HTE task with appropriate status
5. Offers continuation to planning

### `/brainstorm [task-id]`

Process brainstorming queue:
1. Lists tasks with `brainstorm` status
2. Selects and claims task (sets `in_progress`)
3. Invokes `superpowers:brainstorming` skill
4. Either updates original task or breaks into child tasks
5. Moves to appropriate next status

### `/plan-issue [task-id]`

Process planning queue:
1. Lists tasks with `plan` status
2. Selects and claims task
3. Invokes `superpowers:writing-plans` skill
4. Adds implementation plan to task body
5. Moves to `ready` status

### `/pick-issue [task-id]`

Process ready queue:
1. Lists tasks with `ready` status
2. Selects and claims task
3. Fetches full context including plan
4. Implements following the plan
5. Runs verification (tests, lint)
6. Marks task as `done`

### `/retro`

Post-implementation retrospective:
1. Identifies scope via `git diff`
2. Runs verification suite
3. Analyzes changed files for patterns
4. Categorizes findings (bug, tech-debt, testing, etc.)
5. Creates follow-up tasks with appropriate statuses

## Headless Processing

Run tasks without interaction using the shell scripts:

```bash
# Process one ready task
./run-issue.sh

# Process all ready tasks
./run-issue.sh --loop

# Process up to 5 tasks, continue on errors
./run-issue.sh --loop --max 5 --continue-on-error

# Brainstorm tasks in batch
./brainstorm-issues.sh --loop

# Plan tasks in batch
./plan-issues.sh --loop
```

## Status Assessment Criteria

### brainstorm
Task needs design exploration if ANY of:
- Unresolved design questions
- Needs user input on approach
- Affects architecture

### plan
Task needs implementation plan if:
- Design decisions are made
- Solution is known but involves multiple files/steps

### ready
Task is ready for implementation if ALL of:
- Trivial, mechanical change
- Specific file and location known
- No risk of unintended consequences

**Note:** `ready` should be RARE. Prefer `plan`.

## Typical Workflows

### New Feature
```
/new-feature "add dark mode"
    ↓
[brainstorming session]
    ↓
Design doc saved, task created (status: plan)
    ↓
/plan-issue <task-id>
    ↓
[planning session]
    ↓
Plan added, moved to ready
    ↓
/pick-issue <task-id>
    ↓
[implementation]
    ↓
Task marked done
    ↓
/retro (optional)
```

### Processing Queues
```
# Clear brainstorming queue
./brainstorm-issues.sh --loop

# Clear planning queue
./plan-issues.sh --loop

# Implement all ready tasks
./run-issue.sh --loop
```

### Bug Fix
```
hte tasks create --title "Fix login timeout" --status plan
    ↓
/plan-issue
    ↓
/pick-issue
```

## Priority Order

When selecting from queues, commands use this priority:
1. Skip tasks with `in_progress` status
2. Older tasks first
3. Tasks that unblock others

## Files Created

| Command | Creates |
|---------|---------|
| `/new-feature` | `docs/plans/YYYY-MM-DD-<feature>-design.md`, HTE task |
| `/brainstorm` | Design decisions in task body, optional child tasks |
| `/plan-issue` | Implementation plan in task body |
| `/pick-issue` | Code changes, commits |
| `/retro` | Follow-up HTE tasks |
