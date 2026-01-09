import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { FileText, Download, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { ImportFromJourneyModal } from "@/components/measurement/ImportFromJourneyModal";
import { AddPropertyDialog } from "@/components/measurement/AddPropertyDialog";
import { AddActivityModal } from "@/components/measurement/AddActivityModal";
import { PropertyList } from "@/components/measurement/PropertyList";

export default function MeasurementPlanPage() {
  const fullPlan = useQuery(api.measurementPlan.getFullPlan);
  const entities = useQuery(api.measurementPlan.listEntities);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityEntityId, setActivityEntityId] = useState<Id<"measurementEntities"> | undefined>();
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());
  const [addPropertyFor, setAddPropertyFor] = useState<{
    entityId: Id<"measurementEntities">;
    entityName: string;
  } | null>(null);

  const toggleEntity = (entityId: string) => {
    setExpandedEntities((prev) => {
      const next = new Set(prev);
      if (next.has(entityId)) {
        next.delete(entityId);
      } else {
        next.add(entityId);
      }
      return next;
    });
  };

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
          <Button onClick={() => { setActivityEntityId(undefined); setShowActivityModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Activity
          </Button>
          <Button onClick={() => setShowImportModal(true)}>
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
          {fullPlan.map(({ entity, activities, properties }) => {
            const isExpanded = expandedEntities.has(entity._id);

            return (
              <div
                key={entity._id}
                className="border rounded-lg overflow-hidden bg-white"
              >
                {/* Entity Header */}
                <button
                  type="button"
                  onClick={() => toggleEntity(entity._id)}
                  className="w-full px-4 py-3 flex items-center gap-3 bg-gray-50 hover:bg-gray-100 transition-colors border-b"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                  <span className="font-medium text-gray-900">{entity.name}</span>
                  <span className="text-xs text-gray-500">
                    {activities.length} activities, {properties.length} properties
                  </span>
                  {entity.suggestedFrom && (
                    <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      from {entity.suggestedFrom.replace(/_/g, " ")}
                    </span>
                  )}
                </button>

                {/* Entity Content */}
                {isExpanded && (
                  <div className="p-4 space-y-4">
                    {/* Description */}
                    {entity.description && (
                      <p className="text-sm text-gray-600">{entity.description}</p>
                    )}

                    {/* Activities */}
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
                              className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">
                                  {activity.name}
                                </span>
                                {activity.isFirstValue && (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                    First Value
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {activity.lifecycleSlot && (
                                  <span className="text-xs text-gray-500">
                                    {activity.lifecycleSlot.replace(/_/g, " ")}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Properties */}
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

                  </div>
                )}
              </div>
            );
          })}
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
    </div>
  );
}
