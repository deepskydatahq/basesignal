// src/components/profile/JourneyDiagram.tsx

import {
  LIFECYCLE_SLOTS,
  SLOT_INFO,
  type LifecycleSlot,
} from "../../shared/lifecycleSlots";

interface Stage {
  _id: string;
  name: string;
  lifecycleSlot: LifecycleSlot;
  entity?: string;
  action?: string;
}

interface JourneyDiagramProps {
  stages: Stage[];
}

export function JourneyDiagram({ stages }: JourneyDiagramProps) {
  // Group stages by slot (first stage per slot wins)
  const stageBySlot = new Map<LifecycleSlot, Stage>();
  stages.forEach((stage) => {
    if (stage.lifecycleSlot && !stageBySlot.has(stage.lifecycleSlot)) {
      stageBySlot.set(stage.lifecycleSlot, stage);
    }
  });

  return (
    <div
      data-testid="journey-diagram"
      className="flex items-center gap-1 overflow-x-auto py-2"
    >
      {LIFECYCLE_SLOTS.map((slot, index) => {
        const stage = stageBySlot.get(slot);
        const isLast = index === LIFECYCLE_SLOTS.length - 1;

        // Compute status: empty, partial, complete
        const isEmpty = !stage;
        const isComplete = stage?.entity && stage?.action;
        const isPartial = stage && !isComplete;

        // Status-based styling
        let borderClass = "border-dashed border-gray-300";
        let bgClass = "bg-gray-50";
        let textClass = "text-gray-400";

        if (isComplete) {
          borderClass = "border-solid border-blue-500";
          bgClass = "bg-blue-50";
          textClass = "text-blue-600";
        } else if (isPartial) {
          borderClass = "border-solid border-amber-500";
          bgClass = "bg-amber-50";
          textClass = "text-amber-600";
        }

        return (
          <div key={slot} className="flex items-center" data-slot={slot}>
            {/* Slot box */}
            <div
              className={`
                flex flex-col items-center justify-center
                w-28 h-20 rounded-lg border-2 px-2
                ${borderClass} ${bgClass}
              `}
            >
              <span className={`text-xs font-medium ${textClass}`}>
                {SLOT_INFO[slot].name}
              </span>
              {stage && (
                <span className="text-sm font-semibold text-gray-900 text-center truncate w-full mt-1">
                  {stage.name}
                </span>
              )}
            </div>

            {/* Arrow */}
            {!isLast && (
              <svg
                className="w-6 h-6 text-gray-400 mx-1"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}
