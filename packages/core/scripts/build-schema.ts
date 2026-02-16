// packages/core/scripts/build-schema.ts
//
// Generates schema.json from the ProductProfile zod schema using zod v4's
// native toJSONSchema(). Run via: npm run build:schema

import { toJSONSchema } from "zod/v4";
import { ProductProfileSchema } from "../src/schema/index";
import { SCHEMA_VERSION } from "../src/version";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const jsonSchema = toJSONSchema(ProductProfileSchema);

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
