import { describe, it, expect } from "vitest";
import { EntityModelSchema } from "../entities";

const validEntities = {
  items: [{ name: "User", type: "core", properties: ["email", "name"] }],
  relationships: [{ from: "User", to: "Workspace", type: "belongs_to" }],
  confidence: 0.8,
  evidence: [{ url: "https://example.com", excerpt: "Entity info" }],
};

describe("EntityModelSchema", () => {
  it("accepts valid entities with items and relationships", () => {
    expect(EntityModelSchema.safeParse(validEntities).success).toBe(true);
  });

  it("accepts empty items array", () => {
    const data = { ...validEntities, items: [] };
    expect(EntityModelSchema.safeParse(data).success).toBe(true);
  });

  it("rejects entity item with missing name", () => {
    const data = {
      ...validEntities,
      items: [{ type: "core", properties: [] }],
    };
    expect(EntityModelSchema.safeParse(data).success).toBe(false);
  });

  it("rejects relationship with missing from", () => {
    const data = {
      ...validEntities,
      relationships: [{ to: "Workspace", type: "belongs_to" }],
    };
    expect(EntityModelSchema.safeParse(data).success).toBe(false);
  });
});
