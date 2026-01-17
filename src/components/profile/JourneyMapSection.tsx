// src/components/profile/JourneyMapSection.tsx

import { useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ProfileSection, type ProfileSectionStatus } from "./ProfileSection";
import { JourneyDiagram } from "./JourneyDiagram";
import { REQUIRED_SLOTS, type LifecycleSlot } from "../../shared/lifecycleSlots";

interface JourneyMapSectionProps {
  journeyId: Id<"journeys"> | null;
}

export function JourneyMapSection({ journeyId }: JourneyMapSectionProps) {
  const navigate = useNavigate();
  const stages = useQuery(
    api.stages.listByJourney,
    journeyId ? { journeyId } : "skip"
  ) ?? [];

  // Calculate status based on required slots filled
  const filledRequiredSlots = new Set(
    stages
      .filter((s) => s.lifecycleSlot && REQUIRED_SLOTS.includes(s.lifecycleSlot as LifecycleSlot))
      .map((s) => s.lifecycleSlot)
  );

  const hasStages = stages.length > 0;
  const allRequiredFilled = REQUIRED_SLOTS.every((slot) => filledRequiredSlots.has(slot));

  let status: ProfileSectionStatus = "not_started";
  let statusLabel = "Not Started";

  if (hasStages) {
    if (allRequiredFilled) {
      status = "complete";
      statusLabel = "Complete";
    } else {
      status = "in_progress";
      statusLabel = "In Progress";
    }
  }

  return (
    <ProfileSection
      title="Journey Map"
      status={status}
      statusLabel={statusLabel}
      actionLabel={journeyId ? "Edit Journey" : undefined}
      onAction={journeyId ? () => navigate(`/journeys/${journeyId}`) : undefined}
    >
      {hasStages ? (
        <JourneyDiagram
          stages={stages.map((s) => ({
            _id: s._id,
            name: s.name,
            lifecycleSlot: s.lifecycleSlot as LifecycleSlot,
          }))}
        />
      ) : (
        <p className="text-sm text-gray-500">
          Complete the overview interview to map your user journey.
        </p>
      )}
    </ProfileSection>
  );
}
