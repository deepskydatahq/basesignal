# Implementation Plan: Monorepo Workspace Setup and packages/core Scaffold

**Task:** basesignal-441 (M008-E001-S001)
**Design:** `docs/plans/2026-02-15-monorepo-workspace-setup-design.md`
**Story:** `product/stories/M008-E001-S001-monorepo-workspace-setup.toml`

---

## Current State

- **Root package.json**: Single-package, no workspaces. Has `"type": "module"`.
- **Root tsconfig.json**: Project references to `tsconfig.app.json` and `tsconfig.node.json`.
- **Root vitest.config.ts**: Uses `jsdom` env, React plugin, `@` alias, `convex-test` inline dep.
- **.gitignore**: Already has `dist` (bare, matches any `dist/` including `packages/core/dist`).
- **No `packages/` directory** exists yet.
- **Versions**: Node v25.6.0, npm 11.9.0, TypeScript ~5.9.3, Vitest 4.0.16, latest tsup 8.5.1.

---

## Steps (in order)

### Step 1: Modify root `package.json` — add workspaces + tsup devDep

**File:** `package.json`

Add the `workspaces` field and `tsup` as a devDependency.

```diff
 {
   "name": "basesignal",
   "private": true,
   "version": "0.0.0",
   "type": "module",
+  "workspaces": [
+    "packages/*"
+  ],
   "scripts": {
```

```diff
   "devDependencies": {
+    "tsup": "^8.5.1",
     ...existing devDeps...
   }
```

**Why workspaces at root:** npm workspaces requires the `workspaces` field in the root package.json. The glob `packages/*` will pick up any direct child of `packages/`.

**Why tsup as root devDep:** Build tooling is infrastructure. Keeping it in the root avoids duplicating across workspace packages.

---

### Step 2: Create `packages/core/package.json`

**File:** `packages/core/package.json` (NEW)

```json
{
  "name": "@basesignal/core",
  "version": "0.0.0",
  "private": true,
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
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**Key decisions:**
- `private: true` — not publishing to npm yet, workspace-only consumption.
- Dual exports map (`import`/`require`/`types`) for ESM + CJS consumers.
- `main` and `module` fields for backward compat with older bundlers.
- `files: ["dist"]` — only dist/ would be published (future-proofing).
- No dependencies or devDependencies — inherits `tsup`, `vitest`, `typescript` from root.

---

### Step 3: Create `packages/core/tsconfig.json`

**File:** `packages/core/tsconfig.json` (NEW)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "erasableSyntaxOnly": true
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts", "dist", "node_modules"]
}
```

**Key decisions:**
- `noEmit: true` — tsup handles emit, tsc just type-checks.
- `composite: true` — required for project references from root tsconfig.
- `declaration` + `declarationMap` — for project references to work correctly (even though tsup generates actual .d.ts files for dist).
- Strict settings match the existing `tsconfig.app.json` patterns.
- Excludes test files from type-check scope (they'll be checked by vitest).

---

### Step 4: Create `packages/core/tsup.config.ts`

**File:** `packages/core/tsup.config.ts` (NEW)

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  outDir: 'dist',
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.mjs' : '.cjs',
    }
  },
})
```

**Key decisions:**
- `format: ['esm', 'cjs']` — dual output as per story requirements.
- `dts: true` — generates `.d.ts` files alongside JS.
- `clean: true` — removes dist/ before each build.
- Explicit `outExtension` — ensures `.mjs` and `.cjs` extensions to match the exports map in package.json.

---

### Step 5: Create `packages/core/vitest.config.ts`

**File:** `packages/core/vitest.config.ts` (NEW)

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
})
```

**Key decisions:**
- `environment: 'node'` — core is a library, not a React app. No jsdom needed.
- `globals: true` — matches root config convention so `describe`/`it`/`expect` don't need imports.
- No plugins — no React, no aliases. Minimal config.

---

### Step 6: Create `packages/core/src/index.ts`

**File:** `packages/core/src/index.ts` (NEW)

```typescript
// @basesignal/core — analysis engine for product P&L measurement
```

An empty barrel export file. Future stories (S002+) will add type exports here.

---

### Step 7: Create `packages/core/src/index.test.ts`

**File:** `packages/core/src/index.test.ts` (NEW)

```typescript
import { describe, it, expect } from 'vitest'

describe('@basesignal/core', () => {
  it('should be importable', async () => {
    const mod = await import('./index')
    expect(mod).toBeDefined()
  })
})
```

A placeholder test that verifies the module can be imported. Uses explicit vitest imports despite `globals: true` for clarity in a library context.

---

### Step 8: Modify root `tsconfig.json` — add project reference

**File:** `tsconfig.json`

```diff
 {
   "files": [],
   "references": [
     { "path": "./tsconfig.app.json" },
-    { "path": "./tsconfig.node.json" }
+    { "path": "./tsconfig.node.json" },
+    { "path": "./packages/core" }
   ]
 }
```

This allows `tsc -b` from root to build all projects including the core package.

---

### Step 9: Verify `.gitignore` — check dist coverage

**File:** `.gitignore`

The existing `.gitignore` already has `dist` on line 11 (bare pattern), which matches `packages/core/dist` and any nested dist directories. **No change needed.**

The design doc suggested adding `packages/*/dist`, but this is redundant since `dist` already covers it. Skipping to avoid noise.

---

### Step 10: Run `npm install` to set up workspaces

```bash
cd /home/tmo/roadtothebeach/tmo/basesignal && npm install
```

This will:
- Recognize the new `workspaces` config.
- Symlink `packages/core` into `node_modules/@basesignal/core`.
- Update `package-lock.json`.

---

## Verification Commands (in order)

After all changes, run these to confirm the acceptance criteria are met:

```bash
# 1. Workspace symlink exists
ls -la node_modules/@basesignal/core
# Should symlink to ../../packages/core

# 2. TypeScript type-check passes for packages/core
cd packages/core && npx tsc --noEmit
# Should exit 0 with no errors

# 3. tsup build produces correct outputs
cd packages/core && npx tsup
# Should produce dist/index.mjs, dist/index.cjs, dist/index.d.ts

# 4. Vitest placeholder test passes in packages/core
cd packages/core && npx vitest run
# Should show 1 passed test

# 5. Existing app still works — root dev server starts
npm run dev
# Vite should start on port 5174

# 6. Existing tests still pass
npm test -- --run
# All existing tests should pass (root vitest.config.ts is unchanged)
```

---

## Gotchas and Edge Cases

### 1. npm workspace hoisting
npm hoists all dependencies to the root `node_modules/`. Since `packages/core` has no dependencies of its own (it inherits `tsup`, `vitest`, `typescript` from root devDeps), this is a non-issue now. If core later gets its own deps, they'll be hoisted unless there's a version conflict.

### 2. Root `vitest` should NOT run core tests
The root `vitest.config.ts` has `exclude: ['**/node_modules/**', '**/e2e/**']`. Since `packages/core` is NOT in `node_modules` (it's symlinked INTO node_modules but lives at `packages/core/`), the root vitest MIGHT pick up `packages/core/src/index.test.ts`.

**Mitigation:** Add `'packages/**'` to the root `vitest.config.ts` exclude list:

```diff
 test: {
   environment: 'jsdom',
   setupFiles: ['./src/test/setup.ts'],
   globals: true,
-  exclude: ['**/node_modules/**', '**/e2e/**'],
+  exclude: ['**/node_modules/**', '**/e2e/**', 'packages/**'],
   server: {
```

This ensures running `npm test` from root only runs the React app tests, and `cd packages/core && npx vitest run` runs the core tests. Each workspace manages its own test runner.

### 3. `tsc -b` from root with project references
The root `tsconfig.json` uses `"files": []` — it's a solution file that only delegates to references. Adding `packages/core` as a reference means `tsc -b` will type-check it. Since `packages/core/tsconfig.json` has `noEmit: true` AND `composite: true`, tsc will produce `.tsbuildinfo` but no JS output (tsup handles that).

**Note:** `composite: true` technically requires `declaration: true` and `emitDeclarationOnly` or non-noEmit. If `tsc -b` complains, the fallback is to remove `noEmit` and add `emitDeclarationOnly: true` instead. Both achieve the same goal (no JS output, only type-check). Test this during verification.

### 4. `package-lock.json` changes
Running `npm install` will regenerate portions of `package-lock.json` to reflect the new workspace structure and the new `tsup` devDep. This is expected and the lockfile changes should be committed.

### 5. tsup version compatibility
tsup 8.x requires Node >= 18 (we have 25.6.0) and supports TypeScript 5.x (we have ~5.9.3). No compatibility issues expected.

### 6. The `build` script in root
The root `"build": "tsc -b && vite build"` will now also type-check `packages/core` via the project reference. This is correct behavior. If it causes issues, the project reference can be removed from root tsconfig and core can be type-checked independently.

---

## Files Summary

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | `package.json` | MODIFY | Add `workspaces`, add `tsup` devDep |
| 2 | `packages/core/package.json` | CREATE | Package manifest with dual exports |
| 3 | `packages/core/tsconfig.json` | CREATE | TypeScript config for core package |
| 4 | `packages/core/tsup.config.ts` | CREATE | Build config for ESM + CJS output |
| 5 | `packages/core/vitest.config.ts` | CREATE | Test config with node environment |
| 6 | `packages/core/src/index.ts` | CREATE | Empty barrel export entry point |
| 7 | `packages/core/src/index.test.ts` | CREATE | Placeholder test |
| 8 | `tsconfig.json` | MODIFY | Add project reference to packages/core |
| 9 | `vitest.config.ts` | MODIFY | Exclude packages/** from root test runs |

**Total: 9 touchpoints (4 modified, 5 created)**
