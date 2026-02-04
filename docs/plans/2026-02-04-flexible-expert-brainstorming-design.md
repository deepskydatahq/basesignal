# Flexible Expert Brainstorming Design

## Overview

Replace the hardcoded expert personas in brainstorm-auto with a file-based expert catalog. Experts are stored as individual markdown files in `.claude/experts/`. The brainstormer agent selects which experts to consult based on the task, can bring in new experts mid-session, and picks its own reviewer from the catalog.

## Problem Statement

The current brainstorm-auto mode always uses three fixed experts: Butterfield (product), Abramov (technical), Jobs (simplification reviewer). This works well for general product tasks but is a poor fit for specialized work like AI engineering, UX design, data modeling, or security. There's no way to add new expert perspectives without editing the command file, and no way to vary the panel based on what the task actually needs.

## Expert Perspectives

### Product

The brainstorm-auto flow is one of the most valuable parts of the workflow — it forces structured thinking before implementation. Making the expert panel flexible increases that value without adding user-facing complexity. The user never has to pick experts; the system figures it out.

### Technical

The change is mostly a refactor: extract hardcoded strings into files, replace a type-based switch with a name-based lookup. The brainstormer agent prompt changes, but the orchestration flow stays the same. The expert agent prompt becomes a single generic template filled from file content.

### Simplification Review

The only new concept is the manifest (a table of expert names and domains injected into the brainstormer prompt). Everything else is removing code (hardcoded personas) and replacing it with file reads. The command gets shorter, not longer.

## Design

### Expert Catalog

Each expert is a markdown file at `.claude/experts/{slug}.md`. The filename is the expert's ID used for selection and routing.

```
.claude/experts/
├── product-strategist.md
├── technical-architect.md
├── simplification-reviewer.md
├── ai-engineer.md
├── ux-designer.md
├── data-modeler.md
└── ...
```

#### File Format

```markdown
# {Expert Name}

**Domain:** Comma-separated topic areas this expert covers
**Role:** One sentence describing what this expert does in a brainstorming session
**Type:** advisor | reviewer

**Philosophy:** "One defining quote or sentence that captures their worldview."

**Principles:**
- **Principle name** - Explanation
- **Principle name** - Explanation
- ...

**Response format:**
Instructions for how this expert should answer (length, tone, focus areas).
```

**Field definitions:**

- **Domain** — Topic keywords for the brainstormer to match against. Used in the manifest table.
- **Role** — One-line summary shown in the manifest. Helps the brainstormer decide who to consult.
- **Type** — `advisor` (consulted via questions during brainstorming) or `reviewer` (runs as a final pass on the completed design). An expert can serve as both; this signals the intended primary use.
- **Philosophy** — Core worldview injected into the expert agent prompt.
- **Principles** — Detailed thinking framework injected into the expert agent prompt.
- **Response format** — Controls answer style (length, tone, focus).

### Expert Selection

The brainstormer agent receives a manifest of all available experts at the start of each session — just domain, role, and type, not full content:

```
## Available Experts

| Expert | Domain | Role | Type |
|--------|--------|------|------|
| product-strategist | Product strategy, user value, prioritization | Answers product design questions | advisor |
| technical-architect | Architecture, patterns, implementation | Answers technical design questions | advisor |
| ai-engineer | AI/ML, LLM APIs, prompt design, RAG | Answers AI architecture questions | advisor |
| simplification-reviewer | Design review, simplification | Reviews designs for unnecessary complexity | reviewer |
```

The brainstormer selects experts organically:

- It picks initial experts based on the task content and the manifest.
- It can bring in additional experts mid-session as new topics arise.
- It picks a reviewer when completing the design.
- No hardcoded defaults — the brainstormer sees the full catalog and decides.

### Question Routing

Questions change from type-based to name-based:

```xml
<!-- Single expert -->
<question expert="product-strategist">What problem are we solving?</question>

<!-- Multiple experts (parallel, then synthesized) -->
<question expert="ai-engineer,technical-architect">Should we use structured output or parse free-form?</question>
```

Multi-expert questions launch all named experts in parallel. The command synthesizes their answers before passing back to the brainstormer.

### Reviewer Selection

The brainstormer specifies a reviewer when completing the design:

```xml
<design-complete reviewer="simplification-reviewer">
[Final design]
</design-complete>
```

The command loads that expert's file and runs the review step using its principles and response format.

### Expert Agent Prompt Template

One generic template replaces three hardcoded prompts:

```
Answer this question using the principles below.

<question>{question}</question>

## Context
{task context and prior discussion}

## Your Role
{expert.role}

## Philosophy
{expert.philosophy}

## Principles
{expert.principles}

## Response Format
{expert.response_format}
```

The reviewer uses the same template pattern but wrapped with the review-specific structure (design input, verdict/removal/simplification output format).

### Command Changes

The `brainstorm-auto.md` command changes:

1. **Startup:** Glob `.claude/experts/*.md`, read domain/role/type from each file, build manifest table. Full file contents loaded on demand.
2. **Brainstormer prompt:** Inject manifest. Remove hardcoded persona descriptions. Update question format documentation from type-based to name-based.
3. **Question routing:** Replace type-based switch (`product`/`technical`/`both`) with name-based lookup. Read full expert file on first use, cache for session.
4. **Expert agent:** Single generic prompt template filled from expert file fields.
5. **Reviewer step:** Read selected reviewer's file instead of always using Jobs prompt.
6. **Remove:** All hardcoded persona sections (~100 lines of prompts).

### Initial Expert Catalog

Migrate the three existing personas to files:

| File | Source | Type |
|------|--------|------|
| `product-strategist.md` | Butterfield persona | advisor |
| `technical-architect.md` | Abramov persona | advisor |
| `simplification-reviewer.md` | Jobs persona | reviewer |

### Brainstormer Agent Prompt Changes

The brainstormer prompt updates:

- Add: manifest table of available experts
- Add: instructions to select experts from the catalog based on the task
- Add: ability to request new experts mid-session
- Change: question format from `type="product|technical|both"` to `expert="{name}"` or `expert="{name1},{name2}"`
- Change: `<design-complete>` gains `reviewer="{name}"` attribute
- Remove: references to specific persona names (Butterfield, Abramov, Jobs)

## Alternatives Considered

**Predefined expert packs** — Groupings like `backend-pack`, `frontend-pack`. Rejected because it adds a maintenance burden (keeping packs in sync with catalog) and limits flexibility. The brainstormer makes better per-task choices than static groupings.

**Task-label-based selection** — Map labels to experts (e.g., `ai` label → ai-engineer expert). Rejected because it requires the task creator to know which experts exist and manually tag tasks. Pushes complexity to the wrong place.

**Hardcoded defaults with override** — Keep the three defaults, allow overrides via task metadata. Rejected because it's a half-measure that doesn't solve the maintenance problem and adds complexity (two selection paths).

## Success Criteria

- Expert files in `.claude/experts/` are the single source of truth for all personas
- Adding a new expert requires only creating a new markdown file
- The brainstormer selects relevant experts without manual tagging or configuration
- The brainstorm-auto command has no hardcoded persona content
- Existing workflow (`brainstorm-issues.sh`, task label transitions) is unchanged
- The three original experts produce equivalent quality results when selected
