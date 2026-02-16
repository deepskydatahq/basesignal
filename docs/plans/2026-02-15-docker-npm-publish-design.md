# Docker and npm Distribution Design

## Overview

Create a Dockerfile with multi-stage build, a docker-compose.yml for one-command self-hosting, and configure all packages for npm publishing under the `@basesignal` scope. This is the distribution story -- it does not add features, it makes everything built in E001-E005 installable and runnable by others.

## Problem Statement

The packages built across M008 (core, mcp-server, crawlers, storage, cli) have no distribution mechanism. A user cannot `npm install -g @basesignal/cli` because the packages lack publishing configuration. A user cannot `docker-compose up` because no Docker files exist. Without distribution, the open source project is source-only -- usable only by cloning the repo and building from scratch.

## Expert Perspectives

### Technical Architect

The Dockerfile should be a thin shell around `basesignal serve --transport sse`. Do not reinvent the server inside Docker -- the CLI already composes all the pieces. Multi-stage build is correct but keep it to two stages (build + run), not three. The build stage installs all dependencies and runs `npm run build` across workspaces. The run stage copies only `dist/` directories and production `node_modules`. This keeps the image small without contorting the build process.

For npm publishing, the key decision is: publish from workspace or publish individual tarballs? npm workspaces natively support `npm publish --workspace packages/core` since npm v7. This works. Do not add lerna, changesets, or any publishing meta-framework -- those solve version coordination problems that do not exist yet with 5 packages at v0.0.1. A single `scripts/publish-all.sh` that iterates over packages is honest about the scale.

Package scoping under `@basesignal/*` is the right call. It prevents name collisions, groups packages visually in the registry, and communicates ownership. One decision: the organization must exist on npm. The first publish requires `npm login` and creating the `@basesignal` scope (free for public packages).

### Simplification Reviewer

**Verdict: APPROVED with cuts.**

- **Remove:** No Kubernetes manifests, no Helm charts, no Terraform. Docker-compose is the ceiling for self-hosting complexity in v0. If someone needs Kubernetes, they can write their own deployment from the Docker image.
- **Remove:** No `.dockerignore` laundry list -- use an allowlist approach. COPY only what is needed (packages/, package.json, package-lock.json), not COPY-everything-then-ignore.
- **Remove:** No automated version bumping. Versions are bumped manually in package.json files before publishing. A `scripts/publish-all.sh` is acceptable; a version-management tool is not.
- **Remove:** No npm provenance or attestation configuration. This is a nice-to-have that adds signing complexity. Ship first, add provenance when there are actual users trusting the supply chain.
- **Keep:** Multi-stage Dockerfile -- the size difference matters for Docker Hub pulls.
- **Keep:** docker-compose.yml with documented environment variables -- this is the primary self-hosting path.
- **Keep:** `files` and `exports` fields in every package.json -- without these, `npm publish` ships everything including tests and configs.
- **Assessment:** The design is distribution plumbing. It should be boring. Nothing clever.

## Proposed Solution

### 1. Dockerfile (`docker/Dockerfile`)

Two-stage build. Build stage compiles all packages. Run stage copies only production artifacts.

```dockerfile
# === Build stage ===
FROM node:22-alpine AS build

WORKDIR /app

# Copy workspace root files first (layer caching)
COPY package.json package-lock.json ./

# Copy all package.json files for dependency resolution
COPY packages/core/package.json packages/core/
COPY packages/mcp-server/package.json packages/mcp-server/
COPY packages/crawlers/package.json packages/crawlers/
COPY packages/storage/package.json packages/storage/
COPY packages/cli/package.json packages/cli/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY packages/ packages/

# Build all packages
RUN npm run build --workspaces

# === Run stage ===
FROM node:22-alpine

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./

# Copy package.json files for workspace resolution
COPY packages/core/package.json packages/core/
COPY packages/mcp-server/package.json packages/mcp-server/
COPY packages/crawlers/package.json packages/crawlers/
COPY packages/storage/package.json packages/storage/
COPY packages/cli/package.json packages/cli/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built output from build stage
COPY --from=build /app/packages/core/dist packages/core/dist
COPY --from=build /app/packages/mcp-server/dist packages/mcp-server/dist
COPY --from=build /app/packages/crawlers/dist packages/crawlers/dist
COPY --from=build /app/packages/storage/dist packages/storage/dist
COPY --from=build /app/packages/cli/dist packages/cli/dist

# Create data directory
RUN mkdir -p /data

# Non-root user for security
RUN addgroup -g 1001 basesignal && \
    adduser -u 1001 -G basesignal -D basesignal && \
    chown -R basesignal:basesignal /app /data

USER basesignal

# Default environment
ENV BASESIGNAL_STORAGE=/data
ENV NODE_ENV=production

EXPOSE 3000

# Start the MCP server via CLI
CMD ["node", "packages/cli/dist/index.js", "serve", "--transport", "sse", "--port", "3000"]
```

Key decisions:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Base image | `node:22-alpine` | Smallest official Node image, ~50MB vs ~350MB for `node:22` |
| Stages | Two (build + run) | Build needs devDeps for tsc/tsup; run does not |
| COPY strategy | Explicit per-package | Allowlist, not blocklist. No `.dockerignore` needed for correctness |
| Entry point | `node packages/cli/dist/index.js serve` | Reuses the CLI; no separate server entry point to maintain |
| Non-root user | `basesignal:basesignal` | Security baseline; prevents container escape writing as root |
| Data directory | `/data` | Simple, documented mount point for SQLite storage |

### 2. docker-compose.yml (`docker/docker-compose.yml`)

```yaml
# Basesignal self-hosted MCP server
# Usage: docker-compose up
# Connect from Claude Desktop using SSE transport at http://localhost:3000

services:
  basesignal:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    ports:
      - "${BASESIGNAL_PORT:-3000}:3000"
    environment:
      # === Required ===
      # LLM API key (one of these, depending on provider)
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
      - OPENAI_API_KEY=${OPENAI_API_KEY:-}

      # === Optional ===
      # LLM provider: anthropic (default), openai, ollama
      - BASESIGNAL_PROVIDER=${BASESIGNAL_PROVIDER:-anthropic}
      # LLM model override (uses provider default if not set)
      - BASESIGNAL_MODEL=${BASESIGNAL_MODEL:-}
      # Storage path inside container (mapped to volume below)
      - BASESIGNAL_STORAGE=/data
    volumes:
      # Persistent storage for SQLite database and cached profiles
      - basesignal-data:/data
    restart: unless-stopped
    # Health check: verify the server is responding
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

volumes:
  basesignal-data:
```

Key decisions:

- **Single service.** No sidecar databases, no reverse proxy. SQLite runs embedded. This is the simplest possible self-hosting setup.
- **Environment variable passthrough.** The compose file documents every env var with comments. Variables use `${VAR:-default}` syntax so users can set them in a `.env` file or shell.
- **Named volume.** `basesignal-data` persists SQLite data across container restarts. Without this, all profiles are lost on `docker-compose down`.
- **Health check.** Uses `wget` (available on alpine) to hit a `/health` endpoint. The serve command should expose this endpoint (a simple 200 OK response) -- if it does not exist yet, it should be added as part of S003 or this story.
- **No Ollama service.** If a user wants Ollama, they run it separately and set `BASESIGNAL_PROVIDER=ollama` with the appropriate model. Bundling Ollama in the compose file would triple image size and add GPU configuration complexity.

### 3. .env.example (`docker/.env.example`)

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

### 4. npm Publishing Configuration

Each package needs correct `files`, `exports`, `name`, `version`, `description`, `license`, `repository`, and `keywords` fields. Here is the pattern applied to each package.

#### Shared fields (applied to all package.json files)

```json
{
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/deepskydatahq/basesignal.git",
    "directory": "packages/<name>"
  },
  "bugs": {
    "url": "https://github.com/deepskydatahq/basesignal/issues"
  },
  "homepage": "https://github.com/deepskydatahq/basesignal#readme",
  "keywords": ["basesignal", "product-profile", "product-analytics"]
}
```

#### Package-specific configuration

**@basesignal/core** (`packages/core/package.json`)
```json
{
  "name": "@basesignal/core",
  "version": "0.0.1",
  "description": "Product profile types, validation, and analysis utilities",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "files": ["dist"]
}
```

**@basesignal/mcp-server** (`packages/mcp-server/package.json`)
```json
{
  "name": "@basesignal/mcp-server",
  "version": "0.0.1",
  "description": "MCP server for AI-assisted product profile analysis",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "files": ["dist"]
}
```

**@basesignal/crawlers** (`packages/crawlers/package.json`)
```json
{
  "name": "@basesignal/crawlers",
  "version": "0.0.1",
  "description": "Web crawlers for extracting product information",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "files": ["dist"]
}
```

**@basesignal/storage** (`packages/storage/package.json`)
```json
{
  "name": "@basesignal/storage",
  "version": "0.0.1",
  "description": "Storage adapters for product profiles (SQLite, file-based)",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "files": ["dist"]
}
```

**@basesignal/cli** (`packages/cli/package.json`)
```json
{
  "name": "@basesignal/cli",
  "version": "0.0.1",
  "description": "Product profile analysis from the command line",
  "type": "module",
  "bin": {
    "basesignal": "./dist/index.js"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "keywords": ["basesignal", "product-profile", "product-analytics", "cli", "mcp"]
}
```

Notes on the CLI:
- **ESM only.** The CLI is a binary, not a library. No CJS consumer exists.
- **No `main` or `module` fields.** The `bin` entry is what matters.
- **`files: ["dist"]`** ships only the built output. Tests, source, and configs are excluded from the tarball.

### 5. Publish Script (`scripts/publish-all.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail

# Publish all @basesignal packages to npm
# Usage: ./scripts/publish-all.sh [--dry-run]
#
# Prerequisites:
# - npm login (with access to @basesignal scope)
# - All packages built (npm run build --workspaces)
# - All tests passing (npm test --workspaces)

DRY_RUN=""
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN="--dry-run"
  echo "=== DRY RUN ==="
fi

# Publish order matters: dependencies before dependents
PACKAGES=(
  "packages/core"
  "packages/storage"
  "packages/crawlers"
  "packages/mcp-server"
  "packages/cli"
)

echo "Building all packages..."
npm run build --workspaces

echo "Running all tests..."
npm test --workspaces

for pkg in "${PACKAGES[@]}"; do
  echo ""
  echo "Publishing ${pkg}..."
  npm publish --workspace "${pkg}" --access public ${DRY_RUN}
done

echo ""
echo "Done."
```

Key decisions:
- **Explicit publish order.** Core first (no dependencies), then storage/crawlers (depend on core), then mcp-server (depends on core+storage+crawlers), then cli (depends on everything). This ensures that when npm resolves dependencies during install, the required packages exist on the registry.
- **Build + test before publish.** The script runs the full build and test suite as a gate. If tests fail, no packages are published.
- **`--access public`** is required for scoped packages on npm (scoped packages default to private/restricted).
- **`--dry-run` flag** for verification before real publishes.
- **No version bumping.** Versions are edited manually in each package.json. At 5 packages and v0.0.x, any automation is premature.

### 6. Root package.json Additions

The root `package.json` needs a workspace-aware build script:

```json
{
  "scripts": {
    "build:packages": "npm run build --workspaces",
    "test:packages": "npm test --workspaces",
    "prepublishOnly": "echo 'Use scripts/publish-all.sh instead' && exit 1"
  }
}
```

The `prepublishOnly` guard prevents accidental `npm publish` from the root (which would try to publish the root package, not the workspaces).

### 7. Version Management Strategy

**Current phase (v0.0.x): Manual, lockstep.**

All five packages share the same version number. When any package changes, all versions are bumped together. This is intentional simplicity:
- Five packages at v0.0.1 are not worth a version management tool
- Users expect `@basesignal/core@0.0.5` and `@basesignal/cli@0.0.5` to be compatible
- Lockstep versioning eliminates compatibility matrix questions

**Future phase (v1.0.0+): Independent versions with compatibility ranges.**

When the API stabilizes and packages evolve at different rates, switch to independent versioning. At that point, consider changesets or a lightweight custom script. Do not pre-optimize for this.

**Version bump workflow:**
1. Make changes
2. Update version in each `packages/*/package.json` to the new version
3. Commit: `chore: bump to v0.0.2`
4. Tag: `git tag v0.0.2`
5. Push tag: `git push --tags`
6. Run: `./scripts/publish-all.sh`

The CI release workflow (M008-E006-S005) will automate steps 5-6 by triggering on tag push.

## Key Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Docker base | `node:22-alpine` | Smallest official Node image |
| Dockerfile stages | Two (build + run) | Minimal complexity that still drops devDeps |
| Docker entry point | CLI serve command | Single entry point, no separate server binary |
| Docker storage | Named volume at `/data` | Persists SQLite across restarts |
| Docker compose | Single service | SQLite is embedded, no sidecar needed |
| npm scope | `@basesignal/*` | Name collision prevention, visual grouping |
| Publish tool | `scripts/publish-all.sh` | No lerna/changesets overhead for 5 packages |
| Version strategy | Lockstep manual | Simplest correct approach at v0.0.x |
| Package `files` field | `["dist"]` only | Ship built output, not source/tests/configs |
| Dual format | ESM+CJS for libraries, ESM-only for CLI | Libraries need both consumers; CLI is a binary |
| Provenance/attestation | Not included | Ship first, add supply chain signing later |
| Config files | No `.basesignalrc` | Environment variables only (matches CLI skeleton design) |
| Kubernetes/Helm | Not included | Docker-compose is the complexity ceiling for v0 |

## What This Does NOT Do

- **Add new functionality.** This is distribution plumbing only.
- **Create a CI/CD pipeline.** That is M008-E006-S005 (GitHub Actions).
- **Set up npm organization.** Creating `@basesignal` on npmjs.com is a manual one-time step.
- **Add npm provenance or package signing.** Future optimization.
- **Add Docker Hub automated builds.** Future CI integration.
- **Add Kubernetes manifests.** Out of scope for v0.
- **Add a reverse proxy or TLS termination.** Users bring their own if needed.
- **Modify any package source code.** This story only touches Dockerfiles, docker-compose, package.json fields, and the publish script.

## Changes Summary (Touchpoints)

1. **`docker/Dockerfile`** -- new file, multi-stage build
2. **`docker/docker-compose.yml`** -- new file, single-service composition
3. **`docker/.env.example`** -- new file, documented environment variables
4. **`packages/core/package.json`** -- add `files`, `exports`, `repository`, `license`, `description`, `keywords`
5. **`packages/mcp-server/package.json`** -- same fields
6. **`packages/crawlers/package.json`** -- same fields
7. **`packages/storage/package.json`** -- same fields
8. **`packages/cli/package.json`** -- add `files`, `repository`, `license`, `description`, `keywords` (already has `bin` and `exports`)
9. **`scripts/publish-all.sh`** -- new file, ordered workspace publishing
10. **Root `package.json`** -- add `build:packages`, `test:packages`, `prepublishOnly` scripts

## Verification Steps

1. `docker build -f docker/Dockerfile .` builds without errors
2. Built image size is under 200MB (alpine + node + production deps)
3. `docker-compose -f docker/docker-compose.yml up` starts the MCP server
4. Server responds on `http://localhost:3000/health` (or equivalent)
5. `npm pack --workspace packages/core --dry-run` shows only `dist/` files in tarball
6. `npm pack --workspace packages/cli --dry-run` shows only `dist/` files and includes `bin` entry
7. `./scripts/publish-all.sh --dry-run` succeeds (build + test + dry-run publish all 5 packages)
8. All package.json files have `name`, `version`, `description`, `license`, `repository`, `files`, and `exports`
9. Existing app (`npm run dev`, `npm test`) unaffected

## Success Criteria

All seven acceptance criteria from the story:

1. `docker/Dockerfile` builds successfully and produces a working container
2. Container image is based on `node:alpine` for minimal size
3. `docker/docker-compose.yml` starts the MCP server with environment variable configuration
4. `docker-compose.yml` documents all environment variables with comments
5. All packages have correct `files` and `exports` fields for npm publishing
6. Package names use `@basesignal` scope
7. `docker-compose up` starts a working server connectable from Claude Desktop
