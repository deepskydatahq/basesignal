import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import {
  Pencil,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface EntityCardProps {
  id: Id<"measurementEntities">;
  name: string;
  description?: string;
  suggestedFrom?: string;
  activityCount: number;
  propertyCount: number;
  children?: React.ReactNode;
  defaultExpanded?: boolean;
}

export function EntityCard({
  id,
  name,
  description,
  suggestedFrom,
  activityCount,
  propertyCount,
  children,
  defaultExpanded = false,
}: EntityCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [editDescription, setEditDescription] = useState(description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const updateEntity = useMutation(api.measurementPlan.updateEntity);
  const deleteEntity = useMutation(api.measurementPlan.deleteEntity);

  const handleSave = async () => {
    if (!editName.trim()) {
      setError("Name is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await updateEntity({
        id,
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      });
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update entity");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditName(name);
    setEditDescription(description ?? "");
    setIsEditing(false);
    setError(null);
  };

  const handleDelete = () => {
    const hasChildren = activityCount > 0 || propertyCount > 0;
    const message = hasChildren
      ? `This entity has ${activityCount} activities and ${propertyCount} properties that will also be deleted. Delete entity "${name}"?`
      : `Delete entity "${name}"?`;

    if (window.confirm(message)) {
      deleteEntity({ id }).catch((err) => {
        console.error("Failed to delete entity:", err);
      });
    }
  };

  const formatSuggestedFrom = (source: string) => {
    return source.replace(/_/g, " ");
  };

  if (isEditing) {
    return (
      <div className="border rounded-lg bg-white">
        <div className="p-4 space-y-3">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Entity name"
              disabled={isSaving}
            />
            <Input
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description (optional)"
              disabled={isSaving}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              <Check className="h-4 w-4 mr-1" />
              Save
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 group">
        <button
          type="button"
          className="flex items-center gap-2 flex-1 text-left"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500 flex-shrink-0" />
          )}
          <span className="font-medium text-gray-900">{name}</span>
          <div className="flex items-center gap-2 ml-2">
            <span className="text-xs text-gray-500">
              {activityCount} {activityCount === 1 ? "activity" : "activities"}
            </span>
            <span className="text-xs text-gray-400">|</span>
            <span className="text-xs text-gray-500">
              {propertyCount} {propertyCount === 1 ? "property" : "properties"}
            </span>
            {suggestedFrom && (
              <Badge variant="outline" className="text-xs text-blue-600">
                from {formatSuggestedFrom(suggestedFrom)}
              </Badge>
            )}
          </div>
        </button>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content (when expanded) */}
      {isExpanded && children && (
        <div className="px-4 pb-4 pl-10 border-t">
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  );
}
