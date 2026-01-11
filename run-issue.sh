#!/bin/bash
# Run/implement issues in headless Claude Code
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

You are implementing this issue. The issue should have a detailed implementation plan in the comments.

### 1. Review the Plan

Read through the implementation plan carefully. If no plan exists:
- Remove in-progress and route back to planning:
  \`gh issue edit $ISSUE_NUMBER --remove-label \"in-progress\" --remove-label \"stage:ready\" --add-label \"stage:plan\"\`
- Report that the issue lacks a plan and stop.

### 2. Implement

Follow the implementation plan step by step:
- Work through each task in order
- Write tests as specified in the plan
- Run tests to verify your changes work
- Commit changes with clear messages

### 3. Verify

Before completing, run verification:
- Run the project's test suite if one exists
- Ensure the build succeeds if applicable
- Check that your implementation matches the requirements

### 4. Complete

After implementation is done and verified:

\`\`\`bash
# Get the commit SHA
COMMIT_SHA=\$(git rev-parse --short HEAD)

# Close the issue
gh issue edit $ISSUE_NUMBER --remove-label \"in-progress\"
gh issue close $ISSUE_NUMBER --comment \"\$(cat <<'EOF'
Implemented in commit \$COMMIT_SHA.

## Changes
- <summary of changes made>

## Verification
- [x] Implementation complete
- [x] Tests passing (if applicable)

---
*Closed via headless session*
EOF
)\"
\`\`\`

## Output Format

When complete, report:
- Issue number and title
- Summary of changes made
- Commit SHA
- Verification status

## Start

Begin implementation now."

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
            echo "All issues implemented!"
            echo "  Completed: $PROCESSED"
            echo "  Failed: $FAILED"
            echo "=========================================="
        else
            echo "No issues with stage:ready available (all may be in-progress)."
            echo "Run /plan-issue to process the planning queue, or /brainstorm to create issues."
        fi
        exit 0
    fi

    echo "Found $COUNT issue(s) ready for implementation"

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
    echo "Issue #$ISSUE_NUMBER implemented. Moving to next..."
    echo "  Progress: $PROCESSED implemented, $FAILED failed"
    echo "=========================================="
    echo ""

    # Small delay between issues to prevent rate limiting
    sleep 2
done

# Note: If claude exits, the in-progress label remains
# This is intentional - manual cleanup needed if abandoned
