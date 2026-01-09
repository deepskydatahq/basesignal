import { describe, it, expect } from "vitest";
import {
  getPropertyTemplates,
  isLikelyRequired,
  inferDataType,
  DATA_TYPES,
} from "../lib/propertyTemplates";

describe("propertyTemplates", () => {
  describe("getPropertyTemplates", () => {
    it("returns account properties for 'Account' entity", () => {
      const templates = getPropertyTemplates("Account");
      expect(templates.length).toBeGreaterThan(0);
      const names = templates.map((t) => t.name);
      expect(names).toContain("created_at");
      expect(names).toContain("plan_type");
    });

    it("returns account properties for 'Organization' entity", () => {
      const templates = getPropertyTemplates("Organization");
      const names = templates.map((t) => t.name);
      expect(names).toContain("created_at");
      expect(names).toContain("mrr");
    });

    it("returns user properties for 'User' entity", () => {
      const templates = getPropertyTemplates("User");
      const names = templates.map((t) => t.name);
      expect(names).toContain("email");
      expect(names).toContain("role");
    });

    it("returns user properties for 'Member' entity", () => {
      const templates = getPropertyTemplates("Member");
      const names = templates.map((t) => t.name);
      expect(names).toContain("email");
    });

    it("returns subscription properties for 'Subscription' entity", () => {
      const templates = getPropertyTemplates("Subscription");
      const names = templates.map((t) => t.name);
      expect(names).toContain("started_at");
      expect(names).toContain("billing_interval");
    });

    it("returns project properties for 'Project' entity", () => {
      const templates = getPropertyTemplates("Project");
      const names = templates.map((t) => t.name);
      expect(names).toContain("created_at");
      expect(names).toContain("owner_id");
    });

    it("returns generic properties for unknown entity", () => {
      const templates = getPropertyTemplates("Widget");
      const names = templates.map((t) => t.name);
      expect(names).toContain("created_at");
    });

    it("is case-insensitive", () => {
      const lower = getPropertyTemplates("account");
      const upper = getPropertyTemplates("ACCOUNT");
      expect(lower).toEqual(upper);
    });

    it("sorts required properties first", () => {
      const templates = getPropertyTemplates("Account");
      const firstRequired = templates.findIndex((t) => t.isRequired);
      const lastRequired = templates.findLastIndex((t) => t.isRequired);
      const firstOptional = templates.findIndex((t) => !t.isRequired);

      // All required should come before all optional
      if (firstOptional !== -1 && lastRequired !== -1) {
        expect(lastRequired).toBeLessThan(firstOptional);
      }
    });
  });

  describe("isLikelyRequired", () => {
    it("returns true for created_at", () => {
      expect(isLikelyRequired("created_at")).toBe(true);
    });

    it("returns true for email", () => {
      expect(isLikelyRequired("email")).toBe(true);
    });

    it("returns true for id", () => {
      expect(isLikelyRequired("user_id")).toBe(true);
    });

    it("returns false for optional-looking names", () => {
      expect(isLikelyRequired("description")).toBe(false);
      expect(isLikelyRequired("notes")).toBe(false);
    });
  });

  describe("inferDataType", () => {
    it("infers timestamp for _at suffix", () => {
      expect(inferDataType("created_at")).toBe("timestamp");
      expect(inferDataType("last_active_at")).toBe("timestamp");
    });

    it("infers timestamp for _date suffix", () => {
      expect(inferDataType("birth_date")).toBe("timestamp");
    });

    it("infers number for count-like names", () => {
      expect(inferDataType("collaborator_count")).toBe("number");
      expect(inferDataType("seat_count")).toBe("number");
    });

    it("infers number for amount-like names", () => {
      expect(inferDataType("mrr")).toBe("number");
      expect(inferDataType("amount")).toBe("number");
      expect(inferDataType("seats")).toBe("number");
    });

    it("infers boolean for is_ prefix", () => {
      expect(inferDataType("is_active")).toBe("boolean");
      expect(inferDataType("is_verified")).toBe("boolean");
    });

    it("infers boolean for has_ prefix", () => {
      expect(inferDataType("has_subscription")).toBe("boolean");
    });

    it("defaults to string for unknown patterns", () => {
      expect(inferDataType("name")).toBe("string");
      expect(inferDataType("description")).toBe("string");
    });
  });

  describe("DATA_TYPES", () => {
    it("contains expected data types", () => {
      expect(DATA_TYPES).toContain("string");
      expect(DATA_TYPES).toContain("number");
      expect(DATA_TYPES).toContain("boolean");
      expect(DATA_TYPES).toContain("timestamp");
    });
  });
});
