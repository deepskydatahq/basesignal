import { useState, useMemo, useEffect } from "react";
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
import { Loader2 } from "lucide-react";

interface GeneratePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  journeyId: Id<"journeys">;
  onComplete: () => void;
}

export function GeneratePlanModal({
  isOpen,
  onClose,
  journeyId,
  onComplete,
}: GeneratePlanModalProps) {
  const extractedData = useQuery(api.measurementPlan.extractFromJourney, {
    journeyId,
  });
  const importFromJourney = useMutation(api.measurementPlan.importFromJourney);

  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(
    new Set()
  );
  const [selectedActivities, setSelectedActivities] = useState<Set<string>>(
    new Set()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize selections when data loads
  useEffect(() => {
    if (extractedData?.entities) {
      const allEntities = new Set(extractedData.entities.map((e) => e.name));
      const allActivities = new Set(
        extractedData.entities.flatMap((e) => e.activities.map((a) => a.name))
      );
      setSelectedEntities(allEntities);
      setSelectedActivities(allActivities);
    }
  }, [extractedData]);

  const toggleEntity = (entityName: string) => {
    setSelectedEntities((prev) => {
      const next = new Set(prev);
      if (next.has(entityName)) {
        next.delete(entityName);
      } else {
        next.add(entityName);
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

  const hasSelections = useMemo(() => {
    return selectedEntities.size > 0 || selectedActivities.size > 0;
  }, [selectedEntities, selectedActivities]);

  const handleCreatePlan = async () => {
    setIsSubmitting(true);
    try {
      await importFromJourney({
        journeyId,
        selectedEntities: Array.from(selectedEntities),
        selectedActivities: Array.from(selectedActivities),
      });
      onComplete();
    } catch (error) {
      console.error("Failed to create measurement plan:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = extractedData === undefined;
  const isEmpty = extractedData?.entities?.length === 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Measurement Plan</DialogTitle>
          <DialogDescription>
            From your Overview Interview, we found these entities and
            activities. Select what to include in your measurement plan.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading...
            </div>
          ) : isEmpty ? (
            <div className="text-center py-8 text-gray-500">
              No activities found. Complete Overview Interview to generate your
              measurement plan.
            </div>
          ) : (
            <div className="space-y-6">
              {extractedData.entities.map((entity) => (
                <div
                  key={entity.name}
                  className="border rounded-lg overflow-hidden"
                >
                  {/* Entity Header */}
                  <div className="bg-gray-50 px-4 py-3 flex items-center gap-3 border-b">
                    <Checkbox
                      checked={selectedEntities.has(entity.name)}
                      onCheckedChange={() => toggleEntity(entity.name)}
                      id={`entity-${entity.name}`}
                    />
                    <label
                      htmlFor={`entity-${entity.name}`}
                      className="font-medium text-gray-900 cursor-pointer"
                    >
                      {entity.name}
                    </label>
                    <span className="text-xs text-gray-500">
                      ({entity.activities.length} activities)
                    </span>
                  </div>

                  {/* Activities */}
                  <div className="px-4 py-2 space-y-2">
                    {entity.activities.map((activity) => (
                      <div
                        key={activity.name}
                        className="flex items-center gap-3 py-1"
                      >
                        <Checkbox
                          checked={selectedActivities.has(activity.name)}
                          onCheckedChange={() => toggleActivity(activity.name)}
                          id={`activity-${activity.name}`}
                        />
                        <label
                          htmlFor={`activity-${activity.name}`}
                          className="text-sm text-gray-700 cursor-pointer flex-1"
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
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleCreatePlan}
            disabled={isLoading || isEmpty || !hasSelections || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              "Create Plan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
