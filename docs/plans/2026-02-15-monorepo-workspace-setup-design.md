# Monorepo Workspace Setup and packages/core Scaffold Design

## Overview
Convert the existing single-package repo into an npm workspaces monorepo and scaffold `packages/core` as a buildable TypeScript package with its own test setup. The existing React/Convex app remains untouched.

## Problem Statement
The open source strategy (M008) requires extracting the analysis engine into modular packages. Before any extraction can happen, the monorepo infrastructure must exist. This story establishes that foundation.

## Expert Perspectives

### Technical
- **Build toolchain:** tsup (wraps esbuild) as root devDependency. Zero-config, produces ESM + CJS with type declarations. Industry standard for library building.
- **Why not plain tsc:** Would need multiple tsconfigs and no bundling. tsup is simpler.
- **Why not unbuild:** Ecosystem lock-in for minimal benefit over tsup.
- **Root-level devDep:** Build tool is infrastructure, not per-package. Consistency wins.

### Simplification Review
- **Verdict: APPROVED** — design is minimal and inevitable.
- Each piece directly required by acceptance criteria.
- No extraneous scaffolding or future-proofing abstractions.
- Order is forced and logical: workspace → scaffold → build → test.

## Proposed Solution

### Changes (9 touchpoints)

1. **Root package.json** — add `"workspaces": ["packages/*"]` and `tsup` devDep
2. **packages/core/package.json** — `@basesignal/core`, private, dual ESM+CJS exports
3. **packages/core/tsconfig.json** — ES2022, strict, noEmit (tsup handles emit)
4. **packages/core/tsup.config.ts** — entry, format: [esm, cjs], dts: true
5. **packages/core/vitest.config.ts** — node environment (not jsdom)
6. **packages/core/src/index.ts** — empty barrel export
7. **packages/core/src/index.test.ts** — placeholder test
8. **Root tsconfig.json** — add project reference to packages/core
9. **.gitignore** — add `packages/*/dist`

### Key Decisions

- **tsup over plain tsc or unbuild** — simplest path to dual ESM+CJS
- **Separate vitest config per package** — root uses jsdom for React, core uses node
- **private: true** — not publishing yet, workspace-only consumption
- **noEmit in tsconfig** — tsup handles emit, tsc just type-checks

### What This Does NOT Do

- Modify existing src/, convex/, or server/ code
- Add packages/core as dependency of existing app
- Configure CI/CD
- Add runtime dependencies

## Verification Steps

1. `npm install` → `node_modules/@basesignal/core` symlinks to `packages/core`
2. `cd packages/core && npx tsc --noEmit` → zero errors
3. `cd packages/core && npx tsup` → dist/ contains .mjs, .cjs, .d.ts
4. `cd packages/core && npx vitest run` → placeholder test passes
5. `npm run dev` from root → Vite starts normally
6. `npm test` from root → existing tests pass

## Success Criteria
- All 5 acceptance criteria met
- Zero changes to existing app behavior
- Clean foundation for subsequent E001 stories (type extraction, validation, etc.)
