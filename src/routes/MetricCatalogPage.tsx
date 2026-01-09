import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function MetricCatalogPage() {
  const metrics = useQuery(api.metrics.list);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Metric Catalog</h1>

      {metrics === undefined ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900" />
        </div>
      ) : metrics.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No metrics yet</p>
          <p className="text-sm text-gray-400 mt-2">
            Complete the Overview Interview to generate your Metric Catalog.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {metrics.map((metric) => (
            <div
              key={metric._id}
              className="p-4 border border-gray-200 rounded-lg"
            >
              <h3 className="font-medium text-gray-900">{metric.name}</h3>
              <p className="text-sm text-gray-500 mt-1">{metric.definition}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
