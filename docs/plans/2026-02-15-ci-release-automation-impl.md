# Implementation Plan: GitHub Actions CI, Issue Templates, and Release Automation

**Task:** basesignal-x06 (M008-E006-S005)
**Depends on:** M008-E006-S001 (README/LICENSE/CONTRIBUTING)

## Goal

Replace the existing single-job CI workflow with a Node version matrix and concurrency control. Add YAML-based issue templates (bug report, feature request, new crawler proposal), a PR template, and a Changesets-based release workflow for automated versioning and npm publishing.

## Prerequisites

- M008-E006-S001 must be complete (CONTRIBUTING.md exists for cross-references from templates)
- Repository secrets: `NPM_TOKEN` must be added manually after implementation

## Files to Create/Modify

| File | Action |
|------|--------|
| `.github/workflows/ci.yml` | Modify (add matrix, concurrency, rename job) |
| `.github/workflows/release.yml` | Create |
| `.github/ISSUE_TEMPLATE/bug-report.yml` | Create |
| `.github/ISSUE_TEMPLATE/feature-request.yml` | Create |
| `.github/ISSUE_TEMPLATE/new-crawler.yml` | Create |
| `.github/ISSUE_TEMPLATE/config.yml` | Create |
| `.github/PULL_REQUEST_TEMPLATE.md` | Create |
| `.changeset/config.json` | Create (via `npx changeset init` + edit) |
| `package.json` | Modify (devDependencies: add `@changesets/cli`, `@changesets/changelog-github`) |
| `package-lock.json` | Modify (auto-updated by npm install) |

## Implementation Steps

### Step 1: Update `.github/workflows/ci.yml`

Replace the existing CI workflow with the version from the design doc. Three changes from the current file:

1. **Add Node version matrix** (20 and 22) to the `strategy` block
2. **Add concurrency group** (`ci-${{ github.ref }}` with `cancel-in-progress: true`) to cancel stale runs on force-push
3. **Rename job** from `build` to `test` (the job does lint, typecheck, build, and test -- not just build)

Full replacement content:

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

The step names and commands remain identical to the existing workflow. Only the matrix, concurrency, and job name change.

### Step 2: Create `.github/ISSUE_TEMPLATE/bug-report.yml`

Create the directory `.github/ISSUE_TEMPLATE/` and add the bug report template as specified in the design doc. Key fields:

- **What happened?** (textarea, required)
- **What did you expect?** (textarea, required)
- **Steps to reproduce** (textarea, required)
- **Version** (input, required)
- **Node.js version** (dropdown: 20, 22, Other -- required)
- **Operating system** (dropdown: macOS, Linux, Windows, Docker -- required)
- **Additional context** (textarea, optional)

Labels auto-applied: `["bug"]`

Use the exact YAML from the design doc section 3, `.github/ISSUE_TEMPLATE/bug-report.yml`.

### Step 3: Create `.github/ISSUE_TEMPLATE/feature-request.yml`

Feature request template with three fields:

- **Use case** (textarea, required) -- focuses on the problem, not the solution
- **Proposed solution** (textarea, optional)
- **Alternatives considered** (textarea, optional)

Labels auto-applied: `["enhancement"]`

Use the exact YAML from the design doc section 3, `.github/ISSUE_TEMPLATE/feature-request.yml`.

### Step 4: Create `.github/ISSUE_TEMPLATE/new-crawler.yml`

Crawler proposal template with fields:

- **Data source name** (input, required)
- **Source type** (dropdown: Website, API authenticated, API public, App store, Other -- required)
- **URL pattern or API endpoint** (input, required)
- **What data is available?** (textarea, required)
- **Why is this source valuable?** (textarea, required)
- **Would you like to implement this?** (checkbox, optional)

Labels auto-applied: `["crawler", "enhancement"]`

Includes a markdown intro linking to CONTRIBUTING.md.

Use the exact YAML from the design doc section 3, `.github/ISSUE_TEMPLATE/new-crawler.yml`.

### Step 5: Create `.github/ISSUE_TEMPLATE/config.yml`

Disable blank issues and add a contact link to GitHub Discussions:

```yaml
blank_issues_enabled: false
contact_links:
  - name: Question or Discussion
    url: https://github.com/deepskydatahq/basesignal/discussions
    about: Ask questions and discuss ideas in GitHub Discussions
```

This prevents unstructured issues from being filed and routes support questions to Discussions.

### Step 6: Create `.github/PULL_REQUEST_TEMPLATE.md`

Minimal three-section template:

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

### Step 7: Install Changesets dependencies

Run:

```bash
npm install -D @changesets/cli @changesets/changelog-github
```

This modifies `package.json` (adds two devDependencies) and `package-lock.json`.

### Step 8: Initialize Changesets and configure

Run:

```bash
npx changeset init
```

This creates `.changeset/config.json` and `.changeset/README.md`.

Then edit `.changeset/config.json` to match the design doc configuration:

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

Key settings:
- `changelog`: Uses `@changesets/changelog-github` to auto-link PRs and contributors in changelogs
- `commit: false`: Changesets action handles commits, not the CLI
- `access: "public"`: All packages publish as public npm packages
- `baseBranch: "main"`: Release workflow runs on main

### Step 9: Create `.github/workflows/release.yml`

Use Option A (Changesets) from the design doc:

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

Note: `cancel-in-progress: false` for the release workflow (unlike CI) because canceling a publish mid-way could leave packages in an inconsistent state.

### Step 10: Create GitHub labels

Run the following commands to create labels that do not exist by default:

```bash
gh label create "crawler" --color "0075ca" --description "Related to data source crawlers"
gh label create "storage" --color "e4e669" --description "Related to storage adapters"
gh label create "good first issue" --color "7057ff" --description "Good for newcomers"
```

Note: `bug`, `enhancement`, and `documentation` are default GitHub labels and should already exist. If they do not, create them as well.

### Step 11: Document NPM_TOKEN setup

Add a note to CONTRIBUTING.md (or a separate section) explaining that the `NPM_TOKEN` repository secret must be configured manually by a repository admin for the release workflow to publish to npm. This is a manual step that cannot be automated.

## Testing Strategy

This story is primarily infrastructure (YAML files, workflow configurations). Testing is verification-based rather than unit-test-based.

### Automated verification (Step 1 -- CI workflow)

- Push the branch and verify CI runs on the PR with both Node 20 and Node 22 matrix entries
- Confirm all four steps pass: lint, typecheck, build, test
- Verify concurrency cancels stale runs (push two commits quickly, confirm first run is canceled)

### Manual verification (Steps 2-6 -- Templates)

- After pushing, navigate to the repository's "New Issue" page and verify:
  - Three template options appear (Bug Report, Feature Request, New Crawler Proposal)
  - Blank issues are disabled
  - "Question or Discussion" link appears pointing to Discussions
  - Each template renders with correct fields, dropdowns, and required indicators
- Open a PR and verify the PR template pre-fills with the three sections

### Manual verification (Steps 7-9 -- Changesets + Release)

- Verify `npx changeset` works locally (creates a changeset file in `.changeset/`)
- Verify the release workflow file is syntactically valid by checking the Actions tab after push
- Full publish testing requires `NPM_TOKEN` secret -- document as a follow-up manual verification

### Label verification (Step 10)

- After running `gh label create` commands, verify labels appear in the repository's label list

## Acceptance Criteria Mapping

| Criterion | Satisfied By |
|-----------|-------------|
| CI runs tests for all packages on push and PR | Step 1: CI workflow with Node 20/22 matrix, `npm test -- --run` |
| CI builds all packages and verifies TypeScript compilation | Step 1: CI workflow `npm run build` + `npx tsc --noEmit` |
| Issue templates for bug, feature, crawler | Steps 2-5: Three YAML form templates + config.yml |
| Release workflow publishes to npm on version tag push | Step 9: Changesets release workflow (automated version bumps + publish) |
| CI passes on current codebase | Verified when PR CI runs green |
| Issue templates render correctly on GitHub | Manual verification after push |

## Risks

- **NPM_TOKEN not yet configured:** The release workflow will not actually publish until a repository admin adds the `NPM_TOKEN` secret. This is expected -- the workflow file should still be created and will silently skip publishing without the token.
- **Changesets on a `private: true` package:** The root `package.json` is `private: true` with version `0.0.0`. Changesets will ignore it (it only publishes non-private packages). Once `packages/` are created by earlier M008 epics, Changesets will pick them up automatically.
- **No packages/ directory yet:** The CI and release workflows are designed to work with the current single-package structure. When npm workspaces are added, `npm ci`, `npm run build`, and `npm test` will automatically operate on all workspaces without workflow changes.
- **`@changesets/changelog-github` schema URL:** The `$schema` field in `.changeset/config.json` references an unpkg URL. If unpkg is temporarily unavailable, the schema validation will fail silently but Changesets will still work. This is cosmetic.

## Order of Operations

Steps 1-6 can be implemented in any order (they are independent files). Steps 7-8 must precede Step 9 (Changesets must be initialized before the release workflow references it). Step 10 is independent and can run anytime. Step 11 should be last since it documents the completed setup.

Recommended execution order: 2, 3, 4, 5, 6 (templates first -- no dependencies), then 1 (CI), then 7, 8, 9 (Changesets + release), then 10 (labels), then 11 (docs).
