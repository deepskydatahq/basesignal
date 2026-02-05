# Basesignal Hypotheses Catalog

**Vision:** Transform B2B SaaS measurement from interaction-driven to outcome-driven, revealing where products lose revenue potential.

**Last Updated:** January 2026

---

## Active Hypotheses

### H1: Opinionated Outputs
**Status:** 🟡 Untested (implemented, awaiting user feedback)

**Belief:** We believe that opinionated, AI-generated measurement plans will be good enough to use without major edits.

**Because:** Users are stuck because they don't know where to start. A "good enough" default beats a blank page. 80% right is better than endlessly customizable.

**Test:** 3 of 5 users say they would use the generated plan as-is or with minor tweaks.

**Investment Area:** Measurement Foundation

**Evidence:**
- (none yet)

**Next Steps:** If validated, focus on export formats. If invalidated, identify what's missing or wrong.

---

### H2: Interview Completion
**Status:** 🔵 Testing

**Belief:** We believe users will complete a 15-minute guided interview without dropping off.

**Because:** The interview is conversational (not form-driven) and users get immediate value from seeing their journey visualized as they go.

**Test:** 4 of 5 test users complete the interview without abandoning.

**Investment Area:** Interview Completion

**Evidence:**
- Jan 2026: Epic created (#9) with 7 tasks

**Next Steps:** If validated, proceed to onboard more users. If invalidated, identify friction points and simplify.

---

### H3: Concept Clarity
**Status:** 🟡 Untested

**Belief:** We believe users will understand concepts like "First Value" and "outcome-driven tracking" without extensive education.

**Because:** The interview teaches as it guides—users learn by doing, not by reading documentation.

**Test:** Users can explain their First Value moment in their own words after completing the interview.

**Investment Area:** Interview Completion

**Evidence:**
- (none yet)

**Next Steps:** If validated, current education approach is sufficient. If invalidated, add contextual help or simplify terminology.

---

### H4: Tracking Gap Motivation
**Status:** 🟡 Untested (stretch goal—test after H1-H3)

**Belief:** We believe that showing users the gap between current tracking and the measurement plan will motivate them to implement changes.

**Because:** Making the gap visible and quantifiable ("you're tracking 4 of 12 recommended events") creates urgency.

**Test:** 2 of 5 users say they plan to update their tracking based on the gap analysis.

**Investment Area:** Analytics Integration (stretch)

**Evidence:**
- (none yet)

**Next Steps:** If validated, expand integration options. If invalidated, explore other value props for connecting analytics.

---

### H5: Multi-Level Activation
**Status:** 🔵 Testing

**Belief:** We believe that modeling activation as a spectrum (multiple levels from weak to strong signals) rather than a single binary definition will produce more accurate and actionable product understanding.

**Because:** User behavior exists on a continuum. A user who creates a board (weak signal) is less activated than one who shares it with collaborators (strong signal). Binary activation misses this nuance and treats vastly different behaviors as equivalent.

**Test:**
- AI can infer 3-4 distinct activation levels from crawled product content with >70% confidence
- Each level has measurable criteria (action + count + timeframe)
- Levels correctly identify the product's "aha moment" (e.g., for Miro, collaboration is the strong signal)

**Investment Area:** Measurement Foundation

**Evidence:**
- Feb 2026: Miro profile generated with single-level activation; user identified opportunity for multi-level modeling
- Feb 2026: Mission M002 created to test multi-level activation discovery

**Next Steps:** If validated, extend to other lifecycle definitions (active, at-risk, churn). If invalidated, determine if the data sources are insufficient or the model is wrong.

---

## Validated Hypotheses

(none yet)

---

## Invalidated Hypotheses

(none yet)

---

## Parked Hypotheses

(none yet)

---

## Next Action

**Work through epic #9.** Deploy to staging, recruit test users, run sessions. See [Epic: Test H2 - Interview Completion](https://github.com/deepskydatahq/basesignal/issues/9) for task breakdown.
