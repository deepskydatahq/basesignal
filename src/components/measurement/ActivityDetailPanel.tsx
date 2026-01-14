import { X, ChevronRight, Pencil } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";
import { CategoryBadge, type MetricCategory } from "../metrics/CategoryBadge";

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
  onEdit?: () => void;
}

export function ActivityDetailPanel({
  activity,
  derivedMetrics,
  onClose,
  onMetricClick,
  onEdit,
}: ActivityDetailPanelProps) {
  if (!activity) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        data-testid="activity-panel-backdrop"
        onClick={onClose}
        className="fixed inset-0 bg-black/20"
      />
      <aside
        role="complementary"
        className="w-96 h-full bg-white border-l border-gray-200 shadow-lg overflow-y-auto relative z-10"
      >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-start">
        <div>
          <h2 className="text-lg font-medium text-gray-900">{activity.name}</h2>
          <p className="text-sm text-gray-500 mt-1">{activity.entityName}</p>
        </div>
        <div className="flex gap-1">
          {onEdit && (
            <button
              onClick={onEdit}
              aria-label="Edit activity"
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <Pencil className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
          Derived Metrics
        </h3>

        {derivedMetrics.length === 0 ? (
          <p className="text-sm text-gray-500">
            No metrics derived from this activity yet. Metrics are generated when you complete the journey setup.
          </p>
        ) : (
          <ul className="space-y-2">
            {derivedMetrics.map((metric) => (
              <li key={metric.id}>
                <button
                  onClick={() => onMetricClick(metric.id)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
                >
                  <div>
                    <span className="text-sm font-medium text-gray-900 block">
                      {metric.name}
                    </span>
                    <CategoryBadge
                      category={metric.category as MetricCategory}
                      className="mt-1"
                    />
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      </aside>
    </>
  );
}
