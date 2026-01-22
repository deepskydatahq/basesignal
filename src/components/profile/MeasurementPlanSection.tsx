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

function PlanEntityCard({
  name,
  activities,
  activityCount,
  propertyCount,
  isPrimary,
}: {
  name: string;
  activities: string[];
  activityCount: number;
  propertyCount: number;
  isPrimary?: boolean;
}) {
  const activityText = activityCount === 1 ? "activity" : "activities";
  const propertyText = propertyCount === 1 ? "property" : "properties";

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <h4 className="font-medium text-gray-900">{name}</h4>
        {isPrimary && <Badge variant="secondary">Primary</Badge>}
      </div>
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
      <p className="text-sm text-slate-500 mt-3">
        {activityCount} {activityText} · {propertyCount} {propertyText}
      </p>
    </div>
  );
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plan.map(({ entity, activities, properties }) => (
            <PlanEntityCard
              key={entity._id}
              name={entity.name}
              activities={activities.map((a) => a.name)}
              activityCount={activities.length}
              propertyCount={properties.length}
              isPrimary={entity._id === primaryEntityId}
            />
          ))}
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
