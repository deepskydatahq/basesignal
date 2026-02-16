import { describe, it, expect } from "vitest";
import { extractJson } from "./json";

describe("extractJson", () => {
  it("parses raw JSON", () => {
    expect(extractJson('[1, 2, 3]')).toEqual([1, 2, 3]);
  });

  it("parses JSON inside code fences", () => {
    expect(extractJson('```json\n{"key": "value"}\n```')).toEqual({ key: "value" });
  });

  it("parses JSON inside generic code fences", () => {
    expect(extractJson('```\n[1, 2]\n```')).toEqual([1, 2]);
  });

  it("throws on invalid JSON", () => {
    expect(() => extractJson("not json")).toThrow();
  });
});
