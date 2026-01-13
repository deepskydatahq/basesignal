import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ProfileSection, ProfileSectionStatus } from "./ProfileSection";

export function FirstValueSection() {
  const definition = useQuery(api.firstValue.getDefinition);

  // Three states: not_started (null), in_progress (defined but not confirmed), complete (confirmed)
  const status: ProfileSectionStatus = !definition
    ? "not_started"
    : definition.confirmedAt
      ? "complete"
      : "in_progress";

  const statusLabel = !definition
    ? "Not Started"
    : definition.confirmedAt
      ? "Complete"
      : "In Progress";

  const actionLabel = definition ? "Edit" : "Define";

  if (!definition) {
    return (
      <ProfileSection
        title="First Value Moment"
        status={status}
        statusLabel={statusLabel}
        actionLabel={actionLabel}
        onAction={() => {}}
      >
        <p className="text-gray-500 italic">
          Define the moment when users first experience value from your product.
        </p>
      </ProfileSection>
    );
  }

  return (
    <ProfileSection
      title="First Value Moment"
      status={status}
      statusLabel={statusLabel}
      actionLabel={actionLabel}
      onAction={() => {}}
    >
      <div className="space-y-2">
        <p className="text-gray-900 font-medium">{definition.activityName}</p>
        <p className="text-sm text-gray-500">
          Expected: {definition.expectedTimeframe}
        </p>
      </div>
    </ProfileSection>
  );
}
