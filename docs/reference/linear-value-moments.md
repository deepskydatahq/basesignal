# Linear — Value Moments Reference

A structured reference of Linear's known value moments, authored from public product understanding, M002 activation analysis, and expert product knowledge. This document serves as the baseline for validating 7-lens pipeline output (H6 hypothesis).

---

### REF-01: Keyboard-First Speed

**Name:** Keyboard-First Speed

**Description:** Linear's interface is built around keyboard shortcuts and command palette (Cmd+K) interactions, enabling users to create issues, change status, assign, label, and navigate without reaching for the mouse. This speed advantage is felt immediately on first use and is a core differentiator from tools like Jira. The result is that issue management feels lightweight rather than burdensome, removing friction from the tracking process itself.

**Evidence:**
- Linear's marketing emphasizes "Built for speed" as a primary value proposition
- Command palette (Cmd+K) provides access to all actions without mouse navigation
- Keyboard shortcuts for every common action (C for new issue, S for status change, etc.)
- M002 activation L1 (explorer) maps here: users feel the speed advantage when creating their first issue

---

### REF-02: Cycle Completion with Team Visibility `[PRIMARY AHA-MOMENT]`

**Name:** Cycle Completion with Team Visibility

**Description:** Users plan work into time-boxed cycles (sprints), track issues through status transitions, and see the cycle progress as a team — all without status meetings. When a cycle completes, the team has shared evidence of what was accomplished, what carried over, and what the velocity looks like. This is the moment Linear "clicks": the tool replaces status meetings and spreadsheet tracking with live, always-current progress visibility.

**Evidence:**
- Cycle views show burndown, scope changes, and completion rates in real time
- Team members see each other's progress without asking — eliminates "what are you working on?" overhead
- Automatic cycle reports summarize what shipped, what moved, and what was cancelled
- M002 activation L3 (workflow_optimizer, strong signal) identified cycle completion + triage as the primary activation milestone

**Why primary:** This maps to M002's L2-to-L3 transition — the jump from individual learning (workflow_learner) to team-level optimization (workflow_optimizer). The aha-moment is not "I can track issues" (L1) but "my team can see progress without meetings" (L3). Cycle completion with visibility is where individual tool usage becomes team workflow, which is when Linear delivers its core promise.

---

### REF-03: Smart Triage Workflow

**Name:** Smart Triage Workflow

**Description:** Linear's triage inbox collects new issues, bug reports, and requests in a single queue that team leads can rapidly process — accepting into cycles, deferring to backlog, or declining. This structured triage prevents the backlog from becoming a graveyard of stale issues and keeps the team focused on what's actually planned. The triage view with keyboard shortcuts enables processing dozens of items in minutes.

**Evidence:**
- Dedicated triage view separates "new/unprocessed" from "planned" work
- Keyboard-driven accept/defer/decline workflow for rapid processing
- Teams report significantly reduced backlog noise after adopting triage
- M002 activation L3 (workflow_optimizer) includes use_triage as a key criterion alongside cycle completion

---

### REF-04: Roadmap-to-Issue Traceability

**Name:** Roadmap-to-Issue Traceability

**Description:** Linear connects high-level roadmap items (projects and initiatives) to the individual issues that implement them, creating a traceable chain from strategy to execution. Product managers can see how many issues in a project are done, in progress, or blocked — providing real-time project health without manual rollup. This bridges the gap between planning tools (where roadmaps live) and execution tools (where issues live).

**Evidence:**
- Projects group related issues with automatic progress calculation
- Initiatives group multiple projects for cross-team visibility
- Progress bars on projects reflect real-time issue completion
- Filters and views allow slicing by project, team, or initiative
- M002 activation L2 (workflow_learner) includes create_project as a key criterion — roadmap usage begins at the learning stage

---

### REF-05: Development Tool Integration

**Name:** Development Tool Integration

**Description:** Linear integrates with GitHub, GitLab, and Slack to automatically update issue status when PRs are opened, merged, or deployed. This removes the manual burden of keeping the tracker in sync with actual development activity. Developers can reference Linear issue IDs in branch names or PR titles and the system handles the rest — closing issues on merge, linking PRs to issues, and notifying relevant people via Slack.

**Evidence:**
- GitHub/GitLab integration auto-transitions issues on PR merge (e.g., "In Progress" to "Done")
- Branch name conventions (e.g., `tmo/lin-123-fix-bug`) auto-link PRs to issues
- Slack integration posts updates to channels and allows issue creation from messages
- M002 activation L4 (product_workflow_master) includes integrations as a criterion for the most advanced adoption stage

---

### REF-06: Ambient Team Awareness

**Name:** Ambient Team Awareness

**Description:** Through real-time syncing, activity feeds, and notification preferences, Linear creates ambient awareness of what the team is working on without requiring check-ins or standups. Team members passively absorb context — who picked up what issue, which priorities shifted, what shipped — through the tool's always-updating views. This multi-user dynamic is what makes Linear a team tool rather than a personal task manager.

**Evidence:**
- Real-time sync means all views update live as teammates make changes
- Activity feeds show issue transitions, comments, and assignments as they happen
- Custom notification settings let individuals tune signal-to-noise
- Workspace-level views (My Issues, Active Cycle, Backlog) provide different perspectives on team activity
- M002 activation L2 (workflow_learner) includes invite_team_member — team awareness begins when the second person joins

---

## Activation Level Mapping (M002)

The following table maps M002's extracted activation levels to the value moments documented above, providing context for how users progress through Linear's value delivery.

| Level | Name | Signal Strength | Key Criteria | Related Moments |
|-------|------|-----------------|--------------|-----------------|
| L1 | explorer | weak | create_first_issue | REF-01 (speed felt on first action) |
| L2 | workflow_learner | medium | create_project + invite_team_member | REF-04 (roadmap begins), REF-06 (team awareness starts) |
| L3 | workflow_optimizer | strong | complete_cycle + use_triage + resolve_bugs | REF-02 (primary aha-moment), REF-03 (triage mastery) |
| L4 | product_workflow_master | very_strong | cross_team + insights + integrations | REF-05 (dev tool integration), REF-06 (cross-team awareness) |

---

## Sources

- M002 Multi-Level Activation Discovery results (HYPOTHESES.md H2 evidence)
- Linear public website and product documentation
- General product knowledge of Linear's issue tracking and project management capabilities
