#!/bin/bash
# Plan issues in headless Claude Code
# Usage: ./plan-issues.sh [--random] [--loop] [--max N] [--continue-on-error]
#
# Options:
#   --random            Pick issues randomly instead of in order
#   --loop              Process multiple issues sequentially
#   --max N             Maximum number of issues to process (default: all)
#   --continue-on-error Continue to next issue if one fails

set -e

# Parse args
PICK_RANDOM=false
LOOP_MODE=false
MAX_ISSUES=0
CONTINUE_ON_ERROR=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --random)
            PICK_RANDOM=true
            shift
            ;;
        --loop)
            LOOP_MODE=true
            shift
            ;;
        --max)
            MAX_ISSUES="$2"
            shift 2
            ;;
        --continue-on-error)
            CONTINUE_ON_ERROR=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: ./plan-issues.sh [--random] [--loop] [--max N] [--continue-on-error]"
            exit 1
            ;;
    esac
done

# Function to fetch plan issues
fetch_plan_issues() {
    gh issue list --state open --label "stage:plan" --json number,title,labels --jq '
        [.[] | select(.labels | map(.name) | index("in-progress") | not)]
    '
}

# Function to process a single issue
process_issue() {
    local ISSUE_NUMBER="$1"
    local ISSUE_TITLE="$2"

    echo "Selected: #$ISSUE_NUMBER - $ISSUE_TITLE"

    # Claim the issue
    echo "Claiming issue (adding in-progress label)..."
    gh issue edit "$ISSUE_NUMBER" --add-label in-progress

    # Get full issue content
    echo "Fetching issue details..."
    ISSUE_BODY=$(gh issue view "$ISSUE_NUMBER" --json body,title,comments --jq '
        "# Issue: \(.title)\n\n## Description\n\(.body)\n\n## Comments\n" +
        (.comments | map("---\n\(.body)") | join("\n\n"))
    ')

    # Build the prompt
    PROMPT="Plan GitHub issue #$ISSUE_NUMBER: $ISSUE_TITLE

$ISSUE_BODY

---

## Instructions

You are creating an implementation plan for this issue. Follow these steps:

### 1. Invoke the Writing Plans Skill

Use the \`superpowers:writing-plans\` skill with this argument:
\`\`\`
Issue #$ISSUE_NUMBER: $ISSUE_TITLE
\`\`\`

The skill will guide you through:
- Exploring the codebase to understand current state
- Identifying all files that need changes
- Breaking work into specific, ordered TDD steps
- Including test strategy

### 2. Testing Conventions

| What to test | Tool | Pattern |
|--------------|------|---------|
| Convex functions | \`convex-test\` | Use setup helpers for auth |
| React components | RTL | Use \`setup()\` function, \`getByRole\` queries |
| Pure functions | Vitest | Direct unit tests |

Test commands: \`npm run test:run\` (single run)

### 3. Save the Plan

Save the detailed plan to: \`docs/plans/$(date +%Y-%m-%d)-<feature-name>.md\`

### 4. Add Plan Summary to Issue

After creating the full plan document, add a summary comment to the issue:

\`\`\`bash
gh issue comment $ISSUE_NUMBER --body \"\$(cat <<'EOF'
## Implementation Plan

**Plan document:** \`docs/plans/<filename>.md\`

### Overview
<1-2 sentence summary of approach>

### Tasks
<N> TDD tasks covering:
- <brief task list>

### Testing
- [ ] Run \`npm run test:run\` to verify all tests pass

---
*Plan created via headless session*
EOF
)\"
\`\`\`

### 5. Move to Ready

\`\`\`bash
gh issue edit $ISSUE_NUMBER --remove-label \"stage:plan\" --remove-label \"in-progress\" --add-label \"stage:ready\"
\`\`\`

## Output Format

When complete, report:
- Plan document location
- Number of tasks
- Issue moved to stage:ready

## Start

Begin planning now."

    # Run Claude Code in headless mode
    echo ""
    echo "=========================================="
    echo "Starting Claude Code for issue #$ISSUE_NUMBER"
    echo "=========================================="
    echo ""

    claude --dangerously-skip-permissions -p "$PROMPT"
}

# Track stats for loop mode
PROCESSED=0
FAILED=0

# Main loop
while true; do
    # Fetch issues fresh each iteration (to see newly completed ones)
    echo "Fetching stage:plan issues..."
    ISSUES=$(fetch_plan_issues)

    # Check if any issues available
    COUNT=$(echo "$ISSUES" | jq 'length')
    if [[ "$COUNT" -eq 0 ]]; then
        if [[ "$PROCESSED" -gt 0 ]]; then
            echo ""
            echo "=========================================="
            echo "All issues planned!"
            echo "  Completed: $PROCESSED"
            echo "  Failed: $FAILED"
            echo "=========================================="
        else
            echo "No issues with stage:plan available (all may be in-progress)."
            echo "Run /brainstorm to process the brainstorming queue, or /new-feature to create issues."
        fi
        exit 0
    fi

    echo "Found $COUNT issue(s) needing planning"

    # Check if we've hit max
    if [[ "$MAX_ISSUES" -gt 0 && "$PROCESSED" -ge "$MAX_ISSUES" ]]; then
        echo ""
        echo "=========================================="
        echo "Reached maximum issues ($MAX_ISSUES)"
        echo "  Completed: $PROCESSED"
        echo "  Failed: $FAILED"
        echo "=========================================="
        exit 0
    fi

    # Pick an issue
    if [[ "$PICK_RANDOM" == true ]]; then
        INDEX=$((RANDOM % COUNT))
        echo "Picking random issue (index $INDEX)..."
    else
        INDEX=0
        echo "Picking first issue..."
    fi

    ISSUE_NUMBER=$(echo "$ISSUES" | jq -r ".[$INDEX].number")
    ISSUE_TITLE=$(echo "$ISSUES" | jq -r ".[$INDEX].title")

    # Process the issue
    if [[ "$CONTINUE_ON_ERROR" == true ]]; then
        set +e
        process_issue "$ISSUE_NUMBER" "$ISSUE_TITLE"
        EXIT_CODE=$?
        set -e

        if [[ "$EXIT_CODE" -ne 0 ]]; then
            echo "Issue #$ISSUE_NUMBER failed with exit code $EXIT_CODE"
            FAILED=$((FAILED + 1))
            # Remove in-progress label on failure so it can be retried
            gh issue edit "$ISSUE_NUMBER" --remove-label in-progress 2>/dev/null || true
        else
            PROCESSED=$((PROCESSED + 1))
        fi
    else
        process_issue "$ISSUE_NUMBER" "$ISSUE_TITLE"
        PROCESSED=$((PROCESSED + 1))
    fi

    # Exit if not in loop mode
    if [[ "$LOOP_MODE" != true ]]; then
        break
    fi

    echo ""
    echo "=========================================="
    echo "Issue #$ISSUE_NUMBER planned. Moving to next..."
    echo "  Progress: $PROCESSED planned, $FAILED failed"
    echo "=========================================="
    echo ""

    # Small delay between issues to prevent rate limiting
    sleep 2
done

# Note: If claude exits, the in-progress label remains
# This is intentional - manual cleanup needed if abandoned
