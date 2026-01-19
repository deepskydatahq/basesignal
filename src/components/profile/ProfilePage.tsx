import { useQuery } from "convex/react";
import { Navigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { CoreIdentitySection } from "./CoreIdentitySection";
import { FirstValueSection } from "./FirstValueSection";
import { MetricCatalogSection } from "./MetricCatalogSection";
import { MeasurementPlanSection } from "./MeasurementPlanSection";
import { JourneyMapSection } from "./JourneyMapSection";
import { SuggestedNextAction } from "./SuggestedNextAction";
import { ProfileHeader } from "./ProfileHeader";

export function ProfilePage() {
  const profileData = useQuery(api.profile.getProfileData);
  const measurementPlan = useQuery(api.measurementPlan.getFullPlan);

  // Loading state
  if (profileData === undefined) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="animate-pulse text-gray-500">Loading profile...</div>
      </div>
    );
  }

  // Not authenticated
  if (profileData === null) {
    return <Navigate to="/sign-in" />;
  }

  // Flatten metrics from grouped structure
  const flatMetrics = Object.values(profileData.metricCatalog.metrics)
    .flat()
    .map((m) => ({
      _id: m._id,
      name: m.name,
      category: m.category,
    }));

  // Compute next section to suggest
  const sections = profileData.completeness.sections.slice(0, 5);
  const completedIds = sections.filter((s) => s.complete).map((s) => s.id);
  const navigableSections = [
    "journey_map",
    "metric_catalog",
    "measurement_plan",
  ] as const;
  const nextSection =
    navigableSections.find((id) => !completedIds.includes(id)) ?? null;
  const lastCompleted =
    completedIds.length > 0 ? completedIds[completedIds.length - 1] : null;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <ProfileHeader
        identity={profileData.identity}
        completeness={profileData.completeness}
      />

      <div className="space-y-6">
        <CoreIdentitySection data={profileData.identity} />

        {nextSection === "journey_map" && (
          <SuggestedNextAction
            nextSection={nextSection}
            lastCompleted={lastCompleted}
          />
        )}

        <JourneyMapSection journeyId={profileData.journeyMap.journeyId} />

        {nextSection === "metric_catalog" && (
          <SuggestedNextAction
            nextSection={nextSection}
            lastCompleted={lastCompleted}
          />
        )}

        <FirstValueSection />

        <MetricCatalogSection metrics={flatMetrics} />

        {nextSection === "measurement_plan" && (
          <SuggestedNextAction
            nextSection={nextSection}
            lastCompleted={lastCompleted}
          />
        )}

        <MeasurementPlanSection plan={measurementPlan ?? []} />
      </div>
    </div>
  );
}
