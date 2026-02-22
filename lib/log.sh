#!/usr/bin/env bash
# Shared activity logging for all automation scripts.
# Source this file and call log_activity to append JSONL entries.
#
# Usage:
#   source "$(dirname "${BASH_SOURCE[0]}")/../lib/log.sh"
#   log_activity "brainstorm-parallel:w1" "CLAIM" "task-123" "Design lifecycle types"

ACTIVITY_LOG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/logs"

log_activity() {
    local SRC="$1" ACT="$2" TASK="${3:--}" TITLE="${4:-}" DETAIL="${5:-}"
    local TS DAY
    TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    DAY=$(date -u +%Y-%m-%d)
    mkdir -p "$ACTIVITY_LOG_DIR"
    printf '{"ts":"%s","src":"%s","act":"%s","task":"%s","title":"%s","detail":"%s"}\n' \
        "$TS" "$SRC" "$ACT" "$TASK" "$TITLE" "$DETAIL" \
        >> "$ACTIVITY_LOG_DIR/activity-$DAY.jsonl"
}

# Safety net: ensure brainstorm task body was populated from design doc.
# Call after a successful brainstorm run.
# Usage: ensure_brainstorm_body "TASK_ID" "TASK_TITLE" "Worker label for logging"
ensure_brainstorm_body() {
    local TASK_ID="$1" TASK_TITLE="$2" LOG_PREFIX="${3:-brainstorm}"
    local TASK_JSON BODY_LEN SLUG DESIGN_DOC SHORT_SLUG BODY

    TASK_JSON=$(bd show "$TASK_ID" --json 2>/dev/null)

    # Check label transition
    if echo "$TASK_JSON" | jq -r '.[0].labels[]?' 2>/dev/null | grep -q "brainstorm"; then
        echo "[$LOG_PREFIX] Label not transitioned, fixing: brainstorm → plan"
        bd update "$TASK_ID" --remove-label brainstorm --add-label plan 2>/dev/null || true
    fi

    # Check body populated
    BODY_LEN=$(echo "$TASK_JSON" | jq -r '.[0].description | length' 2>/dev/null || echo "0")
    if [[ "$BODY_LEN" -lt 50 ]]; then
        echo "[$LOG_PREFIX] Task body empty, looking for design doc..."
        SLUG=$(echo "$TASK_TITLE" | sed 's/^M[0-9]*-E[0-9]*-S[0-9]*: //' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')
        DESIGN_DOC=$(ls docs/plans/*"$SLUG"*-design.md 2>/dev/null | head -1)
        if [[ -z "$DESIGN_DOC" ]]; then
            SHORT_SLUG=$(echo "$SLUG" | cut -d- -f1-3)
            DESIGN_DOC=$(ls docs/plans/*"$SHORT_SLUG"*-design.md 2>/dev/null | head -1)
        fi
        if [[ -n "$DESIGN_DOC" && -f "$DESIGN_DOC" ]]; then
            echo "[$LOG_PREFIX] Found design doc: $DESIGN_DOC"
            BODY=$(head -c 1500 "$DESIGN_DOC")
            BODY="${BODY}"$'\n\n'"---"$'\n'"*Design doc: ${DESIGN_DOC}*"
            bd update "$TASK_ID" -d "$BODY" 2>/dev/null || true
            echo "[$LOG_PREFIX] Task body populated from design doc"
        else
            echo "[$LOG_PREFIX] WARNING: No design doc found for task"
        fi
    fi
}
