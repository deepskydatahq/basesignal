# Session Recording Setup for User Tests - Implementation Plan

> **For Claude:** This is an operational setup task, not code implementation. Follow tasks sequentially to complete the setup.

**Goal:** Prepare recording infrastructure to capture user sessions during H2: Interview Completion testing.

**Architecture:** External tooling (Loom/Zoom) for session recording with manual moderation, consent language in test script, no code changes needed.

**Context:** Part of Epic #9: Test H2 - Interview Completion. Recording is for observing where users hesitate, get confused, or drop off during guided interviews.

---

## Background Analysis

### Why External Recording (Not Code)

The codebase already captures interview transcripts in `interviewMessages` table. For H2 validation we need:
- **What we have:** Complete text transcript of AI-user conversation
- **What we need:** Ability to observe user behavior (hesitations, confusion, facial expressions)

External screen recording (Loom/Zoom) is the right choice because:
1. Interview transcript already captured in database
2. No code changes = no deployment risk before user tests
3. Easy to set up and iterate
4. Standard practice for user research

### Recording Method Recommendation

| Method | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **Loom** | Async, easy sharing, transcription | Requires user install | Best for remote async |
| **Zoom** | Native recording, familiar, live | Requires scheduling | Best for live moderated |
| **Google Meet** | Free, easy access | Less reliable recording | Backup option |

**Primary: Zoom** - Allows real-time observation + recording + Q&A
**Backup: Loom** - For participants who prefer async

---

## Tasks

### Task 1: Choose Recording Method

**Decision:** Use Zoom as primary method

**Rationale:**
- Live moderation allows follow-up questions
- Built-in recording to cloud
- Participants already familiar
- Can observe real-time reactions

**Alternative:** Loom for participants who prefer async (provide instructions)

**Done:** This task is complete - Zoom selected.

---

### Task 2: Prepare Zoom Recording Configuration

**Step 1: Enable cloud recording in Zoom settings**

1. Go to Zoom web portal → Settings → Recording
2. Enable "Cloud recording"
3. Enable "Record active speaker with shared screen"
4. Enable "Audio transcript"
5. Disable "Record thumbnails when sharing" (privacy)

**Step 2: Test recording settings**

1. Start a test meeting
2. Share screen (simulate user sharing their screen)
3. Record for 2-3 minutes
4. End meeting and verify:
   - Video quality is readable
   - Audio is clear
   - Screen share is captured
   - Transcript generated

**Step 3: Document verified settings**

Create file: `docs/user-testing/recording-checklist.md` with:
- Zoom settings screenshot or list
- Quality verification results
- Any adjusted settings

---

### Task 3: Create Test Recording

**Step 1: Simulate a complete user test session**

1. Start Zoom meeting with recording enabled
2. Open Basesignal in browser
3. Navigate to interview flow
4. Complete 3-5 minutes of the interview
5. Narrate as if you were a user (think-aloud protocol)
6. Stop recording

**Step 2: Review recording quality**

Verify:
- [ ] Screen is readable at 720p
- [ ] Audio is clear and understandable
- [ ] Transcript accurately captures speech
- [ ] Recording file size is manageable (<100MB for 15min)

**Step 3: Document results**

Add to `docs/user-testing/recording-checklist.md`:
- Test recording date
- Quality assessment
- Any issues discovered
- Recommended setup for moderator

---

### Task 4: Prepare Consent Language

**Step 1: Create consent script**

Create file: `docs/user-testing/consent-script.md`

```markdown
# User Test Consent Script

## Before Starting

Read this to participant before beginning:

---

"Thank you for participating in this user test. Before we begin, I need to share some information:

**What we're testing:** We're testing a product interview feature, not testing you. There are no wrong answers.

**Recording:** With your permission, I'll record this session. The recording will capture:
- Your screen as you use the product
- Audio of our conversation
- Any thoughts you share out loud

**How we'll use it:** The recording helps our team understand where the product can improve. It will only be viewed by the Basesignal team and will not be shared publicly.

**Privacy:** Your personal information and any sensitive data you mention will be kept confidential. We may use anonymized quotes or observations in our internal documentation.

**Your rights:** You can stop the session at any time. You can ask us to delete the recording afterward.

Do you have any questions? Do I have your permission to record this session?"

---

## Verbal Consent Confirmation

[ ] Participant verbally confirmed consent
[ ] Recording started after consent received

## Notes

- Date: ___________
- Participant ID: ___________
- Moderator: ___________
```

**Step 2: Create short-form consent for calendar invite**

Add to `docs/user-testing/consent-script.md`:

```markdown
## Calendar Invite Text

Include in meeting invite description:

---

Thanks for agreeing to help us test Basesignal! Here's what to expect:

- Duration: ~20 minutes
- You'll share your screen and walk through a product interview
- We'll record the session (with your permission) for our team to review
- No preparation needed - we want to see your genuine first impressions

If you have questions beforehand, reply to this invite.

---
```

---

### Task 5: Create Moderator Guide

**Step 1: Create moderator checklist**

Create file: `docs/user-testing/moderator-guide.md`

```markdown
# User Test Moderator Guide

## Pre-Session Setup (5 min before)

- [ ] Zoom recording enabled
- [ ] Basesignal app accessible (provide URL in chat)
- [ ] Consent script ready
- [ ] Note-taking document open
- [ ] Timer ready for 15-minute interview

## Session Flow

### 1. Welcome (2 min)
- Thank participant
- Read consent script
- Get verbal permission to record
- Start recording

### 2. Context (1 min)
- "We're testing a guided interview feature"
- "Think out loud - share what you're thinking as you go"
- "There are no wrong answers"

### 3. Task (15 min)
- Send Basesignal URL in chat
- "Please share your screen when ready"
- "Go ahead and start the interview"

Observation notes:
- Where do they hesitate?
- What questions do they re-read?
- Where do they seem confused?
- When do they seem engaged?

### 4. Debrief (5 min)
- "What was that experience like for you?"
- "Was anything confusing or frustrating?"
- "What would make this better?"
- "Any other thoughts?"

### 5. Wrap-Up (1 min)
- Thank participant
- Stop recording
- Share any next steps

## Post-Session

- [ ] Verify recording saved
- [ ] Add observation notes to shared doc
- [ ] Note completion status (completed/dropped/technical issue)
```

---

### Task 6: Test End-to-End Setup

**Step 1: Run a mock user test**

1. Recruit internal team member (not involved in feature)
2. Run through entire flow:
   - Send calendar invite with consent text
   - Start Zoom, get consent, record
   - Have them complete interview
   - Run debrief questions
   - Stop recording
3. Review recording together

**Step 2: Document any adjustments**

Update guides based on mock run:
- Timing adjustments
- Script improvements
- Technical issues discovered

---

### Task 7: Commit Documentation

**Step 1: Create user-testing docs directory**

```bash
mkdir -p docs/user-testing
```

**Step 2: Verify all files created**

- [ ] `docs/user-testing/recording-checklist.md`
- [ ] `docs/user-testing/consent-script.md`
- [ ] `docs/user-testing/moderator-guide.md`

**Step 3: Commit**

```bash
git add docs/user-testing/
git commit -m "docs: add user testing infrastructure for H2 validation

- Recording setup checklist for Zoom
- Consent script with verbal confirmation
- Moderator guide with session flow

Part of epic #9: Test H2 - Interview Completion"
```

---

## Done Criteria Verification

- [x] Recording method chosen: **Zoom (primary), Loom (backup)**
- [ ] Test recording completed: **Task 3**
- [ ] Consent language prepared: **Task 4**

---

## File Summary

| File | Purpose |
|------|---------|
| `docs/user-testing/recording-checklist.md` | Zoom setup & quality verification |
| `docs/user-testing/consent-script.md` | Verbal consent + calendar invite text |
| `docs/user-testing/moderator-guide.md` | Full session flow for test conductor |
