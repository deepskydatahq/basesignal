import { describe, expect, test } from "vitest";
import { clerkTheme, clerkAppearance } from "./clerkTheme";

describe("clerkTheme", () => {
  test("exports variables with correct color mappings", () => {
    expect(clerkTheme.variables).toBeDefined();
    expect(clerkTheme.variables?.colorPrimary).toBe("hsl(0, 0%, 0%)");
    expect(clerkTheme.variables?.colorBackground).toBe("hsl(0, 0%, 100%)");
    expect(clerkTheme.variables?.colorText).toBe("hsl(0, 0%, 7%)");
    expect(clerkTheme.variables?.colorDanger).toBe("hsl(0, 84%, 60%)");
  });

  test("exports variables with correct border radius", () => {
    expect(clerkTheme.variables?.borderRadius).toBe("0.375rem");
  });
});

describe("clerkAppearance", () => {
  test("exports elements with correct class overrides", () => {
    expect(clerkAppearance.elements).toBeDefined();
    expect(clerkAppearance.elements?.rootBox).toBe("w-full");
    expect(clerkAppearance.elements?.card).toBe("shadow-none w-full");
    expect(clerkAppearance.elements?.footerAction).toBe("hidden");
  });

  test("exports elements with correct form styling", () => {
    expect(clerkAppearance.elements?.formFieldInput).toBe("h-12");
    expect(clerkAppearance.elements?.formButtonPrimary).toContain("h-12");
    expect(clerkAppearance.elements?.formButtonPrimary).toContain("bg-neutral-900");
  });

  test("exports elements with correct typography styling", () => {
    expect(clerkAppearance.elements?.headerTitle).toContain("text-2xl");
    expect(clerkAppearance.elements?.headerTitle).toContain("font-semibold");
    expect(clerkAppearance.elements?.headerSubtitle).toContain("text-neutral-500");
  });

  test("exports elements with correct social button styling", () => {
    expect(clerkAppearance.elements?.socialButtonsBlockButton).toContain("h-12");
  });
});
