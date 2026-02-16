# CI, Issue Templates, and Release Automation Design

**Date:** 2026-02-15
**Status:** Draft
**Story:** M008-E006-S005
**Task:** basesignal-x06

## Overview

Design GitHub Actions CI, issue templates, PR template, and tag-triggered release automation for the Basesignal open source monorepo. This story depends on M008-E006-S001 (README/LICENSE/CONTRIBUTING) and sits within the broader M008 Open Source Foundation mission.

The packages directory does not exist yet (it will be created by earlier M008 epics: E001-E005). This design must anticipate the monorepo workspace structure while remaining useful for the current single-package state.

## Current State

- **Existing CI:** `.github/workflows/ci.yml` already exists with a single Node 20 job that runs lint, typecheck, build, and test
- **No release workflow**, no issue templates, no PR template
- **No packages/ directory yet** -- the monorepo workspace structure is planned but not implemented
- **No npm workspaces** configured in root `package.json`
- **Test command:** `npm test -- --run` (Vitest)
- **Build command:** `npm run build` (tsc + vite)
- **Lint command:** `npm run lint` (ESLint 9)

## Design Decisions

### Decision 1: Node Matrix -- Start Narrow

**Decision:** Matrix test on Node 20 and 22 only. Drop Node 18.

**Rationale:** Node 18 reached end-of-life in April 2025. Testing against it adds CI minutes for a version that should not be supported in new open source projects. Node 20 is the current LTS (until April 2026), Node 22 is the next LTS. Two versions provide compatibility confidence without waste.

If a downstream user specifically needs Node 18, we can revisit, but defaulting to dead runtimes is anti-pattern.

### Decision 2: Caching -- Use setup-node Built-in Cache

**Decision:** Use `actions/setup-node@v4` with `cache: 'npm'`. Do not add custom caching for `node_modules`.

**Rationale:** `setup-node` already caches the npm download cache (`~/.npm`). Custom `node_modules` caching adds complexity (invalidation, lockfile hashing) for marginal benefit. The npm download cache means `npm ci` only needs to extract, not download. For a monorepo that is not enormous, this is sufficient.

If CI times grow beyond 5 minutes, revisit with `actions/cache` for `node_modules` as a targeted optimization.

### Decision 3: Changesets for Version Management

**Decision:** Use [Changesets](https://github.com/changesets/changesets) for version management and release.

**Rationale:**
- **Manual versioning** breaks down in monorepos. Forgetting to bump a version, or bumping the wrong one, is a guaranteed failure mode.
- **Lerna** is heavy and opinionated. Changesets is smaller and composes better.
- **How it works:** Contributors add a changeset file (via `npx changeset`) describing what changed and the semver bump type. On merge to main, a GitHub Action opens a "Version Packages" PR that bumps versions and updates changelogs. Merging that PR triggers publish.
- **Escape hatch:** Changesets are just markdown files in `.changeset/`. If we outgrow it, migration is trivial.
- **Trade-off:** Adds a step to the contributor workflow (running `npx changeset`). But this is a feature, not a bug -- it forces contributors to think about semver impact.

### Decision 4: Two-Workflow Release (Not Tag-Triggered)

**Decision:** Use the Changesets two-workflow pattern instead of raw tag-triggered publish.

**Rationale:** The story specifies "tag-triggered npm publish," but Changesets provides a better model:

1. **CI workflow** (on push/PR): test, build, typecheck, lint
2. **Release workflow** (on push to main): runs `changesets/action` which either (a) opens a "Version Packages" PR if there are pending changesets, or (b) publishes to npm and creates GitHub releases if versions were just bumped

This is safer than raw tag-push because:
- Version bumps, changelog updates, and git tags happen atomically
- No risk of publishing a version that doesn't match the code
- GitHub Releases are created automatically with changeset content

**Fallback:** If the team decides Changesets is too much ceremony for the initial release, a simplified tag-triggered workflow is provided as Alternative B below.

### Decision 5: Issue Templates -- YAML Form-Based

**Decision:** Use GitHub's YAML-based issue forms (not markdown templates).

**Rationale:** YAML forms provide structured input with dropdowns, required fields, and validation. They produce better-formatted issues than freeform markdown. Three templates:

1. **Bug Report** -- reproduction steps, expected/actual behavior, environment
2. **Feature Request** -- use case, proposed solution
3. **New Crawler Proposal** -- source type, URL pattern, expected data structure

Plus a `config.yml` to add a "Question" link pointing to GitHub Discussions (avoids issues being used as a support channel).

### Decision 6: Minimal PR Template

**Decision:** A short PR template with three sections: What, Why, and Testing.

**Rationale:** Long PR templates get ignored. Short ones get filled in. Three questions are enough to ensure reviewers have context without creating busywork.

---

## Implementation Spec

### 1. CI Workflow (`.github/workflows/ci.yml`)

Replace the existing file:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20, 22]
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npx tsc --noEmit

      - name: Build
        run: npm run build

      - name: Test
        run: npm test -- --run
```

**Key changes from existing:**
- Added Node version matrix (20, 22)
- Added `concurrency` to cancel stale runs on force-push
- Renamed job from `build` to `test` (it does more than build)

**Future monorepo adaptation:** When `packages/` exists with npm workspaces, `npm ci`, `npm run build`, and `npm test` will automatically operate on all workspaces. No workflow changes needed -- the workspace config in `package.json` handles it.

### 2. Release Workflow (`.github/workflows/release.yml`)

#### Option A: Changesets (Recommended)

```yaml
name: Release

on:
  push:
    branches: [main]

concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Create Release Pull Request or Publish
        uses: changesets/action@v1
        with:
          publish: npx changeset publish
          title: 'chore: version packages'
          commit: 'chore: version packages'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Required setup:**
- `npm install -D @changesets/cli @changesets/changelog-github`
- `npx changeset init` (creates `.changeset/config.json`)
- Add `NPM_TOKEN` to repository secrets

**Changeset config (`.changeset/config.json`):**

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.1/schema.json",
  "changelog": ["@changesets/changelog-github", { "repo": "deepskydatahq/basesignal" }],
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

#### Option B: Tag-Triggered (Simpler Fallback)

If Changesets is deferred, use this minimal tag-triggered workflow:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Test
        run: npm test -- --run

      - name: Publish packages
        run: |
          for dir in packages/*/; do
            if [ -f "$dir/package.json" ]; then
              cd "$dir"
              npm publish --access public
              cd -
            fi
          done
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
```

**Recommendation:** Start with Option A (Changesets). It is slightly more setup but fundamentally safer for multi-package publishing. Option B is the escape hatch if Changesets proves wrong.

### 3. Issue Templates

#### `.github/ISSUE_TEMPLATE/bug-report.yml`

```yaml
name: Bug Report
description: Report something that isn't working correctly
labels: ["bug"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for reporting a bug. Please fill in the details below.

  - type: textarea
    id: description
    attributes:
      label: What happened?
      description: A clear description of the bug.
      placeholder: When I run `basesignal scan example.com`, I get...
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: What did you expect?
      placeholder: I expected the scan to complete and produce a product profile.
    validations:
      required: true

  - type: textarea
    id: reproduction
    attributes:
      label: Steps to reproduce
      description: Minimal steps to reproduce the behavior.
      placeholder: |
        1. Install basesignal v0.1.0
        2. Run `basesignal scan https://example.com`
        3. See error
    validations:
      required: true

  - type: input
    id: version
    attributes:
      label: Version
      description: Output of `basesignal --version` or package version
      placeholder: "0.1.0"
    validations:
      required: true

  - type: dropdown
    id: node-version
    attributes:
      label: Node.js version
      options:
        - "20"
        - "22"
        - Other
    validations:
      required: true

  - type: dropdown
    id: os
    attributes:
      label: Operating system
      options:
        - macOS
        - Linux
        - Windows
        - Docker
    validations:
      required: true

  - type: textarea
    id: additional
    attributes:
      label: Additional context
      description: Logs, screenshots, or anything else that helps.
```

#### `.github/ISSUE_TEMPLATE/feature-request.yml`

```yaml
name: Feature Request
description: Suggest an improvement or new capability
labels: ["enhancement"]
body:
  - type: textarea
    id: use-case
    attributes:
      label: Use case
      description: What are you trying to accomplish? Focus on the problem, not the solution.
      placeholder: When analyzing a SaaS product, I want to...
    validations:
      required: true

  - type: textarea
    id: proposed-solution
    attributes:
      label: Proposed solution
      description: How do you think this could work? (Optional but helpful)

  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives considered
      description: What else have you tried or considered?
```

#### `.github/ISSUE_TEMPLATE/new-crawler.yml`

```yaml
name: New Crawler Proposal
description: Propose a new data source crawler
labels: ["crawler", "enhancement"]
body:
  - type: markdown
    attributes:
      value: |
        Proposing a new crawler? Great! See [CONTRIBUTING.md](../CONTRIBUTING.md) for how crawlers work.

  - type: input
    id: source-name
    attributes:
      label: Data source name
      placeholder: "e.g., ProductHunt, G2, Crunchbase"
    validations:
      required: true

  - type: dropdown
    id: source-type
    attributes:
      label: Source type
      options:
        - Website (public HTML)
        - API (authenticated)
        - API (public)
        - App store listing
        - Other
    validations:
      required: true

  - type: input
    id: url-pattern
    attributes:
      label: URL pattern or API endpoint
      placeholder: "https://www.producthunt.com/products/{slug}"
    validations:
      required: true

  - type: textarea
    id: data-available
    attributes:
      label: What data is available?
      description: What product information can be extracted from this source?
      placeholder: |
        - Product description
        - Pricing tiers
        - Feature list
        - User reviews/ratings
    validations:
      required: true

  - type: textarea
    id: why
    attributes:
      label: Why is this source valuable?
      description: How does this data improve product profile analysis?
    validations:
      required: true

  - type: checkboxes
    id: contribution
    attributes:
      label: Would you like to implement this?
      options:
        - label: I'm willing to submit a PR for this crawler
```

#### `.github/ISSUE_TEMPLATE/config.yml`

```yaml
blank_issues_enabled: false
contact_links:
  - name: Question or Discussion
    url: https://github.com/deepskydatahq/basesignal/discussions
    about: Ask questions and discuss ideas in GitHub Discussions
```

### 4. PR Template (`.github/PULL_REQUEST_TEMPLATE.md`)

```markdown
## What

<!-- What does this PR do? One sentence. -->

## Why

<!-- Why is this change needed? Link to issue if applicable. -->

## Testing

<!-- How did you verify this works? -->

- [ ] Tests pass (`npm test -- --run`)
- [ ] Builds clean (`npm run build`)
```

### 5. Recommended Labels

Create these labels (can be done via `gh label create` or manually):

| Label | Color | Description |
|-------|-------|-------------|
| `bug` | `#d73a4a` | Something isn't working |
| `enhancement` | `#a2eeef` | New feature or request |
| `crawler` | `#0075ca` | Related to data source crawlers |
| `storage` | `#e4e669` | Related to storage adapters |
| `documentation` | `#0075ca` | Documentation improvements |
| `good first issue` | `#7057ff` | Good for newcomers |

These are standard GitHub labels; most already exist by default. Only `crawler`, `storage`, and `good first issue` need explicit creation.

---

## Expert Review

### Technical Architect Review

**Start with why:** The current single-job CI already works. The real value-add here is (1) preparing for multi-package publishing with Changesets, (2) structured issue intake via templates, and (3) Node version matrix for open-source compatibility confidence.

**Minimal API surface:** The CI workflow is one file with one job. The release workflow is one file with one job. Issue templates are declarative YAML. Nothing here requires custom Actions or complex scripting.

**Composition over configuration:** Changesets composes well -- each changeset is an independent file, and the release action composes `version` + `publish` into a single step. If we outgrow it, the changeset files are just markdown and can be processed by any tool.

**Escape hatch:** Option B (tag-triggered) is explicitly provided. The monorepo loop (`for dir in packages/*/`) is deliberately simple shell, not a framework.

### Simplification Reviewer

**What would I remove?**
- ~~FUNDING.yml~~ -- removed. Not essential for launch. Add later if sponsorship is wanted.
- ~~Dependabot config~~ -- not in scope, don't add it preemptively.
- ~~Code coverage reporting~~ -- adds CI complexity for a metric that does not drive quality.
- ~~E2E tests in CI~~ -- the story says "tests for all packages." Playwright E2E is a separate concern; add it when E2E is a real bottleneck.
- Node 18 from matrix -- dead runtime, removed.

**Is every component essential?**
- CI workflow: Yes (core gate for PRs)
- Release workflow: Yes (publishing is the point of open source)
- Bug report template: Yes (structured intake prevents triage waste)
- Feature request template: Yes (same reason)
- Crawler proposal template: Yes (this is a key extension point, specific template saves back-and-forth)
- PR template: Yes (three lines, near-zero cost)
- Config.yml (blank issues disabled): Yes (forces structured intake)
- Labels: Minimal set, all essential for triage

**Verdict: APPROVED.** The design is tight. No bloat detected. The Changesets decision adds the only real complexity, and it is justified by the multi-package publishing problem it solves. The fallback option shows the team has an exit.

---

## Implementation Order

1. Update `.github/workflows/ci.yml` (replace existing)
2. Create `.github/ISSUE_TEMPLATE/bug-report.yml`
3. Create `.github/ISSUE_TEMPLATE/feature-request.yml`
4. Create `.github/ISSUE_TEMPLATE/new-crawler.yml`
5. Create `.github/ISSUE_TEMPLATE/config.yml`
6. Create `.github/PULL_REQUEST_TEMPLATE.md`
7. Install Changesets: `npm install -D @changesets/cli @changesets/changelog-github`
8. Initialize Changesets: `npx changeset init`, then edit config
9. Create `.github/workflows/release.yml`
10. Create labels via `gh label create`
11. Add `NPM_TOKEN` to repository secrets (manual step, document in CONTRIBUTING.md)

## Files Created/Modified

| File | Action |
|------|--------|
| `.github/workflows/ci.yml` | Modify (add matrix, concurrency) |
| `.github/workflows/release.yml` | Create |
| `.github/ISSUE_TEMPLATE/bug-report.yml` | Create |
| `.github/ISSUE_TEMPLATE/feature-request.yml` | Create |
| `.github/ISSUE_TEMPLATE/new-crawler.yml` | Create |
| `.github/ISSUE_TEMPLATE/config.yml` | Create |
| `.github/PULL_REQUEST_TEMPLATE.md` | Create |
| `.changeset/config.json` | Create (via `npx changeset init` + edit) |
| `package.json` | Modify (add `@changesets/cli` and `@changesets/changelog-github` to devDependencies) |

## Acceptance Criteria Mapping

| Criterion | Satisfied By |
|-----------|-------------|
| CI runs tests for all packages on push and PR | CI workflow with matrix, `npm test -- --run` |
| CI builds all packages and verifies TypeScript compilation | CI workflow: `npm run build` + `npx tsc --noEmit` |
| Issue templates for bug, feature, crawler | Three YAML form templates in `.github/ISSUE_TEMPLATE/` |
| Release workflow publishes to npm on version tag push | Release workflow with Changesets (or tag-triggered fallback) |
| CI passes on current codebase | Verified during implementation |
| Issue templates render correctly on GitHub | Verified manually after push |
