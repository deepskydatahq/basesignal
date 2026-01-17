import { useQuery } from "convex/react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { CoreIdentitySection } from "./CoreIdentitySection";
import { FirstValueSection } from "./FirstValueSection";
import { MetricCatalogSection } from "./MetricCatalogSection";
import { MeasurementPlanSection } from "./MeasurementPlanSection";
import { ProfileSection } from "./ProfileSection";

export function ProfilePage() {
  const navigate = useNavigate();
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

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header with completeness */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          {profileData.identity.productName || "Your Product"}
        </h1>
        <div className="mt-2 text-sm text-gray-500">
          {profileData.completeness.completed}/{profileData.completeness.total}
        </div>
      </div>

      <div className="space-y-6">
        <CoreIdentitySection data={profileData.identity} />

        {/* Journey Map - placeholder until component created */}
        <ProfileSection
          title="User Journey Map"
          status={profileData.journeyMap.stages.length > 0 ? "complete" : "not_started"}
          statusLabel={`${profileData.journeyMap.stages.length} stages`}
          actionLabel="View Journey"
          onAction={() => profileData.journeyMap.journeyId && navigate(`/journeys/${profileData.journeyMap.journeyId}`)}
        >
          {profileData.journeyMap.stages.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {profileData.journeyMap.stages.map((stage) => (
                <span
                  key={stage._id}
                  className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                >
                  {stage.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              Complete the overview interview to map your user journey.
            </p>
          )}
        </ProfileSection>

        <FirstValueSection />

        <MetricCatalogSection metrics={flatMetrics} />

        <MeasurementPlanSection plan={measurementPlan ?? []} />
      </div>
    </div>
  );
}
