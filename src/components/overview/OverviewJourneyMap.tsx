import { useQuery } from "convex/react";
import { Check, Circle } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { LIFECYCLE_SLOTS, SLOT_INFO, REQUIRED_SLOTS } from "../../../convex/overviewInterview";

interface OverviewJourneyMapProps {
  journeyId: Id<"journeys">;
}

export default function OverviewJourneyMap({ journeyId }: OverviewJourneyMapProps) {
  const activitiesBySlot = useQuery(api.overviewInterview.getActivitiesBySlot, { journeyId });
  const completionStatus = useQuery(api.overviewInterview.checkCompletionStatus, { journeyId });

  if (!activitiesBySlot) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading journey...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="space-y-6">
        {LIFECYCLE_SLOTS.map((slot) => {
          const activities = activitiesBySlot[slot] || [];
          const info = SLOT_INFO[slot];
          const isFilled = activities.length > 0;
          const isRequired = REQUIRED_SLOTS.includes(slot);

          return (
            <div key={slot} className="space-y-2">
              {/* Slot header */}
              <div className="flex items-center gap-2">
                {isFilled ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Circle className="w-4 h-4 text-gray-300" />
                )}
                <h3 className="font-medium text-gray-900">{info.name}</h3>
                {!isRequired && (
                  <span className="text-xs text-gray-400">(optional)</span>
                )}
              </div>

              {/* Activities list */}
              <div className="ml-6 space-y-1">
                {activities.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">
                    {isRequired ? "Listening..." : "No activities yet"}
                  </p>
                ) : (
                  activities.map((activity) => (
                    <div
                      key={activity._id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                      <span className="text-gray-700">
                        {activity.entity} {activity.action}
                      </span>
                      {activity.description && (
                        <span className="text-gray-400">
                          - {activity.description}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Completion status */}
      {completionStatus && (
        <div className="mt-8 pt-6 border-t border-gray-200">
          {completionStatus.canComplete ? (
            <p className="text-sm text-green-600">
              All required stages covered. Ready to complete.
            </p>
          ) : (
            <p className="text-sm text-gray-500">
              Missing: {completionStatus.missingRequired.map(s => SLOT_INFO[s as keyof typeof SLOT_INFO].name).join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
