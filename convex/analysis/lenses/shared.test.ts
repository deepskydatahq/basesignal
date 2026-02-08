import { describe, it, expect } from "vitest";
import { extractJson } from "./shared";

describe("extractJson", () => {
  it("parses raw JSON object", () => {
    const result = extractJson('{"name": "test", "count": 5}');
    expect(result).toEqual({ name: "test", count: 5 });
  });

  it("parses raw JSON array", () => {
    const result = extractJson('[{"name": "a"}, {"name": "b"}]');
    expect(result).toEqual([{ name: "a" }, { name: "b" }]);
  });

  it("extracts JSON from ```json code fence", () => {
    const text = '```json\n{"name": "test"}\n```';
    const result = extractJson(text);
    expect(result).toEqual({ name: "test" });
  });

  it("extracts JSON from ``` code fence without language tag", () => {
    const text = '```\n{"name": "test"}\n```';
    const result = extractJson(text);
    expect(result).toEqual({ name: "test" });
  });

  it("handles code fence with surrounding text", () => {
    const text = 'Here is the result:\n\n```json\n[{"name": "a"}]\n```\n\nDone.';
    const result = extractJson(text);
    expect(result).toEqual([{ name: "a" }]);
  });

  it("throws on invalid JSON", () => {
    expect(() => extractJson("not json")).toThrow();
  });

  it("throws on empty string", () => {
    expect(() => extractJson("")).toThrow("Empty response text");
  });

  it("throws on whitespace-only string", () => {
    expect(() => extractJson("   \n  ")).toThrow("Empty response text");
  });
});
