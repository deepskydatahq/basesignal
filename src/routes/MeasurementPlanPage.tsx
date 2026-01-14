import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id, Doc } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { FileText, Download, Plus, RefreshCw, Target } from "lucide-react";
import { ImportFromJourneyModal } from "@/components/measurement/ImportFromJourneyModal";
import { AddPropertyDialog } from "@/components/measurement/AddPropertyDialog";
import { AddActivityModal } from "@/components/measurement/AddActivityModal";
import { EditActivityModal } from "@/components/measurement/EditActivityModal";
import { PropertyList } from "@/components/measurement/PropertyList";
import { AddEntityDialog } from "@/components/measurement/AddEntityDialog";
import { EntityCard } from "@/components/measurement/EntityCard";
import { RegenerateConfirmDialog } from "@/components/measurement/RegenerateConfirmDialog";
import { ActivityDetailPanel } from "@/components/measurement/ActivityDetailPanel";

export default function MeasurementPlanPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const highlightFromState = (location.state as { highlightActivity?: string } | null)?.highlightActivity;
  const highlightFromUrl = searchParams.get("highlight");
  const highlightActivity = highlightFromUrl ?? highlightFromState;
  const activityRefs = useRef<Map<string, HTMLElement>>(new Map());

  const fullPlan = useQuery(api.measurementPlan.getFullPlan);
  const entities = useQuery(api.measurementPlan.listEntities);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showAddEntityDialog, setShowAddEntityDialog] = useState(false);
  const [activityEntityId, setActivityEntityId] = useState<Id<"measurementEntities"> | undefined>();
  const [addPropertyFor, setAddPropertyFor] = useState<{
    entityId: Id<"measurementEntities">;
    entityName: string;
  } | null>(null);
  const [editActivity, setEditActivity] = useState<Doc<"measurementActivities"> | null>(null);
  const [selectedActivityForPanel, setSelectedActivityForPanel] = useState<{
    id: Id<"measurementActivities">;
    name: string;
    entityName: string;
    lifecycleSlot: string;
    activityDoc: Doc<"measurementActivities">;
  } | null>(null);

  const navigate = useNavigate();
  const foundationStatus = useQuery(api.setupProgress.foundationStatus);
  const deleteAllMeasurement = useMutation(api.measurementPlan.deleteAll);
  const importFromJourneyMutation = useMutation(api.measurementPlan.importFromJourney);
  const setFirstValue = useMutation(api.measurementPlan.setFirstValue);
  const journeyDiff = useQuery(
    api.measurementPlan.computeJourneyDiff,
    foundationStatus?.overviewInterview?.journeyId
      ? { journeyId: foundationStatus.overviewInterview.journeyId }
      : "skip"
  );

  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const hasJourney = foundationStatus?.overviewInterview?.journeyId != null;
  const journeyId = foundationStatus?.overviewInterview?.journeyId;

  // Get metrics for derived metrics lookup
  const metrics = useQuery(api.metrics.list, {});

  // Helper: get derived metrics for an activity by ID
  const getDerivedMetrics = (activityId: Id<"measurementActivities">) => {
    if (!metrics) return [];

    // Find metrics referencing this activity
    return metrics
      .filter((m) => m.sourceActivityId === activityId)
      .map((m) => ({
        id: m._id,
        name: m.name,
        category: m.category,
      }));
  };

  const handleMetricClick = (metricId: Id<"metrics">) => {
    navigate(`/setup/metric-catalog?metric=${metricId}`);
  };

  const handleGenerate = async () => {
    if (!journeyId || !journeyDiff) return;
    setIsRegenerating(true);
    try {
      const allEntities = [
        ...journeyDiff.newEntities.map((e) => e.name),
        ...journeyDiff.existingEntities.map((e) => e.name),
      ];
      const allActivities = [
        ...journeyDiff.newActivities.map((a) => a.name),
        ...journeyDiff.existingActivities.map((a) => a.name),
      ];
      await importFromJourneyMutation({
        journeyId,
        selectedEntities: allEntities,
        selectedActivities: allActivities,
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleRegenerate = async () => {
    if (!journeyId || !journeyDiff) return;
    setIsRegenerating(true);
    try {
      await deleteAllMeasurement({});
      await handleGenerate();
    } finally {
      setIsRegenerating(false);
      setShowRegenerateDialog(false);
    }
  };

  // Scroll to highlighted activity when navigated from metric catalog
  useEffect(() => {
    if (highlightActivity && activityRefs.current.has(highlightActivity)) {
      const element = activityRefs.current.get(highlightActivity);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      // Clear state to avoid re-highlighting on re-renders
      window.history.replaceState({}, document.title);
    }
  }, [highlightActivity, fullPlan]);

  if (fullPlan === undefined) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Measurement Plan</h1>
            <p className="mt-1 text-sm text-gray-500">
              Entities, activities, and properties to track in your product
            </p>
          </div>
        </div>
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  const isEmpty = fullPlan.length === 0;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Measurement Plan</h1>
          <p className="mt-1 text-sm text-gray-500">
            Entities, activities, and properties to track in your product
          </p>
        </div>
        <div className="flex gap-2">
          {isEmpty && hasJourney && (
            <Button onClick={handleGenerate} disabled={isRegenerating || !journeyDiff}>
              <Download className="w-4 h-4 mr-2" />
              {isRegenerating ? "Generating..." : "Generate from Journey"}
            </Button>
          )}
          {!isEmpty && (
            <>
              <Button variant="outline" onClick={() => setShowRegenerateDialog(true)}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate
              </Button>
              <Button variant="outline" onClick={() => setShowAddEntityDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Entity
              </Button>
              <Button onClick={() => { setActivityEntityId(undefined); setShowActivityModal(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Activity
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => setShowImportModal(true)}>
            <Download className="w-4 h-4 mr-2" />
            Import from Journey
          </Button>
        </div>
      </div>

      {/* Content */}
      {isEmpty ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No measurement plan yet
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Import entities and activities from your journeys to get started.
          </p>
          <Button onClick={() => setShowImportModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Import from Journey
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {fullPlan.map(({ entity, activities, properties }) => (
            <EntityCard
              key={entity._id}
              id={entity._id}
              name={entity.name}
              description={entity.description}
              suggestedFrom={entity.suggestedFrom}
              activityCount={activities.length}
              propertyCount={properties.length}
            >
              {/* Activities section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Activities
                  </h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivityEntityId(entity._id);
                      setShowActivityModal(true);
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Activity
                  </Button>
                </div>
                {activities.length > 0 && (
                  <div className="grid gap-2">
                    {activities.map((activity) => (
                      <div
                        key={activity._id}
                        ref={(el) => {
                          if (el) activityRefs.current.set(activity.name, el);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors",
                          activity.name === highlightActivity && "ring-2 ring-blue-500 bg-blue-50"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedActivityForPanel({
                              id: activity._id,
                              name: activity.name,
                              entityName: entity.name,
                              lifecycleSlot: activity.lifecycleSlot ?? "",
                              activityDoc: activity,
                            })
                          }
                          className="flex items-center gap-2 text-left flex-1"
                        >
                          <span className="text-sm font-medium text-gray-900">
                            {activity.name}
                          </span>
                          {activity.isFirstValue && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                              First Value
                            </span>
                          )}
                        </button>
                        <div className="flex items-center gap-2">
                          {activity.lifecycleSlot && (
                            <span className="text-xs text-gray-500">
                              {activity.lifecycleSlot.replace(/_/g, " ")}
                            </span>
                          )}
                          {!activity.isFirstValue && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFirstValue({ activityId: activity._id });
                              }}
                              title="Mark as First Value"
                            >
                              <Target className="w-3.5 h-3.5 text-gray-400 hover:text-green-600" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Properties section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Properties
                  </h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAddPropertyFor({
                        entityId: entity._id,
                        entityName: entity.name,
                      });
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Property
                  </Button>
                </div>
                <PropertyList properties={properties} />
              </div>
            </EntityCard>
          ))}
        </div>
      )}

      {/* Import Modal */}
      <ImportFromJourneyModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />

      {/* Add Property Dialog */}
      {addPropertyFor && (
        <AddPropertyDialog
          entityId={addPropertyFor.entityId}
          entityName={addPropertyFor.entityName}
          isOpen={true}
          onClose={() => setAddPropertyFor(null)}
        />
      )}

      {/* Add Activity Modal */}
      {entities && (
        <AddActivityModal
          open={showActivityModal}
          onClose={() => {
            setShowActivityModal(false);
            setActivityEntityId(undefined);
          }}
          entities={entities}
          preselectedEntityId={activityEntityId}
        />
      )}

      {/* Edit Activity Modal */}
      <EditActivityModal
        open={editActivity !== null}
        onClose={() => setEditActivity(null)}
        activity={editActivity}
      />

      {/* Add Entity Dialog */}
      <AddEntityDialog
        isOpen={showAddEntityDialog}
        onClose={() => setShowAddEntityDialog(false)}
      />

      {/* Activity Detail Panel */}
      {selectedActivityForPanel && (
        <div className="fixed inset-y-0 right-0 z-40">
          <ActivityDetailPanel
            activity={{
              name: selectedActivityForPanel.name,
              entityName: selectedActivityForPanel.entityName,
              lifecycleSlot: selectedActivityForPanel.lifecycleSlot,
            }}
            derivedMetrics={getDerivedMetrics(selectedActivityForPanel.id)}
            onClose={() => setSelectedActivityForPanel(null)}
            onMetricClick={handleMetricClick}
            onEdit={() => {
              setEditActivity(selectedActivityForPanel.activityDoc);
              setSelectedActivityForPanel(null);
            }}
          />
        </div>
      )}

      {/* Regenerate Confirm Dialog */}
      <RegenerateConfirmDialog
        open={showRegenerateDialog}
        onOpenChange={setShowRegenerateDialog}
        title="Regenerate Measurement Plan?"
        description="This will delete all existing entities, activities, and properties, then regenerate them from your journey. This action cannot be undone."
        onConfirm={handleRegenerate}
        isLoading={isRegenerating}
      />
    </div>
  );
}
