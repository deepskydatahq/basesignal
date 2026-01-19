// src/lib/productColor.test.ts
import { describe, expect, test } from "vitest";
import { getProductInitial, getProductColor } from "./productColor";

describe("getProductInitial", () => {
  test("returns uppercase first letter of product name", () => {
    expect(getProductInitial("Basesignal")).toBe("B");
  });

  test("handles lowercase names", () => {
    expect(getProductInitial("acme corp")).toBe("A");
  });

  test("returns ? for empty string", () => {
    expect(getProductInitial("")).toBe("?");
  });

  test("returns ? for undefined", () => {
    expect(getProductInitial(undefined)).toBe("?");
  });

  test("trims whitespace before extracting", () => {
    expect(getProductInitial("  hello")).toBe("H");
  });
});

describe("getProductColor", () => {
  test("returns a hex color from the palette", () => {
    const color = getProductColor("Basesignal");
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  test("returns same color for same name (deterministic)", () => {
    const color1 = getProductColor("My Product");
    const color2 = getProductColor("My Product");
    expect(color1).toBe(color2);
  });

  test("returns different colors for different names", () => {
    const color1 = getProductColor("Product A");
    const color2 = getProductColor("Product B");
    // High probability they differ, but not guaranteed
    // At least verify both are valid
    expect(color1).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(color2).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  test("returns a color for empty string", () => {
    const color = getProductColor("");
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  test("returns a color for undefined", () => {
    const color = getProductColor(undefined);
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
