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

### H6: 7-Lens Value Discovery
**Status:** 🟢 Validated

**Belief:** We believe that applying 7 analytical lenses to crawled product content and converging their outputs produces a tiered catalog of value moments that match what a human product expert would identify.

**Because:** Value moments emerge at the intersection of multiple perspectives. A capability becomes valuable when it eliminates effort (Lens 2), compresses time (Lens 6), AND creates artifacts others can use (Lens 7). Convergence across lenses is signal; single-lens findings are noise.

**Test:**
- Run pipeline on Linear (reference case with existing product knowledge)
- 70%+ of Tier 1 moments (5+ lens convergence) rated "accurate" or "mostly accurate" by manual review
- Tier 1 moments are recognizable as "obviously important" to someone who knows the product

**Investment Area:** Measurement Foundation

**Evidence:**
- Feb 2026: Mission M003 created with 3 epics (Lens Execution, Validation & Convergence, Reference Comparison)
- Feb 2026: M003 completed - Linear analyzed with 7 lenses:
  - Total candidates: 102 across 7 lenses
  - After validation: 99 (3 duplicates removed)
  - Clusters formed: 36
  - Tier distribution: T1=6, T2=2, T3=28
- Feb 2026: Tier 1 accuracy: **83.3%** (5/6 accurate or mostly accurate)
  - ✓ Invisible progress → transparent metrics (accurate)
  - ✓ Ad hoc triage → structured intake (mostly accurate)
  - ✓ Balance new work vs tech debt (mostly accurate)
  - ✓ Scattered → integrated delivery (mostly accurate)
  - ✓ Manual sprint → automated cycles (mostly accurate)
  - ✗ Fragmented feedback → centralized insights (inaccurate)

**Outcome:** Validated. 7-lens convergence produces recognizable, "obviously important" value moments at 83.3% accuracy (exceeds 70% threshold).

---

## Validated Hypotheses

### H6: 7-Lens Value Discovery ✓
Applying 7 analytical lenses (Capability, Effort, Time, Artifact, Info, Decision, State) to crawled product content and converging outputs produces value moments that match human expert identification. Tested via M003 mission with Linear - 102 candidates across 7 lenses converged to 36 clusters with 6 Tier 1 moments at 83.3% accuracy (threshold: 70%).

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

**Build output layers (M004).** With H5 (multi-level activation) and H6 (7-lens value discovery) validated, next mission is generating actionable outputs: ICP profiles, activation maps, and measurement specs from the discovered value moments.
