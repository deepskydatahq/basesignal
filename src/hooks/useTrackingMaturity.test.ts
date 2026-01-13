import { expect, test, vi, describe } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTrackingMaturity } from "./useTrackingMaturity";

// Mock useQuery to return different user states
const mockUseQuery = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: () => mockUseQuery(),
}));

describe("useTrackingMaturity", () => {
  test("returns undefined values when user has no tracking data", () => {
    mockUseQuery.mockReturnValue({
      // User without tracking data
    });

    const { result } = renderHook(() => useTrackingMaturity());

    expect(result.current.trackingStatus).toBeUndefined();
    expect(result.current.trackingPainPoint).toBeUndefined();
    expect(result.current.analyticsTools).toEqual([]);
    expect(result.current.isStartingFresh).toBe(false);
    expect(result.current.hasExistingSetup).toBe(false);
    expect(result.current.primaryTool).toBeUndefined();
  });

  test("returns tracking data from user", () => {
    mockUseQuery.mockReturnValue({
      trackingStatus: "partial",
      trackingPainPoint: "no_outcomes",
      analyticsTools: ["amplitude", "segment"],
    });

    const { result } = renderHook(() => useTrackingMaturity());

    expect(result.current.trackingStatus).toBe("partial");
    expect(result.current.trackingPainPoint).toBe("no_outcomes");
    expect(result.current.analyticsTools).toEqual(["amplitude", "segment"]);
    expect(result.current.primaryTool).toBe("amplitude");
  });

  test("isStartingFresh is true when status is none", () => {
    mockUseQuery.mockReturnValue({
      trackingStatus: "none",
      trackingPainPoint: "what_to_track",
      analyticsTools: ["none"],
    });

    const { result } = renderHook(() => useTrackingMaturity());

    expect(result.current.isStartingFresh).toBe(true);
    expect(result.current.hasExistingSetup).toBe(false);
  });

  test("hasExistingSetup is true when status is full or partial", () => {
    mockUseQuery.mockReturnValue({
      trackingStatus: "full",
      trackingPainPoint: "trust",
      analyticsTools: ["mixpanel"],
    });

    const { result } = renderHook(() => useTrackingMaturity());

    expect(result.current.isStartingFresh).toBe(false);
    expect(result.current.hasExistingSetup).toBe(true);
  });

  test("hasExistingSetup is true for partial status", () => {
    mockUseQuery.mockReturnValue({
      trackingStatus: "partial",
      trackingPainPoint: "inconsistent",
      analyticsTools: ["ga4"],
    });

    const { result } = renderHook(() => useTrackingMaturity());

    expect(result.current.hasExistingSetup).toBe(true);
  });

  test("hasExistingSetup is false for minimal status", () => {
    mockUseQuery.mockReturnValue({
      trackingStatus: "minimal",
      trackingPainPoint: "what_to_track",
      analyticsTools: ["posthog"],
    });

    const { result } = renderHook(() => useTrackingMaturity());

    expect(result.current.hasExistingSetup).toBe(false);
  });

  test("returns null values when user is null", () => {
    mockUseQuery.mockReturnValue(null);

    const { result } = renderHook(() => useTrackingMaturity());

    expect(result.current.trackingStatus).toBeUndefined();
    expect(result.current.analyticsTools).toEqual([]);
    expect(result.current.isStartingFresh).toBe(false);
    expect(result.current.hasExistingSetup).toBe(false);
  });
});
