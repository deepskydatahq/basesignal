# Implementation Plan: Dockerfile, docker-compose, and npm Publish Configuration

**Task:** basesignal-e5r
**Story:** M008-E005-S004
**Design:** [2026-02-15-docker-npm-publish-design.md](./2026-02-15-docker-npm-publish-design.md)

## Summary

Create Docker distribution files (Dockerfile, docker-compose.yml, .env.example) and configure all five packages for npm publishing under the `@basesignal` scope. Add a publish script and root package.json workspace scripts. This is distribution plumbing only -- no source code changes to any package.

## Prerequisites

This story depends on M008-E005-S003 (export and serve CLI commands). The implementation assumes that `packages/core/`, `packages/mcp-server/`, `packages/crawlers/`, `packages/storage/`, and `packages/cli/` already exist with their respective `package.json` files and build configurations. If these packages do not yet exist on disk, the preceding stories (M008-E001 through M008-E005-S003) must be completed first.

The root `package.json` currently has no `workspaces` field. This plan adds it.

## Steps

### Step 1: Add workspaces field to root package.json

**File:** `package.json`

Add the `workspaces` field to enable npm workspace resolution across all five packages:

```json
"workspaces": [
  "packages/*"
]
```

Also add three new scripts:

```json
"build:packages": "npm run build --workspaces",
"test:packages": "npm test --workspaces",
"prepublishOnly": "echo 'Use scripts/publish-all.sh instead' && exit 1"
```

The `prepublishOnly` guard prevents accidental `npm publish` from the root, which would attempt to publish the root package instead of the individual workspaces.

**What NOT to change:** The existing `dev`, `build`, `lint`, `test`, `test:run`, `test:e2e`, `server:dev`, and `server:start` scripts remain unchanged. They serve the Convex/Vite frontend app, which is separate from the open source packages.

### Step 2: Update packages/core/package.json for npm publishing

**File:** `packages/core/package.json`

Add or update the following fields:

- `"name": "@basesignal/core"`
- `"version": "0.0.1"`
- `"description": "Product profile types, validation, and analysis utilities"`
- `"license": "MIT"`
- `"type": "module"`
- `"repository"`: object with `type: "git"`, `url: "https://github.com/deepskydatahq/basesignal.git"`, `directory: "packages/core"`
- `"bugs"`: `{ "url": "https://github.com/deepskydatahq/basesignal/issues" }`
- `"homepage": "https://github.com/deepskydatahq/basesignal#readme"`
- `"keywords": ["basesignal", "product-profile", "product-analytics"]`
- `"exports"`: conditional exports map with `import`, `require`, and `types` subpaths
- `"main": "./dist/index.cjs"`
- `"module": "./dist/index.mjs"`
- `"types": "./dist/index.d.ts"`
- `"files": ["dist"]`

The `exports` map:
```json
{
  ".": {
    "import": "./dist/index.mjs",
    "require": "./dist/index.cjs",
    "types": "./dist/index.d.ts"
  }
}
```

This ensures ESM and CJS consumers both resolve correctly, and TypeScript finds type declarations.

### Step 3: Update packages/mcp-server/package.json for npm publishing

**File:** `packages/mcp-server/package.json`

Same pattern as Step 2 with these differences:

- `"name": "@basesignal/mcp-server"`
- `"description": "MCP server for AI-assisted product profile analysis"`
- `"repository.directory": "packages/mcp-server"`
- `"keywords": ["basesignal", "product-profile", "product-analytics", "mcp"]`

All other fields (`exports`, `main`, `module`, `types`, `files`, `license`, `bugs`, `homepage`) follow the identical pattern from Step 2.

### Step 4: Update packages/crawlers/package.json for npm publishing

**File:** `packages/crawlers/package.json`

Same pattern as Step 2 with these differences:

- `"name": "@basesignal/crawlers"`
- `"description": "Web crawlers for extracting product information"`
- `"repository.directory": "packages/crawlers"`
- `"keywords": ["basesignal", "product-profile", "product-analytics", "web-crawler"]`

All other fields follow the identical pattern.

### Step 5: Update packages/storage/package.json for npm publishing

**File:** `packages/storage/package.json`

Same pattern as Step 2 with these differences:

- `"name": "@basesignal/storage"`
- `"description": "Storage adapters for product profiles (SQLite, file-based)"`
- `"repository.directory": "packages/storage"`

All other fields follow the identical pattern.

### Step 6: Update packages/cli/package.json for npm publishing

**File:** `packages/cli/package.json`

The CLI differs from library packages:

- `"name": "@basesignal/cli"`
- `"version": "0.0.1"`
- `"description": "Product profile analysis from the command line"`
- `"license": "MIT"`
- `"type": "module"`
- `"bin": { "basesignal": "./dist/index.js" }` (should already exist from S001)
- `"exports": { ".": { "import": "./dist/index.js" } }` -- ESM only, no CJS
- `"files": ["dist"]`
- `"repository"`: same pattern, `directory: "packages/cli"`
- `"bugs"`, `"homepage"`: same as other packages
- `"keywords": ["basesignal", "product-profile", "product-analytics", "cli", "mcp"]`

**No `main`, `module`, or `types` fields.** The CLI is a binary, not a library. The `bin` entry is what matters for `npm install -g`.

### Step 7: Create docker/Dockerfile

**File:** `docker/Dockerfile` (new file)

Two-stage multi-stage build:

**Build stage (`node:22-alpine AS build`):**
1. `WORKDIR /app`
2. Copy `package.json` and `package-lock.json` first (layer caching for dependency installs)
3. Copy each `packages/*/package.json` individually for workspace dependency resolution
4. `RUN npm ci` -- installs all dependencies including devDependencies needed for compilation
5. `COPY packages/ packages/` -- copy all source code
6. `RUN npm run build --workspaces` -- compile all packages

**Run stage (`node:22-alpine`):**
1. `WORKDIR /app`
2. Copy `package.json` and `package-lock.json`
3. Copy each `packages/*/package.json` for workspace resolution
4. `RUN npm ci --omit=dev` -- install production dependencies only
5. `COPY --from=build` each `packages/*/dist` directory from the build stage
6. `RUN mkdir -p /data` -- create the data directory for SQLite storage
7. Create non-root `basesignal` user (uid/gid 1001), chown `/app` and `/data`
8. `USER basesignal`
9. Set environment: `BASESIGNAL_STORAGE=/data`, `NODE_ENV=production`
10. `EXPOSE 3000`
11. `CMD ["node", "packages/cli/dist/index.js", "serve", "--transport", "sse", "--port", "3000"]`

The full Dockerfile content is specified in the design doc and should be used verbatim.

### Step 8: Create docker/docker-compose.yml

**File:** `docker/docker-compose.yml` (new file)

Single-service composition:

- Service `basesignal` builds from `context: ..` with `dockerfile: docker/Dockerfile`
- Port mapping: `${BASESIGNAL_PORT:-3000}:3000`
- Environment variables with documented comments:
  - `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` (required, one of them)
  - `BASESIGNAL_PROVIDER` (optional, default `anthropic`)
  - `BASESIGNAL_MODEL` (optional)
  - `BASESIGNAL_STORAGE=/data` (fixed, maps to volume)
- Named volume: `basesignal-data:/data`
- `restart: unless-stopped`
- Health check: `wget --spider -q http://localhost:3000/health` at 30s intervals with 5s timeout, 3 retries, 10s start period

Comments at the top of the file document usage and Claude Desktop connection instructions.

The full docker-compose.yml content is specified in the design doc.

### Step 9: Create docker/.env.example

**File:** `docker/.env.example` (new file)

Template file with all environment variables documented:

```bash
# Basesignal Docker Configuration
# Copy this file to .env and fill in your values

# LLM Provider API Key (required for anthropic/openai providers)
ANTHROPIC_API_KEY=
# OPENAI_API_KEY=

# LLM Provider: anthropic, openai, or ollama
# BASESIGNAL_PROVIDER=anthropic

# LLM Model (optional, uses provider default)
# BASESIGNAL_MODEL=

# Host port for the MCP server
# BASESIGNAL_PORT=3000
```

### Step 10: Create scripts/publish-all.sh

**File:** `scripts/publish-all.sh` (new file, must be executable)

Bash script that:

1. Accepts `--dry-run` flag
2. Defines publish order (dependencies before dependents): core, storage, crawlers, mcp-server, cli
3. Runs `npm run build --workspaces` as a gate
4. Runs `npm test --workspaces` as a gate
5. Iterates over packages and runs `npm publish --workspace <pkg> --access public` (with optional `--dry-run`)
6. Uses `set -euo pipefail` for safety

After creating, run `chmod +x scripts/publish-all.sh`.

The full script content is specified in the design doc.

### Step 11: Verify existing app is unaffected

Run the existing test suite to confirm no regressions:

```bash
npm test -- --run
```

The additions in this story are purely additive:
- New files in `docker/` (did not exist before)
- New file in `scripts/` (alongside existing scripts)
- New fields in `packages/*/package.json` (additive, no removals)
- New scripts in root `package.json` (additive, existing scripts unchanged)
- New `workspaces` field in root `package.json` -- this is the only potentially impactful change, as it tells npm to treat `packages/*` as workspaces

If adding `workspaces` causes npm to resolve differently for the existing frontend app, the workspace glob `packages/*` only applies to directories under `packages/`, which does not conflict with the root app's dependencies.

### Step 12: Verify Docker build (if Docker is available)

If Docker is available in the development environment:

```bash
docker build -f docker/Dockerfile .
```

Verify:
- Build completes without errors
- Image size is under 200MB

If Docker is not available, this step is deferred to manual verification.

### Step 13: Verify npm pack dry-run

For each package, verify only `dist/` files would be included in the tarball:

```bash
npm pack --workspace packages/core --dry-run
npm pack --workspace packages/cli --dry-run
```

The output should show only files under `dist/` plus `package.json` and `README.md` (if present). No `src/`, `test/`, or config files should appear.

### Step 14: Verify publish dry-run

```bash
./scripts/publish-all.sh --dry-run
```

This should build all packages, run all tests, and perform a dry-run publish of all five packages. If any step fails, investigate before marking the story complete.

## Files Changed

| File | Change Type |
|------|-------------|
| `package.json` | Add `workspaces` field and 3 new scripts |
| `packages/core/package.json` | Add `files`, `exports`, `repository`, `license`, `description`, `keywords`, `bugs`, `homepage` |
| `packages/mcp-server/package.json` | Same npm publishing fields |
| `packages/crawlers/package.json` | Same npm publishing fields |
| `packages/storage/package.json` | Same npm publishing fields |
| `packages/cli/package.json` | Add `files`, `exports`, `repository`, `license`, `description`, `keywords`, `bugs`, `homepage` (ESM-only, has `bin`) |
| `docker/Dockerfile` | New file -- two-stage multi-stage build |
| `docker/docker-compose.yml` | New file -- single-service composition with env vars |
| `docker/.env.example` | New file -- documented environment variable template |
| `scripts/publish-all.sh` | New file -- ordered workspace publishing script |

## What Does NOT Change

- Any package source code (`packages/*/src/`)
- Any package test files (`packages/*/test/` or `*.test.ts`)
- Build configurations (tsup.config.ts, tsconfig.json within packages)
- The existing frontend app (src/, convex/, server/)
- Existing scripts in `scripts/` directory
- Existing root package.json scripts (`dev`, `build`, `lint`, `test`, etc.)

## Acceptance Criteria Mapping

| Criterion | Verified By |
|-----------|-------------|
| docker/Dockerfile builds successfully and produces a working container | Step 12: `docker build` |
| Container image is based on node:alpine for minimal size | Step 7: `FROM node:22-alpine` in both stages |
| docker/docker-compose.yml starts the MCP server with environment variable configuration | Step 8: compose file with env passthrough |
| docker-compose.yml documents all environment variables with comments | Step 8: inline comments in compose file |
| All packages have correct `files` and `exports` fields for npm publishing | Steps 2-6 + Step 13: `npm pack --dry-run` |
| Package names use @basesignal scope | Steps 2-6: `@basesignal/*` names |
| `docker-compose up` starts a working server connectable from Claude Desktop | Step 8 + manual test (criterion marked as manual) |

## Verification

- `npm test -- --run` passes (existing app unaffected)
- `docker build -f docker/Dockerfile .` succeeds (if Docker available)
- `npm pack --workspace packages/core --dry-run` shows only `dist/` files
- `./scripts/publish-all.sh --dry-run` succeeds end-to-end
- All 5 package.json files contain `name`, `version`, `description`, `license`, `repository`, `files`, and `exports`
- docker-compose.yml has comments documenting every environment variable
