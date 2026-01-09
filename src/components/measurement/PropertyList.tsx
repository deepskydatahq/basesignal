import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { DATA_TYPES } from "../../lib/propertyTemplates";

interface PropertyListProps {
  properties: Doc<"measurementProperties">[];
}

export function PropertyList({ properties }: PropertyListProps) {
  if (properties.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic py-2">
        No properties defined yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {properties.map((property) => (
        <PropertyRow key={property._id} property={property} />
      ))}
    </div>
  );
}

function PropertyRow({ property }: { property: Doc<"measurementProperties"> }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(property.name);
  const [editDataType, setEditDataType] = useState(property.dataType);
  const [editDescription, setEditDescription] = useState(
    property.description ?? ""
  );
  const [editIsRequired, setEditIsRequired] = useState(property.isRequired);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const updateProperty = useMutation(api.measurementPlan.updateProperty);
  const deleteProperty = useMutation(api.measurementPlan.deleteProperty);

  const handleSave = async () => {
    if (!editName.trim()) {
      setError("Name is required");
      return;
    }

    setIsSaving(true);
    try {
      await updateProperty({
        id: property._id,
        name: editName.trim(),
        dataType: editDataType,
        description: editDescription.trim() || undefined,
        isRequired: editIsRequired,
      });
      setIsEditing(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditName(property.name);
    setEditDataType(property.dataType);
    setEditDescription(property.description ?? "");
    setEditIsRequired(property.isRequired);
    setIsEditing(false);
    setError(null);
  };

  const handleDelete = async () => {
    try {
      await deleteProperty({ id: property._id });
      setIsDeleteDialogOpen(false);
    } catch (err) {
      console.error("Failed to delete property:", err);
    }
  };

  const dataTypeBadgeColor: Record<string, string> = {
    string: "bg-blue-100 text-blue-800",
    number: "bg-green-100 text-green-800",
    boolean: "bg-purple-100 text-purple-800",
    timestamp: "bg-orange-100 text-orange-800",
  };

  if (isEditing) {
    return (
      <div className="p-3 border rounded-lg bg-gray-50 space-y-3">
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div className="flex gap-2">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Property name"
            className="flex-1"
          />
          <Select value={editDataType} onValueChange={setEditDataType}>
            <SelectTrigger className="w-32">
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
        <Input
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          placeholder="Description (optional)"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`required-${property._id}`}
              checked={editIsRequired}
              onCheckedChange={(checked) => setEditIsRequired(checked === true)}
            />
            <label htmlFor={`required-${property._id}`} className="text-sm">
              Required
            </label>
          </div>
          <div className="flex gap-1">
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md group">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-medium text-gray-900">
            {property.name}
          </span>
          <Badge
            variant="secondary"
            className={dataTypeBadgeColor[property.dataType] ?? "bg-gray-100"}
          >
            {property.dataType}
          </Badge>
          {property.isRequired && (
            <span className="text-xs text-orange-600">required</span>
          )}
          {property.suggestedFrom === "template" && (
            <Badge variant="outline" className="text-xs text-blue-600">
              template
            </Badge>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Property</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{property.name}"? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
