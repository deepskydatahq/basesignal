// src/components/profile/MeasurementPlanSection.tsx

import { useNavigate } from "react-router-dom";
import { ProfileSection } from "./ProfileSection";
import type { Id } from "../../../convex/_generated/dataModel";

interface MeasurementPlanSectionProps {
  plan: Array<{
    entity: { _id: Id<"measurementEntities">; name: string };
    activities: Array<{ _id: Id<"measurementActivities">; name: string }>;
    properties: Array<{ _id: Id<"measurementProperties">; name: string }>;
  }>;
}

function PlanEntityCard({
  name,
  activities,
}: {
  name: string;
  activities: string[];
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h4 className="font-medium text-gray-900 mb-2">{name}</h4>
      {activities.length > 0 ? (
        <ul className="space-y-1">
          {activities.map((activity, i) => (
            <li key={i} className="text-sm text-gray-600 flex items-start">
              <span className="mr-2">•</span>
              <span>{activity}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-400 italic">No activities</p>
      )}
    </div>
  );
}

export function MeasurementPlanSection({
  plan,
}: MeasurementPlanSectionProps) {
  const navigate = useNavigate();

  const entityCount = plan.length;
  const activityCount = plan.reduce((sum, e) => sum + e.activities.length, 0);
  const propertyCount = plan.reduce((sum, e) => sum + e.properties.length, 0);

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
        <>
          <p className="text-sm text-gray-600 mb-4">
            {activityCount} {activityCount === 1 ? "activity" : "activities"} ·{" "}
            {propertyCount} {propertyCount === 1 ? "property" : "properties"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plan.map(({ entity, activities }) => (
              <PlanEntityCard
                key={entity._id}
                name={entity.name}
                activities={activities.map((a) => a.name)}
              />
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-500">
          No measurement plan yet. Complete the Overview Interview to generate
          your first entities and activities.
        </p>
      )}
    </ProfileSection>
  );
}
