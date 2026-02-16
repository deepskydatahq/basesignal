# JSON Schema Generation and Schema Versioning Design

## Overview

Generate a JSON Schema file from the zod schemas in `packages/core` and embed a `basesignal_version` field in every ProductProfile. A single build step (`npm run build:schema`) produces `schema.json`, and a `checkVersion()` utility warns consumers when a profile was created with a different schema version.

## Problem Statement

The `@basesignal/core` package will define the ProductProfile type system in TypeScript and zod (stories S002 and S003). Non-TypeScript consumers -- Python scripts, Go services, data pipeline validators, JSON-based tooling -- cannot use those definitions directly. Without a language-agnostic schema and explicit versioning, profile interoperability depends on luck rather than contract.

This story closes the gap: produce a JSON Schema that any language can consume, stamp every profile with its schema version, and give consumers a function to detect mismatches before they surface as cryptic validation errors.

## Expert Perspectives

### Technical Architect

The real question is: what is the source of truth? If TypeScript types are derived from zod schemas (via `z.infer`), then zod is the single source. Generating JSON Schema from that same source keeps everything in sync without manual coordination. The generation should be a build step, not a runtime operation -- the schema is a build artifact, like compiled JS. Keep the versioning scheme dead simple: one string field, semver, checked at read time. Do not build a migration framework; just tell the consumer "this profile is from version X, you are running version Y" and let them decide what to do.

### Simplification Reviewer

**Verdict: APPROVED with cuts.**

What to remove:
- **No schema registry.** A registry is infrastructure for a problem that does not exist yet. Static files in the npm package are sufficient. If there are ever hundreds of schema versions in production, revisit then.
- **No automatic migration.** `checkVersion()` returns a status enum. It does not transform data. Migration logic is a separate concern that belongs to whoever is reading old profiles.
- **No date-based versioning.** Semver is universally understood. Date-based adds nothing except confusion about what "2026-02" means relative to "2026-03" when one is a breaking change and the other is additive.
- **No compatibility matrix.** The version check is a simple comparison: same major = compatible, different major = incompatible, same major + higher minor = forward-compatible. Three lines of logic.

The design feels unified: zod -> JSON Schema -> version field -> version check. Four pieces, each doing one thing. Ship it.

## Proposed Solution

### Generation Pipeline

```
zod schemas (packages/core/src/schema/)
       │
       ▼
build:schema script (packages/core/scripts/build-schema.ts)
       │  uses zod-to-json-schema
       ▼
packages/core/schema.json  (JSON Schema Draft 2020-12)
       │
       ▼
npm package (included via package.json "files" or "exports")
```

**Tool choice:** `zod-to-json-schema`. This library has first-class zod support, produces Draft 2020-12 output, and handles unions, optionals, and nested objects correctly. It is the de facto standard for this conversion in the zod ecosystem.

**Build step:** A TypeScript script at `packages/core/scripts/build-schema.ts` that:
1. Imports the root `ProductProfileSchema` from `packages/core/src/schema/`
2. Calls `zodToJsonSchema(ProductProfileSchema, { target: "jsonSchema2020-12" })`
3. Writes the result to `packages/core/schema.json`
4. Validates the output against the JSON Schema meta-schema (sanity check)

**NPM script:** `"build:schema": "tsx scripts/build-schema.ts"`, added to `packages/core/package.json`.

**CI integration:** The `build:schema` step runs as part of `npm run build` in the core package. A test verifies that `schema.json` is up-to-date by regenerating and diffing.

### Schema Build Script

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
  $refStrategy: "none", // inline all definitions for portability
});

// Add schema metadata
const output = {
  ...jsonSchema,
  $id: `https://basesignal.dev/schema/v${SCHEMA_VERSION}/product-profile.json`,
  title: "Basesignal Product Profile",
  description: "A structured representation of a product's P&L framework.",
};

const outputPath = resolve(__dirname, "../schema.json");
writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n");

console.log(`Generated schema.json (v${SCHEMA_VERSION})`);
```

### Versioning Strategy

**Format:** Semver string, e.g. `"1.0"`, `"1.1"`, `"2.0"`.

**Rules:**
- **Major bump (1.0 -> 2.0):** Removing a required field, changing a field type, renaming a field, restructuring a section. Any change that makes previously valid profiles invalid.
- **Minor bump (1.0 -> 1.1):** Adding a new optional field, adding a new optional section, adding new enum values to an existing union. Previously valid profiles remain valid.

**Where the version lives:**

1. **In every profile:** `basesignal_version: string` as a required top-level field on `ProductProfile`.
2. **In the package:** `SCHEMA_VERSION` constant exported from `packages/core/src/version.ts`.
3. **In the JSON Schema:** `$id` URL contains the version.

```typescript
// packages/core/src/version.ts
export const SCHEMA_VERSION = "1.0";
```

```typescript
// In the zod schema
export const ProductProfileSchema = z.object({
  basesignal_version: z.string(),
  identity: CoreIdentitySchema.optional(),
  revenue: RevenueArchitectureSchema.optional(),
  // ...
});
```

**Relationship to npm package version:** The npm package version (`@basesignal/core@0.3.0`) and the schema version (`1.0`) are independent. The package can ship bug fixes and new utilities without changing the schema. The schema version changes only when the shape of ProductProfile changes. The `SCHEMA_VERSION` constant is the authoritative value; the package version is for npm dependency resolution.

### Version Check Utility

```typescript
// packages/core/src/version.ts
export const SCHEMA_VERSION = "1.0";

export type VersionCompatibility = "compatible" | "needs_migration" | "incompatible";

export function checkVersion(profileVersion: string): VersionCompatibility {
  const [profileMajor, profileMinor] = profileVersion.split(".").map(Number);
  const [currentMajor, currentMinor] = SCHEMA_VERSION.split(".").map(Number);

  if (profileMajor !== currentMajor) {
    return "incompatible";
  }
  if (profileMinor > currentMinor) {
    return "needs_migration"; // profile is newer than this library
  }
  return "compatible";
}
```

**Semantics:**
- `"compatible"` -- the profile was created with the same or older minor version. All fields are understood by this library.
- `"needs_migration"` -- the profile has a higher minor version. It may contain fields this library does not know about, but the known fields are valid. The consumer should upgrade `@basesignal/core`.
- `"incompatible"` -- different major version. The profile shape may be fundamentally different. Do not attempt to read without a migration step.

### Distribution

The generated `schema.json` is distributed in three ways:

1. **In the npm package:** Listed in `package.json` `"files"` array and available via `"exports"`:
   ```json
   {
     "exports": {
       ".": "./dist/index.js",
       "./schema.json": "./schema.json"
     },
     "files": ["dist/", "schema.json"]
   }
   ```
   Consumers: `import schema from "@basesignal/core/schema.json" with { type: "json" };`

2. **As a static file in the repo:** `packages/core/schema.json` is checked into git so it can be linked from documentation and downloaded directly.

3. **Referenced by URL in the schema itself:** The `$id` field (`https://basesignal.dev/schema/v1.0/product-profile.json`) will eventually point to a hosted version. This is not part of this story -- the URL is a placeholder that becomes real when the project has a documentation site.

### File Structure

```
packages/core/
├── scripts/
│   └── build-schema.ts        # Generation script
├── src/
│   ├── schema/                 # Zod schemas (from S003)
│   │   └── index.ts
│   ├── version.ts              # SCHEMA_VERSION + checkVersion()
│   └── index.ts                # Re-exports version utilities
├── schema.json                 # Generated output (checked in)
├── package.json
└── tsconfig.json
```

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Generation tool | `zod-to-json-schema` | De facto standard, handles zod v4, produces Draft 2020-12 |
| JSON Schema draft | 2020-12 | Latest stable draft, widest tooling support going forward |
| Ref strategy | `"none"` (inline) | Single-file schema is simpler to distribute and validate against |
| Version format | Semver string (`"1.0"`) | Universally understood, maps cleanly to breaking vs. additive |
| Schema version vs. package version | Independent | Schema changes are a subset of package changes |
| Schema storage | Checked into git, included in npm package | Discoverable, no infrastructure needed |
| Version check behavior | Returns status enum, does not transform | Keep concerns separate; migration logic is the consumer's job |
| Schema registry | Not built | Premature; static files are sufficient at this scale |

## What This Does NOT Do

- **No schema migration framework.** `checkVersion()` tells you the status. It does not transform profiles from one version to another. Migration is a future concern.
- **No schema registry or API.** No server hosting schemas. The JSON file ships in the npm package and lives in the git repo.
- **No runtime JSON Schema validation.** The schema is for external consumers. Within TypeScript, zod is the validator. If someone wants JSON Schema validation at runtime, they bring their own `ajv`.
- **No multi-schema output.** One `schema.json` for the full ProductProfile. Individual section schemas are not generated as separate files (but could be extracted from the full schema by consumers).
- **No backward compatibility testing automation.** The version check is manual. Automated "is this schema backward-compatible with the previous version" tooling is out of scope.

## Verification Steps

1. **Schema generates successfully:**
   ```bash
   cd packages/core && npm run build:schema
   # Exits 0, produces schema.json
   ```

2. **Schema validates against JSON Schema meta-schema:**
   ```bash
   # In a test:
   import Ajv from "ajv/dist/2020";
   const ajv = new Ajv();
   const valid = ajv.validateSchema(schema);
   expect(valid).toBe(true);
   ```

3. **Parity with zod:**
   ```typescript
   // Generate test profiles that zod accepts
   const validProfile = { basesignal_version: "1.0", identity: { ... } };
   expect(zodSchema.safeParse(validProfile).success).toBe(true);
   expect(ajv.validate(jsonSchema, validProfile)).toBe(true);

   // Generate profiles that zod rejects
   const invalidProfile = { identity: { productName: 123 } };
   expect(zodSchema.safeParse(invalidProfile).success).toBe(false);
   expect(ajv.validate(jsonSchema, invalidProfile)).toBe(false);
   ```

4. **Version field present:**
   ```typescript
   const profile = createEmptyProfile();
   expect(profile.basesignal_version).toBe("1.0");
   ```

5. **Version check utility:**
   ```typescript
   expect(checkVersion("1.0")).toBe("compatible");
   expect(checkVersion("1.1")).toBe("needs_migration"); // when SCHEMA_VERSION is "1.0"
   expect(checkVersion("2.0")).toBe("incompatible");
   ```

6. **Schema in npm package:**
   ```bash
   npm pack --dry-run
   # Output includes schema.json
   ```

7. **Staleness detection (CI test):**
   ```typescript
   // Regenerate schema in a temp dir, compare with checked-in version
   const fresh = generateSchema();
   const checked = readFileSync("schema.json", "utf-8");
   expect(JSON.parse(fresh)).toEqual(JSON.parse(checked));
   ```

## Success Criteria

- [ ] `packages/core/schema.json` exists and validates against JSON Schema Draft 2020-12 meta-schema
- [ ] JSON Schema validates the same test profiles that zod validates (parity verified by tests)
- [ ] `ProductProfile` includes `basesignal_version: "1.0"` as a required field
- [ ] `checkVersion(profile.basesignal_version)` returns `"compatible"`, `"needs_migration"`, or `"incompatible"`
- [ ] `schema.json` is included in the npm package distribution (`npm pack --dry-run` shows it)
- [ ] `npm run build:schema` regenerates `schema.json` from zod definitions
- [ ] A test detects when `schema.json` is stale relative to the zod schemas
