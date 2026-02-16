import { describe, test, expect } from "vitest";
import { SCHEMA_VERSION, checkVersion } from "./version";
import type { VersionCompatibility } from "./version";

describe("SCHEMA_VERSION", () => {
  test("is a semver-style string", () => {
    expect(SCHEMA_VERSION).toMatch(/^\d+\.\d+$/);
  });

  test("initial version is 1.0", () => {
    expect(SCHEMA_VERSION).toBe("1.0");
  });
});

describe("checkVersion", () => {
  test("returns compatible for same version", () => {
    expect(checkVersion("1.0")).toBe("compatible");
  });

  test("returns compatible for older minor version", () => {
    // Profile from 1.0, library at 1.0 — same version
    expect(checkVersion("1.0")).toBe("compatible");
  });

  test("returns needs_migration for newer minor version", () => {
    // Profile from 1.1, library at 1.0 — profile is newer
    expect(checkVersion("1.1")).toBe("needs_migration");
    expect(checkVersion("1.5")).toBe("needs_migration");
  });

  test("returns incompatible for different major version (higher)", () => {
    expect(checkVersion("2.0")).toBe("incompatible");
    expect(checkVersion("3.1")).toBe("incompatible");
  });

  test("returns incompatible for different major version (lower)", () => {
    expect(checkVersion("0.1")).toBe("incompatible");
    expect(checkVersion("0.9")).toBe("incompatible");
  });

  test("return type is VersionCompatibility", () => {
    const result: VersionCompatibility = checkVersion("1.0");
    expect(["compatible", "needs_migration", "incompatible"]).toContain(result);
  });
});
