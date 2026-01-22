# Analyze H2 Results Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Synthesize learnings from 5 user test sessions and update HYPOTHESES.md with validation results.

**Architecture:** This is a documentation/analysis task. Work through session data, tally results against success criteria, update the hypothesis catalog, and run `/product iteration` to close the loop.

**Tech Stack:** Markdown documentation, GitHub CLI for issue updates

---

## Prerequisites

Before starting this plan, verify that:
- [ ] All 5 test sessions have been completed and documented in `docs/user-testing/sessions/session-01.md` through `session-05.md`
- [ ] Each session file contains filled-in data (not template placeholders)
- [ ] Session recordings are available if needed for clarification

**If sessions are not yet completed:** Stop and complete the sessions first (issue #13). This analysis cannot proceed with placeholder data.

---

### Task 1: Read and Extract Session Data

**Files:**
- Read: `docs/user-testing/sessions/session-01.md`
- Read: `docs/user-testing/sessions/session-02.md`
- Read: `docs/user-testing/sessions/session-03.md`
- Read: `docs/user-testing/sessions/session-04.md`
- Read: `docs/user-testing/sessions/session-05.md`

**Step 1: Read all 5 session files**

Read each session file and extract these data points into a working summary:

| Session | Completed? | Duration | H1: Would Use? | H1 Quote | H3: Accurate? | H3 Explanation | Friction Points |
|---------|------------|----------|----------------|----------|---------------|----------------|-----------------|
| 01 | | | | | | | |
| 02 | | | | | | | |
| 03 | | | | | | | |
| 04 | | | | | | | |
| 05 | | | | | | | |

**Step 2: Verify data completeness**

If any session file still contains template placeholders (`[User response]`, `YYYY-MM-DD`, etc.), STOP and report that session data is incomplete.

---

### Task 2: Tally H2 Results (Interview Completion)

**Success Criteria:** 4 of 5 users complete the interview without abandoning

**Step 1: Count completions**

From the session data extracted in Task 1:
- Count sessions where "User completed full interview" is checked
- Note any abandonment points and reasons

**Step 2: Determine H2 status**

```
If completions >= 4: Status = VALIDATED
If completions < 4:  Status = INVALIDATED
```

**Step 3: Document H2 evidence**

Note:
- Completion count: X/5
- Average session duration vs target (~15 min)
- Common friction points if any abandonments

---

### Task 3: Tally H1 Results (Opinionated Outputs)

**Success Criteria:** 3 of 5 users would use generated outputs as-is or with minor tweaks

**Step 1: Evaluate each session's H1 responses**

From post-interview questions (Q1-Q3):
- Q1: "How close is the plan to what you'd want?"
- Q2: "What would you change to ship it today?"
- Q3: Confidence score (1-5)

Classify each user:
- **Yes**: Would use as-is or said "minor tweaks"
- **No**: Would need major changes or wouldn't use

**Step 2: Determine H1 status**

```
If "Yes" count >= 3: Status = VALIDATED
If "Yes" count < 3:  Status = INVALIDATED
```

**Step 3: Document H1 evidence**

Note:
- "Would use" count: X/5
- Key quotes about output quality
- Common requested changes

---

### Task 4: Tally H3 Results (Concept Clarity)

**Success Criteria:** Users can explain First Value accurately in their own words

**Step 1: Evaluate each session's H3 responses**

From post-interview questions (Q7-Q9):
- Q7: User's First Value explanation + Accuracy rating
- Q8: How they differentiate from feature tracking

Count accuracy ratings:
- **Accurate**: Full understanding
- **Partially Accurate**: Gets the gist but misses nuance
- **Inaccurate**: Misunderstands the concept

**Step 2: Determine H3 status**

For H3, "validated" means most users can explain accurately:
```
If Accurate >= 3: Status = VALIDATED
If Accurate + Partial >= 4 and Accurate >= 2: Status = PARTIALLY VALIDATED
Otherwise: Status = INVALIDATED
```

**Step 3: Document H3 evidence**

Note:
- Accuracy breakdown: X accurate, Y partial, Z inaccurate
- Best user explanations (quotes)
- Common misconceptions

---

### Task 5: Complete Analysis Summary

**Files:**
- Modify: `docs/user-testing/analysis-summary.md`

**Step 1: Fill in analysis-summary.md**

Replace all template placeholders with actual data:

```markdown
# H2 User Test Analysis Summary

> Completed: 2026-01-XX | Sessions: 5

## Executive Summary

[2-3 sentence summary of overall findings]

## Hypothesis Validation

### H1: Opinionated Outputs

**Target:** 3/5 users would use generated outputs as-is or with minor tweaks

**Result:** X/5 | [Validated/Not Validated]

[Fill in the table with actual session data]

### H2: Interview Completion

**Target:** 4/5 users complete without abandoning

**Result:** X/5 | [Validated/Not Validated]

[Fill in the table with actual session data]

### H3: Concept Clarity

**Target:** Users can explain First Value accurately in their own words

**Result:** X/5 | [Validated/Not Validated]

[Fill in the table with actual session data]

## Friction Points Analysis

[Document critical, major, and minor friction points observed]

## Top 5 Improvement Priorities

[Rank by impact and effort]

## Unexpected Discoveries

[Any surprising findings]

## Next Steps

[Based on validation results]
```

**Step 2: Verify completeness**

Ensure no template placeholders remain.

---

### Task 6: Update Session Log

**Files:**
- Modify: `docs/user-testing/session-log.md`

**Step 1: Update metrics**

Update the overview table:
```markdown
| Metric | Target | Actual |
|--------|--------|--------|
| Sessions Completed | 5 | 5 |
| Completion Rate | 80% (4/5) | XX% (X/5) |
| Avg Session Duration | ~15 min | XX min |
```

**Step 2: Fill in session details**

Update each row with actual data:
```markdown
| # | Date | Participant | Status | Duration | Completed? | Notes File |
|---|------|-------------|--------|----------|------------|------------|
| 1 | YYYY-MM-DD | [ID] | Done | XX min | Yes/No | session-01.md |
...
```

**Step 3: Add hypothesis signals**

Update the hypothesis signals section with actual counts.

---

### Task 7: Update HYPOTHESES.md

**Files:**
- Modify: `HYPOTHESES.md`

**Step 1: Update H2 status and evidence**

Find the H2 section and update:

```markdown
### H2: Interview Completion
**Status:** [🟢 Validated / 🔴 Invalidated] (was: 🔵 Testing)

**Evidence:**
- Jan 2026: Epic created (#9) with 7 tasks
- Jan 2026: User testing complete - X/5 completed (target: 4/5)
  - Average duration: XX min
  - [Key observation about completions or dropoffs]

**Next Steps:** [Based on result - proceed to more users if validated, or identify friction points and simplify if invalidated]
```

**Step 2: Update H1 status and evidence**

Update H1 section (was "Untested"):

```markdown
### H1: Opinionated Outputs
**Status:** [🟢 Validated / 🔴 Invalidated / 🟡 Partially Validated]

**Evidence:**
- Jan 2026: User testing - X/5 would use outputs as-is or with minor tweaks
  - [Key quote or insight]
  - Common requested changes: [if any]

**Next Steps:** [Based on result]
```

**Step 3: Update H3 status and evidence**

Update H3 section (was "Untested"):

```markdown
### H3: Concept Clarity
**Status:** [🟢 Validated / 🔴 Invalidated / 🟡 Partially Validated]

**Evidence:**
- Jan 2026: User testing - X/5 accurately explained First Value
  - [Example of good explanation]
  - Common misconceptions: [if any]

**Next Steps:** [Based on result]
```

**Step 4: Update "Last Updated" date**

Change line 5 from current date to today's date.

---

### Task 8: Run Product Iteration

**Step 1: Invoke /product iteration**

Run the `/product iteration` command to:
- Generate product retrospective insights
- Apply product lenses (utility curve, transformation clarity, simplicity)
- Propose next iterations based on learnings
- Optionally create follow-up issues

**Step 2: Review recommendations**

The command will output:
- Transformation assessment
- Utility curve position for H2 epic work
- Recommended next iterations
- Anti-recommendations

**Step 3: Create follow-up issues if appropriate**

If the retrospective identifies concrete next steps, approve issue creation when prompted.

---

### Task 9: Update Issue #14 and Close

**Step 1: Comment on issue with summary**

```bash
gh issue comment 14 --body "$(cat <<'EOF'
## Analysis Complete

### Hypothesis Results

| Hypothesis | Target | Result | Status |
|------------|--------|--------|--------|
| H2: Interview Completion | 4/5 complete | X/5 | [Validated/Invalidated] |
| H1: Opinionated Outputs | 3/5 would use | X/5 | [Validated/Invalidated] |
| H3: Concept Clarity | Accurate explanations | X/5 | [Validated/Invalidated] |

### Key Learnings
- [Learning 1]
- [Learning 2]
- [Learning 3]

### Next Actions
- [Action 1]
- [Action 2]

### Documents Updated
- `HYPOTHESES.md` - Status and evidence for H1, H2, H3
- `docs/user-testing/analysis-summary.md` - Full analysis
- `docs/user-testing/session-log.md` - Session metrics

---
*Analysis completed via `/product iteration`*
EOF
)"
```

**Step 2: Close the issue**

```bash
gh issue close 14 --comment "Analysis complete. HYPOTHESES.md updated."
```

---

## Verification Checklist

After completing all tasks, verify:

- [ ] All 5 session files have been read and data extracted
- [ ] H1, H2, H3 tallied against success criteria
- [ ] `docs/user-testing/analysis-summary.md` fully populated (no placeholders)
- [ ] `docs/user-testing/session-log.md` updated with actual metrics
- [ ] `HYPOTHESES.md` updated with status changes and evidence for H1, H2, H3
- [ ] `/product iteration` run and insights captured
- [ ] Issue #14 commented and closed
- [ ] Follow-up issues created if recommended by product iteration

---

## Notes

- This task has **no code changes** - it is pure documentation and analysis
- If session data is incomplete, the plan cannot proceed - report blocker
- The `/product iteration` command is interactive and may prompt for decisions
- Evidence format in HYPOTHESES.md: `- [Month Year]: [Description] ([data])`
