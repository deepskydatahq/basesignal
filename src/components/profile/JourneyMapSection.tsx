// src/components/profile/JourneyMapSection.tsx

import { useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ProfileSection, type ProfileSectionStatus } from "./ProfileSection";
import { JourneyDiagram } from "./JourneyDiagram";
import { REQUIRED_SLOTS, type LifecycleSlot } from "../../shared/lifecycleSlots";
import { INTERVIEW_TYPES } from "@/shared/interviewTypes";

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

  // Determine actionLabel, onAction, and timeEstimate based on state
  let actionLabel: string | undefined;
  let actionHandler: (() => void) | undefined;
  let timeEstimate: string | undefined;

  if (!hasStages) {
    // Not started - show Start Interview with time estimate
    actionLabel = "Start Interview";
    actionHandler = () => navigate("/setup/interview");
    timeEstimate = `~${INTERVIEW_TYPES.overview.estimatedMinutes} min`;
  } else if (journeyId) {
    // Has stages - show Edit Journey
    actionLabel = "Edit Journey";
    actionHandler = () => navigate(`/journeys/${journeyId}`);
  }

  return (
    <ProfileSection
      title="Journey Map"
      status={status}
      statusLabel={statusLabel}
      actionLabel={actionLabel}
      onAction={actionHandler}
      timeEstimate={timeEstimate}
    >
      {hasStages ? (
        <JourneyDiagram
          stages={stages.map((s) => ({
            _id: s._id,
            name: s.name,
            lifecycleSlot: s.lifecycleSlot as LifecycleSlot,
            entity: s.entity,
            action: s.action,
          }))}
        />
      ) : (
        <div>
          <p className="font-medium text-gray-900">See where users thrive—and where they vanish.</p>
          <p className="text-gray-600 text-sm mt-1">
            Mapping your journey reveals the critical transitions where growth happens or stalls.
          </p>
        </div>
      )}
    </ProfileSection>
  );
}
