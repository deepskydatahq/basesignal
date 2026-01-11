#!/bin/bash
# Brainstorm issues in headless Claude Code
# Usage: ./brainstorm-issues.sh [ISSUE_NUMBER] [--random] [--loop] [--max N] [--continue-on-error]
#
# Arguments:
#   ISSUE_NUMBER        Specific issue to brainstorm (skips claiming)
#
# Options:
#   --random            Pick issues randomly instead of in order
#   --loop              Process multiple issues sequentially
#   --max N             Maximum number of issues to process (default: all)
#   --continue-on-error Continue to next issue if one fails

set -e

# Parse args
SPECIFIC_ISSUE=""
PICK_RANDOM=false
LOOP_MODE=false
MAX_ISSUES=0
CONTINUE_ON_ERROR=false

# Check if first argument is a number (specific issue)
if [[ $# -gt 0 && "$1" =~ ^[0-9]+$ ]]; then
    SPECIFIC_ISSUE="$1"
    shift
fi

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
            echo "Usage: ./brainstorm-issues.sh [ISSUE_NUMBER] [--random] [--loop] [--max N] [--continue-on-error]"
            exit 1
            ;;
    esac
done

# Function to fetch brainstorm issues
fetch_brainstorm_issues() {
    gh issue list --state open --label "stage:brainstorm" --json number,title,labels --jq '
        [.[] | select(.labels | map(.name) | index("in-progress") | not)]
    '
}

# Function to fetch specific issue
fetch_specific_issue() {
    local ISSUE_NUMBER="$1"
    gh issue view "$ISSUE_NUMBER" --json number,title
}

# Function to process a single issue
process_issue() {
    local ISSUE_NUMBER="$1"
    local ISSUE_TITLE="$2"
    local SKIP_CLAIM="$3"

    echo "Selected: #$ISSUE_NUMBER - $ISSUE_TITLE"

    # Claim the issue (unless skipping)
    if [[ "$SKIP_CLAIM" != "true" ]]; then
        echo "Claiming issue (adding in-progress label)..."
        gh issue edit "$ISSUE_NUMBER" --add-label in-progress
    else
        echo "Skipping claim (specific issue mode)"
    fi

    # Build the prompt - delegate to /brainstorm-auto
    PROMPT="Run /brainstorm-auto $ISSUE_NUMBER"

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

# Specific issue mode
if [[ -n "$SPECIFIC_ISSUE" ]]; then
    echo "Fetching issue #$SPECIFIC_ISSUE..."
    ISSUE_DATA=$(fetch_specific_issue "$SPECIFIC_ISSUE")

    if [[ -z "$ISSUE_DATA" ]]; then
        echo "Error: Issue #$SPECIFIC_ISSUE not found"
        exit 1
    fi

    ISSUE_NUMBER=$(echo "$ISSUE_DATA" | jq -r '.number')
    ISSUE_TITLE=$(echo "$ISSUE_DATA" | jq -r '.title')

    process_issue "$ISSUE_NUMBER" "$ISSUE_TITLE" "true"
    exit 0
fi

# Queue mode - main loop
while true; do
    # Fetch issues fresh each iteration (to see newly completed ones)
    echo "Fetching stage:brainstorm issues..."
    ISSUES=$(fetch_brainstorm_issues)

    # Check if any issues available
    COUNT=$(echo "$ISSUES" | jq 'length')
    if [[ "$COUNT" -eq 0 ]]; then
        if [[ "$PROCESSED" -gt 0 ]]; then
            echo ""
            echo "=========================================="
            echo "All issues brainstormed!"
            echo "  Completed: $PROCESSED"
            echo "  Failed: $FAILED"
            echo "=========================================="
        else
            echo "No issues with stage:brainstorm available (all may be in-progress)."
            echo "Run /new-feature to create issues, or /brainstorm-epics to generate epics."
        fi
        exit 0
    fi

    echo "Found $COUNT issue(s) needing brainstorming"

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
        process_issue "$ISSUE_NUMBER" "$ISSUE_TITLE" "false"
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
        process_issue "$ISSUE_NUMBER" "$ISSUE_TITLE" "false"
        PROCESSED=$((PROCESSED + 1))
    fi

    # Exit if not in loop mode
    if [[ "$LOOP_MODE" != true ]]; then
        break
    fi

    echo ""
    echo "=========================================="
    echo "Issue #$ISSUE_NUMBER brainstormed. Moving to next..."
    echo "  Progress: $PROCESSED brainstormed, $FAILED failed"
    echo "=========================================="
    echo ""

    # Small delay between issues to prevent rate limiting
    sleep 2
done

# Note: If claude exits, the in-progress label remains
# This is intentional - manual cleanup needed if abandoned
