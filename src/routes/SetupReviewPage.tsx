import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Map, FileText, BarChart3, Check, ChevronRight } from "lucide-react";
import { GeneratePlanModal } from "../components/setup/GeneratePlanModal";

export default function SetupReviewPage() {
  const navigate = useNavigate();
  const user = useQuery(api.users.current);
  const progress = useQuery(api.setupProgress.current);
  const measurementEntities = useQuery(api.measurementPlan.listEntities);
  const [isSaving, setIsSaving] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const overviewJourneyId = progress?.overviewJourneyId;
  const hasMeasurementPlan = (measurementEntities?.length ?? 0) > 0;

  const metrics = useQuery(api.metrics.list, {});
  const generateFromOverview = useMutation(api.metricCatalog.generateFromOverview);
  const generateFromFirstValue = useMutation(api.metricCatalog.generateFromFirstValue);
  const [isGeneratingMetrics, setIsGeneratingMetrics] = useState(false);

  const metricsCount = metrics?.length ?? 0;
  const hasMetrics = metricsCount > 0;

  const handleGenerateMetrics = async () => {
    if (!overviewJourneyId) return;
    setIsGeneratingMetrics(true);
    try {
      await generateFromOverview({ journeyId: overviewJourneyId });
      await generateFromFirstValue({ journeyId: overviewJourneyId });
    } catch (error) {
      console.error("Failed to generate metrics:", error);
    } finally {
      setIsGeneratingMetrics(false);
    }
  };

  const handleSaveAndComplete = async () => {
    setIsSaving(true);
    try {
      // TODO: Use actual journey ID once interview creates one
      // For now, we need to create a placeholder journey
      // This will be updated when Overview Journey feature is built

      // Temporary: Complete without journey ID (will need schema update)
      // For MVP, we'll navigate to completion screen
      navigate("/setup/complete");
    } catch (error) {
      console.error("Failed to complete setup:", error);
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Review Your Foundation
        </h1>
        <p className="text-gray-600">
          Here's what we've built together. Save to complete your setup.
        </p>
      </div>

      <div className="space-y-4 mb-8">
        {/* Journey Map */}
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Map className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900">Journey Map</h3>
                <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  <Check className="w-3 h-3" />
                  Ready
                </span>
              </div>
              <p className="text-sm text-gray-600">
                {user?.productName ? `${user.productName}'s` : "Your"} core user journey from first touch to value delivery.
              </p>
              {/* TODO: Show journey map thumbnail/preview */}
              <div className="mt-3 h-32 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 text-sm">
                Journey map preview
              </div>
            </div>
          </div>
        </Card>

        {/* Measurement Plan */}
        <Card className={`p-6 ${hasMeasurementPlan ? "" : overviewJourneyId ? "" : "bg-gray-50 border-dashed"}`}>
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
              hasMeasurementPlan ? "bg-green-100" : overviewJourneyId ? "bg-purple-100" : "bg-gray-200"
            }`}>
              <FileText className={`w-6 h-6 ${
                hasMeasurementPlan ? "text-green-600" : overviewJourneyId ? "text-purple-600" : "text-gray-400"
              }`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className={`font-semibold ${hasMeasurementPlan || overviewJourneyId ? "text-gray-900" : "text-gray-400"}`}>
                  Measurement Plan
                </h3>
                {hasMeasurementPlan ? (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    <Check className="w-3 h-3" />
                    {measurementEntities?.length} entities
                  </span>
                ) : overviewJourneyId ? (
                  <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                    Ready to generate
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                    Coming soon
                  </span>
                )}
              </div>
              <p className={`text-sm ${hasMeasurementPlan || overviewJourneyId ? "text-gray-600" : "text-gray-400"}`}>
                {hasMeasurementPlan
                  ? "Entities and activities extracted from your journey."
                  : "Tracking recommendations based on your journey."}
              </p>
              {overviewJourneyId && !hasMeasurementPlan && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowGenerateModal(true)}
                >
                  Generate
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
              {hasMeasurementPlan && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => navigate("/measurement-plan")}
                >
                  View
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Metric Catalog */}
        <Card className={`p-6 ${hasMetrics ? "" : overviewJourneyId ? "" : "bg-gray-50 border-dashed"}`}>
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
              hasMetrics ? "bg-green-100" : overviewJourneyId ? "bg-amber-100" : "bg-gray-200"
            }`}>
              <BarChart3 className={`w-6 h-6 ${
                hasMetrics ? "text-green-600" : overviewJourneyId ? "text-amber-600" : "text-gray-400"
              }`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className={`font-semibold ${hasMetrics || overviewJourneyId ? "text-gray-900" : "text-gray-400"}`}>
                  Metric Catalog
                </h3>
                {hasMetrics ? (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    <Check className="w-3 h-3" />
                    {metricsCount} metrics
                  </span>
                ) : overviewJourneyId ? (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    Ready to generate
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                    Coming soon
                  </span>
                )}
              </div>
              <p className={`text-sm ${hasMetrics || overviewJourneyId ? "text-gray-600" : "text-gray-400"}`}>
                {hasMetrics
                  ? "Key metrics derived from your journey stages."
                  : "Key metrics derived from your journey stages."}
              </p>
              {overviewJourneyId && !hasMetrics && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={handleGenerateMetrics}
                  disabled={isGeneratingMetrics}
                >
                  {isGeneratingMetrics ? "Generating..." : "Generate"}
                  {!isGeneratingMetrics && <ChevronRight className="w-4 h-4 ml-1" />}
                </Button>
              )}
              {hasMetrics && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => navigate("/metric-catalog")}
                >
                  View
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      <div className="flex justify-center">
        <Button
          onClick={handleSaveAndComplete}
          disabled={isSaving}
          size="lg"
          className="px-8"
        >
          {isSaving ? "Saving..." : "Save & Complete Setup"}
        </Button>
      </div>

      {/* Generate Measurement Plan Modal */}
      {overviewJourneyId && (
        <GeneratePlanModal
          isOpen={showGenerateModal}
          onClose={() => setShowGenerateModal(false)}
          journeyId={overviewJourneyId}
          onComplete={() => setShowGenerateModal(false)}
        />
      )}
    </div>
  );
}
