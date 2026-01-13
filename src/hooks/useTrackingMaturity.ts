import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useTrackingMaturity() {
  const user = useQuery(api.users.current);

  return {
    trackingStatus: user?.trackingStatus,
    trackingPainPoint: user?.trackingPainPoint,
    trackingPainPointOther: user?.trackingPainPointOther,
    analyticsTools: user?.analyticsTools ?? [],
    isStartingFresh: user?.trackingStatus === "none",
    hasExistingSetup:
      user?.trackingStatus === "full" || user?.trackingStatus === "partial",
    primaryTool: user?.analyticsTools?.[0],
  };
}
