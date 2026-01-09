import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Trash2 } from "lucide-react";
import { LIFECYCLE_SLOTS } from "./lifecycleSlots";

interface EditActivityModalProps {
  open: boolean;
  onClose: () => void;
  activity: Doc<"measurementActivities"> | null;
}

export function EditActivityModal({
  open,
  onClose,
  activity,
}: EditActivityModalProps) {
  const updateActivity = useMutation(api.measurementPlan.updateActivity);
  const deleteActivity = useMutation(api.measurementPlan.deleteActivity);

  // Form state
  const [name, setName] = useState("");
  const [lifecycleSlot, setLifecycleSlot] = useState<string>("");
  const [isFirstValue, setIsFirstValue] = useState(false);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync form state with activity prop when it changes
  useEffect(() => {
    if (activity) {
      setName(activity.name);
      setLifecycleSlot(activity.lifecycleSlot ?? "");
      setIsFirstValue(activity.isFirstValue);
      setDescription(activity.description ?? "");
      setShowDeleteConfirm(false);
      setError(null);
    }
  }, [activity]);

  const handleUpdate = async () => {
    if (!activity) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await updateActivity({
        id: activity._id,
        name: name.trim(),
        lifecycleSlot: lifecycleSlot || undefined,
        isFirstValue,
        description: description.trim() || undefined,
      });
      onClose();
    } catch (err) {
      console.error("Failed to update activity:", err);
      setError(err instanceof Error ? err.message : "Failed to update activity");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!activity) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await deleteActivity({ id: activity._id });
      onClose();
    } catch (err) {
      console.error("Failed to delete activity:", err);
      setError(err instanceof Error ? err.message : "Failed to delete activity");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = name.trim() && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Activity</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Activity Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-activity-name">Activity Name</Label>
            <Input
              id="edit-activity-name"
              placeholder="e.g., Account Created"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Lifecycle Slot */}
          <div className="space-y-2">
            <Label htmlFor="edit-lifecycle-select">Lifecycle</Label>
            <Select value={lifecycleSlot} onValueChange={setLifecycleSlot}>
              <SelectTrigger id="edit-lifecycle-select" aria-label="Lifecycle">
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
              id="edit-first-value"
              checked={isFirstValue}
              onCheckedChange={(checked) => setIsFirstValue(checked === true)}
            />
            <Label htmlFor="edit-first-value" className="cursor-pointer">
              First Value
            </Label>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description (optional)</Label>
            <Input
              id="edit-description"
              placeholder="What does this activity represent?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Delete Section */}
          <div className="pt-4 border-t">
            {showDeleteConfirm ? (
              <div className="space-y-2">
                <p className="text-sm text-red-600">
                  Are you sure you want to delete this activity?
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                  >
                    Yes, Delete
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Activity
              </Button>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={!canSubmit}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
