// src/components/profile/MeasurementPlanSection.tsx

import { useNavigate } from "react-router-dom";
import { ProfileSection } from "./ProfileSection";
import { Badge } from "../ui/badge";
import type { Id } from "../../../convex/_generated/dataModel";

interface MeasurementPlanSectionProps {
  plan: Array<{
    entity: { _id: Id<"measurementEntities">; name: string };
    activities: Array<{ _id: Id<"measurementActivities">; name: string }>;
    properties: Array<{ _id: Id<"measurementProperties">; name: string }>;
  }>;
  primaryEntityId?: Id<"measurementEntities">;
}

export function MeasurementPlanSection({
  plan,
  primaryEntityId,
}: MeasurementPlanSectionProps) {
  const navigate = useNavigate();

  const entityCount = plan.length;
  const hasEntities = entityCount > 0;
  const statusLabel = hasEntities
    ? `${entityCount} ${entityCount === 1 ? "entity" : "entities"}`
    : "Not started";

  return (
    <ProfileSection
      title="Measurement Plan"
      status={hasEntities ? "complete" : "not_started"}
      statusLabel={statusLabel}
      actionLabel="View Full Plan"
      onAction={() => navigate("/measurement-plan")}
    >
      {hasEntities ? (
        <div
          data-testid="entity-diagram"
          className="flex items-center gap-2 overflow-x-auto py-2"
        >
          {plan.map(({ entity, activities }, index) => {
            const isLast = index === plan.length - 1;
            const isPrimary = entity._id === primaryEntityId;
            const activityText =
              activities.length === 1 ? "activity" : "activities";

            return (
              <div key={entity._id} className="flex items-center">
                {/* Entity node */}
                <div className="flex flex-col items-center justify-center w-28 h-16 rounded-lg border-2 border-gray-300 bg-gray-50 px-2">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-gray-900 text-center truncate max-w-20">
                      {entity.name}
                    </span>
                    {isPrimary && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">
                        Primary
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 mt-1">
                    {activities.length} {activityText}
                  </span>
                </div>

                {/* Connector line */}
                {!isLast && (
                  <svg
                    className="w-6 h-4 text-gray-300 mx-1"
                    viewBox="0 0 24 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="0" y1="8" x2="24" y2="8" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          <p className="font-medium text-gray-900">The blueprint for understanding user behavior.</p>
          <p className="text-gray-600 text-sm mt-1">
            Entities and activities reveal what users do and how they move through your product.
          </p>
        </div>
      )}
    </ProfileSection>
  );
}
