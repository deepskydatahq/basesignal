# Post-Interview Feedback Questions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Draft 5-10 post-session questions to capture hypothesis signals after interview completion or abandonment.

**Architecture:** Create a markdown document with structured feedback questions organized by hypothesis. Questions will be used for user research sessions (not integrated into the app yet).

**Tech Stack:** Markdown documentation

---

## Background

This task supports Epic #9: Test H2 - Interview Completion. We need to prepare questions to ask users after they complete (or abandon) the interview to validate three hypotheses:

| Hypothesis | What We're Testing | Success Criteria |
|------------|-------------------|------------------|
| H1: Opinionated Outputs | Would users use the generated measurement plans? | 3/5 users would use as-is or with minor tweaks |
| H2: Interview Completion | Do users complete the 15-minute interview? | 4/5 users complete without abandoning |
| H3: Concept Clarity | Do users understand "First Value" without education? | Users can explain First Value in their own words |

---

## Task 1: Create Feedback Questions Document

**Files:**
- Create: `docs/user-research/post-interview-questions.md`

**Step 1: Create the document with all questions**

```markdown
# Post-Interview Feedback Questions

Use these questions after users complete (or abandon) the interview session.

---

## Session Context (for interviewer)

Before asking questions, note:
- [ ] Did user complete the full interview?
- [ ] Where did they abandon (if applicable)?
- [ ] Time taken (target: ~15 minutes)
- [ ] Any visible frustration points?

---

## H1 Signal: Would They Use the Outputs?

**Goal:** Determine if AI-generated measurement plans are "good enough" to use.

### Q1. Looking at the measurement plan generated, how close is it to what you'd want to track?
*Listen for: Specific gaps, things that surprised them, whether they'd add/remove anything*

### Q2. If you had to ship this plan to your analytics team today, what would you change first?
*Listen for: Major structural issues vs minor tweaks, "nothing" = strong signal*

### Q3. On a scale of 1-5, how confident are you that this plan would help you understand your product's health?
*Follow up: What would make it a 5?*

---

## H2 Signal: Where Was the Friction?

**Goal:** Identify drop-off points and friction in the interview flow.

### Q4. Was there a moment where you felt stuck or unsure what to answer?
*Listen for: Specific questions that confused them, terminology issues*

### Q5. Did the conversation feel too long, too short, or about right?
*Listen for: Engagement level, patience, where attention wandered*

### Q6. What would have made this easier?
*Listen for: UI improvements, better prompts, different question order*

---

## H3 Signal: Concept Clarity

**Goal:** Test if users understand "First Value" and outcome-driven tracking without explicit teaching.

### Q7. In your own words, what is the "First Value" moment for your product?
*Listen for: Accuracy of understanding, confidence in explanation, use of their own language vs parroting*

### Q8. How is tracking "First Value" different from tracking feature usage?
*Listen for: Outcome vs activity distinction, understanding of why it matters*

### Q9. If a colleague asked what you just did, how would you describe it?
*Listen for: Mental model, whether they see value, how they'd pitch it*

---

## Open-Ended Discovery

**Goal:** Surface surprises we didn't anticipate.

### Q10. What surprised you most about this experience?
*Listen for: Unexpected value, unexpected friction, "aha" moments*

### Q11. Is there anything you expected to happen that didn't?
*Listen for: Missing features, unmet expectations, mental model mismatches*

---

## For Abandoned Sessions Only

If user didn't complete the interview, add these:

### Q12. What made you stop?
*Listen for: Confusion, time pressure, loss of interest, technical issues*

### Q13. What would have helped you continue?
*Listen for: Specific improvements, whether they'd try again*

---

## Closing

Thank the user. Note any follow-up interest:
- [ ] Would they want to see the finished version?
- [ ] Would they be willing to try again after improvements?
- [ ] Any referrals to other potential testers?

---

## Analysis Framework

After each session, categorize findings:

| Question | H1/H2/H3 | Signal Strength | Key Quote | Action Item |
|----------|----------|-----------------|-----------|-------------|
| Q1 | H1 | Strong/Weak/Neutral | "..." | ... |
| ... | ... | ... | ... | ... |

**Validation thresholds:**
- H1: 3/5 users would use outputs as-is or with minor tweaks
- H2: 4/5 users complete without abandoning
- H3: Users can explain First Value accurately in their own words
```

**Step 2: Verify the document was created**

Run: `ls -la docs/user-research/post-interview-questions.md`
Expected: File exists with recent timestamp

**Step 3: Commit the questions document**

```bash
git add docs/user-research/post-interview-questions.md
git commit -m "docs: add post-interview feedback questions for H1/H2/H3

Part of epic #9: Test H2 - Interview Completion

Questions cover:
- H1: Would they use generated outputs? (Q1-Q3)
- H2: Where did they feel friction? (Q4-Q6)
- H3: Can they explain First Value? (Q7-Q9)
- Discovery: Surface surprises (Q10-Q11)
- Abandoned sessions: Why they stopped (Q12-Q13)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Link Questions to Issue

**Step 1: Add completion comment to GitHub issue**

```bash
gh issue comment 12 --body "$(cat <<'EOF'
## Feedback Questions Created

**Document:** `docs/user-research/post-interview-questions.md`

### Question Summary (11 questions total)

**H1 - Opinionated Outputs (3 questions)**
- Q1: How close is the plan to what you'd want?
- Q2: What would you change to ship it today?
- Q3: Confidence scale (1-5) on plan usefulness

**H2 - Interview Friction (3 questions)**
- Q4: Where did you feel stuck?
- Q5: Was it too long/short/right?
- Q6: What would make it easier?

**H3 - Concept Clarity (3 questions)**
- Q7: Explain First Value in your own words
- Q8: How is First Value different from feature tracking?
- Q9: How would you describe this to a colleague?

**Open Discovery (2 questions)**
- Q10: What surprised you most?
- Q11: What did you expect that didn't happen?

**Abandoned Sessions (+2 questions)**
- Q12: What made you stop?
- Q13: What would help you continue?

### Included
- Session context checklist for interviewer
- Analysis framework with validation thresholds
- Signal categorization table template
EOF
)"
```

**Step 2: Close the issue**

```bash
gh issue close 12 --comment "Questions drafted and committed. Ready for user research sessions."
```

---

## Verification

After completing all tasks:

1. Confirm document exists: `cat docs/user-research/post-interview-questions.md`
2. Confirm issue closed: `gh issue view 12`
3. Confirm commit in history: `git log --oneline -1`

---

## Notes

- These questions are for **manual user research sessions**, not in-app surveys
- Questions are intentionally open-ended to surface surprises
- Interviewer should adapt follow-up questions based on responses
- Consider recording sessions (with permission) for team review
