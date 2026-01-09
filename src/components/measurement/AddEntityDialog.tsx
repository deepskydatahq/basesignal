import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface AddEntityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddEntityDialog({
  isOpen,
  onClose,
  onSuccess,
}: AddEntityDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createEntity = useMutation(api.measurementPlan.createEntity);

  // Reset form state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setName("");
      setDescription("");
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate name is not empty
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await createEntity({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Failed to create entity:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create entity";
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isNameEmpty = !name.trim();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Entity</DialogTitle>
          <DialogDescription>
            Create a new entity for your measurement plan. Entities represent
            the key objects in your product (e.g., User, Account, Subscription).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="py-4 space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="entity-name">Name</Label>
              <Input
                id="entity-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., User, Account, Subscription"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="entity-description">Description (optional)</Label>
              <Textarea
                id="entity-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this entity represents..."
                disabled={isSubmitting}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isNameEmpty || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                "Create Entity"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
