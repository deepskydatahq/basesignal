# Development Workflow Design

## Overview

Implement a three-stage issue pipeline with Claude Code commands for AI-assisted development, adapted from timo-data-stack for basesignal's React/Convex stack.

## Problem Statement

Currently basesignal lacks a structured workflow for tracking and processing development tasks. Manual issue management doesn't integrate with Claude Code sessions, making it hard to maintain continuity across sessions and automate batch processing.

## Proposed Solution

Adopt the timo-data-stack workflow with full adaptation:
- GitHub labels for issue stages
- 5 Claude Code commands for the pipeline
- Headless automation script for batch processing

## Design Details

### GitHub Labels

| Label | Color | Description |
|-------|-------|-------------|
| `stage:brainstorm` | `#d4c5f9` | Needs design exploration |
| `stage:plan` | `#fbca04` | Needs implementation plan |
| `stage:ready` | `#0e8a16` | Ready for development |
| `in-progress` | `#1d76db` | Currently being worked on |
| `critical` | `#b60205` | High priority |
| `bug` | `#d73a4a` | Something isn't working |
| `enhancement` | `#a2eeef` | New feature or request |
| `tech-debt` | `#fef2c0` | Technical debt to address |

### Commands

```
.claude/commands/
├── new-feature.md    # Idea → brainstorm → design doc → issue
├── brainstorm.md     # Process stage:brainstorm queue
├── plan-issue.md     # Process stage:plan queue
├── pick-issue.md     # Process stage:ready queue
└── retro.md          # Post-implementation analysis
```

#### Command Adaptations

| Command | Basesignal Adaptation |
|---------|----------------------|
| `new-feature` | Same flow, basesignal context |
| `brainstorm` | Explores React/Convex patterns |
| `plan-issue` | Links to `testing.md` skill |
| `pick-issue` | References `npm test`, Convex patterns |
| `retro` | Full verification suite |

#### Allowed Tools

All commands: `Read`, `Write`, `Glob`, `Grep`, `Skill`
Issue commands add: `Bash(gh issue:*)`, `Bash(git:*)`
Retro adds: `Bash(npm run lint:*)`, `Bash(npx tsc:*)`, `Bash(npm test:*)`

### Retro Verification Suite

```bash
npm run lint                      # ESLint
npx tsc --noEmit                  # TypeScript
npm run test:run                  # Vitest
npx convex dev --typecheck --once # Convex schema
```

### Headless Script

`run-issue.sh` with options:
- `--random` - Pick issues randomly
- `--loop` - Process multiple issues
- `--max N` - Limit issue count
- `--continue-on-error` - Don't stop on failures

Uses `claude --dangerously-skip-permissions` for full autonomy.

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   /new-feature ──┐                                                      │
│   /retro ────────┼──► stage:brainstorm ──► stage:plan ──► stage:ready   │
│                  │         │                   │              │         │
│                  │    /brainstorm         /plan-issue    /pick-issue    │
│                  │                                       run-issue.sh   │
│                  │                                            │         │
│                  └────────────────────────────────────────────┘         │
│                              (retro discovers more issues)              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Alternatives Considered

1. **Minimal copy** - Just update tooling references. Rejected: wouldn't leverage basesignal patterns.
2. **Extend with new features** - Add basesignal-specific stages. Rejected: start with proven workflow first.

## Success Criteria

- All 5 commands work with basesignal codebase
- Labels created and visible in GitHub
- `run-issue.sh` can process issues headlessly
- `/retro` catches lint, type, test, and Convex issues
