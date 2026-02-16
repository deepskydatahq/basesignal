import { describe, test, expect } from "vitest";
import { toJSONSchema } from "zod/v4";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ProductProfileSchema } from "./schema/index";
import { SCHEMA_VERSION } from "./version";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("schema staleness", () => {
  test("schema.json matches current zod schema definitions", () => {
    // Regenerate from zod
    const fresh = toJSONSchema(ProductProfileSchema);

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
