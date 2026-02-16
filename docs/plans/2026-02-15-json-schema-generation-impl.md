# Implementation Plan: JSON Schema Generation and Schema Versioning

**Task:** basesignal-8ig
**Story:** M008-E001-S004
**Design:** [2026-02-15-json-schema-generation-design.md](./2026-02-15-json-schema-generation-design.md)

## Summary

Add JSON Schema generation from zod schemas, embed a `basesignal_version` field in every ProductProfile, and provide a `checkVersion()` utility for version compatibility detection. This story depends on S001 (monorepo workspace), S002 (type extraction), and S003 (zod schemas) being complete — the `packages/core` directory with zod schemas must exist before this work begins.

## Prerequisites

Before starting, verify:
- `packages/core/` exists with `package.json`, `tsconfig.json`, and vitest config (from S001)
- `packages/core/src/schema/index.ts` exports `ProductProfileSchema` and all sub-schemas (from S003)
- `packages/core/src/index.ts` exists as the package entry point (from S001)

## Steps

### Step 1: Install `zod-to-json-schema` dependency

**File:** `packages/core/package.json`

Add `zod-to-json-schema` as a devDependency (it is only needed at build time, not at runtime):

```bash
cd packages/core && npm install --save-dev zod-to-json-schema
```

Verify it appears in `devDependencies` in `packages/core/package.json`.

### Step 2: Create the version module

**File:** `packages/core/src/version.ts` (new file)

Create the version constant and compatibility check utility:

```typescript
// packages/core/src/version.ts

/**
 * The current schema version for Basesignal ProductProfiles.
 *
 * Follows semver conventions:
 * - Major bump (1.0 -> 2.0): breaking changes (removed fields, type changes, renames)
 * - Minor bump (1.0 -> 1.1): additive changes (new optional fields, new enum values)
 */
export const SCHEMA_VERSION = "1.0";

/**
 * Compatibility status returned by checkVersion().
 *
 * - "compatible": profile uses same or older minor version; all fields understood
 * - "needs_migration": profile has higher minor version; may contain unknown fields
 * - "incompatible": different major version; profile shape may be fundamentally different
 */
export type VersionCompatibility =
  | "compatible"
  | "needs_migration"
  | "incompatible";

/**
 * Check whether a profile's schema version is compatible with this library version.
 *
 * @param profileVersion - The basesignal_version string from a ProductProfile
 * @returns Compatibility status
 */
export function checkVersion(profileVersion: string): VersionCompatibility {
  const [profileMajor, profileMinor] = profileVersion.split(".").map(Number);
  const [currentMajor, currentMinor] = SCHEMA_VERSION.split(".").map(Number);

  if (profileMajor !== currentMajor) {
    return "incompatible";
  }
  if (profileMinor > currentMinor) {
    return "needs_migration";
  }
  return "compatible";
}
```

### Step 3: Add `basesignal_version` to the ProductProfile zod schema

**File:** `packages/core/src/schema/index.ts`

This step modifies the existing `ProductProfileSchema` from S003 to include the required `basesignal_version` field. The field must be a required top-level string field.

Add `basesignal_version: z.string()` as the first field in `ProductProfileSchema`:

```typescript
import { SCHEMA_VERSION } from "../version.js";

export const ProductProfileSchema = z.object({
  basesignal_version: z.string(),
  // ... existing fields from S003 (identity, revenue, entities, journey, etc.)
});
```

If there is a factory function like `createEmptyProfile()` or a default profile builder (from S003), update it to include `basesignal_version: SCHEMA_VERSION` in the default values.

### Step 4: Re-export version utilities from package entry point

**File:** `packages/core/src/index.ts`

Add exports for the version module so consumers can import them:

```typescript
export { SCHEMA_VERSION, checkVersion } from "./version.js";
export type { VersionCompatibility } from "./version.js";
```

### Step 5: Create the build-schema script

**File:** `packages/core/scripts/build-schema.ts` (new file)

```typescript
// packages/core/scripts/build-schema.ts
import { zodToJsonSchema } from "zod-to-json-schema";
import { ProductProfileSchema } from "../src/schema/index.js";
import { SCHEMA_VERSION } from "../src/version.js";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const jsonSchema = zodToJsonSchema(ProductProfileSchema, {
  name: "ProductProfile",
  target: "jsonSchema2020-12",
  $refStrategy: "none",
});

const output = {
  ...jsonSchema,
  $id: `https://basesignal.dev/schema/v${SCHEMA_VERSION}/product-profile.json`,
  title: "Basesignal Product Profile",
  description:
    "A structured representation of a product's P&L framework.",
};

const outputPath = resolve(__dirname, "../schema.json");
writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n");

console.log(`Generated schema.json (v${SCHEMA_VERSION})`);
```

**Note on zod version:** The project uses zod v4 (`"zod": "^4.1.12"`). Verify that the installed version of `zod-to-json-schema` supports zod v4. If the latest `zod-to-json-schema` does not yet support zod v4, use the `zod-to-json-schema` version that is compatible, or use zod v4's built-in `z.toJsonSchema()` if available. If neither works, fall back to `zodToJsonSchema` from the `zod-to-json-schema` package with any necessary adapter. Check the zod v4 docs for native JSON Schema support first — zod v4 may have this built in, which would eliminate the need for the third-party library entirely.

### Step 6: Add npm scripts to `packages/core/package.json`

**File:** `packages/core/package.json`

Add the `build:schema` script and update the main `build` script to include schema generation:

```json
{
  "scripts": {
    "build:schema": "tsx scripts/build-schema.ts",
    "build": "tsc && tsx scripts/build-schema.ts"
  }
}
```

If S001 already defined a `build` script (e.g., using `tsup` or `tsc`), append `&& tsx scripts/build-schema.ts` to it rather than replacing it.

### Step 7: Update package.json exports and files

**File:** `packages/core/package.json`

Add `schema.json` to the `files` array and the `exports` map so it ships with the npm package:

```json
{
  "files": ["dist/", "schema.json"],
  "exports": {
    ".": "./dist/index.js",
    "./schema.json": "./schema.json"
  }
}
```

If S001 already has a `files` or `exports` field, add the `schema.json` entries alongside the existing values.

### Step 8: Generate the initial schema.json

Run the build script to generate the initial `schema.json`:

```bash
cd packages/core && npm run build:schema
```

Verify:
- `packages/core/schema.json` is created
- It contains `"$schema"` or `"$id"` referencing the version
- It contains `"basesignal_version"` as a required property
- The file is valid JSON

Commit `schema.json` to git (it is a checked-in build artifact, per the design doc).

### Step 9: Write version utility tests

**File:** `packages/core/src/version.test.ts` (new file)

```typescript
import { describe, test, expect } from "vitest";
import { SCHEMA_VERSION, checkVersion } from "./version.js";
import type { VersionCompatibility } from "./version.js";

describe("SCHEMA_VERSION", () => {
  test("is a semver-style string", () => {
    expect(SCHEMA_VERSION).toMatch(/^\d+\.\d+$/);
  });

  test("initial version is 1.0", () => {
    expect(SCHEMA_VERSION).toBe("1.0");
  });
});

describe("checkVersion", () => {
  test("returns compatible for same version", () => {
    expect(checkVersion("1.0")).toBe("compatible");
  });

  test("returns compatible for older minor version", () => {
    // Profile from 1.0, library at 1.0 — same version
    expect(checkVersion("1.0")).toBe("compatible");
  });

  test("returns needs_migration for newer minor version", () => {
    // Profile from 1.1, library at 1.0 — profile is newer
    expect(checkVersion("1.1")).toBe("needs_migration");
    expect(checkVersion("1.5")).toBe("needs_migration");
  });

  test("returns incompatible for different major version (higher)", () => {
    expect(checkVersion("2.0")).toBe("incompatible");
    expect(checkVersion("3.1")).toBe("incompatible");
  });

  test("returns incompatible for different major version (lower)", () => {
    expect(checkVersion("0.1")).toBe("incompatible");
    expect(checkVersion("0.9")).toBe("incompatible");
  });

  test("return type is VersionCompatibility", () => {
    const result: VersionCompatibility = checkVersion("1.0");
    expect(["compatible", "needs_migration", "incompatible"]).toContain(result);
  });
});
```

### Step 10: Write schema generation and parity tests

**File:** `packages/core/src/schema.test.ts` (new file)

```typescript
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ProductProfileSchema } from "./schema/index.js";
import { SCHEMA_VERSION } from "./version.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(__dirname, "../schema.json");

function loadSchema() {
  const raw = readFileSync(schemaPath, "utf-8");
  return JSON.parse(raw);
}

describe("schema.json", () => {
  test("exists and is valid JSON", () => {
    const schema = loadSchema();
    expect(schema).toBeDefined();
    expect(typeof schema).toBe("object");
  });

  test("has JSON Schema 2020-12 dialect", () => {
    const schema = loadSchema();
    // The schema should reference 2020-12 either via $schema or be valid 2020-12
    // zod-to-json-schema may set $schema or it may be at the definition level
    expect(
      schema.$schema === "https://json-schema.org/draft/2020-12/schema" ||
        schema.$id?.includes("/v")
    ).toBe(true);
  });

  test("contains version in $id", () => {
    const schema = loadSchema();
    expect(schema.$id).toContain(`v${SCHEMA_VERSION}`);
  });

  test("has title and description", () => {
    const schema = loadSchema();
    expect(schema.title).toBe("Basesignal Product Profile");
    expect(schema.description).toBeTruthy();
  });

  test("requires basesignal_version field", () => {
    const schema = loadSchema();
    // Navigate into the schema structure — may be at root or under definitions
    const props =
      schema.properties ||
      schema.definitions?.ProductProfile?.properties ||
      {};
    const required =
      schema.required ||
      schema.definitions?.ProductProfile?.required ||
      [];
    expect(props.basesignal_version).toBeDefined();
    expect(required).toContain("basesignal_version");
  });
});

describe("zod/JSON Schema parity", () => {
  test("valid profile passes both zod and JSON Schema structure check", () => {
    const validProfile = {
      basesignal_version: "1.0",
      // Add minimal required fields from S003 schema here
    };
    const zodResult = ProductProfileSchema.safeParse(validProfile);
    expect(zodResult.success).toBe(true);

    // Structural check: the JSON Schema should list basesignal_version
    const schema = loadSchema();
    const props =
      schema.properties ||
      schema.definitions?.ProductProfile?.properties ||
      {};
    expect(props.basesignal_version).toBeDefined();
  });

  test("profile missing basesignal_version fails zod validation", () => {
    const invalidProfile = {};
    const zodResult = ProductProfileSchema.safeParse(invalidProfile);
    expect(zodResult.success).toBe(false);
  });

  test("profile with wrong type for basesignal_version fails zod validation", () => {
    const invalidProfile = { basesignal_version: 123 };
    const zodResult = ProductProfileSchema.safeParse(invalidProfile);
    expect(zodResult.success).toBe(false);
  });
});

describe("basesignal_version in profiles", () => {
  test("valid profile includes basesignal_version 1.0", () => {
    const profile = {
      basesignal_version: "1.0",
    };
    const result = ProductProfileSchema.safeParse(profile);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.basesignal_version).toBe("1.0");
    }
  });
});
```

**Note:** If `ajv` is available (or worth adding as a devDependency), the parity tests can be strengthened to do full JSON Schema validation against the same test profiles. The design doc shows this pattern. If adding `ajv` feels like scope creep for this story, the structural assertions above are sufficient — the staleness test (Step 11) catches drift.

### Step 11: Write schema staleness detection test

**File:** `packages/core/src/schema-staleness.test.ts` (new file)

This test regenerates the schema in memory and compares it to the checked-in `schema.json`. If a developer changes the zod schemas but forgets to run `build:schema`, this test fails.

```typescript
import { describe, test, expect } from "vitest";
import { zodToJsonSchema } from "zod-to-json-schema";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ProductProfileSchema } from "./schema/index.js";
import { SCHEMA_VERSION } from "./version.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("schema staleness", () => {
  test("schema.json matches current zod schema definitions", () => {
    // Regenerate from zod
    const fresh = zodToJsonSchema(ProductProfileSchema, {
      name: "ProductProfile",
      target: "jsonSchema2020-12",
      $refStrategy: "none",
    });

    const freshWithMeta = {
      ...fresh,
      $id: `https://basesignal.dev/schema/v${SCHEMA_VERSION}/product-profile.json`,
      title: "Basesignal Product Profile",
      description:
        "A structured representation of a product's P&L framework.",
    };

    // Load checked-in version
    const schemaPath = resolve(__dirname, "../schema.json");
    const checkedIn = JSON.parse(readFileSync(schemaPath, "utf-8"));

    expect(freshWithMeta).toEqual(checkedIn);
  });
});
```

**Note on zod v4:** If `zod-to-json-schema` is not the tool used (see Step 5 note about zod v4 native support), adjust the import and generation call accordingly. The test logic stays the same: regenerate and compare.

### Step 12: Run all tests

```bash
cd packages/core && npm test -- --run
```

Verify:
- `version.test.ts` — all checkVersion scenarios pass
- `schema.test.ts` — schema.json exists, has correct metadata, parity checks pass
- `schema-staleness.test.ts` — schema.json matches regenerated output
- No regressions in existing S002/S003 tests

### Step 13: Verify npm package includes schema.json

```bash
cd packages/core && npm pack --dry-run
```

Verify the output lists `schema.json` in the tarball contents. If it does not appear, check that `"files"` in `package.json` includes `"schema.json"` and that the file exists at `packages/core/schema.json`.

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/core/src/version.ts` | New | SCHEMA_VERSION constant + checkVersion() utility |
| `packages/core/src/version.test.ts` | New | Tests for version constant and compatibility check |
| `packages/core/src/schema.test.ts` | New | Tests for schema.json validity, metadata, and zod parity |
| `packages/core/src/schema-staleness.test.ts` | New | Staleness detection: regenerate and diff |
| `packages/core/scripts/build-schema.ts` | New | Build script that generates schema.json from zod |
| `packages/core/schema.json` | New (generated) | JSON Schema output, checked into git |
| `packages/core/src/schema/index.ts` | Modified | Add basesignal_version field to ProductProfileSchema |
| `packages/core/src/index.ts` | Modified | Re-export version utilities |
| `packages/core/package.json` | Modified | Add build:schema script, exports, files, devDependency |

## What Does NOT Change

- Existing convex/ schema, validators, or type definitions
- Existing React components or frontend code
- Root package.json (except potentially workspace resolution if npm install is needed)
- Any parser, handler, or analysis pipeline code
- The shape of sub-schemas defined in S003 (only the top-level ProductProfile gets the new field)

## Dependencies and Ordering

This story has a hard dependency on **S003** (zod schemas exist). The `ProductProfileSchema` must be importable before the build script or tests can run. If S003 is not yet complete, this story cannot begin.

The steps within this plan are sequential: version module (Step 2) must exist before the schema modification (Step 3) and build script (Step 5). Tests (Steps 9-11) depend on the schema being generated (Step 8).

## Risk: zod v4 Compatibility

The project uses `zod@^4.1.12`. The `zod-to-json-schema` library historically targets zod v3. Zod v4 may have:
1. **Native JSON Schema support** (`z.toJsonSchema()`) — if so, use it directly and skip the third-party library entirely.
2. **Breaking API changes** that require a newer version of `zod-to-json-schema`.

**Mitigation:** In Step 1 and Step 5, check zod v4's API first. If native support exists, replace `zod-to-json-schema` with a direct call. Update the build script and staleness test accordingly.

## Verification

- [ ] `packages/core/schema.json` exists and is valid JSON
- [ ] `schema.json` contains `$id` with version, `title`, and `description`
- [ ] `schema.json` lists `basesignal_version` as a required property
- [ ] `checkVersion("1.0")` returns `"compatible"`
- [ ] `checkVersion("1.1")` returns `"needs_migration"`
- [ ] `checkVersion("2.0")` returns `"incompatible"`
- [ ] `ProductProfileSchema.safeParse({ basesignal_version: "1.0" })` succeeds
- [ ] `ProductProfileSchema.safeParse({})` fails (basesignal_version is required)
- [ ] `npm run build:schema` regenerates `schema.json` without errors
- [ ] `npm pack --dry-run` includes `schema.json`
- [ ] Schema staleness test passes (regenerated output matches checked-in file)
- [ ] All existing tests continue to pass
