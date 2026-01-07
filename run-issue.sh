#!/bin/bash
# Run ready issues in headless Claude Code
# Usage: ./run-issue.sh [--random] [--loop] [--max N] [--continue-on-error]
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
            echo "Usage: ./run-issue.sh [--random] [--loop] [--max N] [--continue-on-error]"
            exit 1
            ;;
    esac
done

# Function to fetch ready issues
fetch_ready_issues() {
    gh issue list --state open --label "stage:ready" --json number,title,labels --jq '
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
    PROMPT="Implement GitHub issue #$ISSUE_NUMBER: $ISSUE_TITLE

$ISSUE_BODY

---

## Instructions

1. Follow the implementation plan in the issue comments
2. Make the necessary code changes
3. Run tests to verify changes work
4. Commit changes with appropriate message referencing #$ISSUE_NUMBER

## Completion Workflow

When implementation is complete and tests pass:

1. **Close the issue with a structured comment:**

\`\`\`bash
gh issue close $ISSUE_NUMBER --comment \"\$(cat <<'EOF'
## Completed

**Commit:** <commit-sha>

### Changes
- <file1>: <what changed>
- <file2>: <what changed>

### Summary
<1-2 sentences describing what was done>

### Tests
- [x] <test that was run/passed>

---
*Implemented via headless session*
EOF
)\"\`\`\`

2. **Decide whether to run retrospective:**

   Consider running \`/retro\` if ANY of these apply:
   - You noticed related code that could be improved
   - You saw similar patterns elsewhere that need the same fix
   - You found TODOs or tech debt while working
   - The change touched multiple files that may have adjacent issues

   If yes: Run the /retro skill to discover and create follow-up issues.
   The retro will automatically assign stage labels (stage:brainstorm, stage:plan, or stage:ready) to any issues it creates.

   If no: Just report completion and exit.

## Start

Begin implementing now."

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
    echo "Fetching stage:ready issues..."
    ISSUES=$(fetch_ready_issues)

    # Check if any issues available
    COUNT=$(echo "$ISSUES" | jq 'length')
    if [[ "$COUNT" -eq 0 ]]; then
        if [[ "$PROCESSED" -gt 0 ]]; then
            echo ""
            echo "=========================================="
            echo "All issues processed!"
            echo "  Completed: $PROCESSED"
            echo "  Failed: $FAILED"
            echo "=========================================="
        else
            echo "No issues with stage:ready available (all may be in-progress)."
            echo "Run /plan-issue to process the planning queue, or /brainstorm for brainstorming queue."
        fi
        exit 0
    fi

    echo "Found $COUNT ready issue(s)"

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
    echo "Issue #$ISSUE_NUMBER complete. Moving to next..."
    echo "  Progress: $PROCESSED processed, $FAILED failed"
    echo "=========================================="
    echo ""

    # Small delay between issues to prevent rate limiting
    sleep 2
done

# Note: If claude exits, the in-progress label remains
# This is intentional - manual cleanup needed if abandoned
