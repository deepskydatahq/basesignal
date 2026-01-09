import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Trash2 } from "lucide-react";
import { RegenerateConfirmDialog } from "@/components/measurement/RegenerateConfirmDialog";

export function DevToolsSection() {
  const foundationStatus = useQuery(api.setupProgress.foundationStatus);

  const deleteAllMeasurement = useMutation(api.measurementPlan.deleteAll);
  const deleteAllMetrics = useMutation(api.metricCatalog.deleteAll);
  const importFromJourney = useMutation(api.measurementPlan.importFromJourney);
  const generateFromOverview = useMutation(api.metricCatalog.generateFromOverview);
  const generateFromFirstValue = useMutation(api.metricCatalog.generateFromFirstValue);

  const journeyDiff = useQuery(
    api.measurementPlan.computeJourneyDiff,
    foundationStatus?.overviewInterview?.journeyId
      ? { journeyId: foundationStatus.overviewInterview.journeyId }
      : "skip"
  );

  const [isRegeneratingPlan, setIsRegeneratingPlan] = useState(false);
  const [isRegeneratingMetrics, setIsRegeneratingMetrics] = useState(false);
  const [isResettingAll, setIsResettingAll] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

  const journeyId = foundationStatus?.overviewInterview?.journeyId;
  const hasJourney = journeyId != null;
  const entitiesCount = foundationStatus?.measurementPlan?.entitiesCount ?? 0;
  const metricsCount = foundationStatus?.metricCatalog?.metricsCount ?? 0;

  const handleRegeneratePlan = async () => {
    if (!journeyId || !journeyDiff) return;
    setIsRegeneratingPlan(true);
    try {
      await deleteAllMeasurement({});
      const allEntities = [
        ...journeyDiff.newEntities.map((e) => e.name),
        ...journeyDiff.existingEntities.map((e) => e.name),
      ];
      const allActivities = [
        ...journeyDiff.newActivities.map((a) => a.name),
        ...journeyDiff.existingActivities.map((a) => a.name),
      ];
      await importFromJourney({
        journeyId,
        selectedEntities: allEntities,
        selectedActivities: allActivities,
      });
    } finally {
      setIsRegeneratingPlan(false);
    }
  };

  const handleRegenerateMetrics = async () => {
    if (!journeyId) return;
    setIsRegeneratingMetrics(true);
    try {
      await deleteAllMetrics({});
      await generateFromOverview({ journeyId });
      await generateFromFirstValue({ journeyId });
    } finally {
      setIsRegeneratingMetrics(false);
    }
  };

  const handleResetAll = async () => {
    setIsResettingAll(true);
    try {
      await deleteAllMeasurement({});
      await deleteAllMetrics({});
    } finally {
      setIsResettingAll(false);
      setShowResetDialog(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Developer Tools</CardTitle>
          <CardDescription>
            Testing and debugging tools for the measurement foundation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status */}
          <div className="text-sm space-y-1">
            <p className="text-gray-600">
              <span className="font-medium">Measurement Plan:</span> {entitiesCount} entities
            </p>
            <p className="text-gray-600">
              <span className="font-medium">Metric Catalog:</span> {metricsCount} metrics
            </p>
            <p className="text-gray-600">
              <span className="font-medium">Journey:</span>{" "}
              {hasJourney ? "Available" : "Not completed"}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegeneratePlan}
              disabled={!hasJourney || isRegeneratingPlan || !journeyDiff}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRegeneratingPlan ? "animate-spin" : ""}`} />
              {isRegeneratingPlan ? "Regenerating..." : "Regenerate Measurement Plan"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerateMetrics}
              disabled={!hasJourney || isRegeneratingMetrics}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRegeneratingMetrics ? "animate-spin" : ""}`} />
              {isRegeneratingMetrics ? "Regenerating..." : "Regenerate Metric Catalog"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResetDialog(true)}
              disabled={isResettingAll || (entitiesCount === 0 && metricsCount === 0)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Reset All
            </Button>
          </div>
        </CardContent>
      </Card>

      <RegenerateConfirmDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        title="Reset Measurement Foundation?"
        description="This will delete all entities, activities, properties, and metrics. This action cannot be undone."
        onConfirm={handleResetAll}
        isLoading={isResettingAll}
      />
    </>
  );
}
