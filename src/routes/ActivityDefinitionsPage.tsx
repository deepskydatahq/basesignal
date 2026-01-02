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
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, ArrowRight, Settings } from "lucide-react";

export default function ActivityDefinitionsPage() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const navigate = useNavigate();

  const connection = useQuery(api.amplitude.getById, {
    id: connectionId as Id<"amplitudeConnections">,
  });
  const activities = useQuery(api.activityDefinitions.listByConnection, {
    connectionId: connectionId as Id<"amplitudeConnections">,
  });

  const createActivity = useMutation(api.activityDefinitions.create);
  const removeActivity = useMutation(api.activityDefinitions.remove);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newActivityName, setNewActivityName] = useState("");
  const [newActivitySourceEvent, setNewActivitySourceEvent] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateActivity = async () => {
    if (!connectionId || !newActivityName || !newActivitySourceEvent) return;

    setIsCreating(true);
    try {
      await createActivity({
        connectionId: connectionId as Id<"amplitudeConnections">,
        name: newActivityName,
        type: "simple",
        sourceEvent: newActivitySourceEvent,
      });
      setNewActivityName("");
      setNewActivitySourceEvent("");
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Failed to create activity:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRemoveActivity = async (activityId: Id<"activityDefinitions">) => {
    try {
      await removeActivity({ id: activityId });
    } catch (error) {
      console.error("Failed to remove activity:", error);
    }
  };

  if (!connection) {
    return <div className="p-6">Loading...</div>;
  }

  // Get selected events from the connection to use as options
  const availableEvents = connection.selectedEvents || [];

  return (
    <div className="container mx-auto py-6 max-w-3xl">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => navigate(`/sources/amplitude/${connectionId}/account-mapping`)}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Account Mapping
      </Button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Activity Definitions</h1>
          <p className="text-muted-foreground">
            Map Amplitude events to canonical activities for your P&L model.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Activity
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Activity Mapping</DialogTitle>
              <DialogDescription>
                Map an Amplitude event to a canonical activity name.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="sourceEvent">Source Event (Amplitude)</Label>
                <Select
                  value={newActivitySourceEvent}
                  onValueChange={setNewActivitySourceEvent}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an event" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEvents.map((event) => (
                      <SelectItem key={event} value={event}>
                        {event}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="activityName">Activity Name (Canonical)</Label>
                <Input
                  id="activityName"
                  placeholder="e.g., completed_onboarding"
                  value={newActivityName}
                  onChange={(e) => setNewActivityName(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Use snake_case. This is the name you'll use in value rules.
                </p>
              </div>
              <Button
                onClick={handleCreateActivity}
                disabled={isCreating || !newActivityName || !newActivitySourceEvent}
                className="w-full"
              >
                {isCreating ? "Creating..." : "Create Activity"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2 mb-6">
        <Button
          variant="outline"
          onClick={() => navigate(`/sources/amplitude/${connectionId}/activities/synthetic`)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Synthetic
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate(`/sources/amplitude/${connectionId}/value-rules`)}
        >
          <Settings className="mr-2 h-4 w-4" />
          Value Rules
        </Button>
      </div>

      {activities === undefined ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : activities.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No activities defined yet. Click "Add Activity" to map your first
            Amplitude event.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <Card key={activity._id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {activity.sourceEvent}
                      </code>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="font-medium">{activity.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({activity.type})
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveActivity(activity._id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activities && activities.length > 0 && (
        <div className="mt-6">
          <Button
            onClick={() => navigate("/sources")}
            className="w-full"
          >
            Done - Back to Sources
          </Button>
        </div>
      )}
    </div>
  );
}
