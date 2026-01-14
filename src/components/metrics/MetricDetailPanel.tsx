import { X, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { CategoryBadge, type MetricCategory } from "./CategoryBadge";

interface MetricData {
  name: string;
  definition: string;
  formula: string;
  category: MetricCategory;
  whyItMatters: string;
  howToImprove: string;
}

interface MetricDetailPanelProps {
  metric: MetricData;
  onClose: () => void;
  sourceEventName?: string;
  onSourceEventClick?: () => void;
  sourceActivityName?: string;
}

export function MetricDetailPanel({
  metric,
  onClose,
  sourceEventName,
  onSourceEventClick,
  sourceActivityName,
}: MetricDetailPanelProps) {
  return (
    <aside
      role="complementary"
      className="w-96 h-full bg-white border-l border-gray-200 shadow-lg overflow-y-auto"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-start">
        <div>
          <h2 className="text-lg font-medium text-gray-900">{metric.name}</h2>
          <CategoryBadge category={metric.category} className="mt-1" />
        </div>
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="p-1 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Definition */}
        <section>
          <h3 className="text-sm font-medium text-gray-700 mb-1">Definition</h3>
          <p className="text-sm text-gray-900">{metric.definition}</p>
        </section>

        {/* Formula */}
        <section>
          <h3 className="text-sm font-medium text-gray-700 mb-1">Formula</h3>
          <p className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded">
            {metric.formula}
          </p>
        </section>

        {/* Why It Matters */}
        <section>
          <h3 className="text-sm font-medium text-gray-700 mb-1">Why It Matters</h3>
          <p className="text-sm text-gray-600">{metric.whyItMatters}</p>
        </section>

        {/* How to Improve */}
        <section>
          <h3 className="text-sm font-medium text-gray-700 mb-1">How to Improve</h3>
          <p className="text-sm text-gray-600">{metric.howToImprove}</p>
        </section>

        {/* Source Event */}
        {sourceEventName && (
          <section>
            <h3 className="text-sm font-medium text-gray-700 mb-1">Source Event</h3>
            <button
              onClick={onSourceEventClick}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              {sourceEventName}
            </button>
          </section>
        )}

        {/* Source Activity */}
        {sourceActivityName && (
          <section className="pt-4 border-t">
            <h3 className="text-sm font-medium text-gray-700 mb-1">Source Activity</h3>
            <Link
              to={`/measurement-plan?highlight=${encodeURIComponent(sourceActivityName)}`}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              {sourceActivityName}
              <ArrowRight className="w-3 h-3" />
            </Link>
          </section>
        )}
      </div>
    </aside>
  );
}
