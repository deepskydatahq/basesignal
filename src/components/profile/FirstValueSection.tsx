import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ProfileSection, type ProfileSectionStatus } from "./ProfileSection";
import { INTERVIEW_TYPES } from "@/shared/interviewTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, X } from "lucide-react";

const TIMEFRAME_OPTIONS = [
  "Within 1 day",
  "Within 3 days",
  "Within 1 week",
  "Within 2 weeks",
  "Within 1 month",
];

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

interface FirstValueSectionProps {
  readOnly?: boolean;
}

export function FirstValueSection({ readOnly = false }: FirstValueSectionProps) {
  const definition = useQuery(api.firstValue.getDefinition);
  const updateDefinition = useMutation(api.firstValue.updateDefinition);
  const [isEditing, setIsEditing] = useState(false);
  const [activityName, setActivityName] = useState("");
  const [expectedTimeframe, setExpectedTimeframe] = useState(
    TIMEFRAME_OPTIONS[1]
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Three states: not_started (null), in_progress (defined but not confirmed), complete (confirmed)
  const status: ProfileSectionStatus = !definition
    ? "not_started"
    : definition.confirmedAt
      ? "complete"
      : "in_progress";

  const statusLabel = !definition
    ? "Not Started"
    : definition.confirmedAt
      ? "Complete"
      : "In Progress";

  const actionLabel = definition ? "Edit" : "Define";

  const handleEditClick = () => {
    if (definition) {
      setActivityName(definition.activityName);
      setExpectedTimeframe(definition.expectedTimeframe);
    } else {
      setActivityName("");
      setExpectedTimeframe(TIMEFRAME_OPTIONS[1]);
    }
    setError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!activityName.trim()) {
      setError("Activity name is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await updateDefinition({
        activityName: activityName.trim(),
        reasoning: "",
        expectedTimeframe,
      });
      setIsEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <ProfileSection
        title="First Value Moment"
        status={status}
        statusLabel={statusLabel}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="activityName">Activity name</Label>
            <Input
              id="activityName"
              value={activityName}
              onChange={(e) => setActivityName(e.target.value)}
              placeholder="e.g., Report Created"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expectedTimeframe">Expected timeframe</Label>
            <Select
              value={expectedTimeframe}
              onValueChange={setExpectedTimeframe}
            >
              <SelectTrigger id="expectedTimeframe">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAME_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              <Check className="w-4 h-4 mr-1" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </ProfileSection>
    );
  }

  if (!definition) {
    return (
      <ProfileSection
        title="First Value Moment"
        status={status}
        statusLabel={statusLabel}
        actionLabel={readOnly ? undefined : actionLabel}
        onAction={readOnly ? undefined : handleEditClick}
        timeEstimate={readOnly ? undefined : `~${INTERVIEW_TYPES.first_value.estimatedMinutes} min`}
      >
        <div>
          <p className="font-medium text-gray-900">What moment turns a visitor into a believer?</p>
          <p className="text-gray-600 text-sm mt-1">
            Finding your first value reveals whether you're activating users fast enough.
          </p>
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700">What you'll define:</p>
            <ul className="mt-2 space-y-1">
              <li className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-primary mt-0.5">✦</span>
                <span>Your product's key entities (users, accounts, workspaces)</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-primary mt-0.5">✦</span>
                <span>The moment a user becomes "activated"</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-primary mt-0.5">✦</span>
                <span>What makes a user "active" in your product</span>
              </li>
            </ul>
          </div>
        </div>
      </ProfileSection>
    );
  }

  return (
    <ProfileSection
      title="First Value Moment"
      status={status}
      statusLabel={statusLabel}
      actionLabel={readOnly ? undefined : actionLabel}
      onAction={readOnly ? undefined : handleEditClick}
    >
      <div className="space-y-3">
        <div>
          <span className="text-sm text-gray-500">Activity</span>
          <p className="text-gray-900 font-medium">{definition.activityName}</p>
        </div>
        <div>
          <span className="text-sm text-gray-500">Expected</span>
          <p className="text-gray-900">{definition.expectedTimeframe}</p>
        </div>
        {definition.confirmedAt && (
          <div>
            <span className="text-sm text-gray-500">Status</span>
            <p className="text-green-600 flex items-center gap-1">
              <Check className="w-4 h-4" />
              Confirmed {formatDate(definition.confirmedAt)}
            </p>
          </div>
        )}
      </div>
    </ProfileSection>
  );
}
