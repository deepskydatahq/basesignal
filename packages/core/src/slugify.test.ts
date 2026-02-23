import { describe, it, expect } from "vitest";
import { slugify, momentIdFromName } from "./slugify";

describe("slugify", () => {
  it("converts spaces to hyphens", () => {
    expect(slugify("Drag tasks between columns")).toBe("drag-tasks-between-columns");
  });

  it("removes special characters", () => {
    expect(slugify("View (real-time) analytics!")).toBe("view-real-time-analytics");
  });

  it("collapses multiple spaces and hyphens", () => {
    expect(slugify("Create   a   dashboard")).toBe("create-a-dashboard");
    expect(slugify("hello---world")).toBe("hello-world");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });

  it("handles string with only special chars", () => {
    expect(slugify("!!!")).toBe("");
  });

  it("lowercases input", () => {
    expect(slugify("View Dashboard")).toBe("view-dashboard");
  });

  it("trims leading/trailing whitespace", () => {
    expect(slugify("  hello world  ")).toBe("hello-world");
  });

  it("preserves digits", () => {
    expect(slugify("Level 3 activation")).toBe("level-3-activation");
  });
});

describe("momentIdFromName", () => {
  it("generates moment-prefixed slug", () => {
    expect(momentIdFromName("Drag tasks between columns")).toBe(
      "moment-drag-tasks-between-columns",
    );
  });

  it("returns base slug when no duplicates", () => {
    expect(momentIdFromName("View dashboard", new Set())).toBe("moment-view-dashboard");
  });

  it("appends counter suffix on duplicate", () => {
    const existing = new Set(["moment-view-dashboard"]);
    expect(momentIdFromName("View dashboard", existing)).toBe("moment-view-dashboard-2");
  });

  it("increments counter past existing suffixes", () => {
    const existing = new Set(["moment-view-dashboard", "moment-view-dashboard-2"]);
    expect(momentIdFromName("View dashboard", existing)).toBe("moment-view-dashboard-3");
  });

  it("works with no existingIds argument", () => {
    expect(momentIdFromName("Create report")).toBe("moment-create-report");
  });
});
