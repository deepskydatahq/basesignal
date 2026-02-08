# M003 Validation Results — H6: 7-Lens Value Discovery

**Date:** 2026-02-07
**Product:** Linear (reference case)
**Model:** claude-haiku-4-5-20251001
**Similarity Threshold:** 0.15

---

## Lens Execution Summary

| Lens | Candidates |
|------|-----------|
| Capability Mapping | 15 |
| Effort Elimination | 14 |
| Time Compression | 15 |
| Artifact Creation | 15 |
| Information Asymmetry | 14 |
| Decision Enablement | 14 |
| State Transitions | 15 |
| **Total** | **102** |

---

## Clustering & Convergence

- **Total candidates (after validation):** 98
- **Clusters formed:** 32
- **Similarity threshold:** 0.15
- **Clustering method:** Greedy single-linkage with Jaccard word similarity, same-lens constraint

### Tier Distribution

| Tier | Min Lenses | Count |
|------|-----------|-------|
| Tier 1 (high convergence) | 5+ | 6 |
| Tier 2 (medium convergence) | 3-4 | 1 |
| Tier 3 (low convergence) | 1-2 | 25 |

---

## Tier 1 Moments — Detail

### 1. Manual status updates to real-time visibility

**Description:** Leadership and managers transition from requesting and compiling manual status reports to having automated, real-time visibility into project health, team throughput, and work distribution through dashboards. Before: status meetings and email updates; After: Insights, Initiatives, and project updates provide live data.
**Contributing lenses (7):** Capability Mapping, Effort Elimination, Time Compression, Artifact Creation, Information Asymmetry, Decision Enablement, State Transitions
**Best reference match:** REF-02 — Cycle Completion with Team Visibility
**Jaccard similarity:** 0.137
**Automated rating:** mostly accurate
**Human rating:** accurate — This directly captures Linear's core value prop: replacing status meetings with live project visibility. The description matches REF-02's "team sees progress without meetings" perfectly, but Jaccard underscores the match because the vocabulary differs (automated: "status reports", "dashboards" vs. reference: "cycles", "burndown").

### 2. Scattered feedback to connected insights

**Description:** Product teams transition from hunting for customer feedback across email, support tickets, and calls to having consolidated, actionable customer context directly linked to engineering work. Before: feedback fragmented and hard to access; After: customer signal flows into engineering decisions with clear patterns and business impact.
**Contributing lenses (7):** Artifact Creation, Information Asymmetry, Capability Mapping, Effort Elimination, Decision Enablement, State Transitions, Time Compression
**Best reference match:** REF-03 — Smart Triage Workflow
**Jaccard similarity:** 0.048
**Automated rating:** inaccurate
**Human rating:** mostly accurate — This captures Linear's Customer Asks / Insights feature, a genuine value moment not in our 6-item reference doc. The pipeline correctly identified a real value moment; the "inaccurate" automated rating reflects a gap in the reference doc rather than a pipeline failure. This moment IS recognizable as "obviously important" to a Linear power user.

### 3. Unvetted to intelligently routed work

**Description:** Teams transition from assigning work reactively or randomly to using AI-powered suggestions that intelligently route issues based on historical patterns, related work, and team expertise. Before: unclear who should own an issue; After: Triage Intelligence suggests assignees, projects, and labels.
**Contributing lenses (7):** Information Asymmetry, Effort Elimination, Time Compression, Capability Mapping, Artifact Creation, Decision Enablement, State Transitions
**Best reference match:** REF-03 — Smart Triage Workflow
**Jaccard similarity:** 0.077
**Automated rating:** inaccurate
**Human rating:** mostly accurate — Maps to REF-03 (Smart Triage Workflow) with an AI-specific angle. The core concept (intelligent routing of incoming work) matches triage. The AI framing is more specific than the reference but the value moment is the same: turning unstructured incoming work into assigned, prioritized tasks.

### 4. Slow migration to rapid switchover

**Description:** Teams transitioning from legacy systems (Jira, Azure DevOps) evolve from manual, time-consuming migrations to rapid, automated imports with optional bi-directional sync that keeps both systems aligned during transition. Before: months of manual data transfer; After: automated import with continuous sync.
**Contributing lenses (6):** Capability Mapping, Effort Elimination, Artifact Creation, Decision Enablement, State Transitions, Time Compression
**Best reference match:** REF-03 — Smart Triage Workflow
**Jaccard similarity:** 0.050
**Automated rating:** inaccurate
**Human rating:** inaccurate — Migration from Jira is a switching cost reducer, not a core product value moment. While important for adoption, it doesn't represent ongoing value that Linear delivers. The lenses over-weighted Linear's Jira import feature because the crawled pages included significant content about importing from Jira.

### 5. Disconnected code to linked execution

**Description:** Engineers transition from checking Linear separately from their code work to having automatic linkage where code branches, PRs, and commits automatically update Linear issue status, creating a unified work-to-code pipeline. Before: dual updating overhead; After: code changes drive issue flow.
**Contributing lenses (6):** Effort Elimination, Capability Mapping, Time Compression, Artifact Creation, Information Asymmetry, State Transitions
**Best reference match:** REF-05 — Development Tool Integration
**Jaccard similarity:** 0.092
**Automated rating:** mostly accurate
**Human rating:** accurate — This is a direct match for REF-05. The description captures the exact value: automatic status updates via PR/commit linkage, removing dual-update overhead. The framing as "disconnected code to linked execution" accurately describes the state transition.

### 6. Separate roadmaps to unified timelines

**Description:** Large organizations transition from multiple disconnected roadmaps (product roadmap, engineering roadmap, design roadmap) to a unified, cross-functional timeline where all initiatives and projects align and dependencies are visible. Before: roadmaps drift apart; After: single source of truth with cross-team visibility.
**Contributing lenses (5):** Capability Mapping, Time Compression, Decision Enablement, Effort Elimination, State Transitions
**Best reference match:** REF-04 — Roadmap-to-Issue Traceability
**Jaccard similarity:** 0.117
**Automated rating:** mostly accurate
**Human rating:** accurate — Maps directly to REF-04. The description captures the strategic-to-execution traceability that Linear's projects and initiatives provide. The "unified timelines" framing is a good characterization of what roadmap-to-issue linkage achieves.

---

## Tier 2 Moments — Summary

| Moment | Lenses | Contributing Lenses |
|--------|--------|---------------------|
| Reactive to proactive issue management | 3 | Capability Mapping, Artifact Creation, State Transitions |

---

## Accuracy Calculation

### Automated (Jaccard-based)

| Rating | Count |
|--------|-------|
| Accurate | 0 |
| Mostly Accurate | 3 |
| Inaccurate | 3 |
| **Total Tier 1** | **6** |

**Automated accuracy = (0 + 3) / 6 = 50.0%** (FAIL)

### Human-Reviewed (Final)

| Moment | Automated Rating | Human Rating | Reference Match |
|--------|-----------------|--------------|-----------------|
| Manual status updates to real-time visibility | mostly accurate | **accurate** | REF-02 |
| Scattered feedback to connected insights | inaccurate | **mostly accurate** | (beyond reference) |
| Unvetted to intelligently routed work | inaccurate | **mostly accurate** | REF-03 |
| Slow migration to rapid switchover | inaccurate | **inaccurate** | — |
| Disconnected code to linked execution | mostly accurate | **accurate** | REF-05 |
| Separate roadmaps to unified timelines | mostly accurate | **accurate** | REF-04 |

| Rating | Count |
|--------|-------|
| Accurate | 3 |
| Mostly Accurate | 2 |
| Inaccurate | 1 |
| **Total Tier 1** | **6** |

**Human accuracy = (3 + 2) / 6 = 83.3%** (PASS)

**Threshold:** 70%
**Result:** PASS (83.3% >= 70%)

---

## Lens Contribution Analysis

| Lens | Tier 1 Appearances | Contribution Rate |
|------|-------------------|-------------------|
| Capability Mapping | 6 | 100% |
| Effort Elimination | 6 | 100% |
| Time Compression | 6 | 100% |
| State Transitions | 6 | 100% |
| Artifact Creation | 5 | 83% |
| Decision Enablement | 5 | 83% |
| Information Asymmetry | 4 | 67% |

**Observations:**
- All 7 lenses contributed to Tier 1 moments — no lens was unproductive
- 4 lenses (Capability, Effort, Time, State) appeared in ALL Tier 1 moments — these are the "backbone" lenses
- Information Asymmetry had the lowest contribution but still appeared in 4/6 — it adds unique perspective rather than redundancy
- The high contribution rate across all lenses validates the multi-lens approach: value moments genuinely emerge at intersections

---

## Key Findings

### What worked well

1. **Lens execution produced high-quality candidates** — 102 candidates across 7 lenses, each providing distinct perspectives on the same product
2. **Convergence identified real value** — 5 of 6 Tier 1 moments are recognizable as "obviously important" to someone who knows Linear
3. **Multi-lens convergence is a valid signal** — the one inaccurate moment (migration) still had 6 lenses converge on it, but it represents a switching cost, not ongoing value. This suggests a refinement: convergence identifies "product concepts the lenses agree on" which mostly but not always equals "value moments"
4. **Pipeline found a value moment NOT in our reference** — "Scattered feedback to connected insights" (Customer Asks) is a real Linear value moment that the pipeline discovered independently

### What needs improvement

1. **Jaccard word similarity is too weak for clustering** — The optimal threshold (0.15) is much lower than expected (0.35). At 0.35, zero merges happened. The fundamental issue: different lenses deliberately use different vocabulary to describe the same concept (that's the point of multiple lenses), so word overlap is inherently low
2. **Jaccard is also too weak for reference comparison** — Automated accuracy was 50% vs. human 83.3%. The gap is entirely due to Jaccard failing to recognize semantic equivalence ("status updates to real-time visibility" ≈ "cycle completion with team visibility")
3. **Need semantic similarity** — Embeddings or LLM-based comparison would dramatically improve both clustering and reference comparison. Jaccard works for exact/near-exact matches but fails for the semantic relationships that matter here
4. **Migration as value moment** — The pipeline can't distinguish between "switching cost reduction" and "ongoing product value." This might need a filtering lens or post-processing step

---

## H6 Verdict

### VALIDATED

The 7-lens convergence pipeline achieved **83.3% accuracy** (human-reviewed) on Linear, exceeding the 70% threshold.

**Key evidence:**
- 6 Tier 1 moments generated, 5 rated accurate or mostly accurate
- Tier 1 moments match 4 of 6 reference moments (REF-02, REF-03, REF-04, REF-05)
- Pipeline independently discovered a real value moment (Customer Asks) not in reference
- All 7 lenses contributed meaningfully — no dead lenses

**Caveats:**
- Validated with human review, not fully automated — Jaccard-only scored 50%
- Full pipeline (E001/E002) should use embedding-based similarity, not Jaccard
- One false positive (migration) suggests need for post-processing value filter

**Recommendations for E001/E002 pipeline:**
1. Replace Jaccard with embedding-based similarity (cosine similarity on text embeddings)
2. Add a "value moment vs. feature/process" classification step after convergence
3. Consider hybrid approach: Jaccard for initial pass, LLM for borderline cases
4. Reference comparison should use LLM-based matching, not word overlap

---

*Generated by scripts/validate-h6.mjs on 2026-02-07, human-reviewed same day.*
