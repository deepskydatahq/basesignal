import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { MetricCard } from "@/components/metrics/MetricCard";
import { MetricDetailPanel } from "@/components/metrics/MetricDetailPanel";
import type { MetricCategory } from "@/components/metrics/CategoryBadge";

export default function MetricCatalogPage() {
  const metrics = useQuery(api.metrics.list, {});
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);

  const selectedMetric = metrics?.find((m) => m._id === selectedMetricId);

  if (metrics === undefined) {
    return (
      <div className="space-y-6 max-w-6xl">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Metric Catalog</h1>
          <p className="mt-1 text-sm text-gray-500">Your personalized metrics for measuring product performance</p>
        </div>
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">Loading metrics...</p>
        </div>
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="space-y-6 max-w-6xl">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Metric Catalog</h1>
          <p className="mt-1 text-sm text-gray-500">Your personalized metrics for measuring product performance</p>
        </div>
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">
            Complete the Overview Interview to generate your Metric Catalog
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Metric Catalog</h1>
        <p className="mt-1 text-sm text-gray-500">Your personalized metrics for measuring product performance</p>
      </div>

      <div className="flex gap-6">
        {/* Metric Grid */}
        <div className="flex-1">
          <div className="grid grid-cols-2 gap-4">
            {metrics.map((metric) => (
              <MetricCard
                key={metric._id}
                name={metric.name}
                definition={metric.definition}
                category={metric.category as MetricCategory}
                selected={metric._id === selectedMetricId}
                onClick={() => setSelectedMetricId(metric._id)}
              />
            ))}
          </div>
        </div>

        {/* Detail Panel */}
        {selectedMetric && (
          <div className="w-96 flex-shrink-0">
            <MetricDetailPanel
              metric={{
                name: selectedMetric.name,
                definition: selectedMetric.definition,
                formula: selectedMetric.formula,
                category: selectedMetric.category as MetricCategory,
                whyItMatters: selectedMetric.whyItMatters,
                howToImprove: selectedMetric.howToImprove,
              }}
              onClose={() => setSelectedMetricId(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
