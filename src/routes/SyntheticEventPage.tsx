import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft } from "lucide-react";

const TIME_WINDOWS = [
  { value: "7d", label: "7 days" },
  { value: "14d", label: "14 days" },
  { value: "30d", label: "30 days" },
  { value: "60d", label: "60 days" },
];

const CONDITIONS = [
  { value: "all", label: "All events must occur" },
  { value: "any", label: "Any event triggers" },
  { value: "n_of", label: "N or more events occur" },
];

export default function SyntheticEventPage() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const navigate = useNavigate();

  const connection = useQuery(api.amplitude.getById, {
    id: connectionId as Id<"amplitudeConnections">,
  });
  const activities = useQuery(api.activityDefinitions.listByConnection, {
    connectionId: connectionId as Id<"amplitudeConnections">,
  });

  const createActivity = useMutation(api.activityDefinitions.create);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [condition, setCondition] = useState("all");
  const [count, setCount] = useState(2);
  const [timeWindow, setTimeWindow] = useState("14d");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get simple activities as source events for synthetic
  const simpleActivities = activities?.filter(a => a.type === "simple") || [];
  // Also include selected Amplitude events
  const availableEvents = [
    ...(connection?.selectedEvents || []),
    ...simpleActivities.map(a => a.name),
  ];

  const toggleEvent = (event: string) => {
    setSelectedEvents(prev =>
      prev.includes(event)
        ? prev.filter(e => e !== event)
        : [...prev, event]
    );
  };

  const handleCreate = async () => {
    if (!connectionId || !name || selectedEvents.length < 2) {
      setError("Please provide a name and select at least 2 events");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await createActivity({
        connectionId: connectionId as Id<"amplitudeConnections">,
        name,
        description: description || undefined,
        type: "synthetic",
        syntheticRule: {
          events: selectedEvents,
          condition,
          count: condition === "n_of" ? count : undefined,
          timeWindow,
        },
      });
      navigate(`/sources/amplitude/${connectionId}/activities`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setIsCreating(false);
    }
  };

  if (!connection) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-6 max-w-2xl">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => navigate(`/sources/amplitude/${connectionId}/activities`)}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Activities
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Create Synthetic Activity</CardTitle>
          <CardDescription>
            Combine multiple events into a single meaningful activity.
            For example, "completed onboarding" when a user does signup, profile setup, AND first action.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Activity Name</Label>
            <Input
              id="name"
              placeholder="e.g., completed_onboarding"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Use snake_case. This is the canonical name you'll use in value rules.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              placeholder="e.g., User completed all onboarding steps"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Source Events (select 2 or more)</Label>
            <div className="border rounded-md p-4 max-h-48 overflow-y-auto space-y-2">
              {availableEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No events available. Create simple activity mappings first.
                </p>
              ) : (
                availableEvents.map((event) => (
                  <div key={event} className="flex items-center space-x-2">
                    <Checkbox
                      id={event}
                      checked={selectedEvents.includes(event)}
                      onCheckedChange={() => toggleEvent(event)}
                    />
                    <label
                      htmlFor={event}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {event}
                    </label>
                  </div>
                ))
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Selected: {selectedEvents.length} events
            </p>
          </div>

          <div className="space-y-2">
            <Label>Condition</Label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {condition === "n_of" && (
            <div className="space-y-2">
              <Label>Minimum Events Required</Label>
              <Input
                type="number"
                min={1}
                max={selectedEvents.length || 10}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value) || 1)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Time Window</Label>
            <Select value={timeWindow} onValueChange={setTimeWindow}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_WINDOWS.map((tw) => (
                  <SelectItem key={tw.value} value={tw.value}>
                    {tw.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              All selected events must occur within this time window.
            </p>
          </div>

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
              {error}
            </div>
          )}

          <Button
            onClick={handleCreate}
            disabled={isCreating || !name || selectedEvents.length < 2}
            className="w-full"
          >
            {isCreating ? "Creating..." : "Create Synthetic Activity"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
