import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { Plus, Sparkles } from "lucide-react";
import {
  getPropertyTemplates,
  type PropertyTemplate,
  DATA_TYPES,
} from "../../lib/propertyTemplates";

interface AddPropertyDialogProps {
  entityId: Id<"measurementEntities">;
  entityName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddPropertyDialog({
  entityId,
  entityName,
  isOpen,
  onClose,
  onSuccess,
}: AddPropertyDialogProps) {
  const [name, setName] = useState("");
  const [dataType, setDataType] = useState<string>("string");
  const [description, setDescription] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const createProperty = useMutation(api.measurementPlan.createProperty);
  const existingProperties = useQuery(
    api.measurementPlan.listPropertiesByEntity,
    { entityId }
  );

  // Get template suggestions based on entity name
  const templates = getPropertyTemplates(entityName);
  const existingNames = new Set(existingProperties?.map((p) => p.name) ?? []);
  const availableTemplates = templates.filter(
    (t) => !existingNames.has(t.name)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Property name is required");
      return;
    }

    setError(null);
    setIsCreating(true);

    try {
      await createProperty({
        entityId,
        name: name.trim(),
        dataType,
        description: description.trim() || undefined,
        isRequired,
        suggestedFrom: "manual",
      });
      resetForm();
      onClose();
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create property"
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddFromTemplate = async (template: PropertyTemplate) => {
    setIsCreating(true);
    setError(null);

    try {
      await createProperty({
        entityId,
        name: template.name,
        dataType: template.dataType,
        description: template.description,
        isRequired: template.isRequired,
        suggestedFrom: "template",
      });
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add property");
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDataType("string");
    setDescription("");
    setIsRequired(false);
    setError(null);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Property to {entityName}</DialogTitle>
          <DialogDescription>
            Define a property that should be tracked on this entity.
          </DialogDescription>
        </DialogHeader>

        {/* Template Suggestions */}
        {availableTemplates.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Sparkles className="h-4 w-4" />
              <span>Suggested properties</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableTemplates.slice(0, 5).map((template) => (
                <Button
                  key={template.name}
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddFromTemplate(template)}
                  disabled={isCreating}
                  className="text-xs"
                  title={template.description}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {template.name}
                  <span className="ml-1 text-gray-400">
                    ({template.dataType})
                  </span>
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="border-t pt-4">
          <p className="text-sm text-gray-600 mb-4">
            Or create a custom property:
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., plan_type, created_at"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataType">Data Type</Label>
              <Select value={dataType} onValueChange={setDataType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATA_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this property represent?"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isRequired"
                checked={isRequired}
                onCheckedChange={(checked) => setIsRequired(checked === true)}
              />
              <Label htmlFor="isRequired" className="font-normal">
                Required for analytics
              </Label>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating || !name.trim()}>
                {isCreating ? "Creating..." : "Create Property"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
