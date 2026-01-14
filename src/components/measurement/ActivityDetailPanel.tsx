import { X } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";

interface DerivedMetric {
  id: Id<"metrics">;
  name: string;
  category: string;
}

interface ActivityDetailPanelProps {
  activity: {
    name: string;
    entityName: string;
    lifecycleSlot: string;
  } | null;
  derivedMetrics: DerivedMetric[];
  onClose: () => void;
  onMetricClick: (metricId: Id<"metrics">) => void;
}

export function ActivityDetailPanel({
  activity,
  onClose,
}: ActivityDetailPanelProps) {
  if (!activity) return null;

  return (
    <aside
      role="complementary"
      className="w-96 h-full bg-white border-l border-gray-200 shadow-lg overflow-y-auto"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-start">
        <div>
          <h2 className="text-lg font-medium text-gray-900">{activity.name}</h2>
          <p className="text-sm text-gray-500 mt-1">{activity.entityName}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="p-1 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content placeholder for now */}
      <div className="p-4">
        {/* Derived metrics section added in next task */}
      </div>
    </aside>
  );
}
