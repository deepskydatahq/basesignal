import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { MetricCard } from "@/components/metrics/MetricCard";
import { MetricDetailPanel } from "@/components/metrics/MetricDetailPanel";
import type { MetricCategory } from "@/components/metrics/CategoryBadge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Sparkles } from "lucide-react";
import { RegenerateConfirmDialog } from "@/components/measurement/RegenerateConfirmDialog";

export default function MetricCatalogPage() {
  const navigate = useNavigate();
  const metrics = useQuery(api.metrics.list, {});
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);
  const foundationStatus = useQuery(api.setupProgress.foundationStatus);
  const activities = useQuery(api.measurementPlan.listActivities);
  const generateFromOverview = useMutation(api.metricCatalog.generateFromOverview);
  const generateFromFirstValue = useMutation(api.metricCatalog.generateFromFirstValue);
  const deleteAllMetrics = useMutation(api.metricCatalog.deleteAll);

  const [isGenerating, setIsGenerating] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);

  const hasJourney = foundationStatus?.overviewInterview?.journeyId != null;
  const journeyId = foundationStatus?.overviewInterview?.journeyId;

  const handleGenerate = async () => {
    if (!journeyId) return;
    setIsGenerating(true);
    try {
      await generateFromOverview({ journeyId });
      await generateFromFirstValue({ journeyId });
    } catch (error) {
      console.error("Failed to generate metrics:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    if (!journeyId) return;
    setIsGenerating(true);
    try {
      await deleteAllMetrics({});
      await handleGenerate();
    } finally {
      setIsGenerating(false);
      setShowRegenerateDialog(false);
    }
  };

  const selectedMetric = metrics?.find((m) => m._id === selectedMetricId);

  // Lookup source activity name from metric's sourceActivityId
  function getSourceEventName(sourceActivityId: string | undefined): string | undefined {
    if (!sourceActivityId || !activities) return undefined;
    const activity = activities.find((a) => a._id === sourceActivityId);
    return activity?.name;
  }

  const handleSourceEventClick = (activityName: string) => {
    navigate("/measurement-plan", {
      state: { highlightActivity: activityName },
    });
  };

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
          {hasJourney ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Ready to generate your personalized Metric Catalog
              </p>
              <Button onClick={handleGenerate} disabled={isGenerating}>
                <Sparkles className="h-4 w-4 mr-2" />
                {isGenerating ? "Generating..." : "Generate Metric Catalog"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              Complete the Overview Interview to generate your Metric Catalog
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Metric Catalog</h1>
          <p className="mt-1 text-sm text-gray-500">Your personalized metrics for measuring product performance</p>
        </div>
        {hasJourney && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRegenerateDialog(true)}
            disabled={isGenerating}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? "animate-spin" : ""}`} />
            Regenerate
          </Button>
        )}
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
                sourceEventName={getSourceEventName(metric.sourceActivityId)}
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
              sourceEventName={getSourceEventName(selectedMetric.sourceActivityId)}
              onSourceEventClick={() => {
                const name = getSourceEventName(selectedMetric.sourceActivityId);
                if (name) handleSourceEventClick(name);
              }}
            />
          </div>
        )}
      </div>

      <RegenerateConfirmDialog
        open={showRegenerateDialog}
        onOpenChange={setShowRegenerateDialog}
        title="Regenerate Metric Catalog?"
        description="This will delete all existing metrics and generate new ones from your Overview Interview."
        onConfirm={handleRegenerate}
        isLoading={isGenerating}
      />
    </div>
  );
}
