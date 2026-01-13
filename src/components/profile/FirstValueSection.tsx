import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ProfileSection, ProfileSectionStatus } from "./ProfileSection";
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

export function FirstValueSection() {
  const definition = useQuery(api.firstValue.getDefinition);
  const [isEditing, setIsEditing] = useState(false);
  const [activityName, setActivityName] = useState("");
  const [expectedTimeframe, setExpectedTimeframe] = useState(
    TIMEFRAME_OPTIONS[1]
  );

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
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
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
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button size="sm">
              <Check className="w-4 h-4 mr-1" />
              Save
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
        actionLabel={actionLabel}
        onAction={handleEditClick}
      >
        <p className="text-gray-500 italic">
          Define the moment when users first experience value from your product.
        </p>
      </ProfileSection>
    );
  }

  return (
    <ProfileSection
      title="First Value Moment"
      status={status}
      statusLabel={statusLabel}
      actionLabel={actionLabel}
      onAction={handleEditClick}
    >
      <div className="space-y-2">
        <p className="text-gray-900 font-medium">{definition.activityName}</p>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>Expected: {definition.expectedTimeframe}</span>
          {definition.confirmedAt && (
            <span>Confirmed: {formatDate(definition.confirmedAt)}</span>
          )}
        </div>
      </div>
    </ProfileSection>
  );
}
