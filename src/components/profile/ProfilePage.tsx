import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Navigate } from "react-router-dom";
import { useNavigate } from "react-router";
import { Share2, Check } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { CoreIdentitySection } from "./CoreIdentitySection";
import { FirstValueSection } from "./FirstValueSection";
import { MetricCatalogSection } from "./MetricCatalogSection";
import { MeasurementPlanSection } from "./MeasurementPlanSection";
import { JourneyMapSection } from "./JourneyMapSection";
import { SuggestedNextAction } from "./SuggestedNextAction";
import { ProfileHeader } from "./ProfileHeader";
import { ActivityTimeline } from "./ActivityTimeline";
import { FutureSectionCard } from "./FutureSectionCard";
import { INTERVIEW_TYPES } from "@/shared/interviewTypes";
import { Button } from "@/components/ui/button";

interface ProfilePageProps {
  readOnly?: boolean;
  shareToken?: string;
}

export function ProfilePage({ readOnly = false, shareToken }: ProfilePageProps) {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  // Use appropriate query based on mode
  const authProfileData = useQuery(
    api.profile.getProfileData,
    readOnly ? "skip" : {}
  );
  const sharedProfileData = useQuery(
    api.profile.getProfileByShareToken,
    readOnly && shareToken ? { shareToken } : "skip"
  );
  const profileData = readOnly ? sharedProfileData : authProfileData;

  const measurementPlan = useQuery(
    api.measurementPlan.getFullPlan,
    readOnly ? "skip" : {}
  );
  const firstValueDefinition = useQuery(
    api.firstValue.getDefinition,
    readOnly ? "skip" : {}
  );
  const getOrCreateToken = useMutation(api.profile.getOrCreateShareToken);

  const handleShare = async () => {
    const token = await getOrCreateToken();
    const url = `${window.location.origin}/p/${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Loading state
  if (profileData === undefined) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="animate-pulse text-gray-500">Loading profile...</div>
      </div>
    );
  }

  // Not found (invalid share token) or not authenticated
  if (profileData === null) {
    if (readOnly) {
      return (
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-900">Profile not found</h2>
            <p className="text-gray-600 mt-2">This shared profile link may be invalid or expired.</p>
          </div>
        </div>
      );
    }
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

  // Extract stage names for profile card
  const stageNames = profileData.journeyMap.stages?.map((s) => s.name) || [];

  // Compute next section to suggest (only for owner view)
  const sections = profileData.completeness.sections.slice(0, 5);
  const completedIds = sections.filter((s) => s.complete).map((s) => s.id);
  const navigableSections = [
    "journey_map",
    "metric_catalog",
    "measurement_plan",
  ] as const;
  const nextSection = readOnly
    ? null
    : navigableSections.find((id) => !completedIds.includes(id)) ?? null;
  const lastCompleted =
    completedIds.length > 0 ? completedIds[completedIds.length - 1] : null;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Read-only banner */}
      {readOnly && (
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
          <p className="text-sm text-gray-600">
            Viewing shared profile for <span className="font-medium text-gray-900">{profileData.identity.productName || "this product"}</span>
          </p>
        </div>
      )}

      <ProfileHeader
        identity={{
          ...profileData.identity,
          businessType: profileData.identity.businessType as "b2b" | "b2c" | undefined,
        }}
        completeness={{
          completed: profileData.completeness.completed,
          total: profileData.completeness.total,
          sections: profileData.completeness.sections.map((s) => ({
            id: s.id,
            label: s.name,
            isComplete: s.complete,
          })),
        }}
        stats={{
          metricsCount: profileData.metricCatalog.totalCount,
          entitiesCount: profileData.measurementPlan.entities.length,
          activitiesCount: profileData.measurementPlan.activityCount,
        }}
        stages={stageNames}
        profileData={{
          identity: profileData.identity,
          journeyMap: { stages: profileData.journeyMap.stages },
          metricCatalog: profileData.metricCatalog,
          measurementPlan: profileData.measurementPlan,
        }}
      />

      {/* Share button - owner only */}
      {!readOnly && (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="text-gray-600"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-1.5" />
                Link copied!
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 mr-1.5" />
                Share profile
              </>
            )}
          </Button>
        </div>
      )}

      <div className="space-y-6 mt-6">
        <div id="section-core_identity">
          <CoreIdentitySection data={profileData.identity} readOnly={readOnly} />
        </div>

        {nextSection === "journey_map" && (
          <SuggestedNextAction
            nextSection={nextSection}
            lastCompleted={lastCompleted}
          />
        )}

        <div id="section-journey_map">
          <JourneyMapSection journeyId={profileData.journeyMap.journeyId} readOnly={readOnly} />
        </div>

        {nextSection === "metric_catalog" && (
          <SuggestedNextAction
            nextSection={nextSection}
            lastCompleted={lastCompleted}
          />
        )}

        <div id="section-first_value">
          <FirstValueSection readOnly={readOnly} />
        </div>

        {/* Journey type cards - only show for owners */}
        {!readOnly && (
          <>
            <div id="section-retention">
              <FutureSectionCard
                title={INTERVIEW_TYPES.retention.name}
                description={INTERVIEW_TYPES.retention.description}
                prerequisite="Complete First Value Moment first"
                isReady={!!firstValueDefinition}
                timeEstimate={`~${INTERVIEW_TYPES.retention.estimatedMinutes} min`}
                onAction={() => navigate("/interviews/retention")}
              />
            </div>

            <div id="section-value_outcomes">
              <FutureSectionCard
                title={INTERVIEW_TYPES.value_outcomes.name}
                description={INTERVIEW_TYPES.value_outcomes.description}
                prerequisite="Complete First Value Moment first"
                isReady={!!firstValueDefinition}
                timeEstimate={`~${INTERVIEW_TYPES.value_outcomes.estimatedMinutes} min`}
                onAction={() => navigate("/interviews/value_outcomes")}
              />
            </div>

            <div id="section-value_capture">
              <FutureSectionCard
                title={INTERVIEW_TYPES.value_capture.name}
                description={INTERVIEW_TYPES.value_capture.description}
                prerequisite="Complete Value Outcomes first"
                isReady={false}
                timeEstimate={`~${INTERVIEW_TYPES.value_capture.estimatedMinutes} min`}
                onAction={() => navigate("/interviews/value_capture")}
              />
            </div>

            <div id="section-churn">
              <FutureSectionCard
                title={INTERVIEW_TYPES.churn.name}
                description={INTERVIEW_TYPES.churn.description}
                prerequisite="Complete First Value Moment and Value Outcomes first"
                isReady={false}
                timeEstimate={`~${INTERVIEW_TYPES.churn.estimatedMinutes} min`}
                onAction={() => navigate("/interviews/churn")}
              />
            </div>
          </>
        )}

        <div id="section-metric_catalog">
          <MetricCatalogSection metrics={flatMetrics} readOnly={readOnly} />
        </div>

        {nextSection === "measurement_plan" && (
          <SuggestedNextAction
            nextSection={nextSection}
            lastCompleted={lastCompleted}
          />
        )}

        <div id="section-measurement_plan">
          <MeasurementPlanSection
            plan={measurementPlan ?? []}
            readOnly={readOnly}
          />
        </div>

        {!readOnly && <ActivityTimeline />}
      </div>
    </div>
  );
}
