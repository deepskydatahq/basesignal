# Basesignal Hypotheses Catalog

**Vision:** Transform B2B SaaS measurement from interaction-driven to outcome-driven, revealing where products lose revenue potential.

**Last Updated:** February 2026

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
**Status:** 🟢 Validated

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
- Feb 2026: M002 completed - Linear profile extracted with 4 activation levels:
  - L1 explorer (weak): create_first_issue
  - L2 workflow_learner (medium): create_project + invite_team_member
  - L3 workflow_optimizer (strong) ⭐ PRIMARY: complete_cycle + use_triage + resolve_bugs
  - L4 product_workflow_master (very_strong): cross_team + insights + integrations
- Feb 2026: All test criteria met - 4 levels with measurable criteria, aha-moment correctly identified

**Outcome:** Validated. Multi-level activation produces actionable, nuanced understanding of user progression.

---

## Validated Hypotheses

### H5: Multi-Level Activation ✓
Modeling activation as a spectrum (weak → medium → strong → very_strong) produces more accurate and actionable product understanding than binary activation. Tested via M002 mission with Linear product - extracted 4 distinct levels with measurable criteria, correctly identifying L3 (workflow_optimizer) as the aha-moment.

---

## Invalidated Hypotheses

(none yet)

---

## Parked Hypotheses

(none yet)

---

## Next Action

**Test H6 via M003.** Build 7-lens execution pipeline, validation & convergence, and compare against Linear reference analysis. See `product/missions/M003-7-lens-value-discovery.toml` for mission details.
