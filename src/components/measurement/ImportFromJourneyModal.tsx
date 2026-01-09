import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Check, ChevronDown, Plus, Minus } from "lucide-react";
import { getPropertyTemplates } from "@/lib/propertyTemplates";

interface ImportFromJourneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

// Journey type labels for display
const JOURNEY_TYPE_LABELS: Record<string, string> = {
  overview: "Overview Interview",
  first_value: "First Value",
  retention: "Retention",
  value_outcomes: "Value Outcomes",
  value_capture: "Value Capture",
  churn: "Churn",
};

// Property selection state per entity
interface PropertySelection {
  entityName: string;
  propertyName: string;
  dataType: string;
  isRequired: boolean;
  isSelected: boolean;
}

export function ImportFromJourneyModal({
  isOpen,
  onClose,
  onComplete,
}: ImportFromJourneyModalProps) {
  const journeys = useQuery(api.journeys.listByUser);
  const [selectedJourneyId, setSelectedJourneyId] = useState<Id<"journeys"> | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Selection state
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set());
  const [selectedActivities, setSelectedActivities] = useState<Set<string>>(new Set());
  const [propertySelections, setPropertySelections] = useState<PropertySelection[]>([]);
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get diff data when journey is selected
  const diff = useQuery(
    api.measurementPlan.computeJourneyDiff,
    selectedJourneyId ? { journeyId: selectedJourneyId } : "skip"
  );

  const importFromJourney = useMutation(api.measurementPlan.importFromJourneyIncremental);

  // Initialize selections when diff data loads
  useEffect(() => {
    if (diff) {
      // Select all new entities by default
      const newEntityNames = new Set(diff.newEntities.map((e) => e.name));
      setSelectedEntities(newEntityNames);

      // Select all new activities by default
      const newActivityNames = new Set(diff.newActivities.map((a) => a.name));
      setSelectedActivities(newActivityNames);

      // Expand all new entities by default
      setExpandedEntities(new Set(newEntityNames));

      // Generate property suggestions for new entities
      const properties: PropertySelection[] = [];
      for (const entity of diff.newEntities) {
        const templates = getPropertyTemplates(entity.name);
        for (const template of templates) {
          properties.push({
            entityName: entity.name,
            propertyName: template.name,
            dataType: template.dataType,
            isRequired: template.isRequired,
            isSelected: template.isRequired, // Select required properties by default
          });
        }
      }
      setPropertySelections(properties);
    }
  }, [diff]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedJourneyId(null);
      setSelectedEntities(new Set());
      setSelectedActivities(new Set());
      setPropertySelections([]);
      setExpandedEntities(new Set());
    }
  }, [isOpen]);

  const selectedJourney = useMemo(() => {
    if (!journeys || !selectedJourneyId) return null;
    return journeys.find((j) => j._id === selectedJourneyId);
  }, [journeys, selectedJourneyId]);

  const toggleEntity = (entityName: string) => {
    setSelectedEntities((prev) => {
      const next = new Set(prev);
      if (next.has(entityName)) {
        next.delete(entityName);
        // Also deselect activities for this entity
        if (diff) {
          const entityActivities = diff.newActivities
            .filter((a) => a.entityName === entityName)
            .map((a) => a.name);
          setSelectedActivities((activities) => {
            const nextActivities = new Set(activities);
            for (const actName of entityActivities) {
              nextActivities.delete(actName);
            }
            return nextActivities;
          });
        }
      } else {
        next.add(entityName);
        // Also select activities for this entity
        if (diff) {
          const entityActivities = diff.newActivities
            .filter((a) => a.entityName === entityName)
            .map((a) => a.name);
          setSelectedActivities((activities) => {
            const nextActivities = new Set(activities);
            for (const actName of entityActivities) {
              nextActivities.add(actName);
            }
            return nextActivities;
          });
        }
      }
      return next;
    });
  };

  const toggleActivity = (activityName: string) => {
    setSelectedActivities((prev) => {
      const next = new Set(prev);
      if (next.has(activityName)) {
        next.delete(activityName);
      } else {
        next.add(activityName);
      }
      return next;
    });
  };

  const toggleProperty = (entityName: string, propertyName: string) => {
    setPropertySelections((prev) =>
      prev.map((p) =>
        p.entityName === entityName && p.propertyName === propertyName
          ? { ...p, isSelected: !p.isSelected }
          : p
      )
    );
  };

  const toggleEntityExpanded = (entityName: string) => {
    setExpandedEntities((prev) => {
      const next = new Set(prev);
      if (next.has(entityName)) {
        next.delete(entityName);
      } else {
        next.add(entityName);
      }
      return next;
    });
  };

  const hasSelections = useMemo(() => {
    return selectedEntities.size > 0 || selectedActivities.size > 0;
  }, [selectedEntities, selectedActivities]);

  const handleImport = async () => {
    if (!selectedJourneyId) return;

    setIsSubmitting(true);
    try {
      const selectedProps = propertySelections
        .filter((p) => p.isSelected && selectedEntities.has(p.entityName))
        .map((p) => ({
          entityName: p.entityName,
          propertyName: p.propertyName,
          dataType: p.dataType,
          isRequired: p.isRequired,
        }));

      await importFromJourney({
        journeyId: selectedJourneyId,
        selectedEntities: Array.from(selectedEntities),
        selectedActivities: Array.from(selectedActivities),
        selectedProperties: selectedProps,
      });

      onComplete?.();
      onClose();
    } catch (error) {
      console.error("Failed to import from journey:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = journeys === undefined;
  const isDiffLoading = selectedJourneyId !== null && diff === undefined;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import from Journey</DialogTitle>
          <DialogDescription>
            Import entities and activities from your journeys. Items already in
            your measurement plan will be skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Journey Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Select Journey
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2 border rounded-md bg-white text-left text-sm hover:bg-gray-50"
                disabled={isLoading}
              >
                <span className={selectedJourney ? "text-gray-900" : "text-gray-500"}>
                  {isLoading
                    ? "Loading..."
                    : selectedJourney
                      ? `${selectedJourney.name} (${JOURNEY_TYPE_LABELS[selectedJourney.type] || selectedJourney.type})`
                      : "Choose a journey..."}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>

              {isDropdownOpen && journeys && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {journeys.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      No journeys found
                    </div>
                  ) : (
                    journeys.map((journey) => (
                      <button
                        key={journey._id}
                        type="button"
                        onClick={() => {
                          setSelectedJourneyId(journey._id);
                          setIsDropdownOpen(false);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-100 text-left"
                      >
                        <span className="font-medium">{journey.name}</span>
                        <span className="text-xs text-gray-500">
                          {JOURNEY_TYPE_LABELS[journey.type] || journey.type}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Diff Display */}
          {selectedJourneyId && (
            <div className="space-y-4">
              {isDiffLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Analyzing journey...
                </div>
              ) : diff && (diff.newEntities.length > 0 || diff.newActivities.length > 0) ? (
                <>
                  {/* NEW Items Section */}
                  {diff.newEntities.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                        <Plus className="w-4 h-4" />
                        New Items
                      </div>

                      {diff.newEntities.map((entity) => {
                        const entityActivities = diff.newActivities.filter(
                          (a) => a.entityName === entity.name
                        );
                        const entityProperties = propertySelections.filter(
                          (p) => p.entityName === entity.name
                        );
                        const isExpanded = expandedEntities.has(entity.name);

                        return (
                          <div
                            key={entity.name}
                            className="border border-green-200 rounded-lg overflow-hidden bg-green-50/50"
                          >
                            {/* Entity Header */}
                            <div className="px-4 py-3 flex items-center gap-3 bg-green-50 border-b border-green-200">
                              <Checkbox
                                checked={selectedEntities.has(entity.name)}
                                onCheckedChange={() => toggleEntity(entity.name)}
                                id={`entity-${entity.name}`}
                              />
                              <label
                                htmlFor={`entity-${entity.name}`}
                                className="font-medium text-gray-900 cursor-pointer flex-1"
                              >
                                {entity.name}
                              </label>
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                NEW
                              </span>
                              {(entityActivities.length > 0 || entityProperties.length > 0) && (
                                <button
                                  type="button"
                                  onClick={() => toggleEntityExpanded(entity.name)}
                                  className="text-gray-500 hover:text-gray-700"
                                >
                                  <ChevronDown
                                    className={`w-4 h-4 transition-transform ${
                                      isExpanded ? "rotate-180" : ""
                                    }`}
                                  />
                                </button>
                              )}
                            </div>

                            {/* Activities and Properties */}
                            {isExpanded && (
                              <div className="px-4 py-2 space-y-3">
                                {/* Activities */}
                                {entityActivities.length > 0 && (
                                  <div className="space-y-1">
                                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                      Activities
                                    </div>
                                    {entityActivities.map((activity) => (
                                      <div
                                        key={activity.name}
                                        className="flex items-center gap-3 py-1 pl-4"
                                      >
                                        <Checkbox
                                          checked={selectedActivities.has(activity.name)}
                                          onCheckedChange={() => toggleActivity(activity.name)}
                                          id={`activity-${activity.name}`}
                                          disabled={!selectedEntities.has(entity.name)}
                                        />
                                        <label
                                          htmlFor={`activity-${activity.name}`}
                                          className={`text-sm cursor-pointer flex-1 ${
                                            selectedEntities.has(entity.name)
                                              ? "text-gray-700"
                                              : "text-gray-400"
                                          }`}
                                        >
                                          {activity.name}
                                        </label>
                                        {activity.lifecycleSlot && (
                                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                            {activity.lifecycleSlot.replace(/_/g, " ")}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Properties */}
                                {entityProperties.length > 0 && (
                                  <div className="space-y-1">
                                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                      Suggested Properties
                                    </div>
                                    {entityProperties.map((prop) => (
                                      <div
                                        key={`${prop.entityName}-${prop.propertyName}`}
                                        className="flex items-center gap-3 py-1 pl-4"
                                      >
                                        <Checkbox
                                          checked={prop.isSelected}
                                          onCheckedChange={() =>
                                            toggleProperty(prop.entityName, prop.propertyName)
                                          }
                                          id={`prop-${prop.entityName}-${prop.propertyName}`}
                                          disabled={!selectedEntities.has(entity.name)}
                                        />
                                        <label
                                          htmlFor={`prop-${prop.entityName}-${prop.propertyName}`}
                                          className={`text-sm cursor-pointer flex-1 ${
                                            selectedEntities.has(entity.name)
                                              ? "text-gray-700"
                                              : "text-gray-400"
                                          }`}
                                        >
                                          {prop.propertyName}
                                        </label>
                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                          {prop.dataType}
                                        </span>
                                        {prop.isRequired && (
                                          <span className="text-xs text-orange-600">required</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ALREADY EXISTS Section */}
                  {(diff.existingEntities.length > 0 || diff.existingActivities.length > 0) && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                        <Check className="w-4 h-4" />
                        Already Exists (will be skipped)
                      </div>

                      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 space-y-2">
                        {diff.existingEntities.map((entity) => (
                          <div
                            key={entity.name}
                            className="flex items-center justify-between text-sm text-gray-500"
                          >
                            <span>{entity.name}</span>
                            <span className="text-xs">
                              {entity.matchedActivityCount} activities
                            </span>
                          </div>
                        ))}
                        {diff.existingActivities.map((activity) => (
                          <div
                            key={activity.name}
                            className="text-sm text-gray-500 pl-4"
                          >
                            {activity.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : diff ? (
                <div className="text-center py-8 text-gray-500">
                  <Minus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>All items from this journey are already in your measurement plan.</p>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={
              !selectedJourneyId ||
              isDiffLoading ||
              !hasSelections ||
              isSubmitting
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Importing...
              </>
            ) : (
              "Import Selected"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
