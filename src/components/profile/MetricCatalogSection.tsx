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
  readOnly?: boolean;
}

export function MetricCatalogSection({ metrics, readOnly = false }: MetricCatalogSectionProps) {
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

  // Find categories with no metrics
  const missingCategories = METRIC_CATEGORIES.filter(
    (cat) => grouped[cat].length === 0
  );

  const hasMetrics = metrics.length > 0;
  const statusLabel = hasMetrics ? `${metrics.length} metrics` : "0 metrics";

  return (
    <ProfileSection
      title="Metric Catalog"
      status={hasMetrics ? "complete" : "not_started"}
      statusLabel={statusLabel}
      actionLabel={readOnly ? undefined : "View Full Catalog"}
      onAction={readOnly ? undefined : () => navigate("/metric-catalog")}
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
          {missingCategories.length > 0 && (
            <p className="text-sm text-gray-400 italic border-t border-dashed border-gray-200 pt-3">
              Missing:{" "}
              {missingCategories
                .map((cat) => `${CATEGORY_INFO[cat].label} (0)`)
                .join(", ")}
            </p>
          )}
        </div>
      ) : (
        <div>
          <p className="font-medium text-gray-900">Your product's vital signs, waiting to be measured.</p>
          <p className="text-gray-600 text-sm mt-1">
            Discover which numbers actually matter for your business.
          </p>
        </div>
      )}
    </ProfileSection>
  );
}
