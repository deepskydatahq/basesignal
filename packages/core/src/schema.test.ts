import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ProductProfileSchema } from "./schema/index";
import { SCHEMA_VERSION } from "./version";

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
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
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
    const props = schema.properties ?? {};
    const required = schema.required ?? [];
    expect(props.basesignal_version).toBeDefined();
    expect(required).toContain("basesignal_version");
  });
});

describe("zod/JSON Schema parity", () => {
  test("valid profile passes both zod and JSON Schema structure check", () => {
    const validProfile = {
      basesignal_version: "1.0",
      completeness: 0,
      overallConfidence: 0,
    };
    const zodResult = ProductProfileSchema.safeParse(validProfile);
    expect(zodResult.success).toBe(true);

    // Structural check: the JSON Schema should list basesignal_version
    const schema = loadSchema();
    const props = schema.properties ?? {};
    expect(props.basesignal_version).toBeDefined();
  });

  test("profile missing basesignal_version fails zod validation", () => {
    const invalidProfile = {
      completeness: 0,
      overallConfidence: 0,
    };
    const zodResult = ProductProfileSchema.safeParse(invalidProfile);
    expect(zodResult.success).toBe(false);
  });

  test("profile with wrong type for basesignal_version fails zod validation", () => {
    const invalidProfile = {
      basesignal_version: 123,
      completeness: 0,
      overallConfidence: 0,
    };
    const zodResult = ProductProfileSchema.safeParse(invalidProfile);
    expect(zodResult.success).toBe(false);
  });
});

describe("basesignal_version in profiles", () => {
  test("valid profile includes basesignal_version 1.0", () => {
    const profile = {
      basesignal_version: "1.0",
      completeness: 0.5,
      overallConfidence: 0.8,
    };
    const result = ProductProfileSchema.safeParse(profile);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.basesignal_version).toBe("1.0");
    }
  });
});
