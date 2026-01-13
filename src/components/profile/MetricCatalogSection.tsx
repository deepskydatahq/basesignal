import { useNavigate } from "react-router-dom";
import { ProfileSection } from "./ProfileSection";
import {
  CATEGORY_INFO,
  METRIC_CATEGORIES,
  type MetricCategory,
} from "../../shared/metricTemplates";

interface Metric {
  _id: string;
  name: string;
  category: string;
}

interface MetricCatalogSectionProps {
  metrics: Metric[];
}

export function MetricCatalogSection({ metrics }: MetricCatalogSectionProps) {
  const navigate = useNavigate();

  // Group metrics by category
  const grouped = METRIC_CATEGORIES.reduce(
    (acc, category) => {
      acc[category] = metrics.filter((m) => m.category === category);
      return acc;
    },
    {} as Record<MetricCategory, Metric[]>
  );

  // Only show categories that have metrics
  const populatedCategories = METRIC_CATEGORIES.filter(
    (cat) => grouped[cat].length > 0
  );

  const hasMetrics = metrics.length > 0;
  const statusLabel = hasMetrics ? `${metrics.length} metrics` : "0 metrics";

  return (
    <ProfileSection
      title="Metric Catalog"
      status={hasMetrics ? "complete" : "not_started"}
      statusLabel={statusLabel}
      actionLabel="View Full Catalog"
      onAction={() => navigate("/metric-catalog")}
    >
      {hasMetrics ? (
        <div className="space-y-4">
          {populatedCategories.map((category) => {
            const info = CATEGORY_INFO[category];
            const categoryMetrics = grouped[category];
            return (
              <div key={category}>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  {info.label}
                </h3>
                <ul className="space-y-1">
                  {categoryMetrics.map((metric) => (
                    <li
                      key={metric._id}
                      className="text-sm text-gray-600 flex items-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                      {metric.name}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          No metrics in your catalog yet. Complete the Overview Interview to
          generate your first metrics.
        </p>
      )}
    </ProfileSection>
  );
}
