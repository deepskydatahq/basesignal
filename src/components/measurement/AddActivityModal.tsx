import { useState, useEffect, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id, Doc } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  parseActivityName,
  validateActivityFormat,
} from "../../shared/validation";

const LIFECYCLE_SLOTS = [
  { value: "account_creation", label: "Account Creation" },
  { value: "activation", label: "Activation" },
  { value: "core_usage", label: "Core Usage" },
  { value: "revenue", label: "Revenue" },
  { value: "churn", label: "Churn" },
];

interface AddActivityModalProps {
  open: boolean;
  onClose: () => void;
  entities: Doc<"measurementEntities">[];
  preselectedEntityId?: Id<"measurementEntities">;
}

export function AddActivityModal({
  open,
  onClose,
  entities,
  preselectedEntityId,
}: AddActivityModalProps) {
  const createActivity = useMutation(api.measurementPlan.createActivity);
  const createEntity = useMutation(api.measurementPlan.createEntity);

  // Form state
  const [activityName, setActivityName] = useState("");
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");
  const [lifecycleSlot, setLifecycleSlot] = useState<string>("");
  const [isFirstValue, setIsFirstValue] = useState(false);
  const [description, setDescription] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Parse activity name to extract entity and action
  const parsed = useMemo(() => {
    return parseActivityName(activityName);
  }, [activityName]);

  // Find suggested entity based on parsed entity name
  const suggestedEntity = useMemo(() => {
    if (!parsed.entity) return null;
    return entities.find(
      (e) => e.name.toLowerCase() === parsed.entity.toLowerCase()
    );
  }, [parsed.entity, entities]);

  // Check if parsed entity doesn't exist (for "create entity" button)
  const missingEntity = useMemo(() => {
    if (!parsed.entity) return null;
    const exists = entities.some(
      (e) => e.name.toLowerCase() === parsed.entity.toLowerCase()
    );
    return exists ? null : parsed.entity;
  }, [parsed.entity, entities]);

  // Auto-select entity when suggestion matches
  useEffect(() => {
    if (suggestedEntity && !selectedEntityId) {
      setSelectedEntityId(suggestedEntity._id);
    }
  }, [suggestedEntity, selectedEntityId]);

  // Set preselected entity on mount
  useEffect(() => {
    if (preselectedEntityId) {
      setSelectedEntityId(preselectedEntityId);
    }
  }, [preselectedEntityId]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      setActivityName("");
      setSelectedEntityId(preselectedEntityId ?? "");
      setLifecycleSlot("");
      setIsFirstValue(false);
      setDescription("");
      setValidationError(null);
    }
  }, [open, preselectedEntityId]);

  const handleCreateEntity = async () => {
    if (!missingEntity) return;

    try {
      const newEntityId = await createEntity({
        name: missingEntity,
        suggestedFrom: "manual",
      });
      setSelectedEntityId(newEntityId);
    } catch (error) {
      console.error("Failed to create entity:", error);
    }
  };

  const handleSubmit = async () => {
    // Validate format
    const validation = validateActivityFormat(parsed.entity, parsed.action);
    if (!validation.valid) {
      setValidationError(validation.error ?? "Invalid activity format");
      return;
    }

    if (!selectedEntityId) {
      setValidationError("Please select an entity");
      return;
    }

    setValidationError(null);
    setIsSubmitting(true);

    try {
      await createActivity({
        entityId: selectedEntityId as Id<"measurementEntities">,
        name: activityName.trim(),
        action: parsed.action,
        description: description.trim() || undefined,
        lifecycleSlot: lifecycleSlot || undefined,
        isFirstValue,
        suggestedFrom: "manual",
      });
      onClose();
    } catch (error) {
      console.error("Failed to create activity:", error);
      setValidationError("Failed to create activity");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = activityName.trim() && selectedEntityId && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Activity</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Activity Name */}
          <div className="space-y-2">
            <Label htmlFor="activity-name">Activity Name</Label>
            <Input
              id="activity-name"
              placeholder="e.g., Account Created"
              value={activityName}
              onChange={(e) => setActivityName(e.target.value)}
            />
            {suggestedEntity && (
              <p className="text-sm text-green-600">
                Suggested: {suggestedEntity.name}
              </p>
            )}
            {missingEntity && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCreateEntity}
              >
                Create {missingEntity} entity
              </Button>
            )}
          </div>

          {/* Entity Select */}
          <div className="space-y-2">
            <Label htmlFor="entity-select">Entity</Label>
            <Select
              value={selectedEntityId}
              onValueChange={setSelectedEntityId}
            >
              <SelectTrigger id="entity-select" aria-label="Entity">
                <SelectValue placeholder="Select an entity" />
              </SelectTrigger>
              <SelectContent>
                {entities.map((entity) => (
                  <SelectItem key={entity._id} value={entity._id}>
                    {entity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lifecycle Slot */}
          <div className="space-y-2">
            <Label htmlFor="lifecycle-select">Lifecycle</Label>
            <Select value={lifecycleSlot} onValueChange={setLifecycleSlot}>
              <SelectTrigger id="lifecycle-select" aria-label="Lifecycle">
                <SelectValue placeholder="Select lifecycle stage" />
              </SelectTrigger>
              <SelectContent>
                {LIFECYCLE_SLOTS.map((slot) => (
                  <SelectItem key={slot.value} value={slot.value}>
                    {slot.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* First Value Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="first-value"
              checked={isFirstValue}
              onCheckedChange={(checked) => setIsFirstValue(checked === true)}
            />
            <Label htmlFor="first-value" className="cursor-pointer">
              First Value
            </Label>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              placeholder="What does this activity represent?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Validation Error */}
          {validationError && (
            <p className="text-sm text-red-600">{validationError}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            Add Activity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
