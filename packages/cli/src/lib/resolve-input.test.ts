import { describe, it, expect } from "vitest";
import { resolveInput } from "./resolve-input.js";

describe("resolveInput", () => {
  it("treats a bare string as a storage ID", () => {
    expect(resolveInput("abc123")).toEqual({ type: "storage", id: "abc123" });
  });

  it("treats a UUID as a storage ID", () => {
    expect(resolveInput("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toEqual({
      type: "storage",
      id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    });
  });

  it("treats a path with / as a file", () => {
    expect(resolveInput("./profile.json")).toEqual({
      type: "file",
      path: "./profile.json",
    });
  });

  it("treats a path with \\ as a file", () => {
    expect(resolveInput("C:\\Users\\data\\profile.json")).toEqual({
      type: "file",
      path: "C:\\Users\\data\\profile.json",
    });
  });

  it("treats a .json extension as a file", () => {
    expect(resolveInput("profile.json")).toEqual({
      type: "file",
      path: "profile.json",
    });
  });

  it("treats an absolute path as a file", () => {
    expect(resolveInput("/home/user/profile.json")).toEqual({
      type: "file",
      path: "/home/user/profile.json",
    });
  });

  it("treats a relative directory path as a file", () => {
    expect(resolveInput("data/my-profile")).toEqual({
      type: "file",
      path: "data/my-profile",
    });
  });
});
